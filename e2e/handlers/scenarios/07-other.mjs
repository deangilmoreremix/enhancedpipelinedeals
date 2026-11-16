import { spawn } from 'node:child_process';
import path from 'node:path';
import { assert, callV1, withEnv } from '../lib/util.mjs';

export const label = 'remaining functions (run-agent / autopilot / selectPersona / memory-get / mood-preview)';

// These legacy functions are exercised in demo mode (anon key accepted); strict (default) mode is covered by 01/02/05/06.
export default async function (ctx) {
  return withEnv({ ALLOW_ANON_FUNCTIONS: 'true' }, () => run(ctx));
}

async function run({ t, openai, supa, loadFunction, REPO }) {
  const load = async (n) => (await loadFunction(n)).handler;
  const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../.build');

  // ===================== run-agent
  const ra = await load('run-agent');
  await t('run-agent: 401 without / with a bad token or the anon key when anon is off (nothing read, nothing logged)', async () => {
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada' }], contact_agent_settings: [{ contact_id: 'c1', autopilot_enabled: true }] }); const n0 = supa.log.length;
    assert.equal((await callV1(ra, { body: { contactId: 'c1' }, token: null })).statusCode, 401);
    assert.equal((await callV1(ra, { body: { contactId: 'c1' }, token: 'bad' })).statusCode, 401);
    assert.equal((await withEnv({ ALLOW_ANON_FUNCTIONS: undefined }, () => callV1(ra, { body: { contactId: 'c1' }, token: 'anon-key' }))).statusCode, 401);
    assert.equal(supa.table('agent_logs').length, 0);
    assert.ok(!supa.log.slice(n0).some((l) => /\/rest\/v1\//.test(l.path ?? '')), 'no PostgREST call for unauthenticated requests');
  });
  await t('run-agent: reads go through the caller JWT (RLS applies), not the service role', async () => {
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada' }], contact_agent_settings: [{ contact_id: 'c1', autopilot_enabled: false }] });
    await callV1(ra, { body: { contactId: 'c1' } });
    const reads = supa.requests({ method: 'GET', path: '/rest/v1/contacts' });
    assert.ok(reads.length && reads.every((r) => /Bearer good-jwt/.test(r.headers?.authorization ?? '')), JSON.stringify(reads[0]?.headers));
  });
  await t('run-agent: OPTIONS 200 / GET 405 / contactId required 400 / unknown contact 404 / no settings 400', async () => {
    assert.equal((await callV1(ra, { method: 'OPTIONS', token: null })).statusCode, 200);
    assert.equal((await callV1(ra, { method: 'GET', token: null })).statusCode, 405);
    assert.equal((await callV1(ra, { body: {}, })).statusCode, 400);
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada', company: 'Engines' }] });
    assert.equal((await callV1(ra, { body: { contactId: 'zz' }, })).statusCode, 404);
    assert.equal((await callV1(ra, { body: { contactId: 'c1' }, })).statusCode, 400);
  });
  await t('run-agent: autopilot disabled -> skipped; enabled -> AI message logged to agent_logs and step advanced; sequence end -> done', async () => {
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada', company: 'Engines' }], contact_agent_settings: [{ contact_id: 'c1', autopilot_enabled: false }] });
    assert.equal((await callV1(ra, { body: { contactId: 'c1' }, })).json.skipped, true);
    supa.table('contact_agent_settings')[0].autopilot_enabled = true;
    openai.reset(); openai.script(() => ({ text: 'Hi Ada, quick idea.' }));
    const r = await callV1(ra, { body: { contactId: 'c1' }, });
    assert.equal(r.statusCode, 200, r.body); assert.equal(r.json.preview, 'Hi Ada, quick idea.'); assert.equal(r.json.step, 1);
    assert.equal(supa.table('contact_agent_settings')[0].current_step, 1);
    assert.match(supa.table('agent_logs')[0].message, /Hi Ada/);
    supa.table('contact_agent_settings')[0].current_step = 30;
    assert.equal((await callV1(ra, { body: { contactId: 'c1' }, })).json.done, true);
  });
  await t('run-agent: AI failure falls back to placeholder text (still logs step)', async () => {
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada' }], contact_agent_settings: [{ contact_id: 'c1', autopilot_enabled: true }] });
    openai.script(() => ({ http: { status: 500, message: 'x' } }));
    const r = await callV1(ra, { body: { contactId: 'c1' }, });
    assert.equal(r.statusCode, 200); assert.match(r.json.preview, /real SDR copy/);
  });

  // ===================== autopilot trio + autopilot-run
  const ta = await load('trigger-autopilot'), gas = await load('get-autopilot-status'), uas = await load('update-autopilot-settings'), apr = await load('autopilot-run');
  const aSeed = (enabled = true, status) => supa.reset({ contacts: [{ id: 'c1', name: 'Ada', email: 'ada@x.co', status }], contact_agent_settings: [{ contact_id: 'c1', autopilot_enabled: enabled, current_step: 0, sequence_length: 5 }] });
  await t('update-autopilot-settings / get-autopilot-status: 401 without / with a bad token (nothing read or written); OPTIONS/405 need no token', async () => {
    aSeed(false); const n0 = supa.log.length;
    for (const h of [uas, gas]) {
      assert.equal((await callV1(h, { body: { contactId: 'c1', autopilot_enabled: true }, token: null })).statusCode, 401);
      assert.equal((await callV1(h, { body: { contactId: 'c1', autopilot_enabled: true }, token: 'bad' })).statusCode, 401);
      assert.equal((await callV1(h, { method: 'OPTIONS', token: null })).statusCode, 200);
      assert.equal((await callV1(h, { method: 'GET', token: null })).statusCode, 405);
    }
    assert.equal(supa.table('contact_agent_settings')[0].autopilot_enabled, false);
    assert.ok(!supa.log.slice(n0).some((l) => /\/rest\/v1\//.test(l.path ?? '')), 'no PostgREST call for unauthenticated requests');
  });
  await t('update-autopilot-settings: validation + boolean toggles persisted', async () => {
    assert.equal((await callV1(uas, { body: {}, })).statusCode, 400);
    aSeed(false);
    const r = await callV1(uas, { body: { contactId: 'c1', autopilot_enabled: true, escalated_to_ae: true }, });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([supa.table('contact_agent_settings')[0].autopilot_enabled, supa.table('contact_agent_settings')[0].escalated_to_ae], [true, true]);
    assert.equal((await callV1(uas, { body: { contactId: 'zz', autopilot_enabled: true } })).statusCode, 404, 'no settings row -> 404');
  });
  await t('get-autopilot-status: contact + settings + last log; 404 unknown', async () => {
    aSeed(true); supa.insert('agent_logs', { contact_id: 'c1', level: 'info', message: 'older', created_at: '2026-01-01T00:00:00Z' }); supa.insert('agent_logs', { contact_id: 'c1', level: 'info', message: 'newest', created_at: '2026-02-01T00:00:00Z' });
    const r = await callV1(gas, { body: { contactId: 'c1' }, });
    assert.equal(r.statusCode, 200, r.body); assert.equal(r.json.lastLog.message, 'newest'); assert.equal(r.json.settings.autopilot_enabled, true);
    assert.equal((await callV1(gas, { body: { contactId: 'zz' }, })).statusCode, 404);
  });
  await t('get-autopilot-status returns the contact lead status under the real column name (contacts.status)', async () => {
    aSeed(true, 'prospect');
    const r = await callV1(gas, { body: { contactId: 'c1' }, });
    assert.equal(r.json.contact.lead_status ?? r.json.contact.status, 'prospect', JSON.stringify(r.json.contact));
  });
  const draftJson = JSON.stringify({ strategy: 'warm intro', outreach: { channel: 'email', subject: 'Hello Ada', body: 'Hi Ada, quick note about pipelines.', call_to_action: 'Book 15 minutes?' }, key_points: ['k'], crm_updates: [], confidence: 70 });
  await t('trigger-autopilot: 401 without / with a bad token (nothing logged); OPTIONS 200; 405 on GET', async () => {
    aSeed(true);
    assert.equal((await callV1(ta, { body: { contactId: 'c1' }, token: null })).statusCode, 401);
    assert.equal((await callV1(ta, { body: { contactId: 'c1' }, token: 'bad' })).statusCode, 401);
    assert.equal(supa.table('agent_logs').length, 0);
    assert.equal((await callV1(ta, { method: 'GET' })).statusCode, 405);
    assert.equal((await callV1(ta, { method: 'OPTIONS', token: null })).statusCode, 200);
  });
  await t('trigger-autopilot: disabled -> skipped + log; unknown contact 404; missing settings 400; missing contactId 400', async () => {
    aSeed(false);
    const r = await callV1(ta, { body: { contactId: 'c1' } });
    assert.equal(r.json.skipped, true); assert.equal(supa.table('agent_logs').length, 1);
    assert.equal((await callV1(ta, { body: { contactId: 'nope' } })).statusCode, 404);
    assert.equal((await callV1(ta, { body: {} })).statusCode, 400);
    supa.reset({ contacts: [{ id: 'c2', name: 'B', status: 'lead' }] });
    assert.equal((await callV1(ta, { body: { contactId: 'c2' } })).statusCode, 400);
  });
  await t('trigger-autopilot: enabled + lead -> runs the real SDR specialist, stores the DRAFT in agent_logs (metadata), advances current_step, queues NOTHING', async () => {
    aSeed(true, 'lead');
    supa.table('contact_agent_settings')[0].agent_id = 'sdr-cold-email';
    openai.reset(); openai.script(() => ({ toolCall: { call_id: 'c_ctx', name: 'get_lead_context', arguments: { lead_id: 'c1' } } }));
    openai.script(() => ({ text: draftJson }));
    const r = await callV1(ta, { body: { contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json.status, 'lead', 'reads contacts.status (not the non-existent lead_status)');
    assert.equal(r.json.result.success, true); assert.equal(r.json.result.step, 1);
    assert.equal(r.json.result.draft.outreach.subject, 'Hello Ada');
    const log = supa.table('agent_logs').at(-1);
    assert.match(log.message, /draft prepared \(not sent/); assert.equal(log.contact_id, 'c1');
    assert.equal(log.metadata.requires_approval, true); assert.equal(log.metadata.draft.outreach.body, 'Hi Ada, quick note about pipelines.');
    assert.equal(supa.table('contact_agent_settings')[0].current_step, 1);
    assert.equal(supa.table('outbound_messages').length, 0, 'nothing queued for sending');
    const prompt = JSON.stringify(openai.requests('/v1/responses')[0].body.input);
    assert.match(prompt, /step 1 of 5/i); assert.match(prompt, /Do not send anything/);
  });
  await t('trigger-autopilot: unknown agent_id falls back to the orchestrator; churned contact is handled, customer is skipped with a log', async () => {
    aSeed(true, 'churned'); // settings.agent_id unset -> "auto"
    openai.reset(); openai.script(() => ({ text: draftJson }));
    const r = await callV1(ta, { body: { contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body); assert.ok(r.json.result.success || r.json.result.error, JSON.stringify(r.json));
    aSeed(true, 'customer');
    const c = await callV1(ta, { body: { contactId: 'c1' } });
    assert.equal(c.json.result.skipped, true); assert.match(c.json.result.reason, /customer/);
    assert.equal(supa.table('contact_agent_settings')[0].current_step, 0);
  });
  await t('trigger-autopilot: send_sdr_message needs approval -> logged as awaiting approval, step NOT advanced, nothing queued', async () => {
    aSeed(true, 'prospect');
    supa.table('contact_agent_settings')[0].agent_id = 'sdr-cold-email';
    openai.reset(); openai.script(() => ({ toolCall: { call_id: 'c_send', name: 'send_sdr_message', arguments: { lead_id: 'c1', channel: 'email', subject: 'Hi', body: 'Hello Ada' } } }));
    const r = await callV1(ta, { body: { contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body); assert.equal(r.json.result.awaitingApproval, true);
    assert.equal(supa.table('contact_agent_settings')[0].current_step, 0);
    assert.equal(supa.table('outbound_messages').length, 0);
    assert.equal(supa.table('agent_logs').at(-1).metadata.requires_approval, true);
  });
  await t('trigger-autopilot: model failure -> error logged (level error), step not advanced, request still 200 with result.error', async () => {
    aSeed(true, 'lead'); supa.table('contact_agent_settings')[0].agent_id = 'sdr-cold-email';
    openai.reset(); openai.script(() => ({ http: { status: 500, message: 'model down' } }));
    const r = await callV1(ta, { body: { contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body); assert.match(r.json.result.error, /./);
    assert.equal(supa.table('agent_logs').at(-1).level, 'error'); assert.equal(supa.table('contact_agent_settings')[0].current_step, 0);
  });
  await t('trigger-autopilot: sequence already complete -> logged, no model call', async () => {
    aSeed(true, 'lead'); supa.table('contact_agent_settings')[0].current_step = 5; openai.reset();
    const r = await callV1(ta, { body: { contactId: 'c1' } });
    assert.equal(r.json.result.done, true); assert.equal(openai.requests('/v1/responses').length, 0);
  });
  await t('trigger-autopilot: AI SDR unavailable (no OPENAI_API_KEY) -> honest skip + warn log, no step advance', async () => {
    aSeed(true, 'lead'); const key = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY; openai.reset();
    try {
      const r = await callV1(ta, { body: { contactId: 'c1' } });
      assert.equal(r.json.result.skipped, true); assert.match(r.json.result.reason, /not available/);
      assert.equal(supa.table('agent_logs').at(-1).level, 'warn'); assert.equal(supa.table('contact_agent_settings')[0].current_step, 0);
      assert.equal(openai.requests('/v1/responses').length, 0);
    } finally { process.env.OPENAI_API_KEY = key; }
  });
  await t('autopilot-run: 401 without token; forwards the caller\'s Authorization to trigger-autopilot over HTTP and wraps the result', async () => {
    aSeed(true, 'lead'); supa.table('contact_agent_settings')[0].agent_id = 'sdr-cold-email';
    assert.equal((await callV1(apr, { body: { contactId: 'c1' }, token: null })).statusCode, 401);
    assert.equal((await callV1(apr, { body: { contactId: 'c1' }, token: 'bad' })).statusCode, 401);
    openai.reset(); openai.script(() => ({ text: draftJson }));
    const r = await callV1(apr, { body: { contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body); assert.equal(r.json.contactId, 'c1'); assert.ok(r.json.result.result.draft || r.json.result.result.success);
    const viaAnon = await callV1(apr, { body: { contactId: 'c1' }, token: 'anon-key' });
    assert.equal(viaAnon.statusCode, 200, viaAnon.body);
    assert.equal((await callV1(apr, { body: {} })).statusCode, 400);
    assert.equal((await callV1(apr, { method: 'GET' })).statusCode, 405);
    assert.equal((await callV1(apr, { method: 'OPTIONS', token: null })).statusCode, 204);
  });

  // ===================== selectPersona
  const sp = await load('selectPersona');
  const mg = await load('memory-get'), mp = await load('mood-preview');
  await t('selectPersona / memory-get / mood-preview: 401 without or with a bad token (no DB access)', async () => {
    supa.reset({ contacts: [{ id: 'c1' }] }); const n0 = supa.log.length;
    for (const [h, o] of [[sp, { body: { agent_id: 'a', persona_id: 'p' } }], [mg, { method: 'GET', qs: { contactId: 'c1' } }], [mp, { method: 'GET', qs: { contactId: 'c1' } }]]) {
      assert.equal((await callV1(h, { ...o, token: null })).statusCode, 401);
      assert.equal((await callV1(h, { ...o, token: 'bad' })).statusCode, 401);
      assert.equal((await callV1(h, { ...o, token: 'anon-key' })).statusCode !== 401, true, 'anon key accepted');
    }
    assert.equal(supa.table('agent_persona_selection').length, 1, 'only the anon-key call wrote');
  });
  await t('selectPersona: 405 / 400 missing ids / bad JSON 400 / upsert on agent_id / DB error -> 500 (not a fake success)', async () => {
    assert.equal((await callV1(sp, { method: 'GET' })).statusCode, 405);
    assert.equal((await callV1(sp, { body: { agent_id: 'a' } })).statusCode, 400);
    supa.reset();
    assert.equal((await callV1(sp, { body: { agent_id: 'a', persona_id: 'p1' } })).statusCode, 200);
    await callV1(sp, { body: { agent_id: 'a', persona_id: 'p2' } });
    assert.deepEqual(supa.table('agent_persona_selection').map((r) => r.persona_id), ['p2']);
    assert.equal((await callV1(sp, { body: '{bad' })).statusCode, 400);
    supa.failNext('POST', '/rest/v1/agent_persona_selection', 403, { code: '42501', message: 'rls denied' });
    const denied = await callV1(sp, { body: { agent_id: 'a', persona_id: 'p3' } });
    assert.equal(denied.statusCode, 500); assert.match(denied.json.error, /rls denied/);
  });

  // ===================== memory-get / mood-preview
  await t('memory-get: 405 / 400 / groups agent_memory by memory_type', async () => {
    assert.equal((await callV1(mg, { method: 'POST' })).statusCode, 405);
    assert.equal((await callV1(mg, { method: 'GET' })).statusCode, 400);
    supa.reset({ agent_memory: [{ id: 'm1', contact_id: 'c1', memory_type: 'short', data: {}, updated_at: '2026-01-01' }, { id: 'm2', contact_id: 'c1', memory_type: 'long', data: {}, updated_at: '2026-01-02' }] });
    const r = await callV1(mg, { method: 'GET', qs: { contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body); assert.deepEqual([r.json.memory.short.length, r.json.memory.mid.length, r.json.memory.long.length], [1, 0, 1]);
  });
  await t('mood-preview: contact+deal -> mood (negotiation => precision); unknown contact -> 500 error JSON', async () => {
    supa.reset({ contacts: [{ id: 'c1', name: 'A', status: 'lead' }], deals: [{ id: 'd1', contact_id: 'c1', stage: 'negotiation' }] });
    const r = await callV1(mp, { method: 'GET', qs: { contactId: 'c1' } });
    assert.equal(r.statusCode, 200, r.body); assert.equal(r.json.mood, 'precision');
    assert.equal((await callV1(mp, { method: 'GET' })).statusCode, 400);
  });

  // ===================== env fallback of the shared src client (hand-back item)
  await t('src Supabase client used by memory-get/mood-preview works when only server-side SUPABASE_URL/SUPABASE_ANON_KEY are set (no VITE_*)', async () => {
    supa.reset({ agent_memory: [{ id: 'm1', contact_id: 'c1', memory_type: 'short', data: {}, updated_at: '2026-01-01' }] });
    const n0 = supa.log.length;
    const script = `process.env.SUPABASE_URL=${JSON.stringify(process.env.SUPABASE_URL)};process.env.SUPABASE_ANON_KEY='anon-key';delete process.env.VITE_SUPABASE_URL;delete process.env.VITE_SUPABASE_ANON_KEY;const m=await import(${JSON.stringify(path.join(OUT, 'memory-get.mjs'))});const r=await m.handler({httpMethod:'GET',headers:{authorization:'Bearer anon-key'},queryStringParameters:{contactId:'c1'}},{});console.log(r.body)`;
    // async spawn: the stub servers live in THIS process, so the event loop must stay free
    const out = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }, cwd: REPO });
      let stdout = '', stderr = '';
      child.stdout.on('data', (d) => (stdout += d)); child.stderr.on('data', (d) => (stderr += d));
      child.on('close', () => resolve({ stdout, stderr }));
    });
    assert.match(out.stdout, /"short":\[\{/, 'memory rows returned through the stub: ' + out.stdout.slice(0, 120) + ' ERR ' + out.stderr.slice(0, 300));
    const reached = supa.log.length > n0;
    assert.ok(reached, `memory-get never reached SUPABASE_URL (src/lib/core/supabaseClient.ts reads only VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY and falls back to http://localhost:54321). output: ${(out.stdout + out.stderr).slice(0, 160)}`);
  });
}
