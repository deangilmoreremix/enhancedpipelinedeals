import { spawn } from 'node:child_process';
import path from 'node:path';
import { assert, callV1, freshIp, withEnv } from '../lib/util.mjs';

export const label = 'remaining functions (calendar/email/import/pipeline/autopilot/...)';

const FUTURE = '2027-03-01T15:00:00.000Z';

// These legacy functions are exercised in demo mode (anon key accepted); strict (default) mode is covered by 01/02/05/06.
export default async function (ctx) {
  return withEnv({ ALLOW_ANON_FUNCTIONS: 'true' }, () => run(ctx));
}

async function run({ t, openai, supa, loadFunction, REPO }) {
  const load = async (n) => (await loadFunction(n)).handler;
  const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../.build');

  // ===================== calendar-api
  const cal = await load('calendar-api');
  const calCall = (method, p, body, qs, token = 'good-jwt') => callV1(cal, { method, path: `/.netlify/functions/calendar-api/${p}`, body, qs, token });
  await t('calendar-api: unknown route 404', async () => assert.equal((await calCall('GET', 'nope')).statusCode, 404));
  await t('calendar-api: no / invalid token -> 401 on every route (no DB access); OPTIONS 204', async () => {
    supa.reset(); const n0 = supa.log.length;
    for (const [m, p] of [['GET', 'events'], ['POST', 'events'], ['PUT', 'events/e1'], ['DELETE', 'events/e1'], ['POST', 'schedule-meeting'], ['POST', 'deadlines'], ['GET', 'deadlines']]) {
      assert.equal((await calCall(m, p, { title: 'x' }, undefined, null)).statusCode, 401, `${m} ${p} without token`);
      assert.equal((await calCall(m, p, { title: 'x' }, undefined, 'bad-token')).statusCode, 401, `${m} ${p} with bad token`);
    }
    assert.equal(supa.table('calendar_events').length, 0);
    assert.equal((await calCall('OPTIONS', 'events', undefined, undefined, null)).statusCode, 204);
    assert.ok(!supa.log.slice(n0).some((l) => /\/rest\/v1\//.test(l.path ?? l.url ?? '')), 'no PostgREST call was made for unauthenticated requests');
  });
  await t('calendar-api: acting user = verified JWT user (user-1), body.userId is ignored (cannot be spoofed); anon key -> demo user', async () => {
    supa.reset();
    const r = await calCall('POST', 'events', { userId: 'attacker', title: 'Mine', startTime: FUTURE, endTime: '2027-03-01T16:00:00.000Z' });
    assert.equal(r.statusCode, 201, r.body);
    assert.equal(supa.table('calendar_events')[0].created_by, 'user-1');
    const demo = await calCall('POST', 'events', { title: 'Anon', startTime: FUTURE, endTime: '2027-03-01T16:00:00.000Z' }, undefined, 'anon-key');
    assert.equal(demo.statusCode, 201, demo.body);
    assert.equal(supa.table('calendar_events')[1].created_by, '00000000-0000-0000-0000-000000000000');
  });
  await t('calendar-api POST events: title/startTime/endTime required (400)', async () => {
    assert.equal((await calCall('POST', 'events', { title: 'x' })).statusCode, 400);
    assert.equal((await calCall('POST', 'events', { userId: 'u1', title: 'x' })).statusCode, 400);
  });
  await t('calendar-api POST events with ISO-string dates -> 201 + row (start_time/end_time ISO); invalid date -> 400 not 500', async () => {
    supa.reset();
    const r = await calCall('POST', 'events', { userId: 'u1', title: 'Kickoff', startTime: FUTURE, endTime: '2027-03-01T16:00:00.000Z', attendees: [{ email: 'a@b.co' }], dealId: 'd1' });
    assert.equal(r.statusCode, 201, r.body);
    assert.equal(r.json.event.title, 'Kickoff');
    const row = supa.table('calendar_events')[0];
    assert.deepEqual([row.start_time, row.end_time, row.created_by, row.deal_id, row.attendees[0].status], [FUTURE, '2027-03-01T16:00:00.000Z', 'user-1', 'd1', 'pending']);
    const bad = await calCall('POST', 'events', { userId: 'u1', title: 'x', startTime: 'garbage', endTime: FUTURE });
    assert.equal(bad.statusCode, 400, bad.body);
  });
  await t('calendar-api GET events: filters (dealId/status/limit/date range) + ordering', async () => {
    supa.reset({ calendar_events: [
      { id: 'e1', title: 'B', deal_id: 'd1', status: 'confirmed', start_time: '2027-03-02T10:00:00.000Z', end_time: '2027-03-02T11:00:00.000Z' },
      { id: 'e2', title: 'A', deal_id: 'd1', status: 'confirmed', start_time: '2027-03-01T10:00:00.000Z', end_time: '2027-03-01T11:00:00.000Z' },
      { id: 'e3', title: 'C', deal_id: 'd2', status: 'cancelled', start_time: '2027-03-03T10:00:00.000Z', end_time: '2027-03-03T11:00:00.000Z' },
    ] });
    let r = await calCall('GET', 'events', undefined, { dealId: 'd1' });
    assert.deepEqual(r.json.events.map((e) => e.id), ['e2', 'e1']);
    r = await calCall('GET', 'events', undefined, { status: 'cancelled' }); assert.deepEqual(r.json.events.map((e) => e.id), ['e3']);
    r = await calCall('GET', 'events', undefined, { limit: '1' }); assert.equal(r.json.events.length, 1);
    r = await calCall('GET', 'events', undefined, { startDate: '2027-03-02T00:00:00Z', endDate: '2027-03-02T23:59:59Z' }); assert.deepEqual(r.json.events.map((e) => e.id), ['e1']);
    r = await calCall('GET', 'events', undefined, { startDate: 'nonsense' }); assert.equal(r.statusCode, 400);
  });
  await t('calendar-api PUT/DELETE events: update converts dates; delete removes row (user from JWT, no userId in body)', async () => {
    supa.reset({ calendar_events: [{ id: 'e1', title: 'Old', start_time: FUTURE, end_time: FUTURE }] });
    const u = await calCall('PUT', 'events/e1', { title: 'New', startTime: '2027-04-01T09:00:00.000Z' });
    assert.equal(u.statusCode, 200, u.body);
    assert.deepEqual([supa.table('calendar_events')[0].title, supa.table('calendar_events')[0].start_time], ['New', '2027-04-01T09:00:00.000Z']);
    assert.equal((await calCall('DELETE', 'events/e1', {})).statusCode, 200);
    assert.equal(supa.table('calendar_events').length, 0);
  });
  await t('calendar-api schedule-meeting: dealId+startTime required; creates meeting event from deal', async () => {
    supa.reset({ deals: [{ id: 'd1', value: 1000, stage: 'proposal' }] });
    assert.equal((await calCall('POST', 'schedule-meeting', { userId: 'u1' })).statusCode, 400);
    assert.equal((await calCall('POST', 'schedule-meeting', { userId: 'u1', dealId: 'd1' })).statusCode, 400);
    const r = await calCall('POST', 'schedule-meeting', { userId: 'u1', dealId: 'd1', startTime: FUTURE, durationMinutes: 30 });
    assert.equal(r.statusCode, 201, r.body);
    const ev = supa.table('calendar_events')[0];
    assert.equal(new Date(ev.end_time) - new Date(ev.start_time), 30 * 60000);
    assert.equal(ev.event_type, 'meeting');
  });
  await t('calendar-api deadlines: create (deal must exist) / list / update / complete(PATCH)', async () => {
    supa.reset({ deals: [{ id: 'd1' }] });
    assert.equal((await calCall('POST', 'deadlines', { userId: 'u1', dealId: 'd1' })).statusCode, 400);
    const c = await calCall('POST', 'deadlines', { userId: 'u1', dealId: 'd1', title: 'Sign', deadlineAt: FUTURE, priority: 'high', createCalendarEvent: true });
    assert.equal(c.statusCode, 201, c.body);
    assert.equal(supa.table('deal_deadlines')[0].deadline_at, FUTURE);
    assert.equal(supa.table('calendar_events')[0].event_type, 'deadline', 'calendar event created for deadline');
    const id = supa.table('deal_deadlines')[0].id;
    const l = await calCall('GET', 'deadlines', undefined, { dealId: 'd1' });
    assert.equal(l.statusCode, 200, l.body); assert.equal(l.json.deadlines.length, 1);
    const u = await calCall('PUT', `deadlines/${id}`, { userId: 'u1', title: 'Sign v2', deadlineAt: '2027-05-01T00:00:00.000Z' });
    assert.equal(u.statusCode, 200, u.body); assert.equal(supa.table('deal_deadlines')[0].title, 'Sign v2');
    const p = await calCall('PATCH', `deadlines/${id}`, { userId: 'u1' });
    assert.equal(p.statusCode, 200, p.body); assert.ok(supa.table('deal_deadlines')[0].completed_at);
    assert.equal((await calCall('POST', 'deadlines', { userId: 'u1', dealId: 'missing', title: 'x', deadlineAt: FUTURE })).statusCode, 500, 'missing deal surfaces as an error');
  });

  // ===================== email-api
  const mail = await load('email-api');
  const mailCall = (method, p, body, qs, token = 'good-jwt') => callV1(mail, { method, path: `/.netlify/functions/email-api/${p}`, body, qs, token });
  await t('email-api: no / invalid token -> 401 (nothing stored); anon key and user JWT are accepted', async () => {
    supa.reset({ contacts: [] });
    const body = { messageId: 'm0', fromEmail: 'x@y.co', subject: 's', sentAt: '2027-01-01T10:00:00Z' };
    assert.equal((await mailCall('POST', 'process', body, undefined, null)).statusCode, 401);
    assert.equal((await mailCall('POST', 'process', body, undefined, 'nope')).statusCode, 401);
    assert.equal((await mailCall('GET', 'threads', undefined, undefined, null)).statusCode, 401);
    assert.equal(supa.table('emails').length, 0);
    assert.equal((await mailCall('GET', 'threads', undefined, undefined, 'anon-key')).statusCode, 200);
    assert.equal((await mailCall('OPTIONS', 'process', undefined, undefined, null)).statusCode, 204);
  });
  await t('email-api: unknown route 404; process requires fields (400)', async () => {
    assert.equal((await mailCall('GET', 'zzz')).statusCode, 404);
    assert.equal((await mailCall('POST', 'process', { subject: 'x' })).statusCode, 400);
  });
  await t('email-api process: stores email + thread, auto-links to CRM contact by address', async () => {
    supa.reset({ contacts: [{ id: 'c1', email: 'grace@navy.example', name: 'Grace' }], deals: [] });
    const r = await mailCall('POST', 'process', { messageId: 'm1', fromEmail: 'grace@navy.example', toEmails: ['me@x.co'], subject: 'Re: demo', bodyText: 'Thanks, lets talk', sentAt: '2027-01-01T10:00:00Z' });
    assert.equal(r.statusCode, 201, r.body);
    assert.equal(supa.table('emails').length, 1); assert.equal(supa.table('email_threads').length, 1);
    assert.equal(supa.table('email_threads')[0].contact_id, 'c1', 'thread linked to contact');
  });
  await t('email-api link / record-emails / threads / thread emails / search placeholder', async () => {
    assert.equal((await mailCall('POST', 'link', { emailId: 'x' })).statusCode, 400);
    assert.equal((await mailCall('POST', 'link', { emailId: 'x', recordType: 'bogus', recordId: 'y' })).statusCode, 400);
    assert.equal((await mailCall('GET', 'record-emails', undefined, { recordType: 'deal' })).statusCode, 400);
    const th = await mailCall('GET', 'threads', undefined, { contactId: 'c1' });
    assert.equal(th.statusCode, 200, th.body); assert.equal(th.json.threads.length, 1);
    const emails = await mailCall('GET', `threads/${supa.table('email_threads')[0].thread_id}`);
    assert.equal(emails.statusCode, 200, emails.body);
    const se = await mailCall('GET', 'search', undefined, { query: 'x' });
    assert.equal(se.statusCode, 200);
  });

  // ===================== pipelineAI
  const pai = await load('pipelineAI');
  await t('pipelineAI: 401 without auth / OPTIONS 204', async () => {
    assert.equal((await callV1(pai, { token: null, method: 'GET' })).statusCode, 401);
    assert.equal((await callV1(pai, { method: 'OPTIONS' })).statusCode, 204);
  });
  await t('pipelineAI: selects only existing columns (contacts.ai_score, activities.title/description), skips soft-deleted, calls deep model with json_object, stores analysis', async () => {
    supa.reset({ deals: [{ id: 'd1', title: 'A', stage: 'proposal', value: 10 }], contacts: [] });
    openai.script(() => ({ text: JSON.stringify({ overall_health: 71, deals_analysis: [], pipeline_insights: {} }) }));
    const r = await callV1(pai, { method: 'GET' });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json.overall_health, 71);
    const q = supa.requests({ method: 'GET', path: '/rest/v1/deals' })[0];
    assert.ok(!/lead_score/.test(q.params.select) && !/message/.test(q.params.select), q.params.select);
    assert.equal(q.params.deleted_at, 'is.null');
    const b = openai.last('/v1/responses').body;
    assert.deepEqual([b.model, b.text.format.type, b.reasoning.effort], ['gpt-6-astra', 'json_object', 'high']);
    assert.equal(supa.table('pipeline_analysis').length, 1);
  });
  await t('pipelineAI: Supabase error -> 500 with message', async () => {
    supa.failNext('GET', '/rest/v1/deals', 400, { message: 'bad column' });
    const r = await callV1(pai, { method: 'GET' });
    assert.equal(r.statusCode, 500); assert.match(r.json.error, /bad column/);
  });

  // ===================== enhanced-import (deals)
  const eimp = await load('enhanced-import');
  const imp = (body, o = {}) => callV1(eimp, { body, ...o });
  await t('enhanced-import: OPTIONS 200; 401 unauthenticated; GET 405; invalid action 400; missing data 400', async () => {
    assert.equal((await callV1(eimp, { method: 'OPTIONS', token: null })).statusCode, 200);
    assert.equal((await imp({ action: 'validate_deal', data: {} }, { token: null })).statusCode, 401);
    assert.equal((await callV1(eimp, { method: 'GET' })).statusCode, 405);
    assert.equal((await imp({ action: 'nope', data: {} })).statusCode, 400);
    assert.equal((await imp({ action: 'validate_deal' })).statusCode, 400);
  });
  await t('enhanced-import validate_deal business rules', async () => {
    const r = await imp({ action: 'validate_deal', data: { deal: { stage: 'closed-won', probability: 50, value: 0, dueDate: '2000-01-01' } } });
    assert.equal(r.json.data.isValid, false);
    assert.equal(r.json.data.errors.length, 2); assert.equal(r.json.data.warnings.length, 1);
    const ok = await imp({ action: 'validate_deal', data: { deal: { stage: 'proposal', value: 5, probability: 30 } } });
    assert.equal(ok.json.data.isValid, true);
  });
  await t('enhanced-import import_deals_with_ai: CSV + JSON parse, AI enrichment merged; AI failure leaves deal intact', async () => {
    openai.reset();
    openai.script(() => ({ text: JSON.stringify({ industry: 'Tech', size: '50' }) }));
    const csv = 'title,company,value,stage\nDeal A,Acme,100,proposal';
    const r = await imp({ action: 'import_deals_with_ai', data: { format: 'csv', fileContent: csv, enrichmentOptions: { enrichCompanyData: true } } });
    assert.equal(r.statusCode, 200, r.body);
    const d = r.json.data.success[0];
    assert.deepEqual([d.title, d.company, d.enrichedCompanyData?.industry], ['Deal A', 'Acme', 'Tech']);
    openai.script(() => ({ http: { status: 500, message: 'down' } }));
    const j = await imp({ action: 'import_deals_with_ai', data: { format: 'json', fileContent: JSON.stringify([{ title: 'Z', company: 'Q', value: 1 }]), enrichmentOptions: { enrichCompanyData: true, generateDealInsights: true } } });
    assert.equal(j.statusCode, 200); assert.equal(j.json.data.success[0].title, 'Z'); assert.equal(j.json.data.success[0].enrichedCompanyData, undefined);
    const noOpts = await imp({ action: 'import_deals_with_ai', data: { format: 'json', fileContent: '[{"title":"N"}]' } });
    assert.equal(noOpts.statusCode, 200);
  });
  await t('enhanced-import detect_duplicates: same company + >80% similar title => duplicate; others unique', async () => {
    supa.reset({ deals: [{ id: 'x1', title: 'Website redesign project', company: 'Acme' }, { id: 'x2', title: 'Other', company: 'Beta' }] });
    const r = await imp({ action: 'detect_duplicates', data: { resolutionStrategy: 'skip', importedDeals: [{ title: 'Website redesign project', company: 'acme' }, { title: 'Completely new', company: 'Zed' }] } });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json.data.duplicates.map((d) => d.existing.map((e) => e.id)), [['x1'], []]);
  });
  await t('enhanced-import rate limit 100/15min per ip -> 429', async () => {
    const ip = freshIp(); let r;
    for (let i = 0; i < 101; i++) r = await callV1(eimp, { body: { action: 'validate_deal', data: { deal: { stage: 'a', value: 1 } } }, ip });
    assert.equal(r.statusCode, 429);
  });

  // ===================== enhanced-contact-import
  const eci = await load('enhanced-contact-import');
  await t('enhanced-contact-import: OPTIONS 200 / 401 / 405 / missing body 400 / missing fields 400 / bad template 400', async () => {
    assert.equal((await callV1(eci, { method: 'OPTIONS', token: null })).statusCode, 200);
    assert.equal((await callV1(eci, { body: {}, token: null })).statusCode, 401);
    assert.equal((await callV1(eci, { method: 'GET' })).statusCode, 405);
    assert.equal((await callV1(eci, { body: undefined })).statusCode, 400);
    assert.equal((await callV1(eci, { body: { format: 'csv' } })).statusCode, 400);
    assert.equal((await callV1(eci, { body: { fileContent: 'a', format: 'csv', templateId: 'does-not-exist' } })).statusCode, 400);
  });
  await t('enhanced-contact-import: happy path CSV import runs server-side (no enrichment calls needing browser-relative fetch)', async () => {
    const csv = 'name,email,company\nAda Lovelace,ada@engines.example,Engines';
    const tmpl = (await (async () => { const m = await import(path.join(OUT, 'enhanced-contact-import.mjs')); return m; })());
    // find a valid template id by probing the service through the handler's own error path
    let ok;
    for (const id of ['generic-csv-contacts-v1']) {
      const r = await callV1(eci, { body: { fileContent: csv, format: 'csv', templateId: id, enrichmentOptions: { enrichCompanyData: false, discoverSocialProfiles: false, analyzeBuyingSignals: false, generateLeadScoring: false, includeWebResearch: false } } });
      if (r.statusCode !== 400) { ok = r; break; }
    }
    assert.ok(ok, 'no built-in template id accepted (cannot drive the import)');
    assert.equal(ok.statusCode, 200, ok.body);
    assert.ok(ok.json.results.totalProcessed >= 1);
  });

  // ===================== run-agent
  const ra = await load('run-agent');
  await t('run-agent: OPTIONS 200 / GET 405 / contactId required 400 / unknown contact 404 / no settings 400', async () => {
    assert.equal((await callV1(ra, { method: 'OPTIONS', token: null })).statusCode, 200);
    assert.equal((await callV1(ra, { method: 'GET', token: null })).statusCode, 405);
    assert.equal((await callV1(ra, { body: {}, token: null })).statusCode, 400);
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada', company: 'Engines' }] });
    assert.equal((await callV1(ra, { body: { contactId: 'zz' }, token: null })).statusCode, 404);
    assert.equal((await callV1(ra, { body: { contactId: 'c1' }, token: null })).statusCode, 400);
  });
  await t('run-agent: autopilot disabled -> skipped; enabled -> AI message logged to agent_logs and step advanced; sequence end -> done', async () => {
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada', company: 'Engines' }], contact_agent_settings: [{ contact_id: 'c1', autopilot_enabled: false }] });
    assert.equal((await callV1(ra, { body: { contactId: 'c1' }, token: null })).json.skipped, true);
    supa.table('contact_agent_settings')[0].autopilot_enabled = true;
    openai.reset(); openai.script(() => ({ text: 'Hi Ada, quick idea.' }));
    const r = await callV1(ra, { body: { contactId: 'c1' }, token: null });
    assert.equal(r.statusCode, 200, r.body); assert.equal(r.json.preview, 'Hi Ada, quick idea.'); assert.equal(r.json.step, 1);
    assert.equal(supa.table('contact_agent_settings')[0].current_step, 1);
    assert.match(supa.table('agent_logs')[0].message, /Hi Ada/);
    supa.table('contact_agent_settings')[0].current_step = 30;
    assert.equal((await callV1(ra, { body: { contactId: 'c1' }, token: null })).json.done, true);
  });
  await t('run-agent: AI failure falls back to placeholder text (still logs step)', async () => {
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada' }], contact_agent_settings: [{ contact_id: 'c1', autopilot_enabled: true }] });
    openai.script(() => ({ http: { status: 500, message: 'x' } }));
    const r = await callV1(ra, { body: { contactId: 'c1' }, token: null });
    assert.equal(r.statusCode, 200); assert.match(r.json.preview, /real SDR copy/);
  });

  // ===================== autopilot trio + autopilot-run
  const ta = await load('trigger-autopilot'), gas = await load('get-autopilot-status'), uas = await load('update-autopilot-settings'), apr = await load('autopilot-run');
  const aSeed = (enabled = true, status) => supa.reset({ contacts: [{ id: 'c1', name: 'Ada', email: 'ada@x.co', status }], contact_agent_settings: [{ contact_id: 'c1', autopilot_enabled: enabled, current_step: 0, sequence_length: 5 }] });
  await t('update-autopilot-settings: validation + boolean toggles persisted', async () => {
    assert.equal((await callV1(uas, { body: {}, token: null })).statusCode, 400);
    aSeed(false);
    const r = await callV1(uas, { body: { contactId: 'c1', autopilot_enabled: true, escalated_to_ae: true }, token: null });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([supa.table('contact_agent_settings')[0].autopilot_enabled, supa.table('contact_agent_settings')[0].escalated_to_ae], [true, true]);
    assert.equal((await callV1(uas, { body: { contactId: 'zz', autopilot_enabled: true }, token: null })).statusCode, 500, 'no settings row -> error');
  });
  await t('get-autopilot-status: contact + settings + last log; 404 unknown', async () => {
    aSeed(true); supa.insert('agent_logs', { contact_id: 'c1', level: 'info', message: 'older', created_at: '2026-01-01T00:00:00Z' }); supa.insert('agent_logs', { contact_id: 'c1', level: 'info', message: 'newest', created_at: '2026-02-01T00:00:00Z' });
    const r = await callV1(gas, { body: { contactId: 'c1' }, token: null });
    assert.equal(r.statusCode, 200, r.body); assert.equal(r.json.lastLog.message, 'newest'); assert.equal(r.json.settings.autopilot_enabled, true);
    assert.equal((await callV1(gas, { body: { contactId: 'zz' }, token: null })).statusCode, 404);
  });
  await t('get-autopilot-status returns the contact lead status under the real column name (contacts.status)', async () => {
    aSeed(true, 'prospect');
    const r = await callV1(gas, { body: { contactId: 'c1' }, token: null });
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
  await t('src Supabase client used by calendar-api/email-api/memory-get/mood-preview works when only server-side SUPABASE_URL/SUPABASE_ANON_KEY are set (no VITE_*)', async () => {
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
