import { authedFetch } from './aiClient';
import { isDemoMode } from '../config/demoMode';

/**
 * API keys for the public REST API (/api/v1/*). Server side: netlify/functions/api-keys.ts (/api/keys).
 * The plaintext key is returned exactly once (POST) and is never stored here beyond the caller's own state.
 * Demo mode (no database / functions): in-memory keys that look real but authenticate nothing.
 */
export type ApiKeyScope = 'read' | 'write';
export const API_KEY_SCOPES: readonly ApiKeyScope[] = ['read', 'write'];

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
export interface CreatedApiKey extends ApiKeyRow { key: string }

const KEYS_URL = '/api/keys';
let demoKeys: ApiKeyRow[] = [];
export const __resetDemoKeys = (): void => { demoKeys = []; };

const errorOf = async (res: Response, fallback: string): Promise<Error> => {
  const body: any = await res.json().catch(() => ({}));
  return new Error(body?.error || body?.message || `${fallback} (${res.status})`);
};

/** Name must be 1-60 chars; at least one valid scope. Returns an error message or null. */
export function validateKeyInput(name: string, scopes: string[]): string | null {
  const n = name.trim();
  if (!n) return 'Give the key a name.';
  if (n.length > 60) return 'Name must be 60 characters or fewer.';
  if (scopes.length === 0) return 'Pick at least one scope.';
  if (scopes.some(s => !(API_KEY_SCOPES as readonly string[]).includes(s))) return 'Unknown scope.';
  return null;
}

/** "Active" | "Revoked" */
export const keyStatus = (k: Pick<ApiKeyRow, 'revoked_at'>): 'active' | 'revoked' => (k.revoked_at ? 'revoked' : 'active');

const randomPart = (len: number): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(len);
  (globalThis.crypto || ({ getRandomValues: (a: Uint8Array) => a.map(() => Math.floor(Math.random() * 256)) } as any)).getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
};

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  if (isDemoMode()) return [...demoKeys];
  const res = await authedFetch(KEYS_URL);
  if (!res.ok) throw await errorOf(res, 'Could not load API keys');
  const body: any = await res.json();
  const rows: any[] = body.keys ?? body.data ?? [];
  return rows.map(r => ({
    id: r.id, name: r.name, prefix: r.prefix, scopes: r.scopes ?? [],
    created_at: r.created_at, last_used_at: r.last_used_at ?? null, revoked_at: r.revoked_at ?? null,
  }));
}

export async function createApiKey(name: string, scopes: ApiKeyScope[]): Promise<CreatedApiKey> {
  const invalid = validateKeyInput(name, scopes);
  if (invalid) throw new Error(invalid);
  if (isDemoMode()) {
    const prefix = randomPart(8);
    const row: ApiKeyRow = { id: `demo-key-${Date.now()}`, name: name.trim(), prefix, scopes, created_at: new Date().toISOString(), last_used_at: null, revoked_at: null };
    demoKeys = [row, ...demoKeys];
    return { ...row, key: `cb_live_${prefix}${randomPart(32)}` };
  }
  const res = await authedFetch(KEYS_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), scopes }),
  });
  if (!res.ok) throw await errorOf(res, 'Could not create the API key');
  const b: any = await res.json();
  if (!b.key) throw new Error('The server did not return a key');
  return {
    id: b.id, name: b.name, prefix: b.prefix, scopes: b.scopes ?? scopes,
    created_at: b.created_at ?? new Date().toISOString(), last_used_at: null, revoked_at: null, key: b.key,
  };
}

export async function revokeApiKey(id: string): Promise<void> {
  if (isDemoMode()) {
    demoKeys = demoKeys.map(k => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k));
    return;
  }
  const res = await authedFetch(`${KEYS_URL}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw await errorOf(res, 'Could not revoke the API key');
}

/** curl examples for the documentation panel. */
export function curlExamples(origin: string, keyPlaceholder = 'YOUR_API_KEY'): Array<{ title: string; code: string }> {
  return [
    { title: 'List deals', code: `curl -H "Authorization: Bearer ${keyPlaceholder}" \\\n  "${origin}/api/v1/deals?limit=25"` },
    { title: 'Get one deal', code: `curl -H "Authorization: Bearer ${keyPlaceholder}" \\\n  "${origin}/api/v1/deals/DEAL_ID"` },
    { title: 'Create a deal (needs the write scope)', code: `curl -X POST -H "Authorization: Bearer ${keyPlaceholder}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Acme renewal","company":"Acme","value":12000}' \\\n  "${origin}/api/v1/deals"` },
  ];
}
