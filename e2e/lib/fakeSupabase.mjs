// In-memory fake of Supabase (PostgREST + auth + storage) installed with Playwright route().
// It lets the REAL persistence code paths run (dealMapper, optimistic update/rollback, services) with no server.
// Emulated DB behaviour (documented because it normally lives in SQL, verified separately in e2e/sql):
//  - deals.updated_at/id/created_at defaults, stage change -> deal_activities row (deal_audit trigger)
//  - zero-row PATCH/DELETE return [] (PostgREST behaviour), RLS denial via fake.deny(...)
// STRICT mode (always on): tables/columns/rpc signatures/policies/buckets come from schema.json (see strict.mjs).
// Every contract violation (unknown table/column/rpc/arg, RLS-denied op, private-bucket public URL, ...) is answered
// with the real PostgREST/Storage error shape AND recorded in fake.violations. The runner fails a scenario that
// caused a violation it did not declare with fake.expectViolation({...}).
import crypto from 'node:crypto';
import * as S from './strict.mjs';

export const FAKE_URL = 'http://fake.supabase.local';
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function parseVal(v) { return v; }
function cmp(a, b) { if (a == null && b == null) return 0; if (a == null) return -1; if (b == null) return 1; return a < b ? -1 : a > b ? 1 : 0; }
function coerce(rowVal, filterVal) {
  if (typeof rowVal === 'number') return Number(filterVal);
  if (typeof rowVal === 'boolean') return filterVal === 'true';
  return filterVal;
}
function matchOp(row, col, op, val, negate = false) {
  const rv = col.includes('->') ? col.split('->').reduce((o, k) => (o == null ? o : o[k.replace(/>/g, '')]), row) : row[col];
  let r;
  switch (op) {
    case 'eq': r = rv != null && String(rv) === String(val); break;
    case 'neq': r = rv == null || String(rv) !== String(val); break;
    case 'gt': r = cmp(rv, coerce(rv, val)) > 0; break;
    case 'gte': r = cmp(rv, coerce(rv, val)) >= 0; break;
    case 'lt': r = rv != null && cmp(rv, coerce(rv, val)) < 0; break;
    case 'lte': r = rv != null && cmp(rv, coerce(rv, val)) <= 0; break;
    case 'is': r = val === 'null' ? rv == null : val === 'true' ? rv === true : val === 'false' ? rv === false : rv === val; break;
    case 'in': { const list = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')); r = rv != null && list.includes(String(rv)); break; }
    case 'like': case 'ilike': { const re = new RegExp('^' + String(val).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/\*/g, '.*') + '$', op === 'ilike' ? 'i' : ''); r = rv != null && re.test(String(rv)); break; }
    case 'cs': r = Array.isArray(rv) && val.replace(/^[{[]|[}\]]$/g, '').split(',').every(x => rv.includes(x)); break;
    case 'ov': r = Array.isArray(rv) && val.replace(/^[{[]|[}\]]$/g, '').split(',').some(x => rv.includes(x)); break;
    case 'fts': case 'plfts': case 'phfts': case 'wfts': r = rv != null && String(rv).toLowerCase().includes(String(val).toLowerCase()); break;
    default: r = true;
  }
  return negate ? !r : r;
}
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
function evalOrExpr(row, expr) { // "a.eq.1,b.ilike.%x%" or and(...)
  return splitTop(expr).some(part => {
    const m = part.match(/^and\((.*)\)$/);
    if (m) return splitTop(m[1]).every(p => evalCond(row, p));
    return evalCond(row, part);
  });
}
function evalCond(row, part) {
  const m = part.match(/^([^.]+(?:->>?[^.]+)?)\.(not\.)?([a-z]+)\.(.*)$/);
  if (!m) return true;
  return matchOp(row, m[1], m[3], m[4], !!m[2]);
}

export class FakeSupabase {
  constructor(seed = {}) {
    this.tables = {};
    this.log = []; // {method, table, query, body}
    this.rpcHandlers = {};
    this.denied = []; // {table, method} -> respond 42501
    this.failNext = []; // {table, method, status, body}
    this.storage = new Map();
    this.session = null;
    this.violations = []; // {kind, code, method, target, message, expected}
    this.expectations = []; // {match, hits}
    for (const [t, rows] of Object.entries(seed)) this.tables[t] = rows.map(r => ({ ...r }));
    this.installDefaultRpc();
  }
  table(t) { return (this.tables[t] ||= []); }
  deny(table, method = '*') { this.denied.push({ table, method }); }
  allow() { this.denied = []; }
  fail(table, method, status = 500, body = { message: 'forced failure', code: 'XX000' }, times = 1) { this.failNext.push({ table, method, status, body, times }); }
  requests(table, method) { return this.log.filter(l => (!table || l.table === table) && (!method || l.method === method)); }

  /** Declare that the scenario intentionally triggers a violation. match: kind string | RegExp (message) | {kind,code,method,target}. */
  expectViolation(match) { const e = { match, hits: 0 }; this.expectations.push(e); return e; }
  violate(v) {
    const rec = { ...v, expected: false };
    const hit = this.expectations.find(e => this.matches(e.match, rec));
    if (hit) { hit.hits++; rec.expected = true; }
    this.violations.push(rec);
    return rec;
  }
  matches(m, v) {
    if (typeof m === 'string') return v.kind === m;
    if (m instanceof RegExp) return m.test(`${v.kind} ${v.code} ${v.target} ${v.message}`);
    return Object.entries(m).every(([k, x]) => (x instanceof RegExp ? x.test(String(v[k])) : v[k] === x));
  }
  unexpectedViolations() { return this.violations.filter(v => !v.expected); }
  unmetExpectations() { return this.expectations.filter(e => e.hits === 0); }

  installDefaultRpc() {
    // Handlers follow the REAL signatures in schema.json (names/arity are enforced before they run).
    this.rpcHandlers.search_deals = ({ q, lim }) => {
      const ql = String(q || '').toLowerCase();
      return this.table('deals').filter(d => !d.deleted_at && [d.title, d.company, d.contact, d.notes].some(f => String(f || '').toLowerCase().includes(ql))).slice(0, lim ?? 20);
    };
    this.rpcHandlers.pipeline_aggregates = ({ p_stage_keys = null, p_op = 'sum', p_field = 'value' } = {}) => {
      const by = {};
      for (const d of this.table('deals').filter(d => !d.deleted_at && (!p_stage_keys || p_stage_keys.includes(d.stage)))) {
        const k = d.stage; (by[k] ||= []).push(Number(d[p_field] || 0));
      }
      const f = { sum: a => a.reduce((x, y) => x + y, 0), count: a => a.length, avg: a => a.reduce((x, y) => x + y, 0) / a.length, min: a => Math.min(...a), max: a => Math.max(...a) }[p_op] || (() => 0);
      return Object.entries(by).map(([stage, vals]) => ({ stage, deal_count: vals.length, agg: f(vals) }));
    };
    // merge_deals(keep uuid, merge_ids uuid[], p_fields jsonb default null) returns jsonb  (supabase/migrations/..contract_fixes.sql)
    this.rpcHandlers.merge_deals = ({ keep, merge_ids, p_fields = null }) => {
      const gone = (merge_ids || []).filter(id => id !== keep);
      const survivor = this.table('deals').find(d => d.id === keep);
      if (!survivor) throw new Error('deal to keep not found');
      const skip = ['id', 'workspace_id', 'created_by', 'created_at', 'deleted_at', 'updated_at', 'position'];
      for (const [k, v] of Object.entries(p_fields || {})) if (!skip.includes(k) && S.hasColumn('deals', k)) survivor[k] = v;
      const child = ['notes', 'deal_files', 'tasks', 'deal_activities', 'calendar_events', 'deal_history', 'deal_deadlines', 'communication_records', 'communication_logs', 'outbound_messages', 'deal_health_factors', 'deal_probability_factors', 'enhanced_activities', 'activities', 'action_items', 'automated_notes', 'email_threads', 'follow_ups', 'deal_insights'];
      for (const t of child) this.table(t).forEach(r => { if (gone.includes(r.deal_id)) r.deal_id = keep; });
      // favorites: drop dupes of keep, then repoint
      const favs = this.table('favorites');
      this.tables.favorites = favs.filter(f => !(f.entity_type === 'deal' && gone.includes(f.entity_id) && favs.some(k => k.entity_type === 'deal' && k.entity_id === keep && k.user_id === f.user_id)));
      this.table('favorites').forEach(f => { if (f.entity_type === 'deal' && gone.includes(f.entity_id)) f.entity_id = keep; });
      for (const d of this.table('deals')) if (gone.includes(d.id)) { d.deleted_at = now(); d.updated_at = now(); }
      survivor.updated_at = now();
      return { ...survivor };
    };
    this.rpcHandlers.set_rls_mode = ({ mode }) => mode;
    this.rpcHandlers.get_workflow_run_history = ({ p_limit = 50, p_workflow_id = null } = {}) => this.runHistoryView().filter(r => !p_workflow_id || r.workflow_id === p_workflow_id).slice(0, p_limit);
  }

  async install(context) {
    await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|fake\.supabase\.local)/, r => r.abort());
    await context.route('**/auth/v1/**', r => this.auth(r));
    await context.route('**/rest/v1/**', r => this.rest(r));
    await context.route('**/storage/v1/**', r => this.storageRoute(r));
    await context.route('**/functions/v1/**', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no function"}' }));
    await context.routeWebSocket(/fake\.supabase\.local\/realtime/, ws => { ws.onMessage(() => {}); }).catch(() => {});
  }

  cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range, content-type' };
  json(route, status, body, extra = {}) { return route.fulfill({ status, headers: { ...this.cors, ...extra }, contentType: 'application/json', body: JSON.stringify(body) }); }

  async auth(route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: this.cors });
    const u = new URL(req.url());
    if (u.pathname.endsWith('/user')) return this.session ? this.json(route, 200, this.session.user) : this.json(route, 401, { message: 'not logged in', code: 401 });
    if (u.pathname.endsWith('/token') || u.pathname.endsWith('/signup')) return this.json(route, 200, this.session || { access_token: 'x', token_type: 'bearer', expires_in: 3600, refresh_token: 'x', user: { id: 'anon', aud: 'authenticated', email: 'demo@example.com' } });
    return this.json(route, 200, {});
  }

  /** PostgREST role from the request: the anon key alone -> anon, a user JWT -> authenticated. */
  roleOf(req) {
    const h = req.headers();
    const bearer = (h['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (!bearer || bearer === h['apikey'] || bearer === 'fake') return 'anon';
    return 'authenticated';
  }

  async storageRoute(route) {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: this.cors });
    const method = req.method();
    const u = new URL(req.url());
    const p = u.pathname.replace('/storage/v1/', '');
    const role = this.roleOf(req);
    this.log.push({ method, table: 'storage', query: p });
    const reply = (e, v) => { if (v) this.violate({ kind: 'storage', code: String(e.body.statusCode || e.body.code), method, target: p, message: v }); return this.json(route, e.status, e.body); };
    const parts = p.split('/');
    let body = null; try { body = req.postDataJSON(); } catch {}
    const known = (b) => S.bucketDef(b);

    if (p === 'bucket' || p.startsWith('bucket/')) {
      if (method === 'GET') {
        const id = parts[1];
        if (id) return known(id) ? this.json(route, 200, { id, name: id, ...S.bucketDef(id) }) : reply(S.bucketNotFound, `unknown bucket ${id}`);
        return this.json(route, 200, Object.entries(S.schema.storage.buckets).map(([id, b]) => ({ id, name: id, ...b })));
      }
      // creating/updating/deleting buckets needs the service role (storage.buckets has no anon/authenticated write policy)
      return reply(S.storageRls, `bucket ${method} ${p} with role ${role} (service_role only; buckets are created by migrations)`);
    }
    if (parts[0] === 'object' && (parts[1] === 'move' || parts[1] === 'copy')) return this.json(route, 200, { message: 'Successfully ' + (parts[1] === 'move' ? 'moved' : 'copied') });
    if (parts[0] === 'object' && parts[1] === 'sign') {
      const bucket = parts[2]; const key = parts.slice(3).join('/');
      if (!known(bucket)) return reply(S.bucketNotFound, `unknown bucket ${bucket}`);
      if (method === 'POST') {
        if (!S.storageAllows(bucket, role, 'SELECT')) return reply(S.storageRls, `${role} may not SELECT objects in ${bucket}`);
        if (!bucket || !parts[3]) { // batch: object/sign/<bucket> {paths}
          return this.json(route, 200, (body?.paths || []).map(pa => ({ path: pa, signedURL: `/object/sign/${bucket}/${pa}?token=fake`, error: null })));
        }
        if (!this.storage.has(`${bucket}/${key}`)) return reply({ status: 400, body: { statusCode: '404', error: 'not_found', message: 'Object not found' } }, `createSignedUrl for missing object ${bucket}/${key}`);
        return this.json(route, 200, { signedURL: `/object/sign/${bucket}/${key}?token=fake` });
      }
      if (method === 'GET') { // browser fetching a signed URL: token is the credential
        if (!u.searchParams.get('token')) return reply({ status: 400, body: { statusCode: '400', error: 'InvalidJWT', message: 'jwt must be provided' } }, `signed URL without token ${p}`);
        const b = this.storage.get(`${bucket}/${key}`);
        return route.fulfill({ status: b ? 200 : 404, headers: this.cors, body: b || '' });
      }
    }
    if (parts[0] === 'object' && parts[1] === 'list') {
      const bucket = parts[2];
      if (!known(bucket)) return reply(S.bucketNotFound, `unknown bucket ${bucket}`);
      if (!S.storageAllows(bucket, role, 'SELECT')) return reply(S.storageRls, `${role} may not list ${bucket}`);
      const prefix = `${bucket}/${body?.prefix ? body.prefix.replace(/\/?$/, '/') : ''}`;
      return this.json(route, 200, [...this.storage.keys()].filter(k => k.startsWith(prefix)).map(k => ({ name: k.slice(prefix.length).split('/')[0], id: uuid() })));
    }
    if (parts[0] === 'object' && (parts[1] === 'public' || parts[1] === 'authenticated' || parts[1] === 'info')) {
      const bucket = parts[2]; const key = parts.slice(3).join('/');
      if (!known(bucket)) return reply(S.bucketNotFound, `unknown bucket ${bucket}`);
      if (parts[1] === 'public' && !S.bucketDef(bucket).public) return reply(S.bucketNotFound, `public URL used on PRIVATE bucket ${bucket} (use createSignedUrl): ${p}`);
      if (parts[1] === 'authenticated' && role !== 'authenticated') return reply({ status: 400, body: { statusCode: '400', error: 'InvalidJWT', message: 'Invalid Compact JWS' } }, `${p} requires a signed-in user`);
      const b = this.storage.get(`${bucket}/${key}`);
      return route.fulfill({ status: b ? 200 : 404, headers: this.cors, body: b || '' });
    }
    if (parts[0] === 'object') { // object/<bucket>/<path>
      const bucket = parts[1]; const key = parts.slice(2).join('/');
      if (!known(bucket)) return reply(S.bucketNotFound, `unknown bucket ${bucket}`);
      const op = { GET: 'SELECT', HEAD: 'SELECT', POST: 'INSERT', PUT: 'UPDATE', DELETE: 'DELETE' }[method];
      if (method === 'DELETE' && !key) { // remove(): DELETE object/<bucket> {prefixes}
        if (!S.storageAllows(bucket, role, 'DELETE')) return reply(S.storageRls, `${role} may not DELETE in ${bucket}`);
        const gone = []; for (const pre of body?.prefixes || []) if (this.storage.delete(`${bucket}/${pre}`)) gone.push({ name: pre, bucket_id: bucket });
        return this.json(route, 200, gone);
      }
      if (!S.storageAllows(bucket, role, op)) return reply(S.storageRls, `${role} may not ${op} ${bucket}/${key}`);
      if (method === 'POST' || method === 'PUT') {
        const buf = req.postDataBuffer() || Buffer.alloc(0);
        const lim = S.bucketDef(bucket).file_size_limit;
        if (lim && buf.length > lim) return reply({ status: 413, body: { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' } }, `${bucket}/${key} exceeds file_size_limit ${lim}`);
        if (method === 'POST' && this.storage.has(`${bucket}/${key}`) && req.headers()['x-upsert'] !== 'true') return this.json(route, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
        this.storage.set(`${bucket}/${key}`, buf);
        return this.json(route, 200, { Key: `${bucket}/${key}`, Id: uuid() });
      }
      if (method === 'DELETE') { this.storage.delete(`${bucket}/${key}`); return this.json(route, 200, []); }
      const b = this.storage.get(`${bucket}/${key}`);
      return route.fulfill({ status: b ? 200 : 404, headers: this.cors, body: b || '' });
    }
    return reply({ status: 404, body: { statusCode: '404', error: 'not_found', message: 'Route not found: ' + p } }, `unknown storage route ${method} ${p}`);
  }

  async rest(route) {
    const req = route.request();
    const method = req.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: this.cors });
    const u = new URL(req.url());
    const path = u.pathname.replace('/rest/v1/', '').replace(/^\//, '');
    const headers = req.headers();
    const prefer = headers['prefer'] || '';
    const wantSingle = (headers['accept'] || '').includes('vnd.pgrst.object');
    let body = null; try { body = req.postDataJSON(); } catch {}
    const q = u.searchParams;
    const role = this.roleOf(req);
    const bad = (e, kind, target) => { this.violate({ kind, code: e.body.code, method, target, message: e.body.message }); return this.json(route, e.status, e.body); };

    if (path.startsWith('rpc/')) {
      const fn = path.slice(4);
      this.log.push({ method: 'RPC', table: fn, body });
      const args = (method === 'POST' && body && !Array.isArray(body)) ? body : Object.fromEntries(q);
      const m = S.matchRpc(fn, Object.keys(args || {}));
      if (m.error) return bad(m.error, 'schema', `rpc/${fn}`);
      if (!m.overload.execute.includes(role)) return bad({ status: role === 'anon' ? 401 : 403, body: { code: '42501', details: null, hint: null, message: `permission denied for function ${fn}` } }, 'rls', `rpc/${fn}`);
      const forced = this.takeFail(fn, 'RPC'); if (forced) return this.json(route, forced.status, forced.body);
      const h = this.rpcHandlers[fn];
      if (!h) return bad({ status: 501, body: { code: 'XX000', message: `fake has no handler for existing rpc ${fn}`, details: null, hint: null } }, 'fake-gap', `rpc/${fn}`);
      try { return this.json(route, 200, await h(args || {})); } catch (e) { return this.json(route, 400, { code: 'P0001', message: String(e.message || e), details: null, hint: null }); }
    }

    const table = path;
    this.log.push({ method, table, query: u.search, body });
    const def = S.tableDef(table);
    if (!def) return bad(S.errTable(table), 'schema', table);
    const forced = this.takeFail(table, method); if (forced) return this.json(route, forced.status, forced.body);
    if (this.denied.some(d => d.table === table && (d.method === '*' || d.method === method))) { // explicit test hook (not a violation)
      if (method === 'GET') return this.json(route, 200, []);
      return this.json(route, 403, { code: '42501', message: `new row violates row-level security policy for table "${table}"`, details: null, hint: null });
    }
    const op = S.OPS[method];
    if (!op) return this.json(route, 405, { message: 'method' });
    if (def.kind === 'view' && op !== 'SELECT') return bad(S.errView(table, op), 'schema', table);
    const qe = S.checkQuery(table, q); if (qe) return bad(qe, 'schema', table);
    const items = (op === 'INSERT' || op === 'UPDATE') ? (Array.isArray(body) ? body : [body]) : [];
    const be = items.length ? S.checkBody(table, items, op) : null; if (be) return bad(be, 'schema', table);
    const allowed = S.policyAllows(table, role, op);
    const merge0 = /resolution=merge-duplicates/.test(prefer);
    if (op === 'INSERT' && (!allowed || (merge0 && !S.policyAllows(table, role, 'UPDATE')) || (/return=representation/.test(prefer) && !S.policyAllows(table, role, 'SELECT')))) return bad(S.errRls(table), 'rls', `${table} INSERT as ${role}`);
    // SELECT/UPDATE/DELETE without a policy for the role see no rows: 200 with zero rows (never an error)
    const hidden = !allowed && op !== 'INSERT';
    if (hidden) this.violate({ kind: 'rls', code: 'RLS-ZERO-ROWS', method, target: `${table} ${op} as ${role}`, message: `${role} has no ${op} policy on ${table}: request affects/returns zero rows` });

    // views emulated from base tables (defined in supabase/migrations)
    const rows = hidden ? [] : table === 'workflow_run_history' ? this.runHistoryView() : this.table(table);
    const filters = [...q.entries()].filter(([k]) => !['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k));
    const applyFilters = (list) => list.filter(r => filters.every(([k, v]) => {
      if (k === 'or') return evalOrExpr(r, v.replace(/^\(|\)$/g, ''));
      if (k === 'and') return splitTop(v.replace(/^\(|\)$/g, '')).every(p => evalCond(r, p));
      const m = v.match(/^(not\.)?([a-z]+)\.(.*)$/s);
      if (!m) return true;
      return matchOp(r, k, m[2], m[3], !!m[1]);
    }));

    let out; let status = 200; const extra = {};
    if (method === 'GET' || method === 'HEAD') {
      let list = applyFilters(rows);
      const order = q.get('order');
      if (order) for (const spec of order.split(',').reverse()) { const [c, dir, nulls] = spec.split('.'); const mul = dir === 'desc' ? -1 : 1; list = [...list].sort((a, b) => { const A = a[c], B = b[c]; if (A == null || B == null) { if (A == B) return 0; const nf = nulls === 'nullsfirst'; return (A == null ? (nf ? -1 : 1) : (nf ? 1 : -1)); } return mul * cmp(A, B); }); }
      const total = list.length;
      const range = headers['range'];
      let off = Number(q.get('offset') || 0), lim = q.get('limit') ? Number(q.get('limit')) : Infinity;
      if (range && /^\d+-\d*$/.test(range)) { const [a, b] = range.split('-'); off = Number(a); lim = b === '' ? Infinity : Number(b) - Number(a) + 1; }
      list = list.slice(off, off + lim);
      const sel = q.get('select');
      list = list.map(r => this.project(r, sel));
      if (/count=/.test(prefer)) extra['content-range'] = `${list.length ? off : '*'}-${off + Math.max(list.length - 1, 0)}/${total}`; // content-range
      if (method === 'HEAD') return route.fulfill({ status: 200, headers: { ...this.cors, ...extra } });
      out = list;
    } else if (method === 'POST') {
      const onConflict = q.get('on_conflict');
      const merge = merge0;
      const ignore = /resolution=ignore-duplicates/.test(prefer);
      out = [];
      for (const it of items) {
        const row = { ...this.defaults(table), ...it };
        const miss = S.missingRequired(table, row);
        if (miss) return bad(S.errNotNull(table, miss), 'constraint', table);
        if (onConflict) {
          const cols = onConflict.split(',');
          const ex = rows.find(r => cols.every(c => r[c] === row[c] || (r[c] == null && row[c] == null)));
          if (ex) { if (merge) Object.assign(ex, it); if (!ignore) out.push({ ...ex }); continue; }
        } else if (row.id && rows.some(r => r.id === row.id)) {
          if (merge) { Object.assign(rows.find(r => r.id === row.id), it); out.push({ ...rows.find(r => r.id === row.id) }); continue; }
          return this.json(route, 409, { code: '23505', message: 'duplicate key value violates unique constraint', details: null, hint: null });
        }
        rows.push(row); out.push({ ...row }); this.afterInsert(table, row);
      }
      status = 201;
    } else if (method === 'PATCH') {
      const matched = applyFilters(rows);
      out = matched.map(r => { const before = { ...r }; Object.assign(r, body); if (S.hasColumn(table, 'updated_at') && ['deals', 'notes', 'tasks'].includes(table)) r.updated_at = body?.updated_at || now(); this.afterUpdate(table, before, r); return { ...r }; });
    } else if (method === 'DELETE') {
      const matched = applyFilters(rows);
      out = matched.map(r => ({ ...r }));
      if (!hidden) this.tables[table] = rows.filter(r => !matched.includes(r));
    } else return this.json(route, 405, { message: 'method' });

    const wantRep = /return=representation/.test(prefer) || method === 'GET';
    if (!wantRep) return route.fulfill({ status: method === 'POST' ? 201 : 204, headers: { ...this.cors, ...extra } });
    out = out.map(r => this.project(r, q.get('select')));
    if (wantSingle) {
      if (out.length !== 1) return this.json(route, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${out.length} rows`, hint: null });
      return this.json(route, status, out[0], extra);
    }
    return this.json(route, status, out, extra);
  }

  runHistoryView() {
    return this.table('workflow_executions').map(e => {
      const w = this.table('deal_workflows').find(x => x.id === e.workflow_id);
      const steps = Array.isArray(e.steps) ? e.steps : [];
      return { ...e, workflow_name: w?.name ?? null, source: e.source ?? 'client', record_id: e.record_id ?? e.context?.recordId ?? null,
        duration_ms: e.duration ?? (e.completed_at ? new Date(e.completed_at) - new Date(e.started_at) : null), steps_total: steps.length, steps_failed: steps.filter(s => s.status === 'failed').length };
    });
  }
  project(r, sel) {
    if (!sel || sel === '*') return { ...r };
    if (sel.includes('(')) return { ...r }; // embeds: return whole row
    const cols = sel.split(',').map(s => s.trim()).filter(Boolean);
    if (cols.includes('*')) return { ...r };
    const o = {}; for (const c of cols) { const name = c.includes(':') ? c.split(':')[1] : c; if (name in r) o[c.includes(':') ? c.split(':')[0] : c] = r[name]; } return o;
  }
  defaults(table) {
    const d = { id: uuid() };
    if (['deals', 'notes', 'tasks', 'deal_files', 'deal_activities', 'companies', 'contacts', 'saved_pipeline_views', 'deal_workflows', 'workflow_executions', 'pipeline_stages', 'favorites'].includes(table)) { d.created_at = now(); d.updated_at = now(); }
    if (table === 'deals') { d.value = 0; d.priority = 'medium'; }
    for (const k of Object.keys(d)) if (!S.hasColumn(table, k)) delete d[k]; // only real columns
    return d;
  }
  afterInsert(table, row) {
    if (table === 'deals') this.table('deal_activities').push({ id: uuid(), deal_id: row.id, type: 'created', title: 'Deal created', description: row.title, created_at: now(), occurred_at: now() });
  }
  afterUpdate(table, before, after) {
    if (table !== 'deals') return;
    const at = now();
    if (before.stage !== after.stage) this.table('deal_activities').push({ id: uuid(), deal_id: after.id, type: 'stage_change', title: 'Stage changed', description: `${before.stage} -> ${after.stage}`, metadata: { from: before.stage, to: after.stage }, created_at: at, occurred_at: at });
    if (!before.deleted_at && after.deleted_at) this.table('deal_activities').push({ id: uuid(), deal_id: after.id, type: 'deleted', title: 'Deal deleted', created_at: at, occurred_at: at });
  }
  takeFail(table, method) {
    const i = this.failNext.findIndex(f => f.table === table && (f.method === '*' || f.method === method));
    if (i < 0) return null; const f = this.failNext[i]; if (--f.times <= 0) this.failNext.splice(i, 1); return f;
  }
}

/** Seed matching src/data/mockDeals shape: stages + deals + a contact + a company. */
export function defaultSeed() {
  const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
  const stages = [
    ['qualification', 'Qualification', 0, '#3B82F6', 30, false, false],
    ['proposal', 'Proposal', 1, '#8B5CF6', 50, false, false],
    ['negotiation', 'Negotiation', 2, '#F59E0B', 70, false, false],
    ['closed-won', 'Closed Won', 3, '#10B981', 100, true, false],
    ['closed-lost', 'Closed Lost', 4, '#EF4444', 0, false, true],
  ].map(([key, name, position, color, probability, is_won, is_lost], i) => ({ id: `stage-${i + 1}`, pipeline_id: null, key, name, position, color, probability, is_won, is_lost, is_hidden: false, wip_limit: null, created_at: iso(-30), updated_at: iso(-30) }));
  const mk = (n, title, company, contact, stage, value, priority, position, extra = {}) => ({
    id: `00000000-0000-4000-8000-00000000000${n}`, title, company, contact, stage, value, amount_micros: value * 1e6, priority, probability: 30, position,
    created_at: iso(-10 - n), updated_at: iso(-n), due_date: iso(5 + n), assigned_to: n % 2 ? 'Alex Owner' : 'Sam Rep', tags: n % 2 ? ['enterprise'] : [], is_favorite: false, deleted_at: null, ...extra });
  const deals = [
    mk(1, 'Enterprise Software License', 'TechCorp Inc.', 'Sarah Johnson', 'qualification', 75000, 'high', 1000, { contact_id: 'c0000000-0000-4000-8000-000000000001' }),
    mk(2, 'Marketing Automation Platform', 'GrowthCo', 'Mike Chen', 'qualification', 45000, 'medium', 2000),
    mk(3, 'Cloud Infrastructure Setup', 'Enterprise Corp', 'David Kumar', 'proposal', 120000, 'high', 1000),
    mk(4, 'Security Audit Package', 'SecureNet', 'Lena Park', 'negotiation', 55000, 'low', 1000),
    mk(5, 'Analytics Suite', 'DataWorks', 'Omar Ali', 'closed-won', 85000, 'medium', 1000),
    mk(6, 'Legacy Migration', 'OldCo', 'Tia Bell', 'closed-lost', 30000, 'low', 1000),
  ];
  const contacts = [{ id: 'c0000000-0000-4000-8000-000000000001', name: 'Sarah Johnson', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah@techcorp.com', company: 'TechCorp Inc.', title: 'CTO', status: 'prospect', created_at: iso(-20), updated_at: iso(-2) }];
  const companies = [{ id: 'co000000-0000-4000-8000-000000000001', name: 'TechCorp Inc.', created_at: iso(-20), updated_at: iso(-2) }];
  deals[0].company_id = companies[0].id;
  const profiles = [{ id: 'a0000000-0000-4000-8000-000000000001', name: 'Alex Rivera', avatar: null }, { id: 'a0000000-0000-4000-8000-000000000002', name: 'Sam Rep', avatar: null }];
  return { profiles, user_roles: [], roles: [], pipeline_stages: stages, deals, contacts, companies, notes: [], tasks: [], deal_files: [], deal_activities: [], saved_pipeline_views: [], favorites: [], deal_workflows: [], workflow_executions: [], app_settings: [], feature_flags: [] };
}
