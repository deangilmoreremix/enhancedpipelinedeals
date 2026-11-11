import { assert, callV1 } from '../lib/util.mjs';

export const label = '_openai helpers';

export default async function ({ t, openai, loadFunction }) {
  const o = await loadFunction('_openai');
  const reqs = () => openai.requests('/v1/responses').map((c) => c.body);

  await t('MODEL_TIERS defaults', async () => {
    assert.deepEqual(o.MODEL_TIERS, {
      fast: { model: 'gpt-6-luna', effort: 'none' },
      default: { model: 'gpt-6.1-sol', effort: 'medium' },
      deep: { model: 'gpt-6-astra', effort: 'high' },
    });
  });
  await t('normalizeEffort table', async () => {
    assert.equal(o.normalizeEffort('gpt-6.1-sol', 'none'), 'low');
    assert.equal(o.normalizeEffort('gpt-6-astra', 'none'), 'low');
    assert.equal(o.normalizeEffort('gpt-6-luna', 'none'), 'none');
    assert.equal(o.normalizeEffort('gpt-6-luna', 'minimal'), 'low');
    assert.equal(o.normalizeEffort('gpt-6-astra', undefined), 'medium');
    assert.equal(o.normalizeEffort('gpt-6-astra', 'xhigh'), 'xhigh');
  });
  await t('resolveTier: tier name / explicit model / unknown -> default', async () => {
    assert.equal(o.resolveTier('deep').model, 'gpt-6-astra');
    assert.deepEqual(o.resolveTier('gpt-6.1-sol'), { model: 'gpt-6.1-sol', effort: 'low' });
    assert.deepEqual(o.resolveTier('gpt-6-luna'), { model: 'gpt-6-luna', effort: 'none' });
    assert.equal(o.resolveTier('banana').model, 'gpt-6.1-sol');
    assert.equal(o.resolveTier(undefined).model, 'gpt-6.1-sol');
  });
  await t('buildParams: effort/temperature matrix', async () => {
    const p1 = o.buildParams({ tier: 'fast', input: 'x', temperature: 0.5 });
    assert.equal(p1.temperature, 0.5);
    const p2 = o.buildParams({ tier: 'default', input: 'x', temperature: 0.5 });
    assert.equal(p2.temperature, undefined);
    const p3 = o.buildParams({ tier: 'fast', input: 'x', effort: 'high', temperature: 0.5 });
    assert.equal(p3.temperature, undefined);
    assert.equal(p3.reasoning.effort, 'high');
    assert.equal(p3.store, false);
    const p4 = o.buildParams({ tier: 'default', input: 'x', jsonSchema: { name: 'n', schema: { type: 'object', properties: {}, required: [], additionalProperties: false } }, include: ['a'], toolChoice: 'required', tools: [{ type: 'web_search' }], previousResponseId: 'r', metadata: { a: 'b' }, maxOutputTokens: 10 });
    assert.equal(p4.text.format.strict, true);
    assert.deepEqual([p4.include, p4.tool_choice, p4.previous_response_id, p4.max_output_tokens, p4.metadata], [['a'], 'required', 'r', 10, { a: 'b' }]);
  });
  await t('respond(): upstream 500 -> rejects with status', async () => {
    openai.script(() => ({ http: { status: 500, message: 'kaput' } }));
    await o.respond({ input: 'x' }).then(() => { throw new Error('should reject'); }, (e) => assert.equal(e.status, 500));
    openai.clearScripts();
  });
  await t('extractCitations: url_citation + web_search sources, de-duplicated, first title wins', async () => {
    const c = o.extractCitations([
      { type: 'web_search_call', action: { sources: [{ url: 'https://a' }, { url: 'https://b', title: 'B' }] } },
      { type: 'message', content: [{ annotations: [{ type: 'url_citation', url: 'https://a', title: 'A' }, { type: 'file_citation' }] }] },
    ]);
    assert.deepEqual(c, [{ url: 'https://a', title: 'A' }, { url: 'https://b', title: 'B' }]);
  });
  await t('respondStream yields deltas from typed events', async () => {
    openai.script(() => ({ text: 'abcdefghi' }));
    let s = '';
    for await (const d of o.respondStream({ input: 'x' })) s += d;
    assert.equal(s, 'abcdefghi');
    assert.equal(openai.last('/v1/responses').body.stream, true);
  });
  await t('respondStream throws on error event', async () => {
    openai.script(() => ({ streamError: 'nope' }));
    await assert.rejects(async () => { for await (const _ of o.respondStream({ input: 'x' })) { /* drain */ } }, /nope/);
  });

  // ---------- tool loop
  const tools = [{ type: 'function', name: 'add', description: 'add', parameters: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'], additionalProperties: false } }];
  await t('respondWithTools: function_call -> handler -> function_call_output(call_id) -> final text', async () => {
    openai.reset();
    openai.script(() => ({ toolCall: { call_id: 'call_AAA', name: 'add', arguments: { a: 2, b: 3 } } }));
    openai.script(() => ({ text: 'The sum is 5' }));
    const r = await o.respondWithTools({ input: 'add 2 and 3', tools, handlers: { add: ({ a, b }) => ({ sum: a + b }) } });
    assert.equal(r.text, 'The sum is 5');
    const [first, second] = reqs();
    assert.deepEqual(first.tools.map((x) => x.name), ['add']);
    assert.equal(first.tools[0].function, undefined, 'flat tool shape');
    const types = second.input.map((i) => i.type ?? i.role);
    assert.deepEqual(types, ['user', 'function_call', 'function_call_output']);
    const out = second.input.find((i) => i.type === 'function_call_output');
    assert.equal(out.call_id, 'call_AAA');
    assert.equal(out.output, '{"sum":5}');
    assert.equal(second.input.find((i) => i.type === 'function_call').call_id, 'call_AAA');
  });
  await t('respondWithTools: unknown tool / throwing tool -> {error} output (loop continues)', async () => {
    openai.reset();
    openai.script(() => ({ toolCall: [{ call_id: 'c1', name: 'missing', arguments: {} }, { call_id: 'c2', name: 'add', arguments: { a: 1, b: 1 } }] }));
    openai.script(() => ({ text: 'done' }));
    const r = await o.respondWithTools({ input: 'x', tools, handlers: { add: () => { throw new Error('bad add'); } } });
    assert.equal(r.text, 'done');
    const outs = reqs()[1].input.filter((i) => i.type === 'function_call_output');
    assert.deepEqual(outs.map((x) => [x.call_id, JSON.parse(x.output).error]), [['c1', 'Unknown tool: missing'], ['c2', 'bad add']]);
  });
  await t('respondWithTools: stops at maxTurns when the model keeps calling tools', async () => {
    openai.reset();
    openai.script(() => ({ toolCall: { name: 'add', arguments: { a: 1, b: 1 } } }), { sticky: true });
    const r = await o.respondWithTools({ input: 'x', tools, handlers: { add: () => 2 }, maxTurns: 3 });
    assert.equal(reqs().length, 3);
    assert.ok(r.output.some((i) => i.type === 'function_call'));
  });
  await t('respondWithTools: reasoning/message items from earlier turns are preserved in the next input', async () => {
    openai.reset();
    openai.script(() => ({ output: [{ id: 'rs_1', type: 'reasoning', summary: [] }, { id: 'fc_1', type: 'function_call', status: 'completed', call_id: 'c9', name: 'add', arguments: '{"a":1,"b":2}' }] }));
    openai.script(() => ({ text: 'ok' }));
    await o.respondWithTools({ input: [{ role: 'user', content: 'go' }], tools, handlers: { add: () => 3 } });
    assert.deepEqual(reqs()[1].input.map((i) => i.type ?? i.role), ['user', 'reasoning', 'function_call', 'function_call_output']);
  });

  // ---------- helpers: auth + rate limit
  await t('authorize: header forms (case-insensitive Bearer, whitespace), AI_GATEWAY_ALLOW_UNAUTHENTICATED escape hatch', async () => {
    assert.equal(await o.authorize('bearer anon-key'), true);
    assert.equal(await o.authorize('Bearer   good-jwt  '), true);
    assert.equal(await o.authorize(undefined), false);
    assert.equal(await o.authorize('Bearer wrong'), false);
    process.env.AI_GATEWAY_ALLOW_UNAUTHENTICATED = 'true';
    assert.equal(await o.authorize(undefined), true);
    delete process.env.AI_GATEWAY_ALLOW_UNAUTHENTICATED;
  });
  await t('rateLimited sliding window', async () => {
    const id = 'rl-' + Math.random();
    for (let i = 0; i < 3; i++) assert.equal(o.rateLimited(id, 3, 60000), false);
    assert.equal(o.rateLimited(id, 3, 60000), true);
  });

  // ---------- via _aiClients runner (CJS, used by test-sdr-agent)
  await t('_aiClients (CJS) buildSdrAgent runner: respond path and tools path', async () => {
    openai.reset();
    const ac = await loadFunction('_aiClients');
    const api = ac.buildSdrAgent ? ac : ac.default;
    const { runner } = api.buildSdrAgent({ agentId: 'cold', personaId: 'friendly', sequenceLength: 5, step: 1, contact: { company: 'Acme' } });
    const r = await runner.run({ messages: [{ role: 'user', content: 'hi' }] });
    assert.equal(r.output, 'Stub reply.');
    openai.script(() => ({ toolCall: { call_id: 'z', name: 'add', arguments: { a: 1, b: 1 } } }));
    openai.script(() => ({ text: 'two' }));
    const r2 = await runner.run({ messages: [{ content: 'hi' }], tools, handlers: { add: () => 2 } });
    assert.equal(r2.output, 'two');
  });
  await t('test-sdr-agent (CJS v1) happy path', async () => {
    const m = await loadFunction('test-sdr-agent');
    const res = await callV1(m.handler, { body: { agentId: 'cold_email_sdr', contact: { name: 'Ada', company: 'X' }, prompt: 'hello' }, token: null });
    assert.equal(res.statusCode, 200, res.body);
  });
  await t('test-sdr-agent OPTIONS/405', async () => {
    const m = await loadFunction('test-sdr-agent');
    assert.equal((await callV1(m.handler, { method: 'OPTIONS', token: null })).statusCode, 200);
    assert.equal((await callV1(m.handler, { method: 'GET', token: null })).statusCode, 405);
  });
}
