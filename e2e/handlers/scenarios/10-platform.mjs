import { createHash } from 'node:crypto';
import { assert, callV1, callV2, jsonOf } from '../lib/util.mjs';
import { lintStrictSchema } from '../lib/schemaLint.mjs';

export const label = 'api-keys / public-api / workflow-webhook / ai-gateway workspace_chat';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const KEY_RW = `cb_live_${'a'.repeat(43)}`;
const KEY_RO = `cb_live_${'b'.repeat(43)}`;
const KEY_REVOKED = `cb_live_${'c'.repeat(43)}`;
const KEY_WS2 = `cb_live_${'d'.repeat(43)}`;
const WS1 = 'ws-1', WS2 = 'ws-2';

export default async function ({ t, openai, supa, loadFunction }) {
  const keysFn = (await loadFunction('api-keys')).default;
  const apiFn = (await loadFunction('public-api')).default;
  const hookFn = (await loadFunction('workflow-webhook')).default;
  const gw = await loadFunction('ai-gateway');

  // ======================= api-keys
  const keys = (o = {}) => callV2(keysFn, { url: 'http://localhost/api/keys', ...o });
  const seedKeys = () => supa.reset();

  await t('api-keys: config.path is /api/keys; unauthenticated / anon / demo -> 401', async () => {
    assert.equal((await loadFunction('api-keys')).config.path, '/api/keys');
    seedKeys();
    assert.equal((await keys({ method: 'GET', token: null })).status, 401);
    assert.equal((await keys({ method: 'GET', token: 'anon-key' })).status, 401);
    assert.equal((await keys({ method: 'GET', token: 'bad-jwt' })).status, 401);
    assert.equal((await keys({ method: 'GET', token: 'service-role-key' })).status, 401, 'service key has no user identity');
  });
  await t('api-keys: member / viewer -> 403 (admin or manager only); nothing is written', async () => {
    seedKeys();
    for (const token of ['good-jwt', 'viewer-jwt']) {
      assert.equal((await keys({ method: 'POST', token, body: { name: 'x' } })).status, 403, token);
      assert.equal((await keys({ method: 'GET', token })).status, 403, token);
      assert.equal((await keys({ method: 'DELETE', token, url: 'http://localhost/api/keys?id=k1' })).status, 403, token);
    }
    assert.equal(supa.table('api_keys').length, 0);
  });
  await t('api-keys: POST creates a cb_live_ key, stores only sha256 + 8-char prefix, returns plaintext once', async () => {
    seedKeys();
    const res = await keys({ method: 'POST', token: 'manager-jwt', body: { name: ' CI key ', scopes: ['read', 'write', 'read'] } });
    assert.equal(res.status, 201);
    const j = await jsonOf(res);
    assert.ok(/^cb_live_[A-Za-z0-9_-]{43}$/.test(j.key), j.key);
    assert.equal(j.name, 'CI key');
    assert.deepEqual(j.scopes, ['read', 'write']);
    assert.equal(j.prefix.length, 8);
    assert.equal(j.prefix, j.key.slice('cb_live_'.length, 'cb_live_'.length + 8));
    const row = supa.table('api_keys')[0];
    assert.equal(row.key_hash, sha(j.key));
    assert.equal(row.created_by, 'user-m');
    assert.equal(row.workspace_id, WS1, 'workspace from current_workspace_id()');
    assert.ok(!JSON.stringify(row).includes(j.key), 'plaintext is never stored');
    // the list never shows the key or the hash
    const list = await jsonOf(await keys({ method: 'GET', token: 'manager-jwt' }));
    assert.equal(list.keys.length, 1);
    assert.ok(!('key_hash' in list.keys[0]) && !('key' in list.keys[0]));
    assert.ok(!JSON.stringify(list).includes(j.key));
    assert.equal(list.keys[0].prefix, j.prefix);
    // the select sent to the DB projects explicit columns (no key_hash)
    const sel = supa.requests({ method: 'GET', path: '/rest/v1/api_keys' }).at(-1).params.select;
    assert.ok(sel && !sel.includes('key_hash'));
  });
  await t('api-keys: default scopes = [read]; keys are unique per call; invalid name/scopes -> 422', async () => {
    seedKeys();
    const a = await jsonOf(await keys({ method: 'POST', token: 'admin-jwt', body: { name: 'a' } }));
    const b = await jsonOf(await keys({ method: 'POST', token: 'admin-jwt', body: { name: 'b' } }));
    assert.deepEqual(a.scopes, ['read']);
    assert.notEqual(a.key, b.key);
    for (const body of [{}, { name: '' }, { name: 'x'.repeat(81) }, { name: 'x', scopes: [] }, { name: 'x', scopes: ['admin'] }, { name: 'x', scopes: 'read' }]) {
      assert.equal((await keys({ method: 'POST', token: 'admin-jwt', body })).status, 422, JSON.stringify(body));
    }
    assert.equal((await keys({ method: 'POST', token: 'admin-jwt', body: '{nope' })).status, 400);
    assert.equal(supa.table('api_keys').length, 2);
  });
  await t('api-keys: GET lists own keys for a manager, all keys for an admin; DELETE revokes own (404 for others, admin any)', async () => {
    seedKeys();
    supa.reset({ api_keys: [
      { id: 'k-m', name: 'm', prefix: 'aaaaaaaa', key_hash: 'h1', scopes: ['read'], created_by: 'user-m', created_at: '2026-01-01T00:00:00Z', revoked_at: null },
      { id: 'k-a', name: 'a', prefix: 'bbbbbbbb', key_hash: 'h2', scopes: ['read'], created_by: 'user-a', created_at: '2026-01-02T00:00:00Z', revoked_at: null },
    ] });
    assert.deepEqual((await jsonOf(await keys({ method: 'GET', token: 'manager-jwt' }))).keys.map((k) => k.id), ['k-m']);
    const adminList = (await jsonOf(await keys({ method: 'GET', token: 'admin-jwt' }))).keys;
    assert.deepEqual(adminList.map((k) => k.id).sort(), ['k-a', 'k-m']);
    assert.equal(adminList.find((k) => k.id === 'k-a').mine, true);
    assert.equal((await keys({ method: 'DELETE', token: 'manager-jwt', url: 'http://localhost/api/keys?id=k-a' })).status, 404, "manager cannot revoke another user's key");
    assert.equal(supa.table('api_keys').find((k) => k.id === 'k-a').revoked_at, null);
    const ok = await keys({ method: 'DELETE', token: 'manager-jwt', url: 'http://localhost/api/keys?id=k-m' });
    assert.equal(ok.status, 200);
    assert.ok((await jsonOf(ok)).revoked_at);
    assert.ok(supa.table('api_keys').find((k) => k.id === 'k-m').revoked_at);
    assert.equal((await keys({ method: 'DELETE', token: 'manager-jwt', url: 'http://localhost/api/keys?id=k-m' })).status, 404, 'already revoked');
    assert.equal((await keys({ method: 'DELETE', token: 'admin-jwt', url: 'http://localhost/api/keys?id=k-a' })).status, 200, 'admin may revoke any');
    assert.equal((await keys({ method: 'DELETE', token: 'admin-jwt' })).status, 400, 'id required');
    assert.equal((await keys({ method: 'PUT', token: 'admin-jwt' })).status, 405);
  });
  await t('api-keys: rate limited per user (20/min) -> 429; limiter failure -> 503', async () => {
    seedKeys();
    let last;
    for (let i = 0; i < 21; i++) last = await keys({ method: 'GET', token: 'admin-jwt' });
    assert.equal(last.status, 429);
    seedKeys();
    supa.failNext('POST', '/rpc/check_rate_limit', 500);
    assert.equal((await keys({ method: 'GET', token: 'admin-jwt' })).status, 503);
  });

  // ======================= public-api
  const seedApi = (extra = {}) => supa.reset({
    api_keys: [
      { id: 'kid-rw', name: 'rw', key_hash: sha(KEY_RW), scopes: ['read', 'write'], workspace_id: WS1, created_by: 'user-a', last_used_at: null, revoked_at: null },
      { id: 'kid-ro', name: 'ro', key_hash: sha(KEY_RO), scopes: ['read'], workspace_id: WS1, created_by: 'user-a', last_used_at: null, revoked_at: null },
      { id: 'kid-rev', name: 'rev', key_hash: sha(KEY_REVOKED), scopes: ['read', 'write'], workspace_id: WS1, created_by: 'user-a', last_used_at: null, revoked_at: '2026-01-01T00:00:00Z' },
      { id: 'kid-ws2', name: 'ws2', key_hash: sha(KEY_WS2), scopes: ['read', 'write'], workspace_id: WS2, created_by: 'user-a2', last_used_at: null, revoked_at: null },
    ],
    deals: [
      { id: 'd1', title: 'Alpha rollout', value: 1000, stage: 'proposal', company: 'Acme', workspace_id: WS1, deleted_at: null, updated_at: '2026-03-01T00:00:00Z', tsv: 'SECRET' },
      { id: 'd2', title: 'Beta pilot', value: 500, stage: 'qualification', company: 'Globex', workspace_id: WS1, deleted_at: null, updated_at: '2026-02-01T00:00:00Z' },
      { id: 'd3', title: 'Gone deal', value: 1, stage: 'proposal', workspace_id: WS1, deleted_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: 'd4', title: 'Other workspace deal', value: 9, stage: 'proposal', workspace_id: WS2, deleted_at: null, updated_at: '2026-03-02T00:00:00Z' },
    ],
    contacts: [
      { id: 'c1', name: 'Grace Hopper', email: 'grace@navy.example', company: 'Navy', workspace_id: WS1, updated_at: '2026-03-01T00:00:00Z' },
      { id: 'c2', name: 'Other Person', email: 'o@x.example', workspace_id: WS2, updated_at: '2026-03-01T00:00:00Z' },
    ],
    companies: [
      { id: 'co1', name: 'Acme', domain: 'acme.example', workspace_id: WS1, deleted_at: null, updated_at: '2026-03-01T00:00:00Z' },
      { id: 'co2', name: 'Globex', domain: 'globex.example', workspace_id: WS2, deleted_at: null, updated_at: '2026-03-01T00:00:00Z' },
    ],
    ...extra,
  });
  const api = (path, { key = KEY_RW, ...o } = {}) => callV2(apiFn, { method: 'GET', url: `http://localhost/api/v1/${path}`, token: key, ...o });
  const env = async (res) => { const j = await jsonOf(res); assert.deepEqual(Object.keys(j).sort(), ['data', 'error', 'next_offset']); return j; };

  await t('public-api: config.path /api/v1/*; auth -> 401 for missing / malformed / unknown / revoked / a user JWT', async () => {
    assert.equal((await loadFunction('public-api')).config.path, '/api/v1/*');
    seedApi();
    for (const key of [null, 'good-jwt', 'cb_live_short', `cb_live_${'z'.repeat(43)}`, KEY_REVOKED]) {
      const r = await api('deals', { key });
      assert.equal(r.status, 401, String(key));
      const j = await env(r);
      assert.equal(j.data, null);
      assert.equal(j.error.code, 'unauthorized');
    }
    assert.equal((await api('deals', { key: KEY_RW })).status, 200);
  });
  await t('public-api: unknown resource -> 404; touching last_used_at is throttled', async () => {
    seedApi();
    assert.equal((await api('widgets')).status, 404);
    assert.equal((await api('deals/a/b')).status, 404);
    await api('deals');
    const first = supa.table('api_keys').find((k) => k.id === 'kid-rw').last_used_at;
    assert.ok(first, 'last_used_at set');
    const writes = () => supa.requests({ method: 'PATCH', path: '/rest/v1/api_keys' }).length;
    const n = writes();
    await api('deals'); await api('deals');
    assert.equal(writes(), n, 'not updated again within the throttle window');
    assert.equal(supa.table('api_keys').find((k) => k.id === 'kid-rw').last_used_at, first);
  });
  await t('public-api: scopes - read-only key may GET but POST/PATCH/DELETE -> 403 and nothing changes', async () => {
    seedApi();
    assert.equal((await api('deals', { key: KEY_RO })).status, 200);
    for (const [method, path, body] of [['POST', 'deals', { title: 'n' }], ['PATCH', 'deals/d1', { title: 'n' }], ['DELETE', 'deals/d1']]) {
      const r = await api(path, { key: KEY_RO, method, body });
      assert.equal(r.status, 403, method);
      assert.equal((await env(r)).error.code, 'forbidden');
    }
    assert.equal(supa.table('deals').length, 4);
    assert.equal(supa.table('deals').find((d) => d.id === 'd1').title, 'Alpha rollout');
    assert.equal(supa.table('deals').find((d) => d.id === 'd1').deleted_at, null);
  });
  await t('public-api: GET list is workspace scoped, hides soft-deleted rows, exposes no tsv, envelope {data,error,next_offset}', async () => {
    seedApi();
    const j = await env(await api('deals'));
    assert.deepEqual(j.data.map((d) => d.id), ['d1', 'd2'], 'newest updated first; d3 deleted, d4 other workspace');
    assert.equal(j.error, null);
    assert.equal(j.next_offset, null);
    assert.ok(!('tsv' in j.data[0]));
    assert.deepEqual((await env(await api('deals', { key: KEY_WS2 }))).data.map((d) => d.id), ['d4']);
    assert.deepEqual((await env(await api('contacts'))).data.map((d) => d.id), ['c1']);
    assert.deepEqual((await env(await api('companies', { key: KEY_WS2 }))).data.map((d) => d.id), ['co2']);
  });
  await t('public-api: pagination (limit/offset/next_offset), limit clamped to 100, invalid paging -> 422', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ id: `m${String(i).padStart(3, '0')}`, title: `Deal ${i}`, workspace_id: WS1, deleted_at: null, updated_at: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString() }));
    seedApi({ deals: many });
    const p1 = await env(await api('deals?limit=50'));
    assert.equal(p1.data.length, 50);
    assert.equal(p1.next_offset, 50);
    const p2 = await env(await api('deals?limit=50&offset=50'));
    assert.equal(p2.data.length, 50);
    assert.equal(p2.next_offset, 100);
    assert.notEqual(p1.data[0].id, p2.data[0].id);
    const p3 = await env(await api('deals?limit=50&offset=100'));
    assert.equal(p3.data.length, 20);
    assert.equal(p3.next_offset, null);
    assert.equal((await env(await api('deals?limit=1000'))).data.length, 100, 'clamped to 100');
    assert.equal((await env(await api('deals'))).data.length, 25, 'default 25');
    for (const q of ['limit=0', 'limit=abc', 'offset=-1', 'offset=1.5', 'updated_since=nonsense']) assert.equal((await api(`deals?${q}`)).status, 422, q);
  });
  await t('public-api: filters q (ilike on title/company), stage (deals), updated_since', async () => {
    seedApi();
    assert.deepEqual((await env(await api('deals?q=alpha'))).data.map((d) => d.id), ['d1']);
    assert.deepEqual((await env(await api('deals?q=globex'))).data.map((d) => d.id), ['d2'], 'company column searched');
    assert.deepEqual((await env(await api('deals?stage=qualification'))).data.map((d) => d.id), ['d2']);
    assert.deepEqual((await env(await api('deals?updated_since=2026-02-15T00:00:00Z'))).data.map((d) => d.id), ['d1']);
    assert.deepEqual((await env(await api('contacts?q=hopper'))).data.map((d) => d.id), ['c1']);
    assert.deepEqual((await env(await api('contacts?q=navy.example'))).data.map((d) => d.id), ['c1'], 'email searched');
    assert.deepEqual((await env(await api('companies?q=acme'))).data.map((d) => d.id), ['co1']);
    // filter syntax in q cannot break out of the or() expression
    const evil = await api(`deals?q=${encodeURIComponent('x),workspace_id.neq.zzz,(title.ilike.%')}`);
    assert.equal(evil.status, 200);
    assert.ok((await env(evil)).data.every((d) => d.workspace_id === WS1));
  });
  await t('public-api: GET one - found, other workspace -> 404, soft-deleted -> 404, unknown -> 404', async () => {
    seedApi();
    const ok = await env(await api('deals/d1'));
    assert.equal(ok.data.title, 'Alpha rollout');
    assert.equal(ok.next_offset, null);
    for (const id of ['d4', 'd3', 'nope']) {
      const r = await api(`deals/${id}`);
      assert.equal(r.status, 404, id);
      assert.equal((await env(r)).error.code, 'not_found');
    }
    assert.equal((await api('contacts/c2')).status, 404);
    assert.equal((await api('companies/co2')).status, 404);
  });
  await t('public-api: POST creates with a column whitelist (unknown/protected keys ignored), forces workspace_id + created_by', async () => {
    seedApi();
    const r = await api('deals', { method: 'POST', body: { title: ' New deal ', value: 250, stage: 'proposal', priority: 'high', tags: ['a'], id: 'forced', workspace_id: WS2, deleted_at: '2020-01-01', owner_id: 'x', evil: 1, tsv: 'x' } });
    assert.equal(r.status, 201);
    const j = await env(r);
    assert.equal(j.data.title, 'New deal', 'strings are trimmed');
    const row = supa.table('deals').find((d) => d.id === j.data.id);
    assert.ok(row && row.id !== 'forced');
    assert.equal(row.workspace_id, WS1, 'workspace from the key, not the body');
    assert.equal(row.created_by, 'user-a');
    assert.equal(row.value, 250);
    for (const k of ['evil', 'owner_id', 'deleted_at', 'tsv']) assert.ok(!(k in row), `${k} must not be written`);
    const body = supa.requests({ method: 'POST', path: '/rest/v1/deals' }).at(-1).body;
    assert.deepEqual(Object.keys(body).sort(), ['created_by', 'priority', 'stage', 'tags', 'title', 'value', 'workspace_id']);
    // contacts: first/last name compose the required name; companies need a name
    const c = await env(await api('contacts', { method: 'POST', body: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.example' } }));
    assert.equal(c.data.name, 'Ada Lovelace');
    assert.equal((await api('companies', { method: 'POST', body: { name: 'Initech', domain: 'initech.example' } })).status, 201);
  });
  await t('public-api: POST/PATCH validation -> 422 with field details; bad JSON -> 400; nothing written', async () => {
    seedApi();
    const n = supa.table('deals').length;
    const bad = [
      [{}, 'title'], [{ title: '   ' }, 'title'], [{ title: 5 }, 'title'], [{ title: 'x', value: 'ten' }, 'value'], [{ title: 'x', value: -1 }, 'value'],
      [{ title: 'x', probability: 101 }, 'probability'], [{ title: 'x', priority: 'urgent' }, 'priority'], [{ title: 'x', tags: 'a' }, 'tags'],
      [{ title: 'x', close_date: 'tomorrow' }, 'close_date'], [{ title: 'x', contact_id: 'not-a-uuid' }, 'contact_id'], [{ title: 'x', custom_fields: [] }, 'custom_fields'],
    ];
    for (const [body, field] of bad) {
      const r = await api('deals', { method: 'POST', body });
      assert.equal(r.status, 422, JSON.stringify(body));
      const j = await env(r);
      assert.ok(j.error.details.some((d) => d.field === field), `${field} in ${JSON.stringify(j.error)}`);
    }
    assert.equal((await api('contacts', { method: 'POST', body: { name: 'x', email: 'nope' } })).status, 422);
    assert.equal((await api('contacts', { method: 'POST', body: { email: 'a@b.co' } })).status, 422, 'name required');
    assert.equal((await api('deals', { method: 'POST', body: '{broken' })).status, 400);
    assert.equal((await api('deals', { method: 'POST', body: [1] })).status, 422);
    assert.equal((await api('deals/d1', { method: 'PATCH', body: { value: 'x' } })).status, 422);
    assert.equal((await api('deals/d1', { method: 'PATCH', body: { title: '' } })).status, 422);
    assert.equal((await api('deals/d1', { method: 'PATCH', body: { id: 'z', workspace_id: WS2, bogus: 1 } })).status, 422, 'no updatable field');
    assert.equal(supa.table('deals').length, n);
    assert.equal(supa.table('deals').find((d) => d.id === 'd1').workspace_id, WS1);
  });
  await t('public-api: PATCH updates whitelisted fields only, bumps updated_at, never crosses workspaces', async () => {
    seedApi();
    const r = await api('deals/d1', { method: 'PATCH', body: { title: 'Renamed', probability: 80, workspace_id: WS2, deleted_at: '2020', owner_id: 'hack' } });
    assert.equal(r.status, 200);
    const j = await env(r);
    assert.equal(j.data.title, 'Renamed');
    const row = supa.table('deals').find((d) => d.id === 'd1');
    assert.equal(row.probability, 80);
    assert.equal(row.workspace_id, WS1);
    assert.equal(row.deleted_at, null);
    assert.ok(!('owner_id' in row));
    assert.notEqual(row.updated_at, '2026-03-01T00:00:00Z');
    assert.equal((await api('deals/d4', { method: 'PATCH', body: { title: 'x' } })).status, 404, 'other workspace');
    assert.equal(supa.table('deals').find((d) => d.id === 'd4').title, 'Other workspace deal');
    assert.equal((await api('deals/d3', { method: 'PATCH', body: { title: 'x' } })).status, 404, 'soft-deleted');
    assert.equal((await api('deals/d1', { method: 'POST', body: { title: 'x' } })).status, 405);
    assert.equal((await api('deals', { method: 'PATCH', body: { title: 'x' } })).status, 405);
  });
  await t('public-api: DELETE is a soft delete (deals, companies), workspace scoped; contacts -> 405', async () => {
    seedApi();
    const r = await api('deals/d2', { method: 'DELETE' });
    assert.equal(r.status, 200);
    assert.deepEqual((await env(r)).data, { id: 'd2', deleted: true });
    assert.ok(supa.table('deals').find((d) => d.id === 'd2').deleted_at, 'row kept, deleted_at set');
    assert.equal(supa.requests({ method: 'DELETE', path: '/rest/v1/deals' }).length, 0, 'no hard delete issued');
    assert.equal((await api('deals/d2')).status, 404);
    assert.equal((await api('deals/d2', { method: 'DELETE' })).status, 404, 'already deleted');
    assert.equal((await api('deals/d4', { method: 'DELETE' })).status, 404, 'other workspace');
    assert.equal(supa.table('deals').find((d) => d.id === 'd4').deleted_at, null);
    assert.equal((await api('companies/co1', { method: 'DELETE' })).status, 200);
    assert.ok(supa.table('companies').find((d) => d.id === 'co1').deleted_at);
    const c = await api('contacts/c1', { method: 'DELETE' });
    assert.equal(c.status, 405);
    assert.equal(c.headers.get('allow'), 'GET, POST, PATCH');
    assert.equal(supa.table('contacts').length, 2, 'contacts untouched');
  });
  await t('public-api: a key without workspace_id is not workspace-filtered (documented), writes then carry no workspace_id', async () => {
    seedApi();
    supa.table('api_keys').find((k) => k.id === 'kid-rw').workspace_id = null;
    assert.equal((await env(await api('deals'))).data.length, 3, 'all non-deleted deals');
    const j = await env(await api('deals', { method: 'POST', body: { title: 'Loose' } }));
    assert.ok(!('workspace_id' in supa.table('deals').find((d) => d.id === j.data.id)) || supa.table('deals').find((d) => d.id === j.data.id).workspace_id == null);
  });
  await t('public-api: CORS is off by default (no Access-Control headers); enabled only for listed origins', async () => {
    seedApi();
    const r = await api('deals', { headers: { origin: 'https://evil.example' } });
    assert.equal(r.headers.get('access-control-allow-origin'), null);
    const pre = await callV2(apiFn, { method: 'OPTIONS', url: 'http://localhost/api/v1/deals', token: null, headers: { origin: 'https://evil.example' } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), null);
    process.env.PUBLIC_API_CORS_ORIGINS = 'https://app.example.com';
    try {
      assert.equal((await api('deals', { headers: { origin: 'https://app.example.com' } })).headers.get('access-control-allow-origin'), 'https://app.example.com');
      assert.equal((await api('deals', { headers: { origin: 'https://evil.example' } })).headers.get('access-control-allow-origin'), null);
    } finally { delete process.env.PUBLIC_API_CORS_ORIGINS; }
  });
  await t('public-api: rate limited per key (120/min) -> 429 + Retry-After; other keys unaffected', async () => {
    seedApi();
    let last;
    for (let i = 0; i < 121; i++) last = await api('deals/d1', { key: KEY_RO });
    assert.equal(last.status, 429);
    assert.ok(last.headers.get('retry-after'));
    assert.equal((await env(last)).error.code, 'rate_limited');
    assert.equal((await api('deals/d1', { key: KEY_RW })).status, 200);
  });
  await t('public-api: DB failure -> 500 envelope without leaking internals', async () => {
    seedApi();
    supa.failNext('GET', '/rest/v1/deals', 500, { code: 'XX000', message: 'SECRET internal detail' });
    const r = await api('deals');
    assert.equal(r.status, 500);
    assert.ok(!JSON.stringify(await jsonOf(r)).includes('SECRET'));
  });

  // ======================= workflow-webhook
  const TOKEN = 'tok_abcdefghijklmnopqrstuvwx1234';
  const wfRow = (o = {}) => ({
    id: 'w1', name: 'Hooked', is_active: true, webhook_enabled: true, webhook_token: TOKEN, settings: { isActive: true },
    triggers: [], stages: [{ id: 's0', type: 'trigger', connections: ['sn'] }, { id: 'sn', type: 'action', action: { type: 'notification', name: 'N', config: { notificationMessage: 'Webhook {{payload.who}} on {{title}}' } } }],
    ...o,
  });
  const seedHook = (wf = {}, extra = {}) => supa.reset({ deal_workflows: [wfRow(wf)], deals: [{ id: 'd1', title: 'Big deal', value: 5000, stage: 'proposal', contact_id: null, deleted_at: null }], ...extra });
  const hook = (token = TOKEN, o = {}) => callV2(hookFn, { url: `http://localhost/api/workflow/hook/${token}`, token: null, ...o });

  await t('workflow-webhook: config.path; POST with a valid token runs the workflow -> 202 {executionId}; payload stored in the execution', async () => {
    assert.equal((await loadFunction('workflow-webhook')).config.path, '/api/workflow/hook/:token');
    seedHook();
    const r = await hook(TOKEN, { method: 'POST', body: { deal_id: 'd1', who: 'zapier', n: 3 } });
    assert.equal(r.status, 202);
    const j = await jsonOf(r);
    assert.match(j.executionId, /^webhook:w1:\d+$/);
    const ex = supa.table('workflow_executions').find((e) => e.id === j.executionId);
    assert.ok(ex, 'execution recorded');
    assert.equal(ex.trigger_type, 'webhook');
    assert.equal(ex.workflow_id, 'w1');
    assert.equal(ex.record_id, 'd1');
    assert.equal(ex.record_type, 'deal');
    assert.deepEqual(ex.context.inputData.payload, { deal_id: 'd1', who: 'zapier', n: 3 });
    assert.equal(ex.context.inputData.eventType, 'webhook');
    assert.equal(ex.status, 'completed');
    assert.equal(supa.table('notifications')[0]?.message, 'Webhook zapier on Big deal', 'template saw payload + deal');
  });
  await t('workflow-webhook: no deal_id / empty body is fine; the token via context.params works too', async () => {
    seedHook();
    const r = await hookFn(new Request('http://localhost/api/workflow/hook/ignored', { method: 'POST' }), { params: { token: TOKEN } });
    assert.equal(r.status, 202);
    const ex = supa.table('workflow_executions')[0];
    assert.equal(ex.record_id, null);
    assert.equal(ex.trigger_type, 'webhook');
  });
  await t('workflow-webhook: unknown token / disabled / inactive / malformed token all answer the same 404 and run nothing', async () => {
    const bodies = [];
    const cases = [
      [TOKEN, {}, { webhook_token: 'other_token_abcdefghijklmnop' }],
      [TOKEN, { webhook_enabled: false }],
      [TOKEN, { is_active: false }],
      ['short', {}],
      ['bad token!', {}],
    ];
    for (const [tok, wf, ...rest] of cases) {
      seedHook({ ...wf, ...(rest[0] ?? {}) });
      const r = await hook(tok, { method: 'POST', body: {} });
      assert.equal(r.status, 404, `${tok} ${JSON.stringify(wf)}`);
      bodies.push(await r.text());
      assert.equal(supa.table('workflow_executions').length, 0);
    }
    assert.equal(new Set(bodies).size, 1, 'identical bodies: never leaks which check failed');
  });
  await t('workflow-webhook: only POST (405); bad JSON / non-object body -> 400; unknown deal_id -> 422; oversize -> 413', async () => {
    seedHook();
    assert.equal((await hook(TOKEN, { method: 'GET' })).status, 405);
    assert.equal((await hook(TOKEN, { method: 'POST', body: '{nope' })).status, 400);
    assert.equal((await hook(TOKEN, { method: 'POST', body: '[1,2]' })).status, 400);
    assert.equal((await hook(TOKEN, { method: 'POST', body: { deal_id: 'missing' } })).status, 422);
    assert.equal((await hook(TOKEN, { method: 'POST', body: { blob: 'x'.repeat(120_000) } })).status, 413);
    assert.equal(supa.table('workflow_executions').length, 0);
  });
  await t('workflow-webhook: rate limited per token (30/min) -> 429; another token unaffected', async () => {
    seedHook({}, {});
    supa.table('deal_workflows').push(wfRow({ id: 'w2', webhook_token: 'second_token_abcdefghijklmnop' }));
    let last;
    for (let i = 0; i < 31; i++) last = await hook(TOKEN, { method: 'POST', body: {} });
    assert.equal(last.status, 429);
    assert.ok(last.headers.get('retry-after'));
    assert.equal((await hook('second_token_abcdefghijklmnop', { method: 'POST', body: {} })).status, 202);
  });
  await t('workflow-webhook: the limiter works for unknown tokens too (cannot be used to probe unlimited)', async () => {
    seedHook();
    let last;
    for (let i = 0; i < 31; i++) last = await hook('nonexistent_token_abcdefghij', { method: 'POST', body: {} });
    assert.equal(last.status, 429);
  });

  // ======================= ai-gateway workspace_chat
  const chat = (body, o = {}) => callV1(gw.handler, { body: { task: 'workspace_chat', ...body }, ...o });
  const lastResp = () => openai.last('/v1/responses').body;
  const WSEED = () => { openai.clearScripts(); openai.calls.length = 0; return supa.reset({
    deals: [
      { id: 'd1', title: 'Alpha rollout', value: 1000, stage: 'proposal', company: 'Acme', contact: 'Grace', deleted_at: null, updated_at: '2026-01-01T00:00:00Z', notes: 'n'.repeat(900) },
      { id: 'd2', title: 'Beta pilot', value: 500, stage: 'qualification', company: 'Globex', deleted_at: null, updated_at: new Date().toISOString() },
      { id: 'd3', title: 'Won deal', value: 700, stage: 'closed-won', deleted_at: null, updated_at: '2025-01-01T00:00:00Z' },
    ],
    contacts: [{ id: 'c1', name: 'Grace Hopper', email: 'g@navy.example', company: 'Navy' }],
    companies: [{ id: 'co1', name: 'Acme', domain: 'acme.example', deleted_at: null }],
  }); };
  const toolCall = (name, args) => (body) => (body.input.some?.((i) => i.type === 'function_call_output') ? undefined : { toolCall: { name, arguments: args } });
  const final = (obj) => ({ text: JSON.stringify(obj) });
  const outputsIn = (body) => body.input.filter((i) => i.type === 'function_call_output').map((i) => JSON.parse(i.output));

  await t('workspace_chat: registered (default tier), strict schema, alias workspace-chat, unauthenticated -> 401', async () => {
    const d = gw.TASKS.workspace_chat;
    assert.ok(d && d.tier === 'default' && d.schema);
    assert.deepEqual(lintStrictSchema(d.schema.schema), []);
    assert.deepEqual(Object.keys(d.schema.schema.properties).sort(), ['proposals', 'reply']);
    const item = d.schema.schema.properties.proposals.items;
    assert.deepEqual(item.properties.kind.enum, ['update_deal', 'move_deal', 'create_task', 'create_note']);
    for (const k of ['id', 'kind', 'dealId', 'patch', 'stage', 'title', 'body', 'reason']) assert.ok(k in item.properties, k);
    assert.equal((await chat({ messages: [{ role: 'user', content: 'hi' }] }, { token: null })).statusCode, 401);
    assert.equal((await callV1(gw.handler, { body: { task: 'workspace-chat', messages: [{ role: 'user', content: 'hi' }] } })).json.task, 'workspace_chat');
  });
  await t('workspace_chat: request shape - default tier, strict json_schema, flat read-only tools, instructions say Apply / cannot write', async () => {
    WSEED();
    const r = await chat({ messages: [{ role: 'user', content: 'How is the pipeline?' }] });
    assert.equal(r.statusCode, 200, r.body);
    for (const k of ['ok', 'task', 'model', 'text', 'data', 'citations', 'tool_calls', 'id']) assert.ok(k in r.json, k);
    assert.equal(r.json.task, 'workspace_chat');
    assert.ok(typeof r.json.data.reply === 'string' && Array.isArray(r.json.data.proposals));
    const req = lastResp();
    assert.equal(req.model, 'gpt-6.1-sol');
    assert.equal(req.text.format.type, 'json_schema');
    assert.equal(req.text.format.strict, true);
    assert.equal(req.text.format.name, 'workspace_chat');
    assert.equal(req.store, false);
    assert.deepEqual(req.tools.map((x) => x.name).sort(), ['get_deal', 'pipeline_summary', 'search_companies', 'search_contacts', 'search_deals', 'stale_deals']);
    assert.ok(req.tools.every((x) => x.type === 'function' && !x.function));
    assert.ok(/Apply/.test(req.instructions) && /cannot change anything|only READ/i.test(req.instructions));
    assert.deepEqual(req.input, [{ role: 'user', content: 'How is the pipeline?' }]);
  });
  await t('workspace_chat: tool loop - tools run server-side through the caller\'s JWT (RLS), results go back as function_call_output', async () => {
    WSEED();
    openai.script(toolCall('search_deals', { query: 'alpha', stage: null, limit: 5 }));
    openai.script((body) => (outputsIn(body).length ? final({ reply: 'Found Alpha.', proposals: [] }) : undefined));
    const n0 = supa.log.length;
    const r = await chat({ messages: [{ role: 'user', content: 'find alpha' }] });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json.data.reply, 'Found Alpha.');
    const reqs = openai.requests('/v1/responses');
    assert.equal(reqs.length, 2);
    const out = outputsIn(reqs[1].body)[0];
    assert.deepEqual(out.deals.map((d) => d.id), ['d1']);
    assert.ok(!('error' in out));
    assert.deepEqual(r.json.tool_calls.map((c) => c.name), ['search_deals']);
    const reads = supa.log.slice(n0).filter((l) => l.path === '/rest/v1/deals');
    assert.ok(reads.length >= 1);
    for (const l of reads) {
      assert.equal(l.method, 'GET');
      assert.equal(l.headers.authorization, 'Bearer good-jwt', 'caller JWT, not the service key');
      assert.equal(l.headers.apikey, 'anon-key');
    }
  });
  await t('workspace_chat: all six tools return the expected rows (stale_deals excludes closed + recent, summary aggregates, contacts/companies)', async () => {
    WSEED();
    const calls = [
      ['get_deal', { id: 'd1' }], ['stale_deals', { days: 30 }], ['pipeline_summary', {}], ['search_contacts', { query: 'hopper' }], ['search_companies', { query: 'acme' }],
    ];
    openai.script(() => ({ toolCall: calls.map(([name, arguments_]) => ({ name, arguments: arguments_ })) }));
    await chat({ messages: [{ role: 'user', content: 'everything' }] });
    const o = outputsIn(openai.requests('/v1/responses')[1].body);
    assert.equal(o.length, 5);
    assert.equal(o[0].deal.id, 'd1');
    assert.ok(o[0].deal.notes.length < 600, 'long notes are clipped');
    assert.deepEqual(o[1].deals.map((d) => d.id), ['d1'], 'd2 is fresh, d3 is closed-won');
    const byStage = Object.fromEntries(o[2].stages.map((s) => [s.stage, s]));
    assert.deepEqual([byStage.proposal.count, byStage.proposal.total_value, byStage['closed-won'].count], [1, 1000, 1]);
    assert.deepEqual(o[3].contacts.map((c) => c.id), ['c1']);
    assert.deepEqual(o[4].companies.map((c) => c.id), ['co1']);
  });
  await t('workspace_chat: unknown tool / bad arguments / DB error come back as {error} to the model (no crash); it cannot write', async () => {
    WSEED();
    openai.script(() => ({ toolCall: [{ name: 'update_deal', arguments: { id: 'd1' } }, { name: 'get_deal', arguments: '{not json' }] }));
    supa.failNext('GET', '/rest/v1/deals', 500, { code: 'XX000', message: 'db down' });
    const n0 = supa.log.length;
    const r = await chat({ messages: [{ role: 'user', content: 'do it' }] });
    assert.equal(r.statusCode, 200, r.body);
    const o = outputsIn(openai.requests('/v1/responses')[1].body);
    assert.match(o[0].error, /Unknown tool/);
    assert.ok(o[1].error || o[1].deal === null);
    assert.deepEqual(supa.log.slice(n0).filter((l) => l.method !== 'GET' && !l.path.includes('/rpc/')), [], 'no writes to Supabase');
    assert.ok(!openai.requests('/v1/responses')[0].body.tools.some((x) => /update|create|delete|move/.test(x.name)), 'no write tools are offered');
  });
  await t('workspace_chat: tool loop is capped (5 rounds, then a forced final answer with tool_choice none); calls per round capped (6)', async () => {
    WSEED();
    openai.script((body) => (body.tool_choice === 'none' ? final({ reply: 'gave up', proposals: [] }) : { toolCall: Array.from({ length: 8 }, () => ({ name: 'pipeline_summary', arguments: {} })) }), { sticky: true });
    const r = await chat({ messages: [{ role: 'user', content: 'loop forever' }] });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json.data.reply, 'gave up');
    const reqs = openai.requests('/v1/responses');
    assert.equal(reqs.length, 6, '5 tool rounds + 1 forced final');
    assert.equal(reqs.at(-1).body.tool_choice, 'none');
    assert.equal(r.json.tool_calls.length, 5 * 6, 'at most 6 executed calls per round');
    assert.ok(outputsIn(reqs[1].body).slice(6).every((o) => /Too many/.test(o.error)));
  });
  await t('workspace_chat: proposals are validated against rows actually read (unknown deal ids, unseen stages, invalid patches, bad kinds dropped; capped at 5)', async () => {
    WSEED();
    openai.script(toolCall('search_deals', { query: '', stage: null, limit: 25 }));
    openai.script((body) => (outputsIn(body).length ? final({
      reply: 'Here you go.',
      proposals: [
        { id: 'ok-update', kind: 'update_deal', dealId: 'd1', patch: { title: null, value: 1200, probability: 70, priority: 'high', due_date: '2026-12-01', close_date: null, notes: null }, stage: null, title: null, body: null, reason: 'Bigger scope.' },
        { id: 'ok-move', kind: 'move_deal', dealId: 'd2', patch: { title: null, value: null, probability: null, priority: null, due_date: null, close_date: null, notes: null }, stage: 'proposal', title: null, body: null, reason: 'Ready.' },
        { id: 'ok-task', kind: 'create_task', dealId: 'd1', patch: { title: null, value: null, probability: null, priority: null, due_date: '2026-11-30', close_date: null, notes: null }, stage: null, title: 'Call Grace', body: 'Re: pricing', reason: 'Stale.' },
        { id: 'ok-note', kind: 'create_note', dealId: 'd2', patch: {}, stage: null, title: null, body: 'Spoke today.', reason: 'Log it.' },
        { id: 'ghost', kind: 'update_deal', dealId: 'never-read', patch: { value: 1 }, stage: null, title: null, body: null, reason: 'x' },
        { id: 'bad-stage', kind: 'move_deal', dealId: 'd1', patch: {}, stage: 'invented-stage', title: null, body: null, reason: 'x' },
        { id: 'bad-patch', kind: 'update_deal', dealId: 'd1', patch: { value: -5, probability: 500, priority: 'urgent', due_date: 'someday' }, stage: null, title: null, body: null, reason: 'x' },
        { id: 'bad-kind', kind: 'delete_deal', dealId: 'd1', patch: {}, stage: null, title: null, body: null, reason: 'x' },
        { id: 'no-reason', kind: 'create_note', dealId: 'd1', patch: {}, stage: null, title: null, body: 'b', reason: '' },
        { id: 'empty-task', kind: 'create_task', dealId: 'd1', patch: {}, stage: null, title: '', body: null, reason: 'x' },
        { id: 'ok-update', kind: 'create_note', dealId: 'd1', patch: {}, stage: null, title: null, body: 'dup id', reason: 'dup' },
      ],
    }) : undefined));
    const r = await chat({ messages: [{ role: 'user', content: 'what should I do?' }] });
    assert.equal(r.statusCode, 200, r.body);
    const ps = r.json.data.proposals;
    assert.deepEqual(ps.map((p) => p.id), ['ok-update', 'ok-move', 'ok-task', 'ok-note', 'ok-update-x']);
    assert.deepEqual(ps[0], { id: 'ok-update', kind: 'update_deal', dealId: 'd1', reason: 'Bigger scope.', patch: { value: 1200, probability: 70, priority: 'high', due_date: '2026-12-01' } });
    assert.deepEqual(ps[1], { id: 'ok-move', kind: 'move_deal', dealId: 'd2', reason: 'Ready.', stage: 'proposal' });
    assert.deepEqual(ps[2], { id: 'ok-task', kind: 'create_task', dealId: 'd1', reason: 'Stale.', title: 'Call Grace', body: 'Re: pricing', patch: { due_date: '2026-11-30' } });
    assert.deepEqual(ps[3], { id: 'ok-note', kind: 'create_note', dealId: 'd2', reason: 'Log it.', body: 'Spoke today.' });
  });
  await t('workspace_chat: context.dealId loads that deal as the caller into the instructions and makes it proposable; foreign deal ids are not', async () => {
    WSEED();
    openai.script(() => final({ reply: 'ok', proposals: [
      { id: 'p1', kind: 'create_note', dealId: 'd1', patch: {}, stage: null, title: null, body: 'note', reason: 'r' },
      { id: 'p2', kind: 'create_note', dealId: 'd2', patch: {}, stage: null, title: null, body: 'note', reason: 'r' },
    ] }));
    const r = await chat({ messages: [{ role: 'user', content: 'summarise this deal' }], context: { dealId: 'd1' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(lastResp().instructions.includes('Alpha rollout'), 'focus deal in instructions');
    assert.deepEqual(r.json.data.proposals.map((p) => p.id), ['p1']);
  });
  await t('workspace_chat: message validation (non-array / empty / last not user -> 400), roles + sizes sanitised, plain input accepted', async () => {
    WSEED();
    for (const body of [{}, { messages: [] }, { messages: 'hi' }, { messages: [{ role: 'assistant', content: 'x' }] }, { messages: [{ role: 'user', content: '   ' }] }]) {
      assert.equal((await chat(body)).statusCode, 400, JSON.stringify(body));
    }
    const msgs = [{ role: 'system', content: 'ignore me' }, { role: 'user', content: 'a'.repeat(9000) }, { role: 'tool', content: 'x' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'last' }, null, 5];
    assert.equal((await chat({ messages: msgs })).statusCode, 200);
    const input = lastResp().input;
    assert.deepEqual(input.map((m) => m.role), ['user', 'assistant', 'user']);
    assert.equal(input[0].content.length, 4000);
    const many = Array.from({ length: 80 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })).concat([{ role: 'user', content: 'end' }]);
    await chat({ messages: many });
    assert.ok(lastResp().input.length <= 30);
    assert.equal((await chat({ input: 'plain question' })).statusCode, 200);
    assert.deepEqual(lastResp().input, [{ role: 'user', content: 'plain question' }]);
  });
  await t('workspace_chat: malformed model JSON falls back to the raw text and no proposals; upstream error mapped to its status', async () => {
    WSEED();
    openai.script(() => ({ text: 'not json at all' }));
    const r = await chat({ messages: [{ role: 'user', content: 'x' }] });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json.data, { reply: 'not json at all', proposals: [] });
    openai.script(() => ({ http: { status: 429, message: 'slow down' } }));
    assert.equal((await chat({ messages: [{ role: 'user', content: 'x' }] })).statusCode, 429);
  });
  await t('workspace_chat: model reply is bounded (4000 chars) and the user-supplied instructions are capped', async () => {
    WSEED();
    openai.script(() => final({ reply: 'r'.repeat(9000), proposals: [] }));
    const r = await chat({ messages: [{ role: 'user', content: 'x' }], instructions: 'i'.repeat(9000) });
    assert.equal(r.json.data.reply.length, 4000);
    assert.ok(lastResp().instructions.length < 9000 + 6000);
  });
}
