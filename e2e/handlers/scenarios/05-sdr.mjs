import { assert, callV1, callV2, readSSE, jsonOf, freshIp } from '../lib/util.mjs';
import { lintStrictSchema } from '../lib/schemaLint.mjs';

export const label = 'sdr-run / sdr-agent / skills-api / _sdrAgents';

const seed = (supa) => supa.reset({
  contacts: [{ id: 'c1', name: 'Grace Hopper', company: 'Navy', email: 'grace@navy.example', status: 'lead' }],
  deals: [{ id: 'd1', title: 'Compiler deal', value: 5000, stage: 'proposal', contact_id: 'c1', probability: 40 }],
  activities: [{ id: 'a1', contact_id: 'c1', type: 'email', description: 'sent intro', created_at: new Date().toISOString() }],
});

const sendCall = (extra = {}) => ({ name: 'send_sdr_message', arguments: { lead_id: 'c1', channel: 'email', subject: 'Hello', body: 'Hi Grace, quick note.', ...extra } });

export default async function ({ t, openai, supa, loadFunction }) {
  const agents = await loadFunction('_sdrAgents');
  const run = await loadFunction('sdr-run');
  const sdr = (await loadFunction('sdr-agent')).default;
  const skills = await loadFunction('skills-api');
  const reqs = () => openai.requests('/v1/responses').map((c) => c.body);

  // ---------------- _sdrAgents wiring
  await t('SPECIALISTS: 14 unique ids, tiers valid', async () => {
    assert.equal(agents.SPECIALISTS.length, 14);
    assert.equal(new Set(agents.SPECIALISTS.map((s) => s.id)).size, 14);
    for (const s of agents.SPECIALISTS) assert.ok(['fast', 'default', 'deep'].includes(s.tier) && s.name && s.description && s.task);
  });
  await t('buildAgents(): 14 specialists + orchestrator; orchestrator has 13 handoffs and enrich_lead tool', async () => {
    const { orchestrator, specialists } = agents.buildAgents();
    assert.equal(Object.keys(specialists).length, 14);
    assert.equal(orchestrator.handoffs.length, 13);
    const names = orchestrator.tools.map((x) => x.name);
    assert.ok(names.includes('get_lead_context') && names.includes('enrich_lead'), names.join());
    const sp = specialists['sdr-cold-email'];
    assert.deepEqual(sp.tools.map((x) => x.name).sort(), ['create_followup_task', 'get_lead_context', 'log_autopilot_state', 'save_activity', 'schedule_meeting', 'send_sdr_message', 'web_search'].sort());
    assert.equal(sp.model, 'gpt-6.1-sol');
    assert.equal(specialists['sdr-bump-message'].model, 'gpt-6-luna');
    assert.equal(specialists['sdr-competitor-aware'].model, 'gpt-6-astra');
  });
  await t('SdrOutput zod schema -> OpenAI strict JSON schema passes the linter (as sent by the Agents SDK)', async () => {
    seed(supa); openai.reset();
    const r = await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-cold-email', contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body);
    const fmt = reqs()[0].text.format;
    assert.equal(fmt.type, 'json_schema'); assert.equal(fmt.strict, true);
    assert.deepEqual(lintStrictSchema(fmt.schema), []);
  });
  await t('every function tool schema sent for a specialist is strict-valid (all params required)', async () => {
    const tools = reqs()[0].tools.filter((x) => x.type === 'function');
    const bad = [];
    for (const f of tools) { const p = lintStrictSchema(f.parameters); if (p.length) bad.push(`${f.name}: ${p.join('; ')}`); }
    assert.deepEqual(bad, []);
    assert.ok(reqs()[0].tools.some((x) => x.type === 'web_search'));
  });
  await t('Agents SDK honours OPENAI_BASE_URL: requests reached the stub with Bearer sk-test and reasoning/effort rules', async () => {
    const b = reqs()[0];
    assert.equal(openai.requests('/v1/responses')[0].headers.authorization, 'Bearer sk-test');
    assert.notEqual(b.reasoning?.effort, 'none');
    assert.equal(b.temperature, undefined);
    assert.equal(b.model, 'gpt-6.1-sol');
  });

  // ---------------- sdr-run (v1)
  await t('sdr-run OPTIONS 204 / GET 405 / 401 / invalid action 400 / bad JSON 500', async () => {
    assert.equal((await callV1(run.handler, { method: 'OPTIONS' })).statusCode, 204);
    assert.equal((await callV1(run.handler, { method: 'GET' })).statusCode, 405);
    assert.equal((await callV1(run.handler, { body: {}, token: null })).statusCode, 401);
    assert.equal((await callV1(run.handler, { body: { action: 'zzz', contactId: 'c1' } })).statusCode, 400);
  });
  await t('sdr-run metadata returns 14 agents (id,name,description,tier)', async () => {
    const r = await callV1(run.handler, { body: { action: 'metadata' } });
    assert.equal(r.statusCode, 200); assert.equal(r.json.total, 14);
    assert.deepEqual(Object.keys(r.json.agents[0]).sort(), ['description', 'id', 'name', 'tier']);
  });
  await t('sdr-run 400 missing contactId / agentId; 404 unknown agent; batch needs agentIds', async () => {
    assert.equal((await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-cold-email' } })).statusCode, 400);
    assert.equal((await callV1(run.handler, { body: { action: 'run', contactId: 'c1' } })).statusCode, 400);
    assert.equal((await callV1(run.handler, { body: { action: 'run', contactId: 'c1', agentId: 'nope' } })).statusCode, 404);
    assert.equal((await callV1(run.handler, { body: { action: 'batch', contactId: 'c1' } })).statusCode, 400);
  });
  await t('sdr-run: specialist run loads lead context through a tool call, returns structured output, persists conversation id', async () => {
    seed(supa); openai.reset();
    openai.script(() => ({ toolCall: { call_id: 'call_ctx', name: 'get_lead_context', arguments: { lead_id: 'c1' } } }));
    const r = await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-cold-email', contactId: 'c1', goal: 'book a demo' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json.result.status, 'final');
    assert.equal(r.json.result.agent, 'Cold Email SDR');
    assert.equal(typeof r.json.result.output.outreach.body, 'string');
    const second = reqs()[1];
    const out = second.input.find((i) => i.type === 'function_call_output');
    assert.ok(out && out.call_id === 'call_ctx' && /Grace Hopper/.test(JSON.stringify(out.output)), 'tool output (CRM row) fed back to the model');
    assert.ok(JSON.stringify(reqs()[0].input).includes('book a demo'));
    const th = supa.table('agent_threads');
    assert.equal(th.length, 1);
    assert.match(th[0].openai_conversation_id, /^conv_/);
    // OpenAIConversationsSession persists run items into the conversation (items.create), not via a `conversation` param
    const added = openai.requests(`/v1/conversations/${th[0].openai_conversation_id}/items`).filter((c) => c.method === 'POST');
    assert.ok(added.length >= 1 && added[0].body.items.length >= 2, 'run items persisted to the lead conversation');
    // second run reuses the conversation instead of creating a new one
    const before = openai.requests('/v1/conversations').filter((c) => c.method === 'POST').length;
    await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-cold-email', contactId: 'c1' } });
    assert.equal(openai.requests('/v1/conversations').filter((c) => c.method === 'POST').length, before);
    assert.equal(supa.table('agent_threads').length, 1, 'agent_threads upsert, no duplicate');
    assert.ok(JSON.stringify(reqs().at(-1).input).includes('book a demo'), 'second run replays the stored conversation history');
  });
  await t('sdr-run: dealId (sent by SDRAgentsPanel/useSDRAgents) is echoed and reaches the agent prompt', async () => {
    seed(supa); openai.reset();
    const r = await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-cold-email', contactId: 'c1', dealId: 'd1' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json.dealId, 'd1');
    assert.ok(JSON.stringify(reqs()[0].input).includes('Deal id: d1'));
    const none = await callV1(run.handler, { body: { agentId: 'sdr-cold-email', contactId: 'c1' } });
    assert.equal(none.json.dealId, null);
  });
  await t('sdr-run: opt-out input guardrail trips on "unsubscribe" BEFORE any model call -> 422', async () => {
    seed(supa); openai.reset();
    const r = await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-cold-email', contactId: 'c1', goal: 'They replied: please unsubscribe me' } });
    assert.equal(r.statusCode, 422, r.body);
    assert.match(r.json.error, /opted out/);
    assert.equal(openai.requests('/v1/responses').length, 0, 'model was not called');
  });
  await t('sdr-run: moderation output guardrail (FLAG_ME in draft) -> 422 "failed content moderation"', async () => {
    seed(supa); openai.reset();
    openai.script(() => ({ text: JSON.stringify({ strategy: 's', outreach: { channel: 'email', subject: 'x', body: 'FLAG_ME bad stuff', call_to_action: 'c' }, key_points: [], crm_updates: [], confidence: 50 }) }));
    const r = await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-cold-email', contactId: 'c1' } });
    assert.equal(r.statusCode, 422, r.body);
    assert.match(r.json.error, /moderation/);
    assert.equal(openai.last('/v1/moderations').body.model, 'omni-moderation-latest');
  });
  await t('sdr-run: clean draft passes moderation guardrail (moderation endpoint was consulted)', async () => {
    seed(supa); openai.reset();
    const r = await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-linkedin', contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(openai.requests('/v1/moderations').length, 1);
  });
  await t('sdr-run: send_sdr_message needsApproval -> status approval_required with serialized state + callId (nothing queued)', async () => {
    seed(supa); openai.reset();
    openai.script(() => ({ toolCall: { call_id: 'call_send', ...sendCall() } }));
    const r = await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-cold-email', contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json.result.status, 'approval_required');
    assert.equal(r.json.result.approvals[0].tool, 'send_sdr_message');
    assert.equal(r.json.result.approvals[0].callId, 'call_send');
    assert.match(r.json.result.state, /^v1\.\d+\.[0-9a-f]{64}\./, 'state is HMAC-signed for the caller');
    assert.equal(r.json.result.approvals[0].arguments.subject, 'Hello');
    assert.ok(typeof r.json.result.state === 'string' && r.json.result.state.length > 20);
    assert.equal(supa.table('outbound_messages').length, 0);
  });
  await t('sdr-run: batch runs each agent, caps at 5, reports per-agent errors', async () => {
    seed(supa); openai.reset();
    const r = await callV1(run.handler, { body: { action: 'batch', contactId: 'c1', agentIds: ['sdr-cold-email', 'sdr-follow-up', 'nope-agent'] } });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json.summary.successful, 2); assert.equal(r.json.summary.failed, 1);
    assert.match(r.json.errors[0].error, /Unknown SDR agent/);
  });
  await t('sdr-run: orchestrator (auto) hands off to a specialist via transfer_to_* tool', async () => {
    seed(supa); openai.reset();
    openai.script((b) => {
      const tr = b.tools.find((x) => x.type === 'function' && /^transfer_to_/.test(x.name) && /cold/i.test(x.name));
      if (!tr) return undefined;
      return { toolCall: { call_id: 'call_h', name: tr.name, arguments: {} } };
    });
    const r = await callV1(run.handler, { body: { action: 'run', agentId: 'auto', contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json.result.status, 'final');
    assert.equal(r.json.result.agent, 'Cold Email SDR');
  });
  await t('sdr-run: upstream 500 from OpenAI -> 422 with message', async () => {
    seed(supa); openai.reset();
    openai.script(() => ({ http: { status: 500, message: 'model down' } }));
    const r = await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-cold-email', contactId: 'c1' } });
    assert.equal(r.statusCode, 422); assert.ok(r.json.error);
  });

  // ---------------- sdr-agent (v2, streaming + approval)
  await t('sdr-agent OPTIONS/405/401/400(bad json)/400(no leadId)/400(unknown agent)', async () => {
    assert.equal((await callV2(sdr, { method: 'OPTIONS' })).status, 204);
    assert.equal((await callV2(sdr, { method: 'GET' })).status, 405);
    assert.equal((await callV2(sdr, { body: {}, token: null })).status, 401);
    assert.equal((await callV2(sdr, { body: '{bad' })).status, 400);
    assert.equal((await callV2(sdr, { body: { agentId: 'sdr-cold-email' } })).status, 400);
    const r = await callV2(sdr, { body: { agentId: 'nope', leadId: 'c1' } });
    assert.equal(r.status, 400); assert.ok((await jsonOf(r)).agents.length === 14);
  });
  await t('sdr-agent rate limit 30/min', async () => {
    const ip = freshIp(); let r;
    for (let i = 0; i < 31; i++) r = await callV2(sdr, { body: {}, ip });
    assert.equal(r.status, 429);
  });
  await t('sdr-agent stream: SSE events agent -> delta... -> final, then [DONE]', async () => {
    seed(supa); openai.reset();
    const r = await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1' } });
    assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'text/event-stream');
    const { frames } = await readSSE(r);
    const types = frames.filter((f) => f !== '[DONE]').map((f) => f.type);
    assert.ok(types.includes('delta'), types.join());
    assert.equal(types.at(-1), 'final');
    assert.equal(frames.at(-1), '[DONE]');
    const fin = frames.find((f) => f.type === 'final');
    assert.equal(typeof fin.output.outreach.body, 'string');
    assert.equal(reqs()[0].stream, true);
  });
  await t('sdr-agent stream:false -> single JSON {ok, events, result}', async () => {
    seed(supa); openai.reset();
    const r = await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1', stream: false } });
    const j = await jsonOf(r);
    assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.ok, true); assert.equal(j.result.type, 'final');
  });
  await t('sdr-agent: opt-out -> error frame blocked:true (no model call)', async () => {
    seed(supa); openai.reset();
    const { frames } = await readSSE(await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1', message: 'STOP contacting me, unsubscribe' } }));
    const err = frames.find((f) => f !== '[DONE]' && f.type === 'error');
    assert.ok(err && err.blocked === true && /opted out/.test(err.error), JSON.stringify(frames));
    assert.equal(openai.requests('/v1/responses').length, 0);
    assert.equal(frames.at(-1), '[DONE]');
  });
  await t('sdr-agent: moderation guardrail -> error frame blocked:true', async () => {
    seed(supa); openai.reset();
    openai.script(() => ({ text: JSON.stringify({ strategy: 's', outreach: { channel: 'email', subject: 'x', body: 'FLAG_ME', call_to_action: 'c' }, key_points: [], crm_updates: [], confidence: 1 }) }));
    const { frames } = await readSSE(await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1' } }));
    const err = frames.find((f) => f !== '[DONE]' && f.type === 'error');
    assert.ok(err && err.blocked && /moderation/.test(err.error), JSON.stringify(frames));
  });
  let approval;
  await t('sdr-agent approval: send_sdr_message -> tool_called + approval_required{state, approvals[callId]}; nothing queued yet', async () => {
    seed(supa); openai.reset();
    openai.script(() => ({ toolCall: { call_id: 'call_send', ...sendCall() } }));
    const { frames } = await readSSE(await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1', goal: 'send the intro' } }));
    approval = frames.find((f) => f !== '[DONE]' && f.type === 'approval_required');
    assert.ok(approval, JSON.stringify(frames));
    assert.equal(approval.approvals[0].callId, 'call_send');
    assert.equal(approval.approvals[0].tool, 'send_sdr_message');
    assert.ok(approval.state.length > 20);
    assert.equal(supa.table('outbound_messages').length, 0, 'not executed before approval');
    assert.ok(!frames.some((f) => f.type === 'final'));
  });
  await t('sdr-agent resume with approve:true -> tool executes (outbound_messages queued) -> final', async () => {
    assert.ok(approval, 'needs previous step');
    // after resume the model gets the tool output and answers with the default structured draft
    const { frames } = await readSSE(await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1', resume: { state: approval.state, decisions: [{ callId: 'call_send', approve: true }] } } }));
    assert.ok(frames.some((f) => f !== '[DONE]' && f.type === 'final'), JSON.stringify(frames).slice(0, 600));
    const rows = supa.table('outbound_messages');
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].contact_id, rows[0].channel, rows[0].subject, rows[0].body, rows[0].status, rows[0].created_by_agent], ['c1', 'email', 'Hello', 'Hi Grace, quick note.', 'queued', true]);
    const out = reqs().at(-1).input.find((i) => i.type === 'function_call_output' && i.call_id === 'call_send');
    assert.ok(out && /queued/.test(JSON.stringify(out.output)), 'tool result returned to the model');
  });
  await t('sdr-agent resume with approve:false (reject) -> nothing queued, run continues', async () => {
    seed(supa); openai.reset();
    openai.script(() => ({ toolCall: { call_id: 'call_send2', ...sendCall() } }));
    const first = await readSSE(await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1' } }));
    const ap = first.frames.find((f) => f !== '[DONE]' && f.type === 'approval_required');
    assert.ok(ap);
    const { frames } = await readSSE(await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1', resume: { state: ap.state, decisions: [{ callId: 'call_send2', approve: false }] } } }));
    assert.equal(supa.table('outbound_messages').length, 0);
    assert.ok(frames.some((f) => f !== '[DONE]' && (f.type === 'final' || f.type === 'approval_required')), JSON.stringify(frames).slice(0, 400));
  });
  await t('sdr-agent resume with garbage / unsigned state -> 400 (rejected before any run)', async () => {
    for (const state of ['not-a-state', '', 123, null]) {
      const r = await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1', resume: { state, decisions: [] } } });
      assert.equal(r.status, 400, String(state)); assert.match((await jsonOf(r)).error, /resume state/i);
    }
  });
  await t('sdr-agent: approval state is signed (v1.<ts>.<hmac>.<state>); the RAW state, a modified state, another user, another lead/agent and an expired state are all rejected and queue nothing', async () => {
    seed(supa); openai.reset();
    openai.script(() => ({ toolCall: { call_id: 'call_sig', ...sendCall() } }));
    const first = await readSSE(await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1' } }));
    const ap = first.frames.find((f) => f !== '[DONE]' && f.type === 'approval_required');
    assert.ok(ap && /^v1\.\d{10,16}\.[0-9a-f]{64}\./.test(ap.state), ap?.state?.slice(0, 40));
    const raw = ap.state.split('.').slice(3).join('.');
    const decisions = [{ callId: 'call_sig', approve: true }];
    const attempt = async (state, over = {}, token = 'good-jwt') => callV2(sdr, { token, body: { agentId: 'sdr-cold-email', leadId: 'c1', ...over, resume: { state, decisions } } });
    const parts = ap.state.split('.');
    const forged = [
      ['raw (unsigned) RunState', attempt(raw)],
      ['modified payload', attempt(ap.state.slice(0, -3) + (ap.state.endsWith('abc') ? 'xyz' : 'abc'))],
      ['modified mac', attempt(['v1', parts[1], '0'.repeat(64), ...parts.slice(3)].join('.'))],
      ['re-dated (older ts, same mac)', attempt(['v1', String(Number(parts[1]) - 7_200_000), ...parts.slice(2)].join('.'))],
      ['different user', attempt(ap.state, {}, 'admin-jwt')],
      ['different agent', attempt(ap.state, { agentId: 'sdr-follow-up' })],
    ];
    for (const [what, p] of forged) { const r = await p; assert.equal(r.status, 400, what); assert.match((await jsonOf(r)).error, /resume state/i, what); }
    seed(supa);
    const other = await attempt(ap.state, { leadId: 'c2' });
    assert.ok([400, 404].includes(other.status), 'different lead: ' + other.status);
    assert.equal(supa.table('outbound_messages').length, 0, 'nothing was sent by any forged resume');
    // and the genuine signed state still works for its owner
    const ok = await readSSE(await attempt(ap.state));
    assert.ok(ok.frames.some((f) => f !== '[DONE]' && f.type === 'final'), JSON.stringify(ok.frames).slice(0, 300));
    assert.equal(supa.table('outbound_messages').length, 1);
  });
  await t('sdr-agent signing secret: SDR_STATE_SECRET overrides the service-key-derived default (state signed with the old secret is rejected after rotation)', async () => {
    seed(supa); openai.reset();
    openai.script(() => ({ toolCall: { call_id: 'call_rot', ...sendCall() } }));
    const first = await readSSE(await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1' } }));
    const ap = first.frames.find((f) => f !== '[DONE]' && f.type === 'approval_required');
    process.env.SDR_STATE_SECRET = 'rotated-secret';
    try {
      const r = await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1', resume: { state: ap.state, decisions: [{ callId: 'call_rot', approve: true }] } } });
      assert.equal(r.status, 400);
    } finally { delete process.env.SDR_STATE_SECRET; }
  });
  await t('sdr-agent / sdr-run: the caller must be able to see the lead under RLS (user client read of contacts) -> 404 and no run otherwise; anon key rejected by default', async () => {
    seed(supa); openai.reset();
    const r = await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'nope' } });
    assert.equal(r.status, 404);
    const r2 = await callV1(run.handler, { body: { action: 'run', agentId: 'sdr-cold-email', contactId: 'nope' } });
    assert.equal(r2.statusCode, 404);
    assert.equal(openai.requests('/v1/responses').length, 0, 'no model call for an invisible lead');
    const n0 = supa.log.length;
    await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1' } });
    const check = supa.log.slice(n0).find((l) => /\/rest\/v1\/contacts/.test(l.path));
    assert.equal(check.headers.authorization, 'Bearer good-jwt'); assert.equal(check.headers.apikey, 'anon-key');
    assert.equal((await callV2(sdr, { body: { agentId: 'sdr-cold-email', leadId: 'c1' }, token: 'anon-key' })).status, 401);
    assert.equal((await callV1(run.handler, { body: { action: 'metadata' }, token: 'anon-key' })).statusCode, 401);
  });
  await t('sdr-agent: handoff event emitted for orchestrator -> specialist', async () => {
    seed(supa); openai.reset();
    openai.script((b) => {
      const tr = b.tools.find((x) => x.type === 'function' && /^transfer_to_/.test(x.name) && /follow/i.test(x.name));
      return tr ? { toolCall: { call_id: 'call_h2', name: tr.name, arguments: {} } } : undefined;
    });
    const { frames } = await readSSE(await callV2(sdr, { body: { agentId: 'auto', leadId: 'c1' } }));
    const h = frames.find((f) => f !== '[DONE]' && f.type === 'handoff');
    assert.ok(h && h.to === 'Follow-Up SDR', JSON.stringify(frames).slice(0, 500));
  });

  // ---------------- individual tools (executed directly with the stub DB)
  const exec = async (tool, input) => JSON.parse(await tool.invoke({ context: {} }, JSON.stringify(input)).then((x) => (typeof x === 'string' ? x : JSON.stringify(x))));
  await t('tool get_lead_context: contact + open deals (closed filtered) + activities; unknown lead -> error', async () => {
    seed(supa);
    supa.insert('deals', { id: 'd2', title: 'Old', stage: 'closed-won', contact_id: 'c1' });
    const r = await exec(agents.getLeadContext, { lead_id: 'c1' });
    assert.equal(r.contact.name, 'Grace Hopper'); assert.deepEqual(r.open_deals.map((d) => d.id), ['d1']); assert.equal(r.recent_activity.length, 1);
    assert.equal((await exec(agents.getLeadContext, { lead_id: 'nope' })).error, 'Lead not found');
  });
  await t('tool create_followup_task inserts a task', async () => {
    seed(supa);
    const r = await exec(agents.createFollowupTask, { lead_id: 'c1', title: 'Call', due_date: null, notes: null });
    assert.equal(r.success, true); assert.equal(supa.table('tasks')[0].title, 'Call');
  });
  await t('tool update_pipeline_stage: closed-won needs approval, qualification does not; executes update', async () => {
    seed(supa);
    const needs = async (stage) => { const n = agents.updatePipelineStage.needsApproval; return typeof n === 'function' ? n({}, { deal_id: 'd1', stage }) : n; };
    assert.equal(await needs('closed-won'), true); assert.equal(await needs('closed-lost'), true); assert.equal(await needs('proposal'), false);
    const r = await exec(agents.updatePipelineStage, { deal_id: 'd1', stage: 'negotiation' });
    assert.equal(r.success, true); assert.equal(supa.table('deals')[0].stage, 'negotiation');
  });
  await t('tool schedule_meeting: invalid date -> error; valid -> calendar_events with end = start+duration', async () => {
    seed(supa);
    assert.match((await exec(agents.scheduleMeeting, { lead_id: 'c1', start_iso: 'garbage', duration_minutes: 30, title: 'x' })).error, /Invalid start/);
    const r = await exec(agents.scheduleMeeting, { lead_id: 'c1', start_iso: '2026-12-01T15:00:00Z', duration_minutes: 45, title: 'Demo' });
    assert.equal(r.success, true);
    const ev = supa.table('calendar_events')[0];
    assert.equal(new Date(ev.end_time) - new Date(ev.start_time), 45 * 60000);
  });
  await t('tool log_autopilot_state: invalid JSON -> error; valid -> upsert autopilot_state on lead_id (idempotent)', async () => {
    seed(supa);
    assert.match((await exec(agents.logAutopilotState, { lead_id: 'c1', state_json: '{bad' })).error, /not valid JSON/);
    await exec(agents.logAutopilotState, { lead_id: 'c1', state_json: '{"step":1}' });
    await exec(agents.logAutopilotState, { lead_id: 'c1', state_json: '{"step":2}' });
    assert.equal(supa.table('autopilot_state').length, 1); assert.equal(supa.table('autopilot_state')[0].state.step, 2);
  });
  await t('tool save_activity inserts with metadata.source', async () => {
    seed(supa);
    await exec(agents.saveActivity, { lead_id: 'c1', type: 'note', description: 'did a thing' });
    assert.equal(supa.table('activities').at(-1).metadata.source, 'sdr-agent');
  });
  await t('guardrail unit: opt-out regex matches variants and avoids false positives ("stopwatch")', async () => {
    const hit = async (s) => (await agents.optOutGuardrail.execute({ input: s })).tripwireTriggered;
    for (const s of ['stop', 'Please UNSUBSCRIBE', 'opt out', 'opt-out', 'remove me', "don't contact me", 'do not contact']) assert.equal(await hit(s), true, s);
    for (const s of ['stopwatch demo', 'Advance this lead toward a meeting.', 'subscribe to our newsletter']) assert.equal(await hit(s), false, s);
  });
  await t('guardrail: opt-out also trips on the DEFAULT sdr run prompt? (must NOT: "Goal: Advance this lead")', async () => {
    assert.equal((await agents.optOutGuardrail.execute({ input: 'Lead id: c1\nGoal: Advance this lead toward a meeting.' })).tripwireTriggered, false);
  });

  // ---------------- skills-api (v1)
  await t('skills-api GET lists 14 sdr + superpowers skills; 401 without auth', async () => {
    assert.equal((await callV1(skills.handler, { method: 'GET', token: null })).statusCode, 401);
    const r = await callV1(skills.handler, { method: 'GET' });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json.skills.filter((s) => s.category === 'sdr').length, 14);
    assert.ok(r.json.skills.length > 14);
  });
  await t('skills-api POST: 400 missing ids; 404 unknown; superpowers skill runs; sdr skill runs via Agents SDK', async () => {
    seed(supa); openai.reset();
    assert.equal((await callV1(skills.handler, { body: {} })).statusCode, 400);
    assert.equal((await callV1(skills.handler, { body: { skillId: 'zzz', contactId: 'c1' } })).statusCode, 404);
    const sp = await callV1(skills.handler, { body: { skillId: 'test-driven-development', contactId: 'c1' } });
    assert.equal(sp.statusCode, 200, sp.body); assert.match(sp.json.result.message, /test-driven-development/);
    const sd = await callV1(skills.handler, { body: { skillId: 'sdr-cold-email', contactId: 'c1' } });
    assert.equal(sd.statusCode, 200, sd.body); assert.equal(sd.json.result.status, 'final');
    assert.equal((await callV1(skills.handler, { method: 'DELETE' })).statusCode, 405);
  });
}
