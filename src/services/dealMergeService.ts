import { supabase } from '../lib/core/supabaseClient';
import type { Deal } from '../types';
import { dealToRow } from './dealMapper';
import { canUseRemote } from './dealRecordShared';

export const MIN_MERGE = 2;
export const MAX_MERGE = 9;

export type MergeField = 'title' | 'value' | 'stage' | 'priority' | 'notes';
export const MERGE_FIELDS: MergeField[] = ['title', 'value', 'stage', 'priority', 'notes'];
export const MERGE_FIELD_LABELS: Record<MergeField, string> = {
  title: 'Title', value: 'Value', stage: 'Stage', priority: 'Priority', notes: 'Notes',
};

export const normalizeText = (s: string | undefined | null): string =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export type DuplicateReason = 'title_company' | 'contact';

export interface DuplicateGroup {
  reason: DuplicateReason;
  key: string;
  dealIds: string[];
}

const titleCompanyKey = (d: Deal) => {
  const t = normalizeText(d.title);
  const c = normalizeText(d.company);
  return t && c ? `${t}|${c}` : '';
};
const contactKey = (d: Deal) => (d.contactId ? `id:${d.contactId}` : '');

/** Groups of 2+ deals sharing normalized title+company, or the same contact. */
export function findDuplicateGroups(deals: Deal[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const collect = (reason: DuplicateReason, keyOf: (d: Deal) => string) => {
    const map = new Map<string, string[]>();
    for (const d of deals) {
      if (d.deletedAt) continue;
      const k = keyOf(d);
      if (!k) continue;
      map.set(k, [...(map.get(k) ?? []), d.id]);
    }
    map.forEach((ids, key) => { if (ids.length > 1) groups.push({ reason, key, dealIds: ids }); });
  };
  collect('title_company', titleCompanyKey);
  collect('contact', contactKey);
  return groups;
}

/** Other deals in `pool` that look like duplicates of `deal`. */
export function findDuplicatesOf(deal: Deal, pool: Deal[]): Array<{ deal: Deal; reasons: DuplicateReason[] }> {
  const tc = titleCompanyKey(deal);
  const ck = contactKey(deal);
  const out: Array<{ deal: Deal; reasons: DuplicateReason[] }> = [];
  for (const other of pool) {
    if (other.id === deal.id || other.deletedAt) continue;
    const reasons: DuplicateReason[] = [];
    if (tc && titleCompanyKey(other) === tc) reasons.push('title_company');
    if (ck && contactKey(other) === ck) reasons.push('contact');
    if (reasons.length) out.push({ deal: other, reasons });
  }
  return out;
}

export const COMBINE_NOTES = 'combine';

/** Fields where the selected deals disagree. */
export function getConflicts(deals: Deal[]): MergeField[] {
  return MERGE_FIELDS.filter(f => {
    const vals = new Set(deals.map(d => String(d[f] ?? '')));
    return vals.size > 1;
  });
}

/**
 * Build the survivor's field updates from conflict choices.
 * `choices[field]` is the id of the deal whose value wins (default: survivor); for `notes`
 * it may also be COMBINE_NOTES to concatenate every distinct note.
 */
export function resolveMergeUpdates(
  survivor: Deal,
  all: Deal[],
  choices: Partial<Record<MergeField, string>>
): Partial<Deal> {
  const updates: Partial<Deal> = {};
  const byId = new Map(all.map(d => [d.id, d]));
  for (const field of MERGE_FIELDS) {
    const choice = choices[field];
    if (!choice || choice === survivor.id) continue;
    if (field === 'notes' && choice === COMBINE_NOTES) {
      const parts = [survivor, ...all.filter(d => d.id !== survivor.id)]
        .map(d => (d.notes ?? '').trim())
        .filter((n, i, arr) => n && arr.indexOf(n) === i);
      updates.notes = parts.join('\n\n---\n\n');
      continue;
    }
    const src = byId.get(choice);
    if (!src) continue;
    (updates as Record<string, unknown>)[field] = src[field];
  }
  return updates;
}

export interface MergeRequest {
  keepId: string;
  mergeIds: string[];
  updates?: Partial<Deal>;
}

/** Whether the merge can run against Supabase (otherwise the caller merges in the local store). */
export const canMergeRemote = (ids: string[]): boolean => ids.length > 0 && ids.every(canUseRemote);

/**
 * Calls the `merge_deals` RPC (re-points notes/files/tasks/activities/favorites and soft-deletes the
 * merged deals), then applies the chosen field values to the survivor.
 */
export async function mergeDeals({ keepId, mergeIds, updates }: MergeRequest): Promise<void> {
  const others = mergeIds.filter(id => id !== keepId);
  const total = others.length + 1;
  if (total < MIN_MERGE || total > MAX_MERGE) {
    throw new Error(`Select between ${MIN_MERGE} and ${MAX_MERGE} deals to merge`);
  }
  const { error } = await supabase.rpc('merge_deals', { keep: keepId, merge_ids: others });
  if (error) throw error;
  if (updates && Object.keys(updates).length > 0) {
    const row = dealToRow({ ...updates, updatedAt: new Date() }, { partial: true });
    const { error: upErr } = await supabase.from('deals').update(row).eq('id', keepId);
    if (upErr) throw upErr;
  }
}

export const DealMergeService = { findDuplicateGroups, findDuplicatesOf, getConflicts, resolveMergeUpdates, mergeDeals, canMergeRemote };
