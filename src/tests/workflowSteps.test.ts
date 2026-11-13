import {
  assertSafeUrl, executeAction, executeFilter, interpolate, isPrivateIp, runWorkflowGraph,
  type DbLike, type ServerStep, type StepContext, type StepDeps
} from '../../netlify/functions/_workflowSteps';

/** Records inserts/updates; every call resolves like supabase-js. */
function fakeDb(opts: { insertResult?: any; failTable?: string } = {}) {
  const calls: Array<{ table: string; op: string; payload?: any; filters: Array<[string, any]> }> = [];
  const db: DbLike = {
    from(table: string) {
      const rec = { table, op: 'select', payload: undefined as any, filters: [] as Array<[string, any]> };
      calls.push(rec);
      const result = () => (opts.failTable === table
        ? { data: null, error: { message: 'boom' } }
        : { data: opts.insertResult ?? { id: 'new-id' }, error: null });
      const chain: any = {
        insert(p: any) { rec.op = 'insert'; rec.payload = p; return chain; },
        update(p: any) { rec.op = 'update'; rec.payload = p; return chain; },
        select() { return chain; },
        eq(k: string, v: any) { rec.filters.push([k, v]); return chain; },
        single: async () => result(),
        maybeSingle: async () => result(),
        then(res: any, rej: any) { return Promise.resolve(result()).then(res, rej); }
      };
      return chain;
    }
  };
  return { db, calls };
}

const ctx = (over: Partial<StepContext> = {}): StepContext => ({
  recordId: 'deal-1', recordType: 'deal', inputData: { stage: 'proposal', value: 5000, title: 'Big deal' }, variables: {}, ...over
});

describe('interpolate', () => {
  it('resolves dotted paths and keeps unknown placeholders', () => {
    const c = ctx({ inputData: { deal: { title: 'Acme' }, value: 3 } });
    expect(interpolate({ s: 'Hi {{deal.title}} / {{value}} / {{missing}}' }, c)).toEqual({ s: 'Hi Acme / 3 / {{missing}}' });
  });
});

describe('filter', () => {
  it('halts the branch when the record does not match', () => {
    const a = { type: 'filter', config: { filterCriteria: { value: { operator: 'greater_than', value: 10000 } } } };
    expect(executeFilter(a, ctx()).halt).toBe(true);
    const b = { type: 'filter', config: { filterCriteria: { stage: 'proposal' } } };
    expect(executeFilter(b, ctx())).toMatchObject({ success: true, halt: false });
  });

  it('filters an upstream record list', () => {
    const a = { type: 'filter', config: { filterCriteria: { stage: 'won' } } };
    const r = executeFilter(a, ctx({ lastOutput: { records: [{ stage: 'won' }, { stage: 'lead' }] } }));
    expect(r.output).toEqual({ records: [{ stage: 'won' }], count: 1 });
  });
});

describe('create_task', () => {
  it('inserts an open task linked to the deal', async () => {
    const { db, calls } = fakeDb({ insertResult: { id: 't1' } });
    const r = await executeAction(
      { type: 'create_task', config: { fields: { title: 'Call {{title}}', dueInDays: 2 } } },
      ctx(), { db, now: () => new Date('2026-01-01T00:00:00Z') }
    );
    expect(r).toMatchObject({ success: true, output: { taskId: 't1' } });
    expect(calls[0]).toMatchObject({ table: 'tasks', op: 'insert' });
    expect(calls[0].payload).toMatchObject({
      title: 'Call Big deal', status: 'open', deal_id: 'deal-1', due_date: '2026-01-03T00:00:00.000Z', created_by_agent: true
    });
  });

  it('reports database errors', async () => {
    const { db } = fakeDb({ failTable: 'tasks' });
    const r = await executeAction({ type: 'create_task', config: {} }, ctx(), { db });
    expect(r).toMatchObject({ success: false, error: 'boom' });
  });
});

describe('update_record / send_email / create_note', () => {
  it('updates only whitelisted columns of the deal', async () => {
    const { db, calls } = fakeDb();
    await executeAction({ type: 'update_record', config: { fields: { priority: 'high', id: 'hack', created_by: 'x', 'bad col': 1 } } }, ctx(), { db });
    expect(calls[0].op).toBe('update');
    expect(calls[0].payload.priority).toBe('high');
    expect(calls[0].payload).not.toHaveProperty('id');
    expect(calls[0].payload).not.toHaveProperty('created_by');
    expect(calls[0].filters).toContainEqual(['id', 'deal-1']);
  });

  it('queues an outbound message', async () => {
    const { db, calls } = fakeDb();
    const r = await executeAction({ type: 'send_email', config: { recipients: ['a@b.co'], subject: 'Hi', body: 'Yo' } }, ctx(), { db });
    expect(r.success).toBe(true);
    expect(calls[0]).toMatchObject({ table: 'outbound_messages', op: 'insert' });
    expect(calls[0].payload[0]).toMatchObject({ recipient: 'a@b.co', status: 'queued', channel: 'email' });
  });

  it('rejects invalid email recipients and creates notes', async () => {
    const { db } = fakeDb();
    expect((await executeAction({ type: 'send_email', config: { recipients: ['nope'] } }, ctx(), { db })).success).toBe(false);
    expect((await executeAction({ type: 'create_note', config: { body: 'hello' } }, ctx(), { db })).success).toBe(true);
  });
});

describe('http safety', () => {
  it('detects private addresses', () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '192.168.1.5', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });

  it('only allows https to public hosts', async () => {
    const pub = async () => ['93.184.216.34'];
    await expect(assertSafeUrl('http://example.com', pub)).rejects.toThrow(/https/);
    await expect(assertSafeUrl('https://localhost/x', pub)).rejects.toThrow(/Blocked/);
    await expect(assertSafeUrl('https://10.0.0.1/x', pub)).rejects.toThrow(/private/);
    await expect(assertSafeUrl('https://evil.test/x', async () => ['10.1.1.1'])).rejects.toThrow(/private/);
    await expect(assertSafeUrl('https://example.com/x', pub)).resolves.toBeInstanceOf(URL);
  });

  it('performs the request through the injected fetch', async () => {
    const { db } = fakeDb();
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 })) as unknown as typeof fetch;
    const deps: StepDeps = { db, fetchImpl, resolveHost: async () => ['93.184.216.34'] };
    const r = await executeAction({ type: 'http_request', config: { httpUrl: 'https://example.com/hook', httpMethod: 'POST', httpBody: { a: 1 } } }, ctx(), deps);
    expect(r).toMatchObject({ success: true, output: { status: 200, data: { ok: 1 } } });
    const blocked = await executeAction({ type: 'http_request', config: { httpUrl: 'http://example.com' } }, ctx(), deps);
    expect(blocked.success).toBe(false);
  });
});

describe('ai_agent', () => {
  it('uses the injected completion function', async () => {
    const { db } = fakeDb();
    const ai = jest.fn(async () => 'draft reply');
    const r = await executeAction({ type: 'ai_agent', config: { aiAgentPrompt: 'Summarise {{title}}' } }, ctx(), { db, ai });
    expect(r.output).toEqual({ text: 'draft reply' });
    expect(ai.mock.calls[0][0]).toContain('Summarise Big deal');
  });
});

describe('runWorkflowGraph', () => {
  const steps: ServerStep[] = [
    { id: 't', type: 'trigger', connections: ['f'] },
    { id: 'f', type: 'action', action: { type: 'filter', config: { filterCriteria: { value: { operator: 'greater_than', value: 1000 } } } }, connections: ['task', 'd'] },
    { id: 'task', type: 'action', action: { type: 'create_task', config: { fields: { title: 'Follow up' } } }, connections: [] },
    { id: 'd', type: 'delay', delay: 30, connections: ['note'] },
    { id: 'note', type: 'action', action: { type: 'create_note', config: { body: 'later' } }, connections: [] }
  ];

  it('runs the branch, and schedules a resume for the delay', async () => {
    const { db, calls } = fakeDb();
    const r = await runWorkflowGraph(steps, ctx(), { db });
    expect(r.status).toBe('waiting');
    expect(r.steps.map(s => s.stepId)).toEqual(['t', 'f', 'task', 'd']);
    expect(r.resumes).toEqual([{ stepIds: ['note'], delayMinutes: 30, variables: {} }]);
    expect(calls.filter(c => c.table === 'tasks')).toHaveLength(1);
  });

  it('resumes from given steps', async () => {
    const { db, calls } = fakeDb();
    const r = await runWorkflowGraph(steps, ctx(), { db }, ['note']);
    expect(r.status).toBe('completed');
    expect(calls[0].table).toBe('notes');
  });

  it('stops the branch when a filter does not match', async () => {
    const { db, calls } = fakeDb();
    const r = await runWorkflowGraph(steps, ctx({ inputData: { value: 10 } }), { db });
    expect(r.status).toBe('completed');
    expect(r.steps.map(s => s.stepId)).toEqual(['t', 'f']);
    expect(calls).toHaveLength(0);
  });

  it('fails the run on an error unless continueOnError is set', async () => {
    const { db } = fakeDb({ failTable: 'tasks' });
    const r = await runWorkflowGraph(steps, ctx(), { db });
    expect(r.status).toBe('failed');
    expect(r.error).toMatchObject({ stepId: 'task', message: 'boom' });

    const lenient = steps.map(s => (s.id === 'task' ? { ...s, action: { ...s.action!, errorHandling: { continueOnError: true } } } : s));
    expect((await runWorkflowGraph(lenient, ctx(), { db })).status).toBe('waiting');
  });

  it('iterates downstream steps once per item', async () => {
    const { db, calls } = fakeDb();
    const loop: ServerStep[] = [
      { id: 'i', type: 'action', action: { type: 'iterator', config: { iteratorSource: 'records', iteratorVariable: 'row' } }, connections: ['n'] },
      { id: 'n', type: 'action', action: { type: 'create_note', config: { body: 'item {{row.name}}' } }, connections: [] }
    ];
    const r = await runWorkflowGraph(loop, ctx({ inputData: { records: [{ name: 'a' }, { name: 'b' }] } }), { db });
    expect(r.status).toBe('completed');
    expect(calls.map(c => c.payload?.body_text)).toEqual(['item a', 'item b']);
  });
});
