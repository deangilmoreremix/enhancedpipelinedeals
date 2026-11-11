import Fuse from 'fuse.js';
import type { Deal } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseService';
import { isDemoMode } from '../config/demoMode';
import { dealFromRow } from './dealMapper';
import { useDealStore } from '../store/dealStore';

const FUSE_KEYS = [
  { name: 'title', weight: 0.4 },
  { name: 'company', weight: 0.3 },
  { name: 'contact', weight: 0.2 },
  { name: 'tags', weight: 0.06 },
  { name: 'notes', weight: 0.04 }
];

/** Fuzzy search over in-memory deals (threshold 0.35). Best match first. */
export function fuzzySearchDeals(q: string, deals: Deal[], limit = 200): Deal[] {
  const query = q.trim();
  if (!query) return [];
  const fuse = new Fuse(deals, {
    keys: FUSE_KEYS,
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2
  });
  return fuse.search(query, { limit }).map(r => r.item);
}

const remoteEnabled = (): boolean => Boolean(isSupabaseConfigured) && !isDemoMode();

/** Union of RPC hits (first, in rank order) and Fuse hits, de-duplicated by id, capped at `limit`. */
export function unionDeals(primary: Deal[], secondary: Deal[], limit: number): Deal[] {
  const seen = new Set<string>();
  const out: Deal[] = [];
  for (const d of [...primary, ...secondary]) {
    if (seen.has(d.id) || d.deletedAt) continue;
    seen.add(d.id);
    out.push(d);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Search deals. With a live database the `search_deals(q, lim)` RPC (Postgres full-text on `tsv`) hits are
 * UNIONED with Fuse.js hits over the deals in the store (or the `deals` passed in): full-text has no
 * prefix/typo matching, so Fuse adds fuzzy matches rather than only running when the RPC finds nothing.
 */
export async function searchDeals(q: string, limit = 20, deals?: Deal[]): Promise<Deal[]> {
  const query = q.trim();
  if (!query) return [];

  let rpcHits: Deal[] = [];
  if (remoteEnabled()) {
    try {
      const { data, error } = await supabase.rpc('search_deals', { q: query, lim: limit });
      if (!error && Array.isArray(data)) rpcHits = data.map(row => dealFromRow(row));
    } catch (err) {
      console.warn('search_deals RPC failed, using local fuzzy search:', err);
    }
  }

  const pool = deals ?? Object.values(useDealStore.getState().deals);
  return unionDeals(rpcHits, fuzzySearchDeals(query, pool, limit), limit);
}

export const dealSearchService = { searchDeals, fuzzySearchDeals, unionDeals };
