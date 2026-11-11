/**
 * Minimal in-memory Supabase stand-in (PostgREST + GoTrue + Storage) for exercising Netlify functions with the
 * real @supabase/supabase-js client. NOT a faithful Postgres: no constraints/RLS/triggers beyond what is coded here.
 *
 * Supported PostgREST surface:
 *   GET/POST/PATCH/DELETE /rest/v1/<table>   filters eq neq gt gte lt lte like ilike in is not.<op>, json path a->>b,
 *   order, limit/offset/Range, select projection, Prefer return=representation|minimal, upsert (on_conflict +
 *   resolution=merge-duplicates), Accept application/vnd.pgrst.object+json (single()), 406 PGRST116 semantics
 *   POST /rest/v1/rpc/<fn>   claim_workflow_events (built in), match_contacts (built in), custom via stub.rpc[name]
 *   GET /auth/v1/user        token 'good-jwt' -> user, else 401
 *   /storage/v1/bucket, /storage/v1/object/<bucket>/<path>, /storage/v1/object/public/<bucket>/<path>
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';

export const GOOD_JWT = 'good-jwt';
/** extra signed-in users: token -> { id, role } (role is what the RLS helper current_role_name() returns for that caller) */
export const USERS = {
  'good-jwt': { id: 'user-1', role: 'member' },
  'viewer-jwt': { id: 'user-v', role: 'viewer' },
  'manager-jwt': { id: 'user-m', role: 'manager' },
  'admin-jwt': { id: 'user-a', role: 'admin' },
};
export const SERVICE_KEY = 'service-role-key';
export const ANON_KEY = 'anon-key';

const splitTop = (s) => {
  const out = [];
  let depth = 0, cur = '', q = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (!q && ch === '(') depth++;
    if (!q && ch === ')') depth--;
    if (!q && depth === 0 && ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
};

const parseList = (s) => splitTop(s.replace(/^\(/, '').replace(/\)$/, '')).map((x) => x.replace(/^"(.*)"$/, '$1'));

function colValue(row, col) {
  const parts = col.split('->>');
  if (parts.length === 1) {
    const p2 = col.split('->');
    let v = row[p2[0]];
    for (const k of p2.slice(1)) v = v?.[k];
    return v;
  }
  let v = row[parts[0]];
  for (const k of parts.slice(1)) v = v?.[k];
  return v === undefined || v === null ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
}

const likeToRegex = (pat, flags = '') =>
  new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/\*/g, '.*').replace(/_/g, '.') + '$', flags);

const cmp = (a, b) => {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
};

function testOp(value, opstr) {
  let neg = false;
  let s = opstr;
  if (s.startsWith('not.')) { neg = true; s = s.slice(4); }
  const dot = s.indexOf('.');
  const op = s.slice(0, dot);
  const arg = s.slice(dot + 1);
  let r;
  const eqish = (v) => (v === null || v === undefined ? false : typeof v === 'boolean' ? String(v) === arg : String(v) === arg);
  switch (op) {
    case 'eq': r = eqish(value); break;
    case 'neq': r = !eqish(value); break;
    case 'gt': r = value != null && cmp(value, arg) > 0; break;
    case 'gte': r = value != null && cmp(value, arg) >= 0; break;
    case 'lt': r = value != null && cmp(value, arg) < 0; break;
    case 'lte': r = value != null && cmp(value, arg) <= 0; break;
    case 'like': r = value != null && likeToRegex(arg).test(String(value)); break;
    case 'ilike': r = value != null && likeToRegex(arg, 'i').test(String(value)); break;
    case 'in': r = parseList(arg).includes(value === null || value === undefined ? '\u0000' : String(value)); break;
    case 'is': r = arg === 'null' ? value === null || value === undefined : arg === 'true' ? value === true : arg === 'false' ? value === false : false; break;
    case 'cs': r = Array.isArray(value) && parseList(arg.replace(/^\{/, '(').replace(/\}$/, ')')).every((x) => value.includes(x)); break;
    default: throw new Error(`stubSupabase: unsupported operator ${op}`);
  }
  // PostgREST/SQL: `col NOT IN (...)` is NULL (row excluded) when col is NULL; mimic for not.in / not.eq / not.like
  if (neg) {
    if ((value === null || value === undefined) && op !== 'is') return false;
    return !r;
  }
  return r;
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'or', 'and']);

export function createStubSupabase({ port = 54402 } = {}) {
  const state = { tables: {}, buckets: new Map(), objects: new Map(), log: [], rpc: {}, failNext: [] };
  /** Never cleared by reset(): every table/column touched by any request, for the migration-contract check. */
  const audit = [];
  const stub = {
    port,
    url: `http://127.0.0.1:${port}`,
    state,
    get log() { return state.log; },
    audit,
    /** custom rpc: stub.rpc.name = (args, ctx) => result */
    rpc: state.rpc,
    table(name) { return (state.tables[name] ??= []); },
    reset(seed = {}) {
      state.tables = {};
      state.buckets = new Map();
      state.objects = new Map();
      state.log.length = 0;
      state.failNext.length = 0;
      for (const [k, rows] of Object.entries(seed)) state.tables[k] = rows.map((r) => ({ ...r }));
      stub.rpc.__reset?.();
    },
    insert(table, row) { const r = { id: randomUUID(), created_at: new Date().toISOString(), ...row }; stub.table(table).push(r); return r; },
    /** Make the next request matching (method, path-substring) fail with { status, body }. */
    failNext(method, pathPart, status, body) { state.failNext.push({ method, pathPart, status, body }); },
    requests(filter = {}) {
      return state.log.filter((l) => (!filter.method || l.method === filter.method) && (!filter.path || l.path.includes(filter.path)));
    },
    async start() {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    },
    async stop() { await new Promise((r) => server.close(r)); },
  };

  const send = (res, status, body, headers = {}) => {
    const isBuf = Buffer.isBuffer(body);
    const payload = isBuf ? body : body === undefined || body === null ? '' : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': isBuf ? 'application/octet-stream' : 'application/json', ...headers });
    res.end(payload);
  };
  const pgErr = (res, status, code, message, details = null) => send(res, status, { code, message, details, hint: null });

  function applyFilters(rows, params) {
    let out = rows;
    for (const [k, v] of params) {
      if (RESERVED.has(k)) continue;
      out = out.filter((row) => testOp(colValue(row, k), v));
    }
    return out;
  }

  function project(rows, select) {
    if (!select || select === '*') return rows;
    const cols = splitTop(select).map((c) => c.trim()).filter((c) => c && !c.includes('('));
    if (!cols.length || cols.includes('*')) return rows;
    return rows.map((r) => Object.fromEntries(cols.map((c) => [c.includes(':') ? c.split(':')[0] : c, r[c.includes(':') ? c.split(':')[1] : c]])));
  }

  function order(rows, ord) {
    if (!ord) return rows;
    const keys = ord.split(',').map((o) => { const [c, d = 'asc'] = o.split('.'); return { c, desc: d === 'desc' }; });
    return [...rows].sort((a, b) => {
      for (const { c, desc } of keys) {
        const r = cmp(colValue(a, c), colValue(b, c));
        if (r) return desc ? -r : r;
      }
      return 0;
    });
  }

  async function readBody(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    return Buffer.concat(chunks);
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, stub.url);
    const buf = await readBody(req);
    const ctype = req.headers['content-type'] || '';
    let body;
    if (buf.length && ctype.includes('json')) { try { body = JSON.parse(buf.toString('utf8')); } catch { body = undefined; } }
    const entry = { method: req.method, path: u.pathname, query: u.search, params: Object.fromEntries(u.searchParams), body, headers: req.headers, rawLength: buf.length };
    state.log.push(entry);

    const fi = state.failNext.findIndex((f) => f.method === req.method && u.pathname.includes(f.pathPart));
    if (fi >= 0) { const f = state.failNext.splice(fi, 1)[0]; return send(res, f.status, f.body ?? { code: 'XX000', message: 'injected failure' }); }

    try {
      // -------- auth
      if (u.pathname === '/auth/v1/user') {
        const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const u1 = USERS[tok];
        if (u1) return send(res, 200, { id: u1.id, aud: 'authenticated', role: 'authenticated', email: 'rep@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
        return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      }

      // -------- storage
      if (u.pathname.startsWith('/storage/v1/')) {
        const rest = u.pathname.slice('/storage/v1/'.length);
        if (rest.startsWith('bucket')) {
          const id = rest.split('/')[1];
          if (req.method === 'GET' && id) {
            const b = state.buckets.get(id);
            return b ? send(res, 200, b) : send(res, 404, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' });
          }
          if (req.method === 'POST') {
            const b = { id: body.name ?? body.id, name: body.name ?? body.id, public: Boolean(body.public), file_size_limit: body.file_size_limit ?? null, allowed_mime_types: body.allowed_mime_types ?? null };
            state.buckets.set(b.id, b);
            return send(res, 200, { name: b.id });
          }
        }
        if (rest.startsWith('object/public/')) {
          const key = rest.slice('object/public/'.length);
          const o = state.objects.get(key);
          return o ? send(res, 200, o.data, { 'Content-Type': o.contentType }) : send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' });
        }
        if (rest.startsWith('object/') && (req.method === 'POST' || req.method === 'PUT')) {
          const key = rest.slice('object/'.length);
          const bucket = key.split('/')[0];
          if (!state.buckets.has(bucket)) return send(res, 404, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' });
          if (state.objects.has(key) && req.headers['x-upsert'] !== 'true') return send(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
          // supabase-js sends multipart/form-data for Buffers/Blobs? It sends raw body with content-type for Buffer.
          let data = buf, contentType = ctype;
          if (ctype.startsWith('multipart/form-data')) {
            const m = /\r\n\r\n([\s\S]*)\r\n--[^\r\n]+--\r\n?$/.exec(buf.toString('latin1'));
            if (m) data = Buffer.from(m[1], 'latin1');
            const ct = /Content-Type:\s*([^\r\n]+)/i.exec(buf.toString('latin1'));
            contentType = ct?.[1] ?? contentType;
          }
          state.objects.set(key, { data, contentType });
          return send(res, 200, { Id: randomUUID(), Key: key });
        }
        return send(res, 404, { error: 'storage route not stubbed', path: u.pathname });
      }

      // -------- rpc
      if (u.pathname.startsWith('/rest/v1/rpc/')) {
        const fn = u.pathname.slice('/rest/v1/rpc/'.length);
        if (stub.rpc[fn]) return send(res, 200, await stub.rpc[fn](body ?? {}, stub));
        if (fn === 'current_role_name') {
          // RLS helper: role of the caller identified by the forwarded user JWT (anon key / no token -> null)
          const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
          return send(res, 200, USERS[tok]?.role ?? null);
        }
        if (fn === 'claim_workflow_events') {
          const limit = body?.p_limit ?? 25, max = body?.p_max_attempts ?? 5;
          const rows = stub.table('workflow_events')
            .filter((e) => !e.processed && (e.attempts ?? 0) < max && (!e.claimed_at || new Date(e.claimed_at).getTime() < Date.now() - 10 * 60_000))
            .sort((a, b) => cmp(a.created_at, b.created_at))
            .slice(0, limit);
          for (const e of rows) { e.claimed_at = new Date().toISOString(); e.attempts = (e.attempts ?? 0) + 1; }
          return send(res, 200, rows);
        }
        if (fn === 'match_contacts') {
          const emb = stub.table('contact_embeddings');
          const rows = emb.map((e, i) => ({ contact_id: e.contact_id, content: e.content, similarity: 0.9 - i * 0.1 }));
          return send(res, 200, rows.slice(0, body?.match_count ?? 10));
        }
        return pgErr(res, 404, 'PGRST202', `Could not find the function public.${fn} in the schema cache`);
      }

      // -------- tables
      if (u.pathname.startsWith('/rest/v1/')) {
        const name = u.pathname.slice('/rest/v1/'.length);
        const rows = stub.table(name);
        {
          const cols = new Set();
          const bodyRows = Array.isArray(body) ? body : body && typeof body === 'object' ? [body] : [];
          for (const r of bodyRows) for (const k of Object.keys(r)) cols.add(k);
          for (const [k] of u.searchParams) if (!RESERVED.has(k)) cols.add(k.split('->')[0]);
          const sel = u.searchParams.get('select');
          if (sel && sel !== '*') for (const c of splitTop(sel)) { const x = c.trim(); if (x && !x.includes('(') && !x.includes('*')) cols.add((x.includes(':') ? x.split(':')[1] : x).split('->')[0]); }
          const ord = u.searchParams.get('order');
          if (ord) for (const o of ord.split(',')) cols.add(o.split('.')[0]);
          const oc = u.searchParams.get('on_conflict');
          if (oc) for (const c of oc.split(',')) cols.add(c);
          audit.push({ method: req.method, table: name, cols: [...cols], rowKeys: req.method === 'POST' ? bodyRows.map((r) => Object.keys(r)) : [], upsert: /resolution=/.test(String(req.headers.prefer || '')), url: req.url.slice(0, 200) });
        }
        const prefer = String(req.headers.prefer || '');
        const wantRep = /return=representation/.test(prefer);
        const accept = String(req.headers.accept || '');
        const single = accept.includes('application/vnd.pgrst.object+json');
        const answer = (list, status = 200) => {
          if (single) {
            if (list.length !== 1) return pgErr(res, 406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${list.length} rows`);
            return send(res, status, list[0]);
          }
          return send(res, status, list, status === 200 ? { 'Content-Range': `0-${Math.max(list.length - 1, 0)}/*` } : {});
        };

        if (req.method === 'GET' || req.method === 'HEAD') {
          let out = applyFilters(rows, u.searchParams);
          out = order(out, u.searchParams.get('order'));
          const rangeHeader = req.headers.range;
          let offset = Number(u.searchParams.get('offset') || 0);
          let limit = u.searchParams.get('limit') ? Number(u.searchParams.get('limit')) : undefined;
          if (rangeHeader) { const [a, b] = rangeHeader.split('-').map(Number); offset = a; limit = b - a + 1; }
          const total = out.length;
          out = out.slice(offset, limit === undefined ? undefined : offset + limit);
          out = project(out, u.searchParams.get('select'));
          if (req.method === 'HEAD') { res.writeHead(200, { 'Content-Range': `*/${total}` }); return res.end(); }
          return answer(out);
        }

        if (req.method === 'POST') {
          const items = (Array.isArray(body) ? body : [body]).map((r) => ({ ...r }));
          const upsert = /resolution=(merge|ignore)-duplicates/.exec(prefer);
          const conflictCols = (u.searchParams.get('on_conflict') || 'id').split(',');
          const result = [];
          for (const item of items) {
            const existing = upsert || item.id ? rows.find((r) => conflictCols.every((c) => item[c] !== undefined && String(r[c]) === String(item[c]))) : undefined;
            if (existing && upsert) {
              if (upsert[1] === 'merge') Object.assign(existing, item);
              result.push(existing);
              continue;
            }
            if (existing) return pgErr(res, 409, '23505', `duplicate key value violates unique constraint "${name}_pkey"`);
            const row = { id: randomUUID(), created_at: new Date().toISOString(), ...item };
            if (name === 'workflow_events') { row.processed ??= false; row.attempts ??= 0; row.claimed_at ??= null; }
            if (name === 'outbound_messages') row.status ??= 'queued';
            rows.push(row);
            result.push(row);
          }
          if (wantRep || single) return answer(project(result, u.searchParams.get('select')), 201);
          res.writeHead(201); return res.end();
        }

        if (req.method === 'PATCH') {
          const match = applyFilters(rows, u.searchParams);
          for (const r of match) Object.assign(r, body);
          if (wantRep || single) return answer(project(match, u.searchParams.get('select')));
          res.writeHead(204); return res.end();
        }

        if (req.method === 'DELETE') {
          const match = new Set(applyFilters(rows, u.searchParams));
          state.tables[name] = rows.filter((r) => !match.has(r));
          if (wantRep) return answer([...match]);
          res.writeHead(204); return res.end();
        }
      }
      return send(res, 404, { error: 'not stubbed', path: u.pathname });
    } catch (e) {
      return send(res, 500, { code: 'XX000', message: `stubSupabase error: ${e.message}` });
    }
  });

  return stub;
}
