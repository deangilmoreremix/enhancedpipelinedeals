/**
 * Public REST API (Netlify Functions v2): /api/v1/{deals|contacts|companies}[/:id]
 *
 * Auth: `Authorization: Bearer cb_live_...` (keys from /api/keys). Unknown / revoked -> 401. GET needs scope `read` (or `write`),
 * POST / PATCH / DELETE need `write` (403). Rows are read and written with the service role but ALWAYS scoped by the key's
 * workspace_id when the key has one. Envelope on every response: { data, error, next_offset }.
 *   GET    /api/v1/<res>?limit<=100&offset&q&updated_since[&stage (deals)]   list (next_offset = null on the last page)
 *   GET    /api/v1/<res>/:id
 *   POST   /api/v1/<res>              whitelisted columns only (unknown keys ignored), 422 on invalid values
 *   PATCH  /api/v1/<res>/:id          whitelisted columns only
 *   DELETE /api/v1/<res>/:id          soft delete (deleted_at) for deals / companies; contacts have no deleted_at -> 405
 * CORS is off unless PUBLIC_API_CORS_ORIGINS is set (comma separated origins, or `*`).
 */
import { jsonResponse, rateAllowed, serviceDb, sha256Hex, type ServiceDb } from './_platform';

type Obj = Record<string, any>;
type Kind = 'string' | 'number' | 'boolean' | 'stringArray' | 'object' | 'email' | 'date' | 'uuid' | { enum: string[] } | { int: [number, number] } | { num: [number, number] };

interface Resource {
  table: string;
  select: string;
  fields: Record<string, Kind>;
  required: string[];
  search: string[];
  softDelete: boolean;
  stageFilter?: boolean;
}

const RESOURCES: Record<string, Resource> = {
  deals: {
    table: 'deals',
    select: 'id,title,value,stage,priority,probability,close_date,due_date,company,contact,company_id,contact_id,notes,tags,custom_fields,currency_code,owner_id,workspace_id,created_at,updated_at',
    fields: {
      title: 'string', value: { num: [0, 1e15] }, stage: 'string', priority: { enum: ['high', 'medium', 'low'] }, probability: { num: [0, 100] },
      close_date: 'date', due_date: 'date', company: 'string', contact: 'string', company_id: 'uuid', contact_id: 'uuid', notes: 'string',
      tags: 'stringArray', custom_fields: 'object', currency_code: 'string',
    },
    required: ['title'],
    search: ['title', 'company', 'contact'],
    softDelete: true,
    stageFilter: true,
  },
  contacts: {
    table: 'contacts',
    select: 'id,name,first_name,last_name,email,phone,company,company_id,title,status,source,notes,tags,website,city,state,country,custom_fields,owner_id,workspace_id,created_at,updated_at',
    fields: {
      name: 'string', first_name: 'string', last_name: 'string', email: 'email', phone: 'string', company: 'string', company_id: 'uuid', title: 'string',
      status: 'string', source: 'string', notes: 'string', website: 'string', city: 'string', state: 'string', country: 'string', tags: 'stringArray', custom_fields: 'object',
    },
    required: ['name'],
    search: ['name', 'email', 'company'],
    softDelete: false, // contacts has no deleted_at column (e2e/lib/schema.json)
  },
  companies: {
    table: 'companies',
    select: 'id,name,domain,website,industry,size,phone,address,revenue,notes,logo_url,custom_fields,owner_id,workspace_id,created_at,updated_at',
    fields: {
      name: 'string', domain: 'string', website: 'string', industry: 'string', size: 'string', phone: 'string', address: 'string',
      revenue: { num: [0, 1e15] }, notes: 'string', logo_url: 'string', custom_fields: 'object',
    },
    required: ['name'],
    search: ['name', 'domain'],
    softDelete: true,
  },
};

const MAX_STRING = 5000;
const MAX_BODY_BYTES = 200_000;
const RATE_LIMIT = 120;
const RATE_WINDOW_S = 60;
const LAST_USED_THROTTLE_MS = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- CORS (off by default) --------------------------------------------------------------------------------------------
function corsHeaders(req: Request): Record<string, string> {
  const allow = (process.env.PUBLIC_API_CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!allow.length) return {};
  const origin = req.headers.get('origin');
  const h: Record<string, string> = { 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', Vary: 'Origin' };
  if (allow.includes('*')) h['Access-Control-Allow-Origin'] = '*';
  else if (origin && allow.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

const envelope = (data: unknown, error: unknown = null, next_offset: number | null = null) => ({ data, error, next_offset });

// ---- validation -------------------------------------------------------------------------------------------------------
/** Returns the cleaned value or throws a string describing the problem. */
function coerce(kind: Kind, v: unknown): unknown {
  if (v === null) return null;
  if (typeof kind === 'object') {
    if ('enum' in kind) { if (typeof v !== 'string' || !kind.enum.includes(v)) throw `must be one of ${kind.enum.join(', ')}`; return v; }
    const [lo, hi] = 'int' in kind ? kind.int : kind.num;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || ('int' in kind && !Number.isInteger(v))) throw `must be a number between ${lo} and ${hi}`;
    return v;
  }
  switch (kind) {
    case 'string': if (typeof v !== 'string' || v.length > MAX_STRING) throw `must be a string (max ${MAX_STRING} chars)`; return v;
    case 'number': if (typeof v !== 'number' || !Number.isFinite(v)) throw 'must be a number'; return v;
    case 'boolean': if (typeof v !== 'boolean') throw 'must be a boolean'; return v;
    case 'email': if (typeof v !== 'string' || v.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw 'must be a valid email address'; return v.trim();
    case 'date': if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) throw 'must be an ISO 8601 date'; return v;
    case 'uuid': if (typeof v !== 'string' || !UUID.test(v)) throw 'must be a uuid'; return v;
    case 'stringArray':
      if (!Array.isArray(v) || v.length > 100 || v.some((x) => typeof x !== 'string' || x.length > 200)) throw 'must be an array of up to 100 short strings';
      return v;
    case 'object':
      if (typeof v !== 'object' || Array.isArray(v) || JSON.stringify(v).length > 20_000) throw 'must be a JSON object (max 20 KB)';
      return v;
  }
}

function sanitize(res: Resource, body: Obj, partial: boolean): { row: Obj; errors: Array<{ field: string; message: string }> } {
  const row: Obj = {};
  const errors: Array<{ field: string; message: string }> = [];
  for (const [field, kind] of Object.entries(res.fields)) { // unknown keys (id, workspace_id, deleted_at, ...) are simply never copied
    if (!Object.prototype.hasOwnProperty.call(body, field) || body[field] === undefined) continue;
    try { row[field] = coerce(kind, body[field]); } catch (m) { errors.push({ field, message: String(m) }); }
  }
  for (const f of res.required) {
    const v = row[f];
    const missing = v === undefined || v === null || (typeof v === 'string' && !v.trim());
    if (!partial && missing) {
      // contacts: allow first_name/last_name instead of name
      if (res.table === 'contacts' && f === 'name' && (row.first_name || row.last_name)) { row.name = [row.first_name, row.last_name].filter(Boolean).join(' '); continue; }
      errors.push({ field: f, message: 'is required' });
    } else if (partial && f in row && missing) errors.push({ field: f, message: 'cannot be empty' });
  }
  return { row, errors };
}

const searchTerm = (q: string) => q.replace(/[^\p{L}\p{N}\s@.\-+_']/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);

// ---- auth -------------------------------------------------------------------------------------------------------------
interface KeyRow { id: string; scopes: string[] | null; workspace_id: string | null; created_by: string | null; last_used_at: string | null; revoked_at: string | null }

async function authenticate(db: ServiceDb, header: string | null): Promise<KeyRow | null> {
  const token = (header || '').replace(/^Bearer\s+/i, '').trim();
  if (!/^cb_live_[A-Za-z0-9_-]{20,128}$/.test(token)) return null;
  const { data, error } = await db.from('api_keys').select('id,scopes,workspace_id,created_by,last_used_at,revoked_at').eq('key_hash', sha256Hex(token)).maybeSingle();
  if (error || !data || (data as KeyRow).revoked_at) return null;
  const key = data as KeyRow;
  const last = key.last_used_at ? Date.parse(key.last_used_at) : 0;
  if (!last || Date.now() - last > LAST_USED_THROTTLE_MS) {
    await db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id); // best effort
  }
  return key;
}

function dbError(e: { code?: string; message?: string }, cors: Record<string, string> = {}): Response | null {
  if (e.code === 'PGRST116' || e.code === '22P02') return null; // not found / malformed id handled by callers
  console.error('[public-api] db error', e.code, e.message);
  if (e.code === '23505') return jsonResponse(409, envelope(null, { code: 'conflict', message: 'A record with these values already exists' }), cors);
  if (e.code === '23503' || e.code === '23502' || e.code === '23514') return jsonResponse(422, envelope(null, { code: 'invalid', message: 'The record violates a database constraint' }), cors);
  return jsonResponse(500, envelope(null, { code: 'internal', message: 'Request failed' }), cors);
}

// ---- handler ----------------------------------------------------------------------------------------------------------
export default async (req: Request): Promise<Response> => {
  const cors = corsHeaders(req);
  const out = (status: number, body: unknown, extra: Record<string, string> = {}) => jsonResponse(status, body, { ...cors, ...extra });
  const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
    out(status, envelope(null, { code, message, ...extra }), headers);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = new URL(req.url);
  const segs = url.pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const res = RESOURCES[segs[0] ?? ''];
  const id = segs[1];
  if (!res || segs.length > 2) return fail(404, 'not_found', 'Unknown resource');

  const db = serviceDb();
  if (!db) return fail(500, 'internal', 'API is not configured');
  const key = await authenticate(db, req.headers.get('authorization'));
  if (!key) return fail(401, 'unauthorized', 'Invalid or revoked API key', {}, { 'WWW-Authenticate': 'Bearer' });

  const allowed = await rateAllowed(db, `api-v1:${key.id}`, RATE_LIMIT, RATE_WINDOW_S, 'public-api');
  if (allowed === null) return fail(503, 'unavailable', 'Rate limit check unavailable');
  if (!allowed) return fail(429, 'rate_limited', 'Rate limit exceeded', {}, { 'Retry-After': String(RATE_WINDOW_S) });

  const scopes = key.scopes ?? ['read'];
  const isWrite = req.method !== 'GET';
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return fail(405, 'method_not_allowed', 'Method not allowed', {}, { Allow: 'GET, POST, PATCH, DELETE' });
  if (isWrite ? !scopes.includes('write') : !(scopes.includes('read') || scopes.includes('write'))) {
    return fail(403, 'forbidden', `This API key lacks the '${isWrite ? 'write' : 'read'}' scope`);
  }
  if (req.method === 'POST' && id) return fail(405, 'method_not_allowed', 'POST creates on the collection URL', {}, { Allow: 'GET, PATCH, DELETE' });
  if (req.method === 'PATCH' && !id) return fail(405, 'method_not_allowed', 'PATCH needs /:id', {}, { Allow: 'GET, POST' });
  if (req.method === 'DELETE' && !id) return fail(405, 'method_not_allowed', 'DELETE needs /:id', {}, { Allow: 'GET, POST' });

  // every query goes through here so the workspace scope can never be forgotten
  const scoped = (q: any) => {
    let r = q;
    if (key.workspace_id) r = r.eq('workspace_id', key.workspace_id);
    if (res.softDelete) r = r.is('deleted_at', null);
    return r;
  };

  try {
    if (req.method === 'GET' && !id) {
      const sp = url.searchParams;
      const lim = sp.get('limit') === null ? 25 : Number(sp.get('limit'));
      const off = sp.get('offset') === null ? 0 : Number(sp.get('offset'));
      if (!Number.isInteger(lim) || lim < 1) return fail(422, 'invalid', 'limit must be an integer between 1 and 100');
      if (!Number.isInteger(off) || off < 0 || off > 1_000_000) return fail(422, 'invalid', 'offset must be a non-negative integer');
      const limit = Math.min(lim, 100);
      let q = scoped(db.from(res.table).select(res.select));
      const term = searchTerm(sp.get('q') || '');
      if (term) q = q.or(res.search.map((c) => `${c}.ilike.%${term}%`).join(','));
      const stage = sp.get('stage');
      if (stage && res.stageFilter) q = q.eq('stage', stage);
      const since = sp.get('updated_since');
      if (since) {
        if (Number.isNaN(Date.parse(since))) return fail(422, 'invalid', 'updated_since must be an ISO 8601 date');
        q = q.gte('updated_at', new Date(since).toISOString());
      }
      const { data, error } = await q.order('updated_at', { ascending: false }).order('id', { ascending: true }).range(off, off + limit); // limit + 1 rows
      if (error) return dbError(error, cors)!;
      const rows = (data ?? []) as Obj[];
      const more = rows.length > limit;
      return out(200, envelope(rows.slice(0, limit), null, more ? off + limit : null));
    }

    if (req.method === 'GET') {
      const { data, error } = await scoped(db.from(res.table).select(res.select)).eq('id', id).maybeSingle();
      if (error) return error.code === '22P02' ? fail(404, 'not_found', 'Not found') : dbError(error, cors)!;
      return data ? out(200, envelope(data)) : fail(404, 'not_found', 'Not found');
    }

    if (req.method === 'DELETE') {
      if (!res.softDelete) return fail(405, 'method_not_allowed', `${segs[0]} cannot be deleted through the API`, {}, { Allow: 'GET, POST, PATCH' });
      const { data, error } = await scoped(db.from(res.table).update({ deleted_at: new Date().toISOString() }).eq('id', id)).select('id');
      if (error) return error.code === '22P02' ? fail(404, 'not_found', 'Not found') : dbError(error, cors)!;
      return data?.length ? out(200, envelope({ id, deleted: true })) : fail(404, 'not_found', 'Not found');
    }

    // POST / PATCH
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'Request body too large');
    let body: unknown;
    try { body = raw ? JSON.parse(raw) : null; } catch { return fail(400, 'invalid_json', 'Body must be valid JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(422, 'invalid', 'Body must be a JSON object');
    const { row, errors } = sanitize(res, body as Obj, req.method === 'PATCH');
    if (errors.length) return fail(422, 'invalid', 'Validation failed', { details: errors });

    if (req.method === 'POST') {
      const insert: Obj = { ...row };
      if (key.workspace_id) insert.workspace_id = key.workspace_id;
      if (key.created_by) insert.created_by = key.created_by;
      const { data, error } = await db.from(res.table).insert(insert).select(res.select).single();
      if (error) return dbError(error, cors) ?? fail(422, 'invalid', 'Invalid value');
      return out(201, envelope(data));
    }
    if (!Object.keys(row).length) return fail(422, 'invalid', 'No updatable fields in body', { details: [{ field: '*', message: `allowed: ${Object.keys(res.fields).join(', ')}` }] });
    const { data, error } = await scoped(db.from(res.table).update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)).select(res.select);
    if (error) return error.code === '22P02' ? fail(404, 'not_found', 'Not found') : dbError(error, cors) ?? fail(422, 'invalid', 'Invalid value');
    return data?.length ? out(200, envelope(data[0])) : fail(404, 'not_found', 'Not found');
  } catch (e: any) {
    console.error('[public-api]', e?.message || e);
    return fail(500, 'internal', 'Request failed');
  }
};

export const config = { path: '/api/v1/*' };
