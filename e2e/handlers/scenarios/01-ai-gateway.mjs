import { assert, callV1, freshIp, readSSE, withEnv } from '../lib/util.mjs';
import { lintStrictSchema } from '../lib/schemaLint.mjs';

export const label = 'ai-gateway (v1)';

const INPUT = { contact: { name: 'Ada Lovelace', company: 'Analytical Engines' } };

export default async function ({ t, openai, supa, loadFunction }) {
  const gw = await loadFunction('ai-gateway');
  const { handler, TASKS } = gw;
  const call = (body, o = {}) => callV1(handler, { body, ...o });
  const lastResp = () => openai.last('/v1/responses').body;

  // ---------------- transport / auth
  await t('OPTIONS -> 204 with CORS', async () => {
    const r = await callV1(handler, { method: 'OPTIONS' });
    assert.equal(r.statusCode, 204);
    assert.ok(r.headers['Access-Control-Allow-Methods']);
  });
  await t('GET -> 405', async () => assert.equal((await callV1(handler, { method: 'GET' })).statusCode, 405));
  await t('no bearer -> 401', async () => assert.equal((await call({ task: 'chat' }, { token: null })).statusCode, 401));
  await t('invalid bearer -> 401 (Supabase auth/v1/user rejects)', async () => {
    const r = await call({ task: 'chat' }, { token: 'nope' });
    assert.equal(r.statusCode, 401);
  });
  await t('anon key REJECTED by default (it is public, not a credential)', async () => {
    const r = await call({ task: 'chat', input: 'hi' }, { token: 'anon-key' });
    assert.equal(r.statusCode, 401);
  });
  await t('anon key accepted only with ALLOW_ANON_FUNCTIONS=true; legacy AI_GATEWAY_ALLOW_UNAUTHENTICATED=true still works (and also lets token-less calls in)', async () => {
    await withEnv({ ALLOW_ANON_FUNCTIONS: 'true' }, async () => {
      assert.equal((await call({ task: 'chat', input: 'hi' }, { token: 'anon-key' })).statusCode, 200);
      assert.equal((await call({ task: 'chat', input: 'hi' }, { token: null })).statusCode, 401, 'token-less is not covered by the new switch');
      assert.equal((await call({ task: 'chat', input: 'hi' }, { token: 'bad' })).statusCode, 401);
    });
    await withEnv({ AI_GATEWAY_ALLOW_UNAUTHENTICATED: 'true' }, async () => {
      assert.equal((await call({ task: 'chat', input: 'hi' }, { token: 'anon-key' })).statusCode, 200);
      assert.equal((await call({ task: 'chat', input: 'hi' }, { token: null })).statusCode, 200);
    });
  });
  await t('valid user JWT accepted', async () => assert.equal((await call({ task: 'chat', input: 'hi' }, { token: 'good-jwt' })).statusCode, 200));
  await t('rate limit -> 429 after 60 requests per ip', async () => {
    const ip = freshIp();
    let last;
    for (let i = 0; i < 61; i++) last = await call({ task: 'nope' }, { ip });
    assert.equal(last.statusCode, 429);
  });
  await t('invalid JSON body -> 400', async () => assert.equal((await call('{not json')).statusCode, 400));
  await t('unknown task -> 400 listing tasks', async () => {
    const r = await call({ task: 'does_not_exist' });
    assert.equal(r.statusCode, 400);
    assert.ok(r.json.tasks.includes('contact_analyze'));
  });

  // ---------------- schemas
  await t('every TASKS json_schema satisfies strict structured-output rules', async () => {
    const bad = [];
    for (const [k, d] of Object.entries(TASKS)) if (d.schema) { const p = lintStrictSchema(d.schema.schema); if (p.length) bad.push(`${k}: ${p.join('; ')}`); }
    assert.deepEqual(bad, []);
  });
  await t('linter itself rejects a non-strict schema (self-check)', async () => {
    assert.ok(lintStrictSchema({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } }, required: ['a'] }).length >= 2);
  });

  // ---------------- every task returns the documented envelope
  for (const task of Object.keys(TASKS)) {
    await t(`task ${task}: envelope {ok,data,text,citations,tool_calls} + request shape`, async () => {
      openai.calls.length = 0;
      const r = await call({ task, input: `analyze this (JSON)`, context: INPUT });
      assert.equal(r.statusCode, 200, r.body);
      for (const k of ['ok', 'task', 'model', 'text', 'data', 'citations', 'tool_calls', 'id']) assert.ok(k in r.json, `missing ${k}`);
      assert.equal(r.json.ok, true);
      assert.ok(Array.isArray(r.json.citations) && Array.isArray(r.json.tool_calls));
      const def = TASKS[task];
      const req = lastResp();
      assert.ok(req.instructions.includes('SmartCRM'), 'instructions carry system prompt');
      assert.ok(req.input && String(req.input).includes('CONTEXT (JSON)'), 'context serialised into input');
      assert.equal(req.store, false);
      assert.ok(req.max_output_tokens > 0);
      // reasoning rules
      const eff = req.reasoning?.effort;
      if (/gpt-6(\.\d+)?-(astra|sol)/.test(req.model)) assert.notEqual(eff, 'none', `effort none on ${req.model}`);
      if (eff !== 'none') assert.equal(req.temperature, undefined, 'no temperature unless effort none');
      if (def.schema) {
        assert.equal(req.text.format.type, 'json_schema');
        assert.equal(req.text.format.strict, true);
        assert.equal(req.text.format.name, def.schema.name);
        assert.ok(r.json.data && typeof r.json.data === 'object', 'structured data parsed');
      } else if (def.jsonObject) {
        assert.equal(req.text.format.type, 'json_object');
        assert.ok(r.json.data, 'json object parsed');
      } else {
        assert.equal(req.text, undefined);
        assert.equal(r.json.data, null);
      }
      if (def.webSearch) {
        assert.equal(req.tools[0].type, 'web_search');
        assert.deepEqual(req.include, ['web_search_call.action.sources']);
        if (def.requireSearch) {
          assert.equal(req.tool_choice, 'required');
          const urls = r.json.citations.map((c) => c.url);
          assert.ok(urls.includes('https://example.com/profile') && urls.includes('https://example.org/news'), `citations ${urls}`);
          assert.equal(r.json.citations.filter((c) => c.url === 'https://example.com/profile').length, 1, 'citations de-duplicated');
          assert.equal(r.json.citations.find((c) => c.url === 'https://example.com/profile').title, 'Profile');
        }
      } else {
        assert.equal(req.include, undefined);
        assert.equal(req.tools, undefined);
      }
    });
  }

  await t('model tiers: fast=gpt-6-luna(effort none), default=gpt-6.1-sol, deep=gpt-6-astra; tier override honoured', async () => {
    await call({ task: 'cta', input: 'x' });
    let b = lastResp(); assert.equal(b.model, 'gpt-6-luna'); assert.equal(b.reasoning.effort, 'none');
    await call({ task: 'chat', input: 'x' });
    b = lastResp(); assert.equal(b.model, 'gpt-6.1-sol'); assert.equal(b.reasoning.effort, 'medium');
    await call({ task: 'chat', input: 'x', tier: 'deep' });
    b = lastResp(); assert.equal(b.model, 'gpt-6-astra'); assert.equal(b.reasoning.effort, 'high');
  });
  await t('effort none requested on gpt-6.1-sol is mapped to low (API would reject none)', async () => {
    const r = await call({ task: 'chat', input: 'x', effort: 'none' });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(lastResp().reasoning.effort, 'low');
  });
  await t('effort minimal -> low; temperature dropped when effort != none', async () => {
    const r = await call({ task: 'chat', input: 'x', effort: 'minimal', temperature: 0.2 });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(lastResp().reasoning.effort, 'low');
    assert.equal(lastResp().temperature, undefined);
  });
  await t('temperature IS sent for a fast tier (effort none) request', async () => {
    await call({ task: 'cta', input: 'x', temperature: 0.3 });
    assert.equal(lastResp().temperature, 0.3);
  });
  await t('explicit model id (gpt-6-luna) works; explicit gpt-6.1-sol with effort none is fixed', async () => {
    const a = await call({ task: 'chat', input: 'x', tier: 'gpt-6-luna' });
    assert.equal(a.statusCode, 200, a.body); assert.equal(lastResp().reasoning.effort, 'none');
    const b = await call({ task: 'chat', input: 'x', tier: 'gpt-6.1-sol' });
    assert.equal(b.statusCode, 200, b.body); assert.equal(lastResp().reasoning.effort, 'low');
  });

  // ---------------- aliases
  const aliasExpect = {
    'contact-analyze': 'contact_analyze', 'contact-analyzer': 'contact_analyze', 'lead-score': 'lead_score', 'email-compose': 'email_compose',
    'email-generator': 'email_compose', 'web-research': 'web_research', enrich: 'enrichment', 'contact-public-enrichment': 'contact_public_enrichment',
    'public-enrichment': 'contact_public_enrichment', 'ai-enrichment': 'enrichment', data_enrichment: 'enrichment', 'social-discovery': 'social_discovery',
    'discover-channels': 'social_discovery', 'deal-analyze': 'deal_analyze', 'deal-analyzer': 'deal_analyze', 'deal-automation': 'deal_automation',
    'contact-automation': 'contact_automation', 'generate-automation': 'contact_automation', 'sales-coach': 'sales_coach', transformEmail: 'transform_email',
    getCaseStudy: 'case_study', generateCTA: 'cta', 'playbooks-ai': 'playbooks', 'deal-heatmap': 'deal_risk', 'video-agent': 'video_script',
  };
  await t(`all ${Object.keys(aliasExpect).length} aliases resolve to the expected task`, async () => {
    const wrong = [];
    for (const [alias, task] of Object.entries(aliasExpect)) {
      const r = await call({ task: alias, input: 'x (JSON)' });
      if (r.statusCode !== 200 || r.json.task !== task) wrong.push(`${alias}->${r.json?.task ?? r.statusCode}`);
    }
    assert.deepEqual(wrong, []);
  });
  await t('taskType field is accepted as task', async () => assert.equal((await call({ taskType: 'cta', input: 'x' })).json.task, 'cta'));

  // ---------------- CRM context
  await t('contactId/dealId load CRM rows (deal -> contact_id, contact, last 10 activities) into the prompt', async () => {
    supa.reset({
      contacts: [{ id: 'c1', name: 'Grace Hopper', company: 'Navy', email: 'grace@navy.example' }],
      deals: [{ id: 'd1', title: 'Compiler deal', value: 5000, stage: 'proposal', contact_id: 'c1' }],
      activities: Array.from({ length: 12 }, (_, i) => ({ id: `a${i}`, contact_id: 'c1', type: 'call', description: `call ${i}`, created_at: new Date(2026, 0, i + 1).toISOString() })),
    });
    const r = await call({ task: 'deal_risk', dealId: 'd1', input: 'assess' });
    assert.equal(r.statusCode, 200, r.body);
    const input = String(lastResp().input);
    assert.ok(input.includes('Compiler deal') && input.includes('Grace Hopper'), 'deal+contact in prompt');
    assert.ok(input.includes('call 11') && !input.includes('"call 0"'), 'newest 10 activities only');
  });
  await t('CRM context reads run AS THE CALLER (anon apikey + user JWT, never the service-role key)', async () => {
    supa.reset({ contacts: [{ id: 'c1', name: 'Grace Hopper' }], deals: [{ id: 'd1', title: 'X', contact_id: 'c1' }] });
    const n0 = supa.log.length;
    await call({ task: 'chat', dealId: 'd1', input: 'x' });
    const reads = supa.log.slice(n0).filter((l) => /\/rest\/v1\/(deals|contacts|activities)/.test(l.path));
    assert.ok(reads.length >= 2);
    for (const l of reads) {
      assert.equal(l.headers.authorization, 'Bearer good-jwt');
      assert.equal(l.headers.apikey, 'anon-key');
    }
  });
  await t('CRM lookup failure is non-fatal (still 200)', async () => {
    supa.failNext('GET', '/rest/v1/deals', 500);
    const r = await call({ task: 'chat', dealId: 'd1', input: 'x' });
    assert.equal(r.statusCode, 200);
  });

  // ---------------- chat variants
  await t('chat json:true -> json_object + data', async () => {
    const r = await call({ task: 'chat', input: 'give me JSON', json: true });
    assert.equal(lastResp().text.format.type, 'json_object');
    assert.ok(r.json.data);
  });
  await t('chat messages[] used as Responses input items', async () => {
    await call({ task: 'chat', messages: [{ role: 'user', content: 'hello there' }] });
    assert.deepEqual(lastResp().input, [{ role: 'user', content: 'hello there' }]);
  });
  await t('chat: previousResponseId -> previous_response_id + store true', async () => {
    await call({ task: 'chat', input: 'x', previousResponseId: 'resp_abc' });
    assert.equal(lastResp().previous_response_id, 'resp_abc'); assert.equal(lastResp().store, true);
  });
  await t('chat: store:true honoured; default store false', async () => {
    await call({ task: 'chat', input: 'x', store: true }); assert.equal(lastResp().store, true);
  });
  await t('client tools: flat function + web_search pass through, others dropped; function_call -> tool_calls', async () => {
    openai.script((b) => ({ toolCall: { call_id: 'call_1', name: 'lookup', arguments: { q: 'x' } } }));
    const tools = [{ type: 'function', name: 'lookup', description: 'd', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } }, { type: 'web_search' }, { type: 'code_interpreter' }, { type: 'function', function: { name: 'old' } }];
    const r = await call({ task: 'chat', input: 'x', tools, toolChoice: 'auto' });
    assert.equal(r.statusCode, 200, r.body);
    const sent = lastResp().tools;
    assert.deepEqual(sent.map((x) => x.type + ':' + (x.name ?? '')), ['function:lookup', 'web_search:']);
    assert.equal(lastResp().tool_choice, 'auto');
    assert.deepEqual(r.json.tool_calls, [{ call_id: 'call_1', name: 'lookup', arguments: { q: 'x' } }]);
  });
  await t('function_call_output items via input[] are forwarded verbatim', async () => {
    const items = [{ type: 'function_call_output', call_id: 'call_1', output: '{"ok":true}' }];
    await call({ task: 'chat', input: items });
    assert.deepEqual(lastResp().input, items);
  });
  await t('web_research userLocation -> approximate user_location', async () => {
    await call({ task: 'web_research', input: 'x (JSON)', userLocation: { country: 'US', city: 'Austin' } });
    assert.deepEqual(lastResp().tools[0].user_location, { type: 'approximate', country: 'US', city: 'Austin' });
  });

  // ---------------- streaming
  await t('chat stream:true -> buffered SSE `data: {"delta"}` ... `data: [DONE]`', async () => {
    const r = await call({ task: 'chat', input: 'x', stream: true });
    assert.equal(r.statusCode, 200);
    assert.equal(r.headers['Content-Type'], 'text/event-stream');
    const { frames } = await readSSE(r.body);
    assert.equal(frames.at(-1), '[DONE]');
    const text = frames.filter((f) => f !== '[DONE]').map((f) => f.delta).join('');
    assert.equal(text, 'Stub reply.');
    assert.equal(lastResp().stream, true);
  });
  await t('stream:true on a schema task falls back to JSON (not SSE)', async () => {
    const r = await call({ task: 'cta', input: 'x', stream: true });
    assert.equal(r.json.ok, true);
  });
  await t('stream: OpenAI error event mid-stream -> handler maps to status (not a silent success)', async () => {
    openai.script(() => ({ streamError: 'boom' }));
    const r = await call({ task: 'chat', input: 'x', stream: true });
    assert.ok(r.statusCode >= 400, `status ${r.statusCode} body ${r.body}`);
  });

  // ---------------- error mapping
  for (const status of [400, 401, 429, 500, 503]) {
    await t(`OpenAI ${status} -> handler ${status} with ok:false`, async () => {
      openai.script(() => ({ http: { status, message: `upstream ${status}` } }));
      const r = await call({ task: 'chat', input: 'x' });
      assert.equal(r.statusCode, status);
      assert.equal(r.json.ok, false);
      assert.match(r.json.error, /upstream|error/i);
    });
  }
  await t('empty output is a completed response with empty text', async () => {
    openai.script(() => ({ output: [] }));
    const r = await call({ task: 'chat', input: 'x' });
    assert.equal(r.statusCode, 200); // empty output is still a completed response
    assert.equal(r.json.text, '');
  });
  await t('model returns prose around JSON -> parseJSON salvage', async () => {
    openai.script(() => ({ text: 'Here you go: {"score": 7, "summary":"s","next_action":"n","risks":[]} thanks' }));
    const r = await call({ task: 'contact_analyze', input: 'x' });
    assert.equal(r.json.data.score, 7);
  });
}
