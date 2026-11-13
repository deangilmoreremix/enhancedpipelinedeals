import { assert, callV2, jsonOf, freshIp } from '../lib/util.mjs';

export const label = 'ai-image / ai-voice / ai-embed (v2)';

export default async function ({ t, openai, supa, loadFunction }) {
  const image = (await loadFunction('ai-image')).default;
  const voice = (await loadFunction('ai-voice')).default;
  const embed = (await loadFunction('ai-embed')).default;
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

  const common = (name, fn, okBody) => {
    return Promise.all([]).then(async () => {
      await t(`${name}: OPTIONS 204, GET 405`, async () => {
        assert.equal((await callV2(fn, { method: 'OPTIONS' })).status, 204);
        assert.equal((await callV2(fn, { method: 'GET' })).status, 405);
      });
      await t(`${name}: 401 without / with bad token`, async () => {
        assert.equal((await callV2(fn, { body: okBody, token: null })).status, 401);
        assert.equal((await callV2(fn, { body: okBody, token: 'bad' })).status, 401);
      });
      await t(`${name}: invalid JSON -> 400`, async () => assert.equal((await callV2(fn, { body: '{x' })).status, 400));
    });
  };

  // ===================== ai-image
  await common('ai-image', image, { prompt: 'a cat' });
  await t('ai-image rate limit 10/min -> 429 on 11th', async () => {
    const ip = freshIp(); let r;
    for (let i = 0; i < 11; i++) r = await callV2(image, { body: {}, ip });
    assert.equal(r.status, 429);
  });
  await t('ai-image missing prompt -> 400', async () => {
    const r = await callV2(image, { body: { action: 'generate' } });
    assert.equal(r.status, 400); assert.match((await jsonOf(r)).error, /prompt/);
  });
  await t('ai-image moderation: FLAG_ME -> 422 and NO image call / storage upload', async () => {
    openai.reset(); supa.reset();
    const r = await callV2(image, { body: { prompt: 'draw FLAG_ME please' } });
    assert.equal(r.status, 422);
    assert.equal(openai.requests('/v1/moderations').length, 1);
    assert.equal(openai.requests('/v1/images/generations').length, 0);
    assert.equal(supa.state.objects.size, 0);
  });
  await t('ai-image generate: moderation(omni) -> generations(model/size/quality/background) -> bucket created public -> upload -> public URL', async () => {
    openai.reset(); supa.reset();
    const r = await callV2(image, { body: { action: 'generate', prompt: 'a red fox', entityType: 'deal', entityId: 'd 1/../x', size: '1536x1024', quality: 'high', background: 'transparent' } });
    const j = await jsonOf(r);
    assert.equal(r.status, 200, JSON.stringify(j));
    assert.equal(j.ok, true); assert.equal(j.model, 'gpt-image-2.6-flare'); assert.equal(j.revised_prompt, 'stub revised prompt');
    assert.equal(openai.last('/v1/moderations').body.model, 'omni-moderation-latest');
    const g = openai.last('/v1/images/generations').body;
    assert.deepEqual([g.model, g.prompt, g.size, g.quality, g.background, g.n], ['gpt-image-2.6-flare', 'a red fox', '1536x1024', 'high', 'transparent', 1]);
    const bucket = supa.state.buckets.get('ai-images');
    assert.ok(bucket && bucket.public === true, 'bucket created public');
    assert.match(j.path, /^deal\/d1x\/\d+\.png$/);
    assert.ok(!j.path.includes('..'), 'path traversal chars stripped: ' + j.path);
    assert.equal(j.url, `${supa.url}/storage/v1/object/public/ai-images/${j.path}`);
    const obj = supa.state.objects.get(`ai-images/${j.path}`);
    assert.ok(obj && obj.data.length === PNG.length, 'uploaded bytes = decoded b64 ' + obj?.data.length + ' vs ' + PNG.length + ' ' + supa.requests({path:'/storage/v1/object/'})[0]?.headers['content-type']);
    const dl = await fetch(j.url);
    assert.equal(dl.status, 200);
  });
  await t('ai-image: existing bucket is reused (no second create)', async () => {
    openai.reset();
    const before = supa.requests({ method: 'POST', path: '/storage/v1/bucket' }).length;
    await callV2(image, { body: { prompt: 'again' } });
    assert.equal(supa.requests({ method: 'POST', path: '/storage/v1/bucket' }).length, before);
  });
  await t('ai-image: invalid size/quality/background fall back to 1024x1024/medium/auto', async () => {
    openai.reset();
    await callV2(image, { body: { prompt: 'x', size: '9999x9999', quality: 'ultra', background: 'neon' } });
    const g = openai.last('/v1/images/generations').body;
    assert.deepEqual([g.size, g.quality, g.background], ['1024x1024', 'medium', 'auto']);
  });
  await t('ai-image: prompt truncated to 4000 chars', async () => {
    openai.reset();
    await callV2(image, { body: { prompt: 'a'.repeat(5000) } });
    assert.equal(openai.last('/v1/images/generations').body.prompt.length, 4000);
  });
  await t('ai-image edit without imageUrl -> 400', async () => {
    assert.equal((await callV2(image, { body: { action: 'edit', prompt: 'x' } })).status, 400);
  });
  await t('ai-image edit: fetches imageUrl, calls images/edits (sunburst, multipart image+mask), uploads result', async () => {
    openai.reset(); supa.reset();
    // seed a source image into the stub storage and edit it through its public URL
    supa.state.buckets.set('src', { id: 'src', public: true });
    supa.state.objects.set('src/a.png', { data: PNG, contentType: 'image/png' });
    const r = await callV2(image, { body: { action: 'edit', prompt: 'make it blue', imageUrl: `${supa.url}/storage/v1/object/public/src/a.png`, mask: PNG.toString('base64') } });
    const j = await jsonOf(r);
    assert.equal(r.status, 200, JSON.stringify(j));
    assert.equal(j.model, 'gpt-image-2.6-sunburst');
    const c = openai.last('/v1/images/edits');
    assert.equal(c.multipart.fields.model, 'gpt-image-2.6-sunburst');
    assert.equal(c.multipart.fields.prompt, 'make it blue');
    assert.ok(c.multipart.files.some((f) => f.field === 'image' && f.size === PNG.length), JSON.stringify(c.multipart.files));
    assert.ok(c.multipart.files.some((f) => f.field === 'mask'));
    assert.ok(supa.state.objects.size >= 2);
  });
  await t('ai-image edit: unreachable imageUrl -> 400 (not 500)', async () => {
    const r = await callV2(image, { body: { action: 'edit', prompt: 'x', imageUrl: `${supa.url}/storage/v1/object/public/src/missing.png` } });
    assert.equal(r.status, 400);
  });
  await t('ai-image: SSRF — imageUrl pointing at a private/loopback address is refused', async () => {
    // the stub Supabase lives on 127.0.0.1, so the previous test fetched loopback successfully; a server-side fetch of
    // arbitrary client URLs must not reach internal addresses
    const r = await callV2(image, { body: { action: 'edit', prompt: 'x', imageUrl: 'http://127.0.0.1:54401/v1/anything.png' } });
    assert.equal(r.status, 400, 'loopback imageUrl should be rejected');
  });
  await t('ai-image: imageUrl with non-image content-type is refused', async () => {
    supa.state.objects.set('src/a.txt', { data: Buffer.from('hi'), contentType: 'text/plain' });
    const r = await callV2(image, { body: { action: 'edit', prompt: 'x', imageUrl: `${supa.url}/storage/v1/object/public/src/a.txt` } });
    assert.equal(r.status, 400);
  });
  await t('ai-image: storage upload failure -> 500 with message', async () => {
    supa.failNext('POST', '/storage/v1/object/', 500, { message: 'disk full' });
    const r = await callV2(image, { body: { prompt: 'x' } });
    assert.ok([500, 502].includes(r.status), String(r.status));
    assert.match((await jsonOf(r)).error, /Storage upload failed|disk full/);
  });

  // ===================== ai-voice
  await common('ai-voice', voice, { action: 'speak', text: 'hi' });
  await t('ai-voice rate limit 20/min', async () => {
    const ip = freshIp(); let r;
    for (let i = 0; i < 21; i++) r = await callV2(voice, { body: {}, ip });
    assert.equal(r.status, 429);
  });
  await t('ai-voice unknown action -> 400', async () => assert.equal((await callV2(voice, { body: { action: 'dance' } })).status, 400));
  await t('speak: missing text 400; moderation FLAG_ME 422 (no TTS call)', async () => {
    openai.reset();
    assert.equal((await callV2(voice, { body: { action: 'speak' } })).status, 400);
    assert.equal((await callV2(voice, { body: { action: 'speak', text: 'FLAG_ME' } })).status, 422);
    assert.equal(openai.requests('/v1/audio/speech').length, 0);
  });
  await t('speak: TTS request shape, bucket ai-audio created, mp3 uploaded, public url', async () => {
    openai.reset(); supa.reset();
    const r = await callV2(voice, { body: { action: 'speak', text: 'Hello Ada', voice: 'cedar', instructions: 'warm', contactId: 'c-1/..' } });
    const j = await jsonOf(r);
    assert.equal(r.status, 200, JSON.stringify(j));
    const b = openai.last('/v1/audio/speech').body;
    assert.deepEqual([b.model, b.voice, b.input, b.instructions, b.response_format], ['gpt-4o-mini-tts', 'cedar', 'Hello Ada', 'warm', 'mp3']);
    assert.ok(supa.state.buckets.get('ai-audio')?.public);
    assert.ok(!j.path.includes('..') && j.path.endsWith('.mp3'));
    const o = supa.state.objects.get(`ai-audio/${j.path}`);
    assert.ok(o && o.data.toString().includes('stub-mp3'));
    assert.equal(j.url, `${supa.url}/storage/v1/object/public/ai-audio/${j.path}`);
  });
  await t('speak: unknown voice falls back to marin', async () => {
    await callV2(voice, { body: { action: 'speak', text: 'x', voice: 'darth' } });
    assert.equal(openai.last('/v1/audio/speech').body.voice, 'marin');
  });
  await t('transcribe: missing audio 400; >25MB 413; ok -> text/languages + model gpt-transcribe (multipart file)', async () => {
    openai.reset();
    assert.equal((await callV2(voice, { body: { action: 'transcribe' } })).status, 400);
    const big = Buffer.alloc(25 * 1024 * 1024 + 1).toString('base64');
    assert.equal((await callV2(voice, { body: { action: 'transcribe', audioBase64: big } })).status, 413);
    assert.equal(openai.requests('/v1/audio/transcriptions').length, 0);
    const r = await callV2(voice, { body: { action: 'transcribe', audioBase64: Buffer.from('RIFFxxxx').toString('base64'), mimeType: 'audio/wav', fileName: 'call.wav' } });
    const j = await jsonOf(r);
    assert.equal(r.status, 200, JSON.stringify(j));
    assert.deepEqual([j.text, j.languages, j.model], ['hello from stub transcription', ['en'], 'gpt-transcribe']);
    const c = openai.last('/v1/audio/transcriptions');
    assert.equal(c.multipart.fields.model, 'gpt-transcribe');
    assert.equal(c.multipart.files[0].filename, 'call.wav');
  });
  await t('realtime_token: POST {base}/realtime/client_secrets with session {type,model,instructions,audio.output.voice}; returns value/expires_at/model', async () => {
    openai.reset();
    const r = await callV2(voice, { body: { action: 'realtime_token', voice: 'ash', instructions: 'be nice' } });
    const j = await jsonOf(r);
    assert.equal(r.status, 200, JSON.stringify(j));
    assert.deepEqual([j.value, j.model], ['ek_stub_secret', 'gpt-realtime-2.1']);
    assert.ok(j.expires_at > 0);
    const s = openai.last('/v1/realtime/client_secrets').body.session;
    assert.deepEqual([s.type, s.model, s.instructions, s.audio.output.voice], ['realtime', 'gpt-realtime-2.1', 'be nice', 'ash']);
    assert.equal(openai.last('/v1/realtime/client_secrets').headers.authorization, 'Bearer sk-test');
  });

  // ===================== ai-embed
  await common('ai-embed', embed, { action: 'search_contacts', query: 'x' });
  await t('ai-embed rate limit 60/min', async () => {
    const ip = freshIp(); let r;
    for (let i = 0; i < 61; i++) r = await callV2(embed, { body: {}, ip });
    assert.equal(r.status, 429);
  });
  await t('ai-embed unknown action 400; index without contactId 400; unknown contact 404', async () => {
    assert.equal((await callV2(embed, { body: { action: 'zzz' } })).status, 400);
    assert.equal((await callV2(embed, { body: { action: 'index_contact' } })).status, 400);
    supa.reset();
    assert.equal((await callV2(embed, { body: { action: 'index_contact', contactId: 'nope' } })).status, 404);
  });
  await t('index_contact: embeds profile text (1536-d, float) and upserts contact_embeddings(on_conflict contact_id, embedding as JSON string)', async () => {
    openai.reset();
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada Lovelace', title: 'CTO', company: 'Engines', tags: ['vip', 'math'], notes: 'loves analytical engines' }] });
    const r = await callV2(embed, { body: { action: 'index_contact', contactId: 'c1' } });
    assert.equal(r.status, 200, JSON.stringify(await jsonOf(r)));
    const e = openai.last('/v1/embeddings').body;
    assert.deepEqual([e.model, e.encoding_format], ['text-embedding-3-small', 'float']);
    assert.ok(e.input.includes('Title: CTO') && e.input.includes('Tags: vip, math'));
    const req = supa.requests({ method: 'POST', path: '/rest/v1/contact_embeddings' })[0];
    assert.equal(req.params.on_conflict, 'contact_id');
    assert.match(req.headers.prefer, /merge-duplicates/);
    assert.equal(typeof req.body.embedding, 'string');
    assert.equal(JSON.parse(req.body.embedding).length, 1536);
    assert.equal(supa.table('contact_embeddings')[0].contact_id, 'c1');
    // re-index is an upsert, not a duplicate row
    await callV2(embed, { body: { action: 'index_contact', contactId: 'c1' } });
    assert.equal(supa.table('contact_embeddings').length, 1);
  });
  await t('search_contacts: embeds query and calls rpc match_contacts(query_embedding as string, match_count<=50, min_similarity)', async () => {
    openai.reset();
    const r = await callV2(embed, { body: { action: 'search_contacts', query: 'engines people', limit: 500, minSimilarity: 0.5 } });
    const j = await jsonOf(r);
    assert.equal(r.status, 200, JSON.stringify(j));
    assert.ok(Array.isArray(j.results) && j.results[0].contact_id === 'c1');
    const rpc = supa.requests({ path: '/rest/v1/rpc/match_contacts' })[0].body;
    assert.equal(rpc.match_count, 50); assert.equal(rpc.min_similarity, 0.5);
    assert.equal(JSON.parse(rpc.query_embedding).length, 1536);
    assert.equal((await callV2(embed, { body: { action: 'search_contacts', query: '  ' } })).status, 400);
  });
  await t('ai-embed: anon key rejected by default; reads (contacts, match_contacts) run as the caller (anon apikey + user JWT); embeddings write uses the service role', async () => {
    openai.reset();
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada' }], contact_embeddings: [{ contact_id: 'c1', content: 'x' }, { contact_id: 'hidden', content: 'secret' }] });
    assert.equal((await callV2(embed, { body: { action: 'search_contacts', query: 'x' }, token: 'anon-key' })).status, 401);
    const n0 = supa.log.length;
    const r = await callV2(embed, { body: { action: 'search_contacts', query: 'x' } });
    const j = await jsonOf(r);
    assert.equal(r.status, 200);
    assert.deepEqual(j.results.map((h) => h.contact_id), ['c1'], 'hits for contacts the caller cannot see (RLS) are dropped');
    for (const l of supa.log.slice(n0).filter((l) => /rpc\/match_contacts|\/rest\/v1\/contacts/.test(l.path))) {
      assert.equal(l.headers.authorization, 'Bearer good-jwt'); assert.equal(l.headers.apikey, 'anon-key');
    }
    const n1 = supa.log.length;
    await callV2(embed, { body: { action: 'index_contact', contactId: 'c1' } });
    const l1 = supa.log.slice(n1);
    assert.equal(l1.find((l) => l.method === 'GET' && /contacts/.test(l.path)).headers.authorization, 'Bearer good-jwt');
    assert.equal(l1.find((l) => l.method === 'POST' && /contact_embeddings/.test(l.path)).headers.authorization, 'Bearer service-role-key');
    // contact invisible to the caller -> 404 (nothing embedded, nothing written)
    supa.reset({ contacts: [] }); openai.reset();
    assert.equal((await callV2(embed, { body: { action: 'index_contact', contactId: 'c1' } })).status, 404);
    assert.equal(openai.requests('/v1/embeddings').length, 0);
  });
  await t('search_contacts: min_similarity 0 is treated as 0.2 default (cannot request "everything")', async () => {
    await callV2(embed, { body: { action: 'search_contacts', query: 'x', minSimilarity: 0 } });
    const rpc = supa.requests({ path: '/rest/v1/rpc/match_contacts' }).at(-1).body;
    assert.equal(rpc.min_similarity, 0.2);
  });
  await t('search_contacts: rpc error -> 500 with message', async () => {
    supa.failNext('POST', '/rest/v1/rpc/match_contacts', 404, { code: 'PGRST202', message: 'no function' });
    const r = await callV2(embed, { body: { action: 'search_contacts', query: 'x' } });
    assert.equal(r.status, 500); assert.match((await jsonOf(r)).error, /no function/);
  });
}
