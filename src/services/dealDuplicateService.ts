import { supabase, isSupabaseConfigured } from './supabaseService';
import { isDemoMode } from '../config/demoMode';
import type { Deal } from '../types';
import { useDealStore } from '../store/dealStore';
import { isUuidLike as isUuid } from './customFieldService';

const normalizeText = (s: string | undefined | null): string =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export interface DuplicateCandidate {
  id: string;
  title: string | null;
  company: string | null;
  value: number | null;
  stage: string | null;
  reason: string;
}

export interface DuplicateQuery {
  title: string;
  company?: string;
  contactId?: string | null;
  excludeId?: string | null;
}

const tokens = (s: string): string[] => normalizeText(s).split(' ').filter(t => t.length > 1);

/** Dice-like token overlap in 0..1 (order-insensitive, typo-tolerant enough for titles). */
export function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach(t => { if (tb.has(t)) shared++; });
  return (2 * shared) / (ta.size + tb.size);
}

export const SIMILARITY_THRESHOLD = 0.7;

/** Client-side duplicate search over `deals` (demo mode / non-uuid deals). Best matches first. */
export function findDuplicatesLocal(q: DuplicateQuery, deals: Deal[]): DuplicateCandidate[] {
  const title = normalizeText(q.title);
  const company = normalizeText(q.company);
  const out: Array<DuplicateCandidate & { score: number }> = [];
  for (const d of deals) {
    if (d.deletedAt || d.id === q.excludeId) continue;
    const sameTitle = !!title && normalizeText(d.title) === title;
    const sameCompany = !!company && normalizeText(d.company) === company;
    const sim = q.title ? similarity(q.title, d.title ?? '') : 0;
    const sameContact = !!q.contactId && d.contactId === q.contactId;
    let reason = '';
    let score = 0;
    if (sameTitle && sameCompany) { reason = 'Same title and company'; score = 3; }
    else if (sameContact && sameCompany) { reason = 'Same contact and company'; score = 2.5; }
    else if (sameCompany && sim >= SIMILARITY_THRESHOLD) { reason = 'Similar title at the same company'; score = 2 + sim; }
    else if (sameTitle) { reason = 'Same title'; score = 1.5; }
    else if (sim >= 0.85) { reason = 'Very similar title'; score = sim; }
    if (reason) out.push({ id: d.id, title: d.title ?? null, company: d.company ?? null, value: d.value ?? null, stage: d.stage ?? null, reason, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5).map(({ score: _s, ...rest }) => rest);
}

const useRpc = () => isSupabaseConfigured && !isDemoMode();

const REASONS: Record<string, string> = {
  same_title_company: 'Same title and company',
  same_contact_similar_title: 'Same contact, similar title',
};

/** Possible duplicates before creating a deal: `find_duplicate_deals` RPC, or a store similarity scan in demo mode. */
export async function findDuplicateDeals(q: DuplicateQuery): Promise<DuplicateCandidate[]> {
  if (!q.title.trim()) return [];
  if (!useRpc()) return findDuplicatesLocal(q, Object.values(useDealStore.getState().deals));
  const { data, error } = await supabase.rpc('find_duplicate_deals', {
    p_title: q.title.trim(),
    p_company: q.company?.trim() ?? '',
    p_contact_id: isUuid(q.contactId) ? q.contactId : null,
    p_exclude: isUuid(q.excludeId) ? q.excludeId : null,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, any>>).map(r => ({
    id: r.id, title: r.title ?? null, company: r.company ?? null, value: r.value != null ? Number(r.value) : null,
    stage: r.stage ?? null, reason: REASONS[r.reason] ?? r.reason ?? 'Possible duplicate',
  }));
}

export const DealDuplicateService = { findDuplicateDeals, findDuplicatesLocal, similarity };
