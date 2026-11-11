import { assert, callV2, readSSE, jsonOf, freshIp } from '../lib/util.mjs';

export const label = 'ai-stream + composeEmail (v2)';

export default async function ({ t, openai, supa, loadFunction }) {
  const stream = (await loadFunction('ai-stream')).default;
  const compose = (await loadFunction('composeEmail')).default;
  const lastResp = () => openai.last('/v1/responses').body;

  // ---------------- ai-stream
  await t('ai-stream OPTIONS 204 / GET 405', async () => {
    assert.equal((await callV2(stream, { method: 'OPTIONS' })).status, 204);
    assert.equal((await callV2(stream, { method: 'GET' })).status, 405);
  });
  await t('ai-stream auth: none/invalid -> 401 JSON', async () => {
    for (const token of [null, 'bad']) { const r = await callV2(stream, { body: { input: 'x' }, token }); assert.equal(r.status, 401); assert.equal((await jsonOf(r)).ok, false); }
  });
  await t('ai-stream rate limit -> 429', async () => {
    const ip = freshIp(); let r;
    for (let i = 0; i < 61; i++) r = await callV2(stream, { body: { input: 'x' }, ip });
    assert.equal(r.status, 429);
  });
  await t('ai-stream invalid JSON -> 400', async () => assert.equal((await callV2(stream, { body: '{oops' })).status, 400));
  await t('ai-stream SSE framing: delta frames then [DONE]; headers', async () => {
    openai.script(() => ({ text: 'Hello streaming world' }));
    const r = await callV2(stream, { body: { input: 'hi', instructions: 'be brief' } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'text/event-stream');
    assert.equal(r.headers.get('cache-control'), 'no-cache');
    const { frames, text } = await readSSE(r);
    assert.ok(text.split('\n\n').filter(Boolean).every((b) => b.startsWith('data: ')), 'every block is a data: frame');
    assert.equal(frames.at(-1), '[DONE]');
    const deltas = frames.filter((f) => f !== '[DONE]');
    assert.ok(deltas.length >= 2, 'multiple delta frames (not buffered into one)');
    assert.ok(deltas.every((f) => typeof f.delta === 'string'));
    assert.equal(deltas.map((f) => f.delta).join(''), 'Hello streaming world');
    const b = lastResp();
    assert.equal(b.stream, true); assert.equal(b.instructions, 'be brief'); assert.equal(b.input, 'hi');
    assert.equal(b.model, 'gpt-6.1-sol'); assert.equal(b.max_output_tokens, 2000);
  });
  await t('ai-stream messages[] -> input items; tier/effort/maxOutputTokens honoured', async () => {
    await (await callV2(stream, { body: { messages: [{ role: 'user', content: 'yo' }], tier: 'fast', effort: 'low', maxOutputTokens: 50 } })).text();
    const b = lastResp();
    assert.deepEqual(b.input, [{ role: 'user', content: 'yo' }]);
    assert.equal(b.model, 'gpt-6-luna'); assert.equal(b.reasoning.effort, 'low'); assert.equal(b.max_output_tokens, 50); assert.equal(b.temperature, undefined);
  });
  await t('ai-stream: default input "Proceed." when body has none', async () => {
    await (await callV2(stream, { body: {} })).text();
    assert.equal(lastResp().input, 'Proceed.');
  });
  await t('ai-stream upstream HTTP error -> {"error"} frame then [DONE] (status 200 stream)', async () => {
    openai.script(() => ({ http: { status: 500, message: 'upstream exploded' } }));
    const { frames } = await readSSE(await callV2(stream, { body: { input: 'x' } }));
    assert.ok(frames[0].error && /upstream exploded/.test(frames[0].error), JSON.stringify(frames));
    assert.equal(frames.at(-1), '[DONE]');
  });
  await t('ai-stream mid-stream error event -> partial deltas, then error frame, then [DONE]', async () => {
    openai.script(() => ({ streamError: 'stream broke' }));
    const { frames } = await readSSE(await callV2(stream, { body: { input: 'x' } }));
    assert.ok(frames.some((f) => f !== '[DONE]' && f.error === 'stream broke'), JSON.stringify(frames));
    assert.equal(frames.at(-1), '[DONE]');
  });
  await t('ai-stream client abort (reader cancel) does not crash the handler', async () => {
    openai.script(() => ({ text: 'x'.repeat(5000) }));
    const r = await callV2(stream, { body: { input: 'x' } });
    const reader = r.body.getReader();
    await reader.read();
    await reader.cancel();
    await new Promise((res) => setTimeout(res, 50));
  });

  // ---------------- composeEmail
  const seed = () => supa.reset({
    contacts: [{ id: 'c1', name: 'Grace Hopper', company: 'Navy' }],
    deals: [{ id: 'd1', title: 'Compiler deal', value: 5000, stage: 'proposal' }],
    sdr_personas: [{ id: 'p1', persona_prompt: 'Speak like a seasoned admiral.' }],
  });
  await t('composeEmail OPTIONS/GET/auth/429/400', async () => {
    assert.equal((await callV2(compose, { method: 'OPTIONS' })).status, 204);
    assert.equal((await callV2(compose, { method: 'GET' })).status, 405);
    assert.equal((await callV2(compose, { body: {}, token: null })).status, 401);
    const ip = freshIp(); let r;
    for (let i = 0; i < 61; i++) r = await callV2(compose, { body: { contactId: 'c1' }, ip });
    assert.equal(r.status, 429);
  });
  await t('composeEmail loads contact/deal/persona from Supabase into instructions and streams {"content"} frames', async () => {
    seed();
    openai.script(() => ({ text: 'Dear Grace, let us talk.' }));
    const r = await callV2(compose, { body: { contactId: 'c1', dealId: 'd1', personaId: 'p1', input: 'Draft: hi' } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'text/event-stream');
    const { frames } = await readSSE(r);
    const content = frames.filter((f) => f !== '[DONE]' && 'content' in f).map((f) => f.content).join('');
    assert.equal(content, 'Dear Grace, let us talk.');
    const b = lastResp();
    assert.ok(b.instructions.includes('Grace Hopper at Navy'));
    assert.ok(b.instructions.includes('Deal: Compiler deal (5000 value, proposal stage)'));
    assert.ok(b.instructions.includes('seasoned admiral'));
    assert.ok(b.instructions.includes('Improve and complete this draft: Draft: hi'));
    assert.equal(b.input, 'Draft: hi');
    assert.equal(b.stream, true); assert.equal(b.max_output_tokens, 1500);
  });
  await t('composeEmail without input uses default write prompt', async () => {
    seed();
    await (await callV2(compose, { body: { contactId: 'c1' } })).text();
    const b = lastResp();
    assert.ok(b.instructions.includes('Write a compelling email based on the context provided.'));
    assert.equal(b.input, 'Write a professional email for this contact and deal.');
  });
  await t('composeEmail terminates stream with [DONE] like ai-stream (client contract)', async () => {
    seed();
    const { frames } = await readSSE(await callV2(compose, { body: { contactId: 'c1' } }));
    assert.equal(frames.at(-1), '[DONE]', 'composeEmail stream never ends with data: [DONE]');
  });
  await t('composeEmail: unknown contact does not leak "undefined" into the prompt', async () => {
    seed();
    await (await callV2(compose, { body: { contactId: 'missing' } })).text();
    assert.ok(!/undefined/.test(lastResp().instructions), lastResp().instructions);
  });
  await t('composeEmail upstream error -> error frame', async () => {
    seed();
    openai.script(() => ({ http: { status: 429, message: 'slow down' } }));
    const { frames } = await readSSE(await callV2(compose, { body: { contactId: 'c1' } }));
    assert.ok(frames.some((f) => f !== '[DONE]' && f.error && /slow down/.test(f.error)), JSON.stringify(frames));
  });
  await t('composeEmail invalid JSON -> 400; missing contactId -> 400', async () => {
    assert.equal((await callV2(compose, { body: '{bad' })).status, 400);
    assert.equal((await callV2(compose, { body: { dealId: 'd1' } })).status, 400);
  });
}
