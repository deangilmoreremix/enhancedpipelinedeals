import { supabase } from './supabaseService';
import { companyFromRow, companyToRow, isRemote, listLocal, normalizeName, removeLocalCompanies, update as updateCompanyRow } from './companyService';
import { assertRowsAffected } from '../utils/rlsError';
import type { Company } from '../types';
import { useDealStore } from '../store/dealStore';
import { useContactStore } from '../store/contactStore';

export interface DuplicateHit { id: string; name: string; domain: string | null; reason: string }
export interface DuplicateGroup { key: string; ids: string[]; names: string[]; reason: string }

/** Same normalisation as SQL norm_domain(). */
export const normalizeDomain = (d: string | null | undefined): string =>
  (d ?? '').trim().replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').replace(/[/?#].*$/, '').toLowerCase();

const squash = (s: string | null | undefined) => normalizeName(s).replace(/\s+/g, ' ');

// ---- detection --------------------------------------------------------------------------------

/** Companies that look like `name` / `domain` (find_duplicate_companies RPC; local scan in demo mode). */
export async function findDuplicateCompanies(name: string, domain?: string | null, excludeId?: string | null): Promise<DuplicateHit[]> {
  const nn = squash(name);
  const nd = normalizeDomain(domain);
  if (!nn && !nd) return [];
  if (isRemote()) {
    const { data, error } = await supabase.rpc('find_duplicate_companies', {
      p_name: name, p_domain: domain ?? null, p_exclude: excludeId && !excludeId.startsWith('local-') ? excludeId : null,
    });
    if (error) throw error;
    return ((data ?? []) as Array<{ id: string; name: string; domain?: string | null; reason: string }>)
      .map(r => ({ id: r.id, name: r.name, domain: r.domain ?? null, reason: r.reason }));
  }
  return listLocal()
    .filter(c => c.id !== excludeId && ((nn && squash(c.name) === nn) || (nd && normalizeDomain(c.domain) === nd)))
    .map(c => ({ id: c.id, name: c.name, domain: c.domain ?? null, reason: nn && squash(c.name) === nn ? 'name' : 'domain' }));
}

/** Groups of companies sharing a normalised name or domain (scan_duplicate_companies RPC; local in demo mode). */
export async function scanDuplicateCompanies(): Promise<DuplicateGroup[]> {
  if (isRemote()) {
    const { data, error } = await supabase.rpc('scan_duplicate_companies');
    if (error) throw error;
    return ((data ?? []) as Array<{ group_key: string; ids?: string[]; names?: string[]; reason: string }>).map(r => ({
      key: r.group_key, ids: r.ids ?? [], names: r.names ?? [], reason: r.reason,
    }));
  }
  const groups = new Map<string, { reason: string; rows: Company[] }>();
  const add = (key: string, reason: string, c: Company) => {
    const g = groups.get(key) ?? { reason, rows: [] };
    g.rows.push(c);
    groups.set(key, g);
  };
  for (const c of listLocal()) {
    if (squash(c.name)) add(`name:${squash(c.name)}`, 'name', c);
    if (normalizeDomain(c.domain)) add(`domain:${normalizeDomain(c.domain)}`, 'domain', c);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.rows.length >= 2)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, g]) => ({ key, ids: g.rows.map(r => r.id), names: g.rows.map(r => r.name), reason: g.reason }));
}

// ---- merge ------------------------------------------------------------------------------------

const FILL_FIELDS = ['industry', 'website', 'domain', 'size', 'revenue', 'phone', 'address', 'logoUrl', 'notes', 'ownerId'] as const;
const blank = (v: unknown) => v === undefined || v === null || v === '';

/** Pure: fields the survivor lacks that a loser has (first loser wins), plus merged custom values. */
export function planMerge(survivor: Company, losers: Company[]): { patch: Partial<Omit<Company, 'id'>>; filled: string[] } {
  const patch: Record<string, unknown> = {};
  const filled: string[] = [];
  for (const f of FILL_FIELDS) {
    if (!blank(survivor[f])) continue;
    const donor = losers.find(l => !blank(l[f]));
    if (donor) { patch[f] = donor[f]; filled.push(f); }
  }
  const custom: Record<string, unknown> = { ...(survivor.customFields ?? {}) };
  let customChanged = false;
  for (const l of losers) {
    for (const [k, v] of Object.entries(l.customFields ?? {})) {
      if (blank(custom[k]) && !blank(v)) { custom[k] = v; customChanged = true; }
    }
  }
  if (customChanged) { patch.customFields = custom; filled.push('customFields'); }
  return { patch: patch as Partial<Omit<Company, 'id'>>, filled };
}

export interface MergeResult {
  survivorId: string;
  mergedIds: string[];
  filled: string[];
  relinkedDeals: number;
  relinkedContacts: number;
}

export class MergeError extends Error {
  constructor(message: string, readonly partial: Partial<MergeResult> = {}) { super(message); this.name = 'MergeError'; }
}

/**
 * Client-side merge: repoint deals + contacts to the survivor, copy missing fields onto it, soft-delete the others
 * (deleted_at). Not transactional: a failure part-way throws a MergeError that says what already happened (re-running
 * the merge is safe, every step is idempotent).
 */
export async function mergeCompanies(survivorId: string, loserIds: string[]): Promise<MergeResult> {
  const losers = [...new Set(loserIds)].filter(id => id !== survivorId);
  if (losers.length === 0) throw new MergeError('Pick at least one company to merge into the survivor');
  return isRemote() && !survivorId.startsWith('local-') ? mergeRemote(survivorId, losers) : mergeLocal(survivorId, losers);
}

async function mergeRemote(survivorId: string, loserIds: string[]): Promise<MergeResult> {
  const ids = [survivorId, ...loserIds];
  const { data: rows, error: readErr } = await supabase.from('companies').select('*').in('id', ids).is('deleted_at', null);
  if (readErr) throw readErr;
  const all = (rows ?? []).map(companyFromRow);
  const survivor = all.find(c => c.id === survivorId);
  if (!survivor) throw new MergeError('The surviving company no longer exists');
  const losers = all.filter(c => c.id !== survivorId);
  if (losers.length === 0) throw new MergeError('The other companies were already merged or deleted');
  const lostIds = losers.map(l => l.id);
  const { patch, filled } = planMerge(survivor, losers);
  const done: Partial<MergeResult> = { survivorId, filled };

  try {
    const relink = async (table: 'deals' | 'contacts') => {
      const target = { company_id: survivorId, company: survivor.name };
      const byId = await supabase.from(table).update(target).in('company_id', lostIds).select('id');
      if (byId.error) throw byId.error;
      const names = [...new Set(losers.map(l => l.name))];
      const byName = await supabase.from(table).update(target).is('company_id', null).in('company', names).select('id');
      if (byName.error) throw byName.error;
      return (byId.data?.length ?? 0) + (byName.data?.length ?? 0);
    };
    done.relinkedDeals = await relink('deals');
    done.relinkedContacts = await relink('contacts');

    if (Object.keys(patch).length > 0) {
      const res = await supabase.from('companies').update({ ...companyToRow(patch), updated_at: new Date().toISOString() }).eq('id', survivorId).select('id');
      if (res.error) throw res.error;
      assertRowsAffected(res.data);
    }

    const del = await supabase.from('companies').update({ deleted_at: new Date().toISOString() }).in('id', lostIds).select('id');
    if (del.error) throw del.error;
    assertRowsAffected(del.data);
    if ((del.data?.length ?? 0) < lostIds.length) {
      throw new Error(`Only ${del.data?.length ?? 0} of ${lostIds.length} duplicate companies could be removed`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Merge failed';
    throw new MergeError(`${msg}. Deals/contacts already moved to the survivor stay there; run the merge again to finish.`, done);
  }
  return { survivorId, mergedIds: lostIds, filled, relinkedDeals: done.relinkedDeals ?? 0, relinkedContacts: done.relinkedContacts ?? 0 };
}

async function mergeLocal(survivorId: string, loserIds: string[]): Promise<MergeResult> {
  const list = listLocal();
  const survivor = list.find(c => c.id === survivorId);
  if (!survivor) throw new MergeError('The surviving company no longer exists');
  const losers = list.filter(c => loserIds.includes(c.id));
  const { patch, filled } = planMerge(survivor, losers);
  const names = new Set(losers.map(l => normalizeName(l.name)));
  const isLoser = (companyId: string | undefined, name: string | undefined) =>
    (!!companyId && loserIds.includes(companyId)) || (!companyId && names.has(normalizeName(name)));

  let relinkedDeals = 0;
  let relinkedContacts = 0;
  const deals = Object.values(useDealStore.getState().deals).filter(d => !d.deletedAt && isLoser(d.companyId, d.company));
  for (const d of deals) {
    await useDealStore.getState().updateDeal(d.id, { company: survivor.name, companyId: survivorId.startsWith('local-co-') ? undefined : survivorId });
    relinkedDeals++;
  }
  const contacts = useContactStore.getState().contacts.filter(c => isLoser((c as { companyId?: string }).companyId, c.company));
  for (const c of contacts) {
    try { await useContactStore.getState().updateContact(c.id, { company: survivor.name }); relinkedContacts++; } catch { /* demo/mock contact that cannot be written */ }
  }
  if (Object.keys(patch).length > 0) await updateCompanyRow(survivorId, patch);
  removeLocalCompanies(loserIds);
  return { survivorId, mergedIds: loserIds, filled, relinkedDeals, relinkedContacts };
}
