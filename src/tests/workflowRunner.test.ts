import { executionId, matchWorkflows, processEvent, type WorkflowRow, type WorkflowEventRow } from '../../netlify/functions/workflow-runner';
import { slaState, staleDaysFromPolicies } from '../../netlify/functions/scheduled-sla';
import type { DbLike } from '../../netlify/functions/_workflowSteps';

const wf = (over: Partial<WorkflowRow> & { id: string }): WorkflowRow => ({
  is_active: true,
  triggers: [{ id: 't1', type: 'stage_changed', isActive: true, config: { toStage: 'won' } }],
  stages: [],
  ...over
});

const event = (over: Partial<WorkflowEventRow> = {}): WorkflowEventRow => ({
  id: 'e1', event_type: 'deal.stage_changed', entity_type: 'deal', entity_id: 'd1',
  payload: { from: 'proposal', to: 'won', value: 9000 }, created_at: '2026-06-01T00:00:00Z', ...over
});

describe('matchWorkflows', () => {
  it('matches by trigger type and target stage', () => {
    const m = matchWorkflows(event(), [wf({ id: 'a' }), wf({ id: 'b', triggers: [{ type: 'stage_changed', config: { toStage: 'lost' } }] })]);
    expect(m.map(x => x.workflow.id)).toEqual(['a']);
  });

  it('maps event types and ignores unknown ones', () => {
    const created = wf({ id: 'c', triggers: [{ type: 'record_created' }] });
    expect(matchWorkflows(event({ event_type: 'deal.created', payload: {} }), [created])).toHaveLength(1);
    expect(matchWorkflows(event({ event_type: 'deal.stage_changed' }), [created])).toHaveLength(0);
    expect(matchWorkflows(event({ event_type: 'contact.created' }), [created])).toHaveLength(0);
  });

  it('skips inactive workflows and triggers', () => {
    expect(matchWorkflows(event(), [wf({ id: 'a', is_active: false })])).toHaveLength(0);
    expect(matchWorkflows(event(), [wf({ id: 'a', settings: { isActive: false } })])).toHaveLength(0);
    expect(matchWorkflows(event(), [wf({ id: 'a', triggers: [{ type: 'stage_changed', isActive: false }] })])).toHaveLength(0);
  });

  it('evaluates trigger conditions against payload and the deal record', () => {
    const w = wf({
      id: 'a',
      triggers: [{ type: 'stage_changed', conditions: [{ field: 'value', operator: 'greater_than', value: 5000 }, { field: 'priority', operator: 'equals', value: 'high' }] }]
    });
    expect(matchWorkflows(event(), [w], { priority: 'high' })).toHaveLength(1);
    expect(matchWorkflows(event(), [w], { priority: 'low' })).toHaveLength(0);
    expect(matchWorkflows(event({ payload: { to: 'won', value: 100 } }), [w], { priority: 'high' })).toHaveLength(0);
  });

  it('routes stale/sla events to sla_breach triggers with optional slaType', () => {
    const w = wf({ id: 's', triggers: [{ type: 'sla_breach', config: { slaType: 'stale' } }] });
    expect(matchWorkflows(event({ event_type: 'deal.stale', payload: { slaType: 'stale' } }), [w])).toHaveLength(1);
    expect(matchWorkflows(event({ event_type: 'deal.sla_breached', payload: { slaType: 'sla_instance' } }), [w])).toHaveLength(0);
  });
});

describe('processEvent idempotency', () => {
  function db(rows: { prior?: any; browser?: any[] }) {
    const upserts: any[] = [];
    const client: DbLike = {
      from(table: string) {
        const chain: any = {
          _id: undefined as string | undefined,
          select() { return chain; },
          eq(k: string, v: any) { if (k === 'id') chain._id = v; return chain; },
          gte() { return chain; }, not() { return chain; }, limit() { return Promise.resolve({ data: rows.browser ?? [], error: null }); },
          maybeSingle: async () => (table === 'workflow_executions' ? { data: rows.prior ?? null, error: null } : { data: null, error: null }),
          upsert: async (r: any) => { upserts.push(r); return { error: null }; },
          insert: async () => ({ error: null })
        };
        return chain;
      }
    };
    return { client, upserts };
  }
  const flow = wf({ id: 'a', stages: [{ id: 't', type: 'trigger', connections: [] }] });

  it('records a server execution with a deterministic id', async () => {
    const { client, upserts } = db({});
    const r = await processEvent(event(), [flow], { db: client });
    expect(r).toMatchObject({ executions: 1, skipped: 0, failed: 0 });
    expect(upserts[0]).toMatchObject({ id: executionId('e1', 'a'), status: 'completed', source: 'server', event_id: 'e1', record_id: 'd1' });
  });

  it('skips events that already ran (re-run safe)', async () => {
    const { client, upserts } = db({ prior: { id: executionId('e1', 'a'), status: 'completed' } });
    expect(await processEvent(event(), [flow], { db: client })).toMatchObject({ executions: 0, skipped: 1 });
    expect(upserts).toHaveLength(0);
  });

  it('skips runs the browser already performed', async () => {
    const { client, upserts } = db({ browser: [{ id: 'client-run' }] });
    expect(await processEvent(event(), [flow], { db: client })).toMatchObject({ executions: 0, skipped: 1 });
    expect(upserts).toHaveLength(0);
  });
});

describe('scheduled-sla helpers', () => {
  const now = new Date('2026-06-10T00:00:00Z');
  it('classifies SLA instances', () => {
    expect(slaState({ started_at: '2026-06-01T00:00:00Z', target_at: '2026-06-09T00:00:00Z' }, now)).toBe('breached');
    expect(slaState({ started_at: '2026-06-01T00:00:00Z', target_at: '2026-06-11T00:00:00Z' }, now)).toBe('warning');
    expect(slaState({ started_at: '2026-06-09T00:00:00Z', target_at: '2026-06-20T00:00:00Z' }, now)).toBe('ok');
    expect(slaState({}, now)).toBe('ok');
  });

  it('derives the stale threshold from policies, default 30 days', () => {
    expect(staleDaysFromPolicies([])).toBe(30);
    expect(staleDaysFromPolicies([{ record_type: 'deal', metrics: { type: 'stage_duration', target: 14, unit: 'days' } }])).toBe(14);
    expect(staleDaysFromPolicies([{ record_type: 'deal', metrics: { type: 'stage_duration', target: 48, unit: 'hours' } }])).toBe(2);
    expect(staleDaysFromPolicies([{ record_type: 'contact', metrics: { type: 'stage_duration', target: 1 } }])).toBe(30);
  });
});
