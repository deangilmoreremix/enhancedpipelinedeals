import { assert, callV2, jsonOf, freshIp, withEnv } from '../lib/util.mjs';

export const label = 'workflow-runner / workflow-run-now / _workflowSteps / scheduled-sla';

const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const H = 3_600_000, D = 86_400_000;

const wfMain = () => ({
  id: 'w1', name: 'Main flow', is_active: true, settings: { isActive: true },
  triggers: [{ id: 't1', type: 'stage_changed', isActive: true, config: { recordType: 'deal', fromStage: 'qualification', toStage: 'proposal' }, conditions: [{ field: 'value', operator: 'greater_than', value: 1000 }] }],
  stages: [
    { id: 's0', type: 'trigger', connections: ['sc'] },
    { id: 'sc', type: 'condition', condition: { field: 'value', operator: 'greater_than', value: 1000 }, connections: ['st', 'slow'], connectionLabels: { st: 'true', slow: 'false' } },
    { id: 'slow', type: 'action', action: { type: 'notification', name: 'Low value', config: { notificationMessage: 'LOW BRANCH {{title}}' } } },
    { id: 'st', type: 'action', action: { type: 'create_task', name: 'Task', config: { fields: { title: 'Follow up {{title}}', dueInDays: 2, notes: 'n' } } }, connections: ['su'] },
    { id: 'su', type: 'action', action: { type: 'update_stage', config: { newStage: 'negotiation' } }, connections: ['se'] },
    { id: 'se', type: 'action', action: { type: 'send_email', config: { subject: 'Hello {{title}}', body: 'Body' } }, connections: ['sn'] },
    { id: 'sn', type: 'action', action: { type: 'notification', name: 'Advance', config: { notificationMessage: 'Deal {{title}} advanced to {{steps.su.output.fields.stage}}' } }, connections: ['sh'] },
    { id: 'sh', type: 'action', action: { type: 'http_request', config: { httpUrl: 'http://127.0.0.1:54402/rest/v1/deals', httpMethod: 'GET' }, errorHandling: { continueOnError: true } }, connections: ['sa'] },
    { id: 'sa', type: 'action', action: { type: 'ai_agent', config: { aiAgentPrompt: 'Summarize {{title}}' } }, connections: ['sf'] },
    { id: 'sf', type: 'action', action: { type: 'filter', config: { filterCriteria: { value: { operator: 'greater_than', value: 1000 } } } }, connections: ['sd'] },
    { id: 'sd', type: 'delay', delay: 60, connections: ['sz'] },
    { id: 'sz', type: 'action', action: { type: 'notification', name: 'After delay', config: { notificationMessage: 'RESUMED {{title}} ai={{aiResult}}' } } },
  ],
});

export default async function ({ t, openai, supa, loadFunction }) {
  const steps = await loadFunction('_workflowSteps');
  const runner = await loadFunction('workflow-runner');
  const runNow = (await loadFunction('workflow-run-now')).default;
  const sla = await loadFunction('scheduled-sla');
  const run = (name) => name;

  const seedDeal = (o = {}) => ({ id: 'd1', title: 'Big deal', value: 5000, stage: 'proposal', contact_id: 'c1', priority: 'high', ...o });
  const baseSeed = (extra = {}) => ({
    deals: [seedDeal()],
    contacts: [{ id: 'c1', name: 'Grace', email: 'grace@navy.example' }],
    deal_workflows: [wfMain()],
    pipeline_stages: [{ key: 'closed-won', is_won: true }, { key: 'closed-lost', is_lost: true }],
    ...extra,
  });
  const event = (o = {}) => ({ id: 'e1', event_type: 'deal.stage_changed', entity_type: 'deal', entity_id: 'd1', payload: { from: 'qualification', to: 'proposal' }, processed: false, attempts: 0, claimed_at: null, created_at: iso(5000), ...o });

  // ======================= matchWorkflows (pure)
  const wf = (trigger, extra = {}) => ({ id: 'x', is_active: true, triggers: [{ id: 't', type: 'stage_changed', config: {}, ...trigger }], ...extra });
  const ev = (o = {}) => ({ event_type: 'deal.stage_changed', entity_type: 'deal', payload: { from: 'a', to: 'b' }, ...o });
  const matches = (w, e, rec) => runner.matchWorkflows(e, [w], rec).length === 1;

  await t('matchWorkflows: event type mapping (deal.created/updated/stage_changed/sla_breached/stale) and unknown event -> none', async () => {
    assert.ok(matches(wf({ type: 'record_created' }), ev({ event_type: 'deal.created' })));
    assert.ok(matches(wf({ type: 'record_updated' }), ev({ event_type: 'deal.updated' })));
    assert.ok(matches(wf({ type: 'sla_breach' }), ev({ event_type: 'deal.sla_breached' })));
    assert.ok(matches(wf({ type: 'sla_breach' }), ev({ event_type: 'deal.stale' })));
    assert.ok(!matches(wf({ type: 'stage_changed' }), ev({ event_type: 'deal.deleted' })));
    assert.ok(!matches(wf({ type: 'record_created' }), ev()), 'trigger type must match');
  });
  await t('matchWorkflows: recordType, fromStage/toStage, slaType', async () => {
    assert.ok(matches(wf({ config: { recordType: 'deal' } }), ev()));
    assert.ok(!matches(wf({ config: { recordType: 'contact' } }), ev()));
    assert.ok(matches(wf({ config: { fromStage: 'a', toStage: 'b' } }), ev()));
    assert.ok(!matches(wf({ config: { fromStage: 'x' } }), ev()));
    assert.ok(!matches(wf({ config: { toStage: 'x' } }), ev()));
    assert.ok(matches(wf({ type: 'sla_breach', config: { slaType: 'stale' } }), ev({ event_type: 'deal.stale', payload: { slaType: 'stale' } })));
    assert.ok(!matches(wf({ type: 'sla_breach', config: { slaType: 'stale' } }), ev({ event_type: 'deal.sla_breached', payload: { slaType: 'sla_instance' } })));
  });
  await t('matchWorkflows: conditions AND/OR (left-to-right), record fields + payload both visible', async () => {
    const c = (field, operator, value, logicalOperator) => ({ field, operator, value, logicalOperator });
    const rec = { value: 5000, priority: 'high' };
    assert.ok(matches(wf({ conditions: [c('value', 'greater_than', 1000), c('priority', 'equals', 'high')] }), ev(), rec));
    assert.ok(!matches(wf({ conditions: [c('value', 'greater_than', 1000), c('priority', 'equals', 'low')] }), ev(), rec));
    assert.ok(matches(wf({ conditions: [c('priority', 'equals', 'low', 'OR'), c('value', 'greater_than', 1000)] }), ev(), rec), 'OR');
    assert.ok(matches(wf({ conditions: [c('to', 'equals', 'b')] }), ev(), rec), 'payload field');
    assert.ok(!matches(wf({ conditions: [c('value', 'less_than', 10)] }), ev(), rec));
  });
  await t('matchWorkflows: inactive workflow / inactive trigger / settings.isActive=false are skipped', async () => {
    assert.ok(!matches(wf({}, { is_active: false }), ev()));
    assert.ok(!matches(wf({}, { settings: { isActive: false } }), ev()));
    assert.ok(!matches(wf({ isActive: false }), ev()));
  });

  // ======================= HTTP guard helpers
  await t('isPrivateIp: loopback/RFC1918/link-local/CGNAT/mapped-v6/ULA blocked; public allowed', async () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1', '224.0.0.1']) assert.equal(steps.isPrivateIp(ip), true, ip);
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) assert.equal(steps.isPrivateIp(ip), false, ip);
  });
  await t('assertSafeUrl: http, creds, localhost/.internal/.local, literal private IP, hostname resolving private -> blocked; public https ok', async () => {
    const pub = async () => ['93.184.216.34'], priv = async () => ['10.1.2.3'], mixed = async () => ['93.184.216.34', '127.0.0.1'];
    for (const u of ['http://example.com', 'https://user:pw@example.com', 'https://localhost/x', 'https://a.localhost', 'https://svc.internal', 'https://printer.local', 'https://127.0.0.1/', 'https://[::1]/', 'https://169.254.169.254/latest', 'ftp://example.com', 'not a url'])
      await assert.rejects(steps.assertSafeUrl(u, pub), undefined, u);
    await assert.rejects(steps.assertSafeUrl('https://evil.example', priv), /private/);
    await assert.rejects(steps.assertSafeUrl('https://rebind.example', mixed), /private/, 'any private A record blocks');
    await assert.rejects(steps.assertSafeUrl('https://nx.example', async () => []), /resolve/);
    assert.equal((await steps.assertSafeUrl('https://api.example.com/path?q=1', pub)).hostname, 'api.example.com');
  });
  await t('http_request via injected fetch: public https -> redirect:"error", JSON body, response parsed & truncated; non-2xx -> failed step', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response('{"ok":1}', { status: 200 }); };
    const ctx = { recordId: 'd1', recordType: 'deal', inputData: { title: 'T' }, variables: {} };
    const deps = { db: {}, fetchImpl, resolveHost: async () => ['93.184.216.34'] };
    const ok = await steps.executeHttpRequest({ type: 'http_request', config: { httpUrl: 'https://api.example.com/hook/{{title}}', httpMethod: 'POST', httpBody: { a: '{{title}}' }, httpHeaders: { 'X-A': '1' } } }, ctx, deps);
    assert.equal(ok.success, true); assert.deepEqual(ok.output, { status: 200, data: { ok: 1 } });
    assert.equal(calls[0].url, 'https://api.example.com/hook/T'); assert.equal(calls[0].init.redirect, 'error'); assert.equal(calls[0].init.body, '{"a":"T"}'); assert.equal(calls[0].init.headers['X-A'], '1');
    const bad = await steps.executeHttpRequest({ type: 'http_request', config: { httpUrl: 'https://api.example.com/x' } }, ctx, { ...deps, fetchImpl: async () => new Response('no', { status: 500 }) });
    assert.equal(bad.success, false); assert.match(bad.error, /HTTP 500/);
    const wh = await steps.executeHttpRequest({ type: 'webhook', config: { webhookUrl: 'https://api.example.com/wh' } }, ctx, deps);
    assert.equal(JSON.parse(calls.at(-1).init.body).recordId, 'd1'); assert.equal(wh.success, true);
  });
  await t('http_request to local stub (127.0.0.1 over http) is BLOCKED by the guard and never fetched', async () => {
    supa.reset(); const n = supa.log.length;
    const r = await steps.executeHttpRequest({ type: 'http_request', config: { httpUrl: `${supa.url}/rest/v1/deals` } }, { inputData: {}, variables: {} }, { db: {} });
    assert.equal(r.success, false); assert.match(r.error, /https|Blocked/);
    const r2 = await steps.executeHttpRequest({ type: 'http_request', config: { httpUrl: 'https://127.0.0.1:54402/x' } }, { inputData: {}, variables: {} }, { db: {} });
    assert.equal(r2.success, false); assert.match(r2.error, /private|Blocked/);
    assert.equal(supa.log.length, n, 'no request reached the stub');
  });
  await t('http_request timeout: slow fetch aborted after 10s is reported (fake timers not used: abort signal propagated)', async () => {
    let sawSignal = false;
    const fetchImpl = (url, init) => { sawSignal = init.signal instanceof AbortSignal; return Promise.resolve(new Response('{}', { status: 200 })); };
    await steps.executeHttpRequest({ type: 'http_request', config: { httpUrl: 'https://api.example.com/' } }, { inputData: {}, variables: {} }, { db: {}, fetchImpl, resolveHost: async () => ['93.184.216.34'] });
    assert.ok(sawSignal);
  });

  // ======================= interpolation / registry
  await t('interpolate: record fields, record.x, trigger.x, steps.<id>.output.x, vars; unresolved placeholders kept; no prototype pollution', async () => {
    const ctx = { recordId: 'd1', recordType: 'deal', inputData: { title: 'T', record: { title: 'RT' }, n: 0 }, variables: { aiResult: 'AI' }, stepOutputs: { s1: { output: { v: 7 } } } };
    assert.equal(steps.interpolate('{{title}}|{{record.title}}|{{trigger.title}}|{{steps.s1.output.v}}|{{aiResult}}|{{recordId}}|{{nope}}|{{n}}', ctx), 'T|RT|T|7|AI|d1|{{nope}}|0');
    assert.equal(steps.interpolate('{{__proto__.polluted}}{{constructor.name}}', ctx).includes('Object'), false, 'constructor/proto lookups must not resolve');
  });
  await t('HANDLED_ACTION_KEYS: every key has an executor (dispatch never says "Unsupported")', async () => {
    for (const k of steps.HANDLED_ACTION_KEYS) {
      const r = await steps.executeAction({ type: k, config: {} }, { inputData: {}, variables: {} }, { db: { from() { throw new Error('db-touch'); } } });
      assert.ok(!/Unsupported action type/.test(r.error ?? ''), k);
    }
    assert.match((await steps.executeAction({ type: 'bogus' }, { inputData: {}, variables: {} }, { db: {} })).error, /Unsupported/);
  });
  await t('sanitizeFields strips protected/invalid columns', async () => {
    assert.deepEqual(steps.sanitizeFields({ id: 1, created_at: 1, tsv: 1, ok_col: 2, 'bad col': 3, Bad: 4, deleted_at: 1, user_id: 1 }), { ok_col: 2 });
  });

  // ======================= end to end through workflow-runner against stub Supabase
  const db = () => runner.serviceClient();
  const execs = () => supa.table('workflow_executions');
  const notifs = () => supa.table('notifications').map((n) => n.message);

  await t('batch: claims event via RPC, runs full graph (condition true branch, task, stage, email queued, notification, blocked http continues, ai_agent, filter, delay->waiting)', async () => {
    supa.reset(baseSeed({ workflow_events: [event()] }));
    openai.reset();
    openai.script(() => ({ text: 'AI SUMMARY' }));
    const s = await runner.runWorkflowBatch({ db: db() });
    assert.deepEqual([s.events, s.executions, s.skipped, s.failed, s.errors], [1, 1, 0, 0, []]);
    const e = supa.table('workflow_events')[0];
    assert.equal(e.processed, true); assert.ok(e.processed_at); assert.equal(e.attempts, 1);
    const ex = execs();
    assert.equal(ex.length, 1);
    assert.equal(ex[0].id, 'evt:e1:w1');
    assert.deepEqual([ex[0].status, ex[0].source, ex[0].event_id, ex[0].record_id, ex[0].record_type, ex[0].trigger_id, ex[0].trigger_type, ex[0].attempt], ['waiting', 'server', 'e1', 'd1', 'deal', 't1', 'stage_changed', 1]);
    assert.equal(ex[0].completed_at, null);
    const byStep = Object.fromEntries(ex[0].steps.map((x) => [x.stepId, x]));
    assert.ok(!byStep.slow, 'false branch must not run');
    assert.equal(byStep.sc.output.matched, true);
    for (const id of ['s0', 'sc', 'st', 'su', 'se', 'sn', 'sh', 'sa', 'sf', 'sd']) assert.ok(byStep[id], `step ${id} ran`);
    assert.equal(byStep.sh.status, 'failed'); assert.match(byStep.sh.error, /https|Blocked/, 'http to http://127.0.0.1 blocked by guard');
    assert.equal(byStep.sa.output.text, 'AI SUMMARY');
    // side effects
    const task = supa.table('tasks')[0];
    assert.equal(task.title, 'Follow up Big deal'); assert.equal(task.deal_id, 'd1'); assert.equal(task.status, 'open');
    assert.ok(Math.abs(new Date(task.due_date) - (Date.now() + 2 * D)) < 60_000, 'dueInDays=2');
    assert.equal(supa.table('deals')[0].stage, 'negotiation');
    const msg = supa.table('outbound_messages')[0];
    assert.deepEqual([msg.deal_id, msg.recipient, msg.subject, msg.status, msg.channel], ['d1', 'grace@navy.example', 'Hello Big deal', 'queued', 'email']);
    assert.ok(notifs().some((m) => m === 'Deal Big deal advanced to negotiation'), `notifications ${notifs()}`);
    assert.ok(!notifs().some((m) => m.startsWith('LOW')));
    // delay: resume row
    const trg = supa.table('scheduled_triggers');
    assert.equal(trg.length, 1);
    assert.equal(trg[0].name, 'resume:evt:e1:w1:0'); assert.equal(trg[0].is_active, true);
    assert.deepEqual(trg[0].schedule_config.stepIds, ['sz']); assert.equal(trg[0].schedule_config.kind, 'delay_resume');
    assert.ok(Math.abs(new Date(trg[0].next_run) - (Date.now() + 60 * 60_000)) < 60_000);
    assert.equal(trg[0].schedule_config.variables.aiResult, 'AI SUMMARY');
    assert.equal(openai.requests('/v1/responses')[0].body.model, 'gpt-6-luna', 'ai_agent defaults to fast tier');
  });
  await t('idempotency: same event re-claimed -> execution evt:e1:w1 skipped, no duplicate side effects', async () => {
    const e = supa.table('workflow_events')[0]; e.processed = false; e.claimed_at = null;
    const before = [supa.table('tasks').length, supa.table('outbound_messages').length, execs().length];
    const s = await runner.runWorkflowBatch({ db: db() });
    assert.deepEqual([s.executions, s.skipped], [0, 1]);
    assert.deepEqual([supa.table('tasks').length, supa.table('outbound_messages').length, execs().length], before);
    assert.equal(supa.table('scheduled_triggers').length, 1, 'no second resume row');
  });
  await t('delay resume: not due -> untouched; make due -> resume execution runs remaining step, marks trigger inactive, claims once', async () => {
    let n = await runner.resumeDueDelays(db(), [wfMain()], { db: db() });
    assert.equal(n, 0);
    supa.table('scheduled_triggers')[0].next_run = iso(1000);
    n = await runner.resumeDueDelays(db(), supa.table('deal_workflows'), { db: db() });
    assert.equal(n, 1);
    assert.equal(supa.table('scheduled_triggers')[0].is_active, false);
    assert.ok(notifs().some((m) => m === 'RESUMED Big deal ai=AI SUMMARY'), notifs().join('|'));
    const r = execs().find((x) => x.id.startsWith('resume:'));
    assert.ok(r && r.status === 'completed' && r.trigger_type === 'scheduled', JSON.stringify(r));
    assert.equal(await runner.resumeDueDelays(db(), supa.table('deal_workflows'), { db: db() }), 0, 'second sweep finds nothing');
  });

  await t('condition false branch: low-value deal takes labelled false path only (no task created)', async () => {
    supa.reset(baseSeed({ deals: [seedDeal({ value: 10 })], deal_workflows: [{ ...wfMain(), triggers: [{ ...wfMain().triggers[0], conditions: [] }] }], workflow_events: [event()] }));
    const s = await runner.runWorkflowBatch({ db: db() });
    assert.equal(s.executions, 1, JSON.stringify(s));
    assert.deepEqual(notifs(), ['LOW BRANCH Big deal']);
    assert.equal(supa.table('tasks').length, 0);
    assert.equal(execs()[0].status, 'completed');
  });
  await t('trigger conditions gate the run: value 10 does not match "value > 1000" trigger -> 0 executions, event still marked processed', async () => {
    supa.reset(baseSeed({ deals: [seedDeal({ value: 10 })], workflow_events: [event()] }));
    const s = await runner.runWorkflowBatch({ db: db() });
    assert.deepEqual([s.events, s.executions], [1, 0]);
    assert.equal(supa.table('workflow_events')[0].processed, true);
  });
  await t('wrong stage transition (from/to) does not match', async () => {
    supa.reset(baseSeed({ workflow_events: [event({ payload: { from: 'proposal', to: 'negotiation' } })] }));
    const s = await runner.runWorkflowBatch({ db: db() });
    assert.equal(s.executions, 0);
  });
  await t('browser already ran it (non-evt execution for same record/trigger within 120s) -> skipped', async () => {
    supa.reset(baseSeed({ workflow_events: [event()], workflow_executions: [{ id: 'client-run-1', workflow_id: 'w1', trigger_type: 'stage_changed', status: 'completed', started_at: iso(30_000), context: { recordId: 'd1' } }] }));
    const s = await runner.runWorkflowBatch({ db: db() });
    assert.deepEqual([s.executions, s.skipped], [0, 1]);
  });
  await t('inactive workflow rows are not loaded (is_active=false)', async () => {
    supa.reset(baseSeed({ deal_workflows: [{ ...wfMain(), is_active: false }], workflow_events: [event()] }));
    const s = await runner.runWorkflowBatch({ db: db() });
    assert.equal(s.executions, 0);
  });
  await t('iterator: search_records -> item branch per record (note each), done branch once; per-item {{item.title}}', async () => {
    const w2 = { id: 'w2', is_active: true, triggers: [{ id: 'tt', type: 'record_updated', config: {} }], stages: [
      { id: 'a0', type: 'trigger', connections: ['a1'] },
      { id: 'a1', type: 'action', action: { type: 'search_records', config: { recordType: 'task', searchCriteria: { status: 'open' } } }, connections: ['a2'] },
      { id: 'a2', type: 'action', action: { type: 'iterator', config: { iteratorSource: 'query_result' } }, connections: ['a3', 'a4'], connectionLabels: { a3: 'item', a4: 'done' } },
      { id: 'a3', type: 'action', action: { type: 'create_note', name: 'Note', config: { body: 'note for {{item.title}}' } } },
      { id: 'a4', type: 'action', action: { type: 'notification', name: 'done', config: { notificationMessage: 'ALL DONE' } } },
    ] };
    supa.reset(baseSeed({ deal_workflows: [w2], tasks: [{ id: 't1', title: 'One', status: 'open' }, { id: 't2', title: 'Two', status: 'open' }, { id: 't3', title: 'Three', status: 'done' }], workflow_events: [event({ event_type: 'deal.updated', payload: {} })] }));
    const s = await runner.runWorkflowBatch({ db: db() });
    assert.equal(s.executions, 1, JSON.stringify(s));
    const notes = supa.table('notes').map((n) => n.body_text);
    assert.deepEqual(notes.sort(), ['note for One', 'note for Two']);
    assert.deepEqual(notifs(), ['ALL DONE']);
    assert.equal(execs()[0].status, 'completed');
  });
  await t('failed step -> execution failed, error_step_id set; retryPolicy -> event released for retry, else marked processed', async () => {
    const bad = { id: 'w3', is_active: true, settings: { retryPolicy: { enabled: true, maxRetries: 3 } }, triggers: [{ id: 'tx', type: 'stage_changed', config: {} }], stages: [{ id: 'b0', type: 'trigger', connections: ['b1'] }, { id: 'b1', type: 'action', action: { type: 'update_record', config: { fields: {} } } }] };
    supa.reset(baseSeed({ deal_workflows: [bad], workflow_events: [event()] }));
    let s = await runner.runWorkflowBatch({ db: db() });
    assert.deepEqual([s.executions, s.failed], [1, 1]);
    assert.equal(execs()[0].status, 'failed'); assert.equal(execs()[0].error_step_id, 'b1'); assert.match(execs()[0].error_message, /No fields/);
    let e = supa.table('workflow_events')[0];
    assert.equal(e.processed, false); assert.equal(e.claimed_at, null); assert.match(e.error, /retry/);
    // attempt 2: prior failed -> re-run allowed, attempt counter increments
    s = await runner.runWorkflowBatch({ db: db() });
    assert.equal(s.executions, 1); assert.equal(execs().length, 1); assert.equal(execs()[0].attempt, 2);
    // exhaust retries (attempts >= maxRetries 3)
    await runner.runWorkflowBatch({ db: db() });
    e = supa.table('workflow_events')[0];
    assert.equal(e.processed, true, 'after maxRetries the event is finalised');
  });
  await t('RPC claim failure is surfaced in summary.errors (no throw)', async () => {
    supa.reset(baseSeed({ workflow_events: [event()] }));
    supa.failNext('POST', '/rest/v1/rpc/claim_workflow_events', 500, { message: 'rpc down' });
    const s = await runner.runWorkflowBatch({ db: db() });
    assert.match(s.errors[0], /claim: rpc down/);
  });
  await t('batch respects p_limit (25) and p_max_attempts (5) on the claim RPC', async () => {
    supa.reset(baseSeed({ workflow_events: [event()] }));
    await runner.runWorkflowBatch({ db: db() });
    const rpc = supa.requests({ path: 'claim_workflow_events' })[0].body;
    assert.deepEqual([rpc.p_limit, rpc.p_max_attempts], [25, 5]);
  });
  await t('default export (scheduled) returns summary JSON; 500 when service key missing', async () => {
    supa.reset(baseSeed({ workflow_events: [event()] }));
    const res = await runner.default();
    const j = await jsonOf(res);
    assert.equal(res.status, 200); assert.equal(j.executions, 1); assert.equal(j.ok, true);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r2 = await runner.default(); process.env.SUPABASE_SERVICE_ROLE_KEY = key;
    assert.equal(r2.status, 500);
  });

  // ======================= workflow-run-now
  // run-now is admin/manager only (or the service key); its rate limit is per user (in-memory, per warm instance: 6/min)
  const asAdmin = (o = {}) => callV2(runNow, { token: 'admin-jwt', ...o });
  await t('workflow-run-now: OPTIONS/405/401; per-user rate limit 429 after 6 runs', async () => {
    assert.equal((await callV2(runNow, { method: 'OPTIONS' })).status, 204);
    assert.equal((await callV2(runNow, { method: 'GET' })).status, 405);
    assert.equal((await callV2(runNow, { body: {}, token: null })).status, 401);
    let r;
    for (let i = 0; i < 7; i++) r = await callV2(runNow, { body: {}, token: 'manager-jwt' });
    assert.equal(r.status, 429);
    // a different IP does not reset the per-user counter
    assert.equal((await callV2(runNow, { body: {}, token: 'manager-jwt', ip: freshIp() })).status, 429);
  });
  await t('workflow-run-now role gate: member / viewer -> 403; anon key -> 401 (or 403 when anon is allowed); manager / admin / service key -> 200; nothing executes for rejected callers', async () => {
    supa.reset(baseSeed({ workflow_events: [event()] }));
    const n0 = supa.log.length;
    for (const token of ['good-jwt', 'viewer-jwt']) {
      const r = await callV2(runNow, { body: {}, token });
      assert.equal(r.status, 403, token); assert.match((await jsonOf(r)).error, /admin or manager/i);
    }
    assert.equal((await callV2(runNow, { body: {}, token: 'anon-key' })).status, 401);
    await withEnv({ ALLOW_ANON_FUNCTIONS: 'true' }, async () => assert.equal((await callV2(runNow, { body: {}, token: 'anon-key' })).status, 403));
    assert.ok(!supa.log.slice(n0).some((l) => /claim_workflow_events/.test(l.path)), 'runner never started for rejected callers');
    for (const action of ['rerun', 'resume']) assert.equal((await callV2(runNow, { body: { action, executionId: 'evt:e1:w1' }, token: 'good-jwt' })).status, 403, action);
    const ok = await asAdmin({ body: {} });
    assert.equal(ok.status, 200, JSON.stringify(await jsonOf(ok)));
    const svc = await callV2(runNow, { body: {}, token: 'service-role-key' });
    assert.equal(svc.status, 200);
  });
  await t('workflow-run-now: plain POST runs a batch and returns summary', async () => {
    supa.reset(baseSeed({ workflow_events: [event()] }));
    const r = await asAdmin({ body: {} });
    const j = await jsonOf(r);
    assert.equal(r.status, 200); assert.equal(j.executions, 1);
  });
  await t('workflow-run-now rerun: unknown run 422; existing run -> new rerun:<id>:<ts> execution with attempt+1 and same record', async () => {
    assert.equal((await asAdmin({ body: { action: 'rerun', executionId: 'nope' } })).status, 422);
    const r = await asAdmin({ body: { action: 'rerun', executionId: 'evt:e1:w1' } });
    const j = await jsonOf(r);
    assert.equal(r.status, 200, JSON.stringify(j));
    assert.match(j.executionId, /^rerun:evt:e1:w1:\d+$/);
    const row = execs().find((x) => x.id === j.executionId);
    assert.ok(row); assert.equal(row.attempt, 2); assert.equal(row.record_id, 'd1');
    assert.equal(row.workflow_id, 'w1');
  });
  await t('rerun of a run whose workflow was deleted -> 422 "no longer exists"', async () => {
    supa.table('deal_workflows').length = 0;
    const r = await asAdmin({ body: { action: 'rerun', executionId: 'evt:e1:w1' } });
    assert.equal(r.status, 422); assert.match((await jsonOf(r)).error, /no longer exists/);
  });
  await t('workflow-run-now resume: no pending delays -> 422; pending delay -> made due and executed', async () => {
    supa.reset(baseSeed({ workflow_events: [event()] }));
    await runner.runWorkflowBatch({ db: db() });
    assert.equal((await callV2(runNow, { body: { action: 'resume', executionId: 'evt:nonexistent:w1' }, token: 'service-role-key' })).status, 422);
    const r = await callV2(runNow, { body: { action: 'resume', executionId: 'evt:e1:w1' }, token: 'service-role-key' });
    const j = await jsonOf(r);
    assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.resumed, 1);
    assert.ok(notifs().some((m) => m.startsWith('RESUMED')));
    assert.equal((await callV2(runNow, { body: { action: 'resume', executionId: 'evt:e1:w1' }, token: 'service-role-key' })).status, 422, 'cannot resume twice');
  });

  // ======================= scheduled-sla
  const slaSeed = () => ({
    sla_instances: [
      { id: 'i1', policy_id: 'p1', record_id: 'd1', record_type: 'deal', status: 'active', started_at: iso(10 * H), target_at: new Date(Date.now() + 2 * H).toISOString(), notifications: [] },
      { id: 'i2', policy_id: 'p1', record_id: 'd2', record_type: 'deal', status: 'active', started_at: iso(10 * H), target_at: iso(H), notifications: [] },
      { id: 'i3', policy_id: 'p1', record_id: 'd3', record_type: 'deal', status: 'active', started_at: iso(1 * H), target_at: new Date(Date.now() + 20 * H).toISOString(), notifications: [] },
      { id: 'i4', policy_id: 'p1', record_id: 'd4', record_type: 'deal', status: 'breached', started_at: iso(10 * H), target_at: iso(H), notifications: [] },
    ],
  });
  await t('slaState / staleDaysFromPolicies pure helpers', async () => {
    const now = new Date('2026-01-10T00:00:00Z');
    assert.equal(sla.slaState({ started_at: '2026-01-09T00:00:00Z', target_at: '2026-01-11T00:00:00Z' }, now), 'ok');
    assert.equal(sla.slaState({ started_at: '2026-01-05T00:00:00Z', target_at: '2026-01-10T12:00:00Z' }, now), 'warning');
    assert.equal(sla.slaState({ started_at: '2026-01-05T00:00:00Z', target_at: '2026-01-10T00:00:00Z' }, now), 'breached');
    assert.equal(sla.slaState({}, now), 'ok');
    assert.equal(sla.staleDaysFromPolicies([]), 30);
    assert.equal(sla.staleDaysFromPolicies([{ record_type: 'deal', metrics: { type: 'stage_duration', target: 48, unit: 'hours' } }]), 2);
    assert.equal(sla.staleDaysFromPolicies([{ record_type: 'contact', metrics: { type: 'stage_duration', target: 1 } }]), 30);
    assert.equal(sla.staleDaysFromPolicies([{ metrics: { type: 'stage_duration', target: 1440, unit: 'minutes' } }]), 1);
  });
  await t('SLA: warning at 80% (once), breach (+notification +deal.sla_breached event), ok untouched, already-breached ignored; re-run is idempotent', async () => {
    supa.reset(slaSeed());
    let s = await sla.runSlaSweep(db());
    assert.deepEqual([s.slaWarned, s.slaBreached, s.errors], [1, 1, []]);
    const by = Object.fromEntries(supa.table('sla_instances').map((i) => [i.id, i]));
    assert.equal(by.i1.status, 'warning'); assert.equal(by.i1.notifications[0].type, 'warning');
    assert.equal(by.i2.status, 'breached'); assert.equal(by.i2.notifications[0].type, 'breach');
    assert.equal(by.i3.status, 'active'); assert.equal(by.i4.notifications.length, 0);
    assert.deepEqual(supa.table('notifications').map((n) => n.type).sort(), ['sla_breach', 'sla_warning']);
    const evs = supa.table('workflow_events');
    assert.equal(evs.length, 1); assert.deepEqual([evs[0].event_type, evs[0].entity_id, evs[0].payload.slaInstanceId], ['deal.sla_breached', 'd2', 'i2']);
    s = await sla.runSlaSweep(db());
    assert.deepEqual([s.slaWarned, s.slaBreached], [0, 0]);
    assert.equal(supa.table('notifications').length, 2); assert.equal(supa.table('workflow_events').length, 1);
  });
  await t('SLA: a warning instance that later breaches is promoted to breached with its own notification', async () => {
    supa.reset(slaSeed());
    await sla.runSlaSweep(db());
    supa.table('sla_instances').find((i) => i.id === 'i1').target_at = iso(1000);
    const s = await sla.runSlaSweep(db());
    assert.equal(s.slaBreached, 1);
    assert.equal(supa.table('sla_instances').find((i) => i.id === 'i1').status, 'breached');
  });
  await t('overdue tasks: one task_overdue notification each; done/cancelled/future ignored; second sweep silent', async () => {
    supa.reset({ tasks: [
      { id: 'k1', title: 'Late', due_date: iso(2 * D), status: 'open', user_id: 'u1', deal_id: 'd1' },
      { id: 'k2', title: 'Done', due_date: iso(2 * D), status: 'done' },
      { id: 'k3', title: 'Future', due_date: new Date(Date.now() + D).toISOString(), status: 'open' },
      { id: 'k4', title: 'Cancelled', due_date: iso(2 * D), status: 'cancelled' },
      { id: 'k5', title: 'Late2', due_date: iso(D), status: 'pending' },
    ] });
    let s = await sla.runSlaSweep(db());
    assert.equal(s.overdueTasks, 2, JSON.stringify(s));
    const n = supa.table('notifications');
    assert.deepEqual(n.map((x) => x.metadata.taskId).sort(), ['k1', 'k5']);
    assert.equal(n.find((x) => x.metadata.taskId === 'k1').user_id, 'u1'); assert.match(n[0].message, /was due/);
    s = await sla.runSlaSweep(db());
    assert.equal(s.overdueTasks, 0); assert.equal(supa.table('notifications').length, 2);
  });
  await t('stale deals: >30d open deals flagged (event+notification), closed/deleted/fresh skipped; 7-day dedupe; re-emit after 7 days', async () => {
    supa.reset({
      pipeline_stages: [{ key: 'won', is_won: true }, { key: 'lost', is_lost: true }],
      deals: [
        { id: 's1', title: 'Old open', stage: 'proposal', updated_at: iso(40 * D), owner_id: 'u1' },
        { id: 's2', title: 'Old won', stage: 'won', updated_at: iso(40 * D) },
        { id: 's3', title: 'Fresh', stage: 'proposal', updated_at: iso(2 * D) },
        { id: 's4', title: 'Old deleted', stage: 'proposal', updated_at: iso(40 * D), deleted_at: iso(D) },
        { id: 's5', title: 'Old closed-lost literal', stage: 'lost', updated_at: iso(40 * D) },
      ],
    });
    let s = await sla.runSlaSweep(db());
    assert.equal(s.staleDeals, 1, JSON.stringify(s));
    const ev1 = supa.table('workflow_events');
    assert.deepEqual(ev1.map((e) => [e.event_type, e.entity_id, e.payload.slaType, e.payload.idleDays, e.payload.thresholdDays]), [['deal.stale', 's1', 'stale', 40, 30]]);
    assert.equal(supa.table('notifications')[0].type, 'deal_stale'); assert.equal(supa.table('notifications')[0].user_id, 'u1');
    s = await sla.runSlaSweep(db());
    assert.equal(s.staleDeals, 0, 'dedupe within 7 days');
    supa.table('workflow_events')[0].created_at = iso(8 * D);
    s = await sla.runSlaSweep(db());
    assert.equal(s.staleDeals, 1, 're-emit after 7 days');
  });
  await t('stale deals: last REAL activity (deal_last_activity view) beats updated_at; missing view falls back to updated_at', async () => {
    supa.reset({
      deals: [
        { id: 'a1', title: 'Edited long ago, active yesterday', stage: 'proposal', updated_at: iso(60 * D) },
        { id: 'a2', title: 'Silent', stage: 'proposal', updated_at: iso(60 * D) },
        { id: 'a3', title: 'Old activity', stage: 'proposal', updated_at: iso(60 * D) },
      ],
      deal_last_activity: [{ deal_id: 'a1', last_activity_at: iso(D) }, { deal_id: 'a3', last_activity_at: iso(45 * D) }],
    });
    const s = await sla.runSlaSweep(db());
    assert.equal(s.staleDeals, 2, JSON.stringify(s));
    const ev = supa.table('workflow_events').map((e) => [e.entity_id, e.payload.idleDays]).sort();
    assert.deepEqual(ev, [['a2', 60], ['a3', 45]]);
    supa.reset({ deals: [{ id: 'b1', title: 'x', stage: 'proposal', updated_at: iso(50 * D) }] });
    supa.failNext('GET', '/rest/v1/deal_last_activity', 404, { code: '42P01', message: 'relation "deal_last_activity" does not exist' });
    const s2 = await sla.runSlaSweep(db());
    assert.equal(s2.staleDeals, 1); assert.deepEqual(s2.errors, []);
  });
  await t('stale deals threshold comes from active stage_duration deal policy (10 days)', async () => {
    supa.reset({ sla_policies: [{ id: 'p', record_type: 'deal', is_active: true, metrics: { type: 'stage_duration', target: 10, unit: 'days' } }], deals: [{ id: 's1', title: 'x', stage: 'proposal', updated_at: iso(12 * D) }] });
    const s = await sla.runSlaSweep(db());
    assert.equal(s.staleDeals, 1); assert.equal(supa.table('workflow_events')[0].payload.thresholdDays, 10);
  });
  await t('stale deals: without pipeline_stages rows falls back to closed-won/closed-lost', async () => {
    supa.reset({ deals: [{ id: 'a', title: 'x', stage: 'closed-won', updated_at: iso(60 * D) }, { id: 'b', title: 'y', stage: 'negotiation', updated_at: iso(60 * D) }] });
    const s = await sla.runSlaSweep(db());
    assert.equal(s.staleDeals, 1); assert.equal(supa.table('workflow_events')[0].entity_id, 'b');
  });
  await t('sla sweep: a failing sub-sweep is reported but the others still run', async () => {
    supa.reset({ tasks: [{ id: 'k1', title: 'Late', due_date: iso(2 * D), status: 'open' }] });
    supa.failNext('GET', '/rest/v1/sla_instances', 500, { message: 'sla table down' });
    const s = await sla.runSlaSweep(db());
    assert.match(s.errors[0], /sla table down/); assert.equal(s.overdueTasks, 1);
  });
  await t('scheduled-sla default export returns summary / 500 without service key', async () => {
    supa.reset({});
    const res = await sla.default(); assert.equal(res.status, 200); assert.equal((await jsonOf(res)).ok, true);
  });
}
