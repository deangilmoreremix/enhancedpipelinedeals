/**
 * API key management (Netlify Functions v2): /api/keys
 *   POST   { name, scopes?: ('read'|'write')[] } -> 201 { ok, id, name, prefix, scopes, key }   (plaintext key ONLY here)
 *   GET                                           -> 200 { ok, keys: [{ id, name, prefix, scopes, workspace_id, created_by, created_at, last_used_at, revoked_at, mine }] }
 *   DELETE ?id=<uuid>                             -> 200 { ok, id, revoked_at }   (own keys; admin: any key)
 * Requires a verified user JWT (no anon / service callers) with the admin or manager role. Only sha256(key) + an 8-char
 * prefix of the random part are stored. Rate limited per user (RPC check_rate_limit).
 */
import { randomBytes } from 'node:crypto';
import { authUser, callerRole, userClient } from './_openai';
import { jsonResponse, rateAllowed, serviceDb, sha256Hex } from './_platform';

export const KEY_PREFIX = 'cb_live_';
const MAX_ACTIVE_KEYS_PER_USER = 25;
const SCOPES = ['read', 'write'] as const;
const PUBLIC_COLS = 'id,name,prefix,scopes,workspace_id,created_by,created_at,last_used_at,revoked_at';

const origin = process.env.ALLOWED_ORIGIN;
const cors: Record<string, string> = origin
  ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' }
  : {};
const reply = (status: number, body: unknown) => jsonResponse(status, body, cors);

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return reply(405, { ok: false, error: 'Method not allowed' });

  const authHeader = req.headers.get('authorization') || undefined;
  const user = await authUser(authHeader);
  if (!user || user.demo || user.service) return reply(401, { ok: false, error: 'Unauthorized' });
  const role = await callerRole(authHeader);
  if (role !== 'admin' && role !== 'manager') return reply(403, { ok: false, error: 'Admin or manager role required' });

  const db = serviceDb();
  if (!db) return reply(500, { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  const allowed = await rateAllowed(db, `api-keys:${user.id}`, 20, 60, 'api-keys');
  if (allowed === null) return reply(503, { ok: false, error: 'Rate limit check unavailable' });
  if (!allowed) return reply(429, { ok: false, error: 'Rate limit exceeded' });

  try {
    if (req.method === 'GET') {
      let q = db.from('api_keys').select(PUBLIC_COLS).order('created_at', { ascending: false });
      if (role !== 'admin') q = q.eq('created_by', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return reply(200, { ok: true, keys: (data ?? []).map((k: any) => ({ ...k, mine: k.created_by === user.id })) });
    }

    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id');
      if (!id) return reply(400, { ok: false, error: 'id is required' });
      let q = db.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id).is('revoked_at', null);
      if (role !== 'admin') q = q.eq('created_by', user.id);
      const { data, error } = await q.select('id,revoked_at');
      if (error) throw error;
      if (!data?.length) return reply(404, { ok: false, error: 'API key not found' });
      return reply(200, { ok: true, id: data[0].id, revoked_at: data[0].revoked_at });
    }

    // POST
    const body = (await req.json().catch(() => null)) as { name?: unknown; scopes?: unknown } | null;
    if (!body || typeof body !== 'object') return reply(400, { ok: false, error: 'Invalid JSON body' });
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 80) return reply(422, { ok: false, error: 'name is required (1-80 characters)' });
    let scopes: string[] = ['read'];
    if (body.scopes !== undefined) {
      if (!Array.isArray(body.scopes) || !body.scopes.length || body.scopes.some((s) => !SCOPES.includes(s as any))) {
        return reply(422, { ok: false, error: "scopes must be a non-empty array of 'read' | 'write'" });
      }
      scopes = [...new Set(body.scopes as string[])];
    }
    const { count } = await db.from('api_keys').select('id', { count: 'exact', head: true }).eq('created_by', user.id).is('revoked_at', null);
    if ((count ?? 0) >= MAX_ACTIVE_KEYS_PER_USER) return reply(422, { ok: false, error: `Limit of ${MAX_ACTIVE_KEYS_PER_USER} active keys reached; revoke one first` });

    const uc = userClient(authHeader);
    let workspaceId: string | null = null;
    if (uc) {
      const { data: ws } = await uc.rpc('current_workspace_id');
      if (typeof ws === 'string') workspaceId = ws;
    }
    const secret = randomBytes(32).toString('base64url');
    const key = `${KEY_PREFIX}${secret}`;
    const { data, error } = await db
      .from('api_keys')
      .insert({ name, prefix: secret.slice(0, 8), key_hash: sha256Hex(key), scopes, workspace_id: workspaceId, created_by: user.id })
      .select('id,name,prefix,scopes')
      .single();
    if (error) throw error;
    return reply(201, { ok: true, id: data.id, name: data.name, prefix: data.prefix, scopes: data.scopes, key });
  } catch (e: any) {
    console.error('[api-keys]', e?.message || e);
    return reply(500, { ok: false, error: 'Request failed' });
  }
};

export const config = { path: '/api/keys' };
