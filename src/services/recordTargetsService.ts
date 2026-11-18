import { supabase } from '../lib/core/supabaseClient';
import { assertRowsAffected } from '../utils/rlsError';
import { isUuid } from './dealRecordShared';

/**
 * Multi-record links for notes and tasks (note_targets / task_targets).
 * Remote-only helpers: the in-memory (demo) path keeps `targets` on the item itself.
 */

export type TargetType = 'deal' | 'contact' | 'company';
export type TargetKind = 'note' | 'task';

export interface RecordTarget {
  type: TargetType;
  id: string;
  /** Display label, resolved lazily by the UI; never persisted. */
  label?: string;
}

/** The records an item list is being viewed from (a deal and its contact/company). */
export interface TargetScope {
  deal?: string;
  contact?: string;
  company?: string;
}

const CONFIG = {
  note: { table: 'note_targets', col: 'note_id' },
  task: { table: 'task_targets', col: 'task_id' },
} as const;

export const TARGET_TYPES: TargetType[] = ['deal', 'contact', 'company'];

export const targetKey = (t: Pick<RecordTarget, 'type' | 'id'>): string => `${t.type}:${t.id}`;

export const sameTargets = (a: RecordTarget[], b: RecordTarget[]): boolean => {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(targetKey));
  return b.every(t => keys.has(targetKey(t)));
};

/** De-duplicate by type+id, keeping the first occurrence (and any label it carries). */
export const uniqueTargets = (targets: RecordTarget[]): RecordTarget[] => {
  const seen = new Set<string>();
  return targets.filter(t => (seen.has(targetKey(t)) ? false : (seen.add(targetKey(t)), true)));
};

/** True when a missing table/relation caused the error (migration not applied yet). */
export const isMissingRelation = (e: unknown): boolean => {
  const err = e as { code?: string; message?: string } | null;
  const code = err?.code ?? '';
  return code === '42P01' || code === 'PGRST205' || /does not exist|could not find the table/i.test(err?.message ?? '');
};

/** Which of the item's targets match what the list is viewed from (deal first, then contact, then company). */
export function matchSource(targets: RecordTarget[], scope: TargetScope): RecordTarget | null {
  for (const type of TARGET_TYPES) {
    const id = scope[type];
    if (id && targets.some(t => t.type === type && t.id === id)) return { type, id };
  }
  return null;
}

/** Item ids linked to any record in `scope`, with the matching targets. Empty when the table is not deployed yet. */
export async function findLinkedItemIds(kind: TargetKind, scope: TargetScope): Promise<Map<string, RecordTarget[]>> {
  const { table, col } = CONFIG[kind];
  const conds = TARGET_TYPES
    .filter(t => isUuid(scope[t]))
    .map(t => `and(target_type.eq.${t},target_id.eq.${scope[t]})`);
  const out = new Map<string, RecordTarget[]>();
  if (conds.length === 0) return out;
  const { data, error } = await supabase.from(table).select(`${col}, target_type, target_id`).or(conds.join(','));
  if (error) {
    if (isMissingRelation(error)) return out;
    throw error;
  }
  for (const r of (data ?? []) as Array<Record<string, string>>) {
    const list = out.get(r[col]) ?? [];
    list.push({ type: r.target_type as TargetType, id: r.target_id });
    out.set(r[col], list);
  }
  return out;
}

/** All targets of the given items, keyed by item id. */
export async function fetchTargets(kind: TargetKind, ids: string[]): Promise<Record<string, RecordTarget[]>> {
  const { table, col } = CONFIG[kind];
  const out: Record<string, RecordTarget[]> = {};
  if (ids.length === 0) return out;
  const { data, error } = await supabase.from(table).select(`${col}, target_type, target_id`).in(col, ids);
  if (error) {
    if (isMissingRelation(error)) return out;
    throw error;
  }
  for (const r of (data ?? []) as Array<Record<string, string>>) {
    (out[r[col]] ??= []).push({ type: r.target_type as TargetType, id: r.target_id });
  }
  return out;
}

/** Make the stored targets equal `desired` (insert the new ones, delete the removed ones). */
export async function replaceTargets(
  kind: TargetKind,
  itemId: string,
  desired: RecordTarget[],
  current?: RecordTarget[],
): Promise<RecordTarget[]> {
  const { table, col } = CONFIG[kind];
  const want = uniqueTargets(desired).filter(t => isUuid(t.id));
  const have = current ?? (await fetchTargets(kind, [itemId]))[itemId] ?? [];
  const haveKeys = new Set(have.map(targetKey));
  const wantKeys = new Set(want.map(targetKey));
  const added = want.filter(t => !haveKeys.has(targetKey(t)));
  const removed = have.filter(t => !wantKeys.has(targetKey(t)));

  if (added.length) {
    const { error } = await supabase
      .from(table)
      .insert(added.map(t => ({ [col]: itemId, target_type: t.type, target_id: t.id })));
    if (error) throw error;
  }
  for (const t of removed) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq(col, itemId)
      .eq('target_type', t.type)
      .eq('target_id', t.id)
      .select(col);
    if (error) throw error;
    assertRowsAffected(data as unknown[]); // RLS filters silently (0 rows)
  }
  return want;
}

/** Legacy single-record columns kept in sync with the first deal/contact target. */
export function primaryColumns(targets: RecordTarget[]): { deal_id: string | null; contact_id: string | null } {
  const first = (type: TargetType) => targets.find(t => t.type === type && isUuid(t.id))?.id ?? null;
  return { deal_id: first('deal'), contact_id: first('contact') };
}
