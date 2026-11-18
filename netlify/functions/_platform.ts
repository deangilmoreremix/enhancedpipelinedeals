/**
 * Shared helpers for the platform functions (api-keys, public-api, workflow-webhook): sha256, a service-role client that does
 * not drag the workflow runner into the bundle, and the persistent rate limiter (RPC check_rate_limit) with the same fallback
 * behaviour as workflow-run-now (in-memory limiter only when the RPC has not been migrated).
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { rateLimited } from './_openai';

export const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');

export function serviceDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export type ServiceDb = NonNullable<ReturnType<typeof serviceDb>>;

/** true = allowed, false = limited, null = the limiter itself failed (callers answer 503). */
export async function rateAllowed(db: ServiceDb, key: string, limit: number, windowSeconds: number, tag = 'platform'): Promise<boolean | null> {
  const { data, error } = await (db as any).rpc('check_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (!error) return data === true;
  const missing = error.code === 'PGRST202' || error.code === '42883' || /could not find the function|function .* does not exist/i.test(error.message || '');
  if (missing) {
    console.warn(`[${tag}] check_rate_limit RPC not found; falling back to the in-memory limiter (apply the migration)`);
    return !rateLimited(key, limit, windowSeconds * 1000);
  }
  console.error(`[${tag}] check_rate_limit failed:`, error.message);
  return null;
}

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}
