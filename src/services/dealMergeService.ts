import { supabase } from '../lib/core/supabaseClient';
import type { Deal } from '../types';
import type { CustomFieldValue } from '../types/customFields';
import { dealToRow } from './dealMapper';
import { canUseRemote } from './dealRecordShared';

export const MIN_MERGE = 2;
export const MAX_MERGE = 9;

export type CoreMergeField = 'title' | 'company' | 'contact' | 'value' | 'stage' | 'priority' | 'probability' | 'closeDate' | 'dueDate' | 'notes';
/** A core deal field, or `cf:<key>` for a custom field. */
export type MergeField = CoreMergeField | `cf:${string}`;
export const MERGE_FIELDS: CoreMergeField[] = ['title', 'company', 'contact', 'value', 'stage', 'priority', 'probability', 'closeDate', 'dueDate', 'notes'];
export const MERGE_FIELD_LABELS: Record<CoreMergeField, string> = {
  title: 'Title', company: 'Company', contact: 'Contact', value: 'Value', stage: 'Stage', priority: 'Priority',
  probability: 'Probability', closeDate: 'Close date', dueDate: 'Due date', notes: 'Notes',
};
export const CUSTOM_PREFIX = 'cf:';
export const isCustomMergeField = (f: string): f is `cf:${string}` => f.startsWith(CUSTOM_PREFIX);
export const customMergeField = (key: string): MergeField => `${CUSTOM_PREFIX}${key}`;

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

const cmp = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return String(v.getTime());
  if (typeof v === 'string') return v.trim();
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};
const fieldValue = (d: Deal, f: MergeField): unknown =>
  isCustomMergeField(f) ? d.customFields?.[f.slice(CUSTOM_PREFIX.length)] : d[f];

/** Fields where the selected deals disagree (core fields first, then custom fields as `cf:<key>`). */
export function getConflicts(deals: Deal[]): MergeField[] {
  const keys = [...new Set(deals.flatMap(d => Object.keys(d.customFields ?? {})))].sort();
  const all: MergeField[] = [...MERGE_FIELDS, ...keys.map(customMergeField)];
  return all.filter(f => new Set(deals.map(d => cmp(fieldValue(d, f)))).size > 1);
}

/**
 * Build the survivor's field updates from conflict choices.
 * `choices[field]` is the id of the deal whose value wins (default: survivor); for `notes`
 * it may also be COMBINE_NOTES to concatenate every distinct note. Choosing another deal's company /
 * contact also takes its companyId / contactId; custom fields are sent as one merged `customFields`.
 */
export function resolveMergeUpdates(
  survivor: Deal,
  all: Deal[],
  choices: Partial<Record<MergeField, string>>
): Partial<Deal> {
  const updates: Partial<Deal> = {};
  const byId = new Map(all.map(d => [d.id, d]));
  const target = updates as Record<string, unknown>;
  let custom: Record<string, CustomFieldValue> | undefined;
  for (const [field, choice] of Object.entries(choices) as Array<[MergeField, string | undefined]>) {
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
    if (isCustomMergeField(field)) {
      custom = custom ?? { ...(survivor.customFields ?? {}) };
      const key = field.slice(CUSTOM_PREFIX.length);
      const v = src.customFields?.[key];
      if (v === undefined || v === null || v === '') delete custom[key]; else custom[key] = v;
      continue;
    }
    target[field] = src[field];
    if (field === 'company' && src.companyId !== undefined) updates.companyId = src.companyId;
    if (field === 'contact' && src.contactId !== undefined) updates.contactId = src.contactId;
  }
  if (custom) updates.customFields = custom;
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
 * Calls the `merge_deals` RPC (re-points notes/files/tasks/activities/favorites, soft-deletes the
 * merged deals and applies the chosen survivor field values atomically via `p_fields`).
 */
export async function mergeDeals({ keepId, mergeIds, updates }: MergeRequest): Promise<void> {
  const others = mergeIds.filter(id => id !== keepId);
  const total = others.length + 1;
  if (total < MIN_MERGE || total > MAX_MERGE) {
    throw new Error(`Select between ${MIN_MERGE} and ${MAX_MERGE} deals to merge`);
  }
  // Survivor field updates ride along in the same RPC so the merge is atomic server-side.
  const hasUpdates = !!updates && Object.keys(updates).length > 0;
  const fields = hasUpdates
    ? dealToRow({ ...updates, updatedAt: new Date() }, { partial: true })
    : null;
  const { error } = await supabase.rpc('merge_deals', { keep: keepId, merge_ids: others, p_fields: fields });
  if (error) throw error;
}

export const DealMergeService = { findDuplicateGroups, findDuplicatesOf, getConflicts, resolveMergeUpdates, mergeDeals, canMergeRemote };
