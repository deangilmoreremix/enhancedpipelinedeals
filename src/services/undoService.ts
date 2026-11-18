import { create } from 'zustand';
import { useDealStore } from '../store/dealStore';
import { pushToast } from '../store/dealRecordStore';
import type { Deal } from '../types';

/**
 * Central undo manager. Destructive / bulk actions register an entry (label + undo callback) that is shown as a
 * toast with an Undo button for UNDO_TTL_MS. Ctrl/Cmd+Z (outside text fields) undoes the newest entry.
 * Entries expire (timer + stale sweep), are capped at MAX_ENTRIES and every timer is cleared on removal, so nothing leaks.
 * Informational entries (no `undo`) are plain toasts, e.g. merge, which cannot be reversed reliably.
 */
export const UNDO_TTL_MS = 8000;
export const MAX_ENTRIES = 5;

export interface UndoEntry {
  id: string;
  label: string;
  createdAt: number;
  expiresAt: number;
  /** Undefined = informational toast (nothing to undo). */
  undo?: () => Promise<void>;
  running: boolean;
}

interface UndoStore {
  entries: UndoEntry[];
}

export const useUndoStore = create<UndoStore>(() => ({ entries: [] }));

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let seq = 0;
let autoHost = true;
/** Tests switch the self-mounting toast host off. */
export const __setUndoAutoHost = (on: boolean): void => { autoHost = on; };
let hostRequested = false;

const clearTimer = (id: string) => {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
};

const remove = (id: string) => {
  clearTimer(id);
  useUndoStore.setState(s => ({ entries: s.entries.filter(e => e.id !== id) }));
};

export interface PushUndoOptions {
  label: string;
  undo?: () => Promise<void>;
  ttlMs?: number;
}

/** Register an undoable (or informational) action. Returns the entry id. */
export function pushUndo({ label, undo, ttlMs = UNDO_TTL_MS }: PushUndoOptions): string {
  const now = Date.now();
  const id = `undo-${now}-${++seq}`;
  const entry: UndoEntry = { id, label, createdAt: now, expiresAt: now + ttlMs, undo, running: false };
  const next = [...useUndoStore.getState().entries, entry];
  while (next.length > MAX_ENTRIES) {
    const dropped = next.shift();
    if (dropped) clearTimer(dropped.id);
  }
  useUndoStore.setState({ entries: next });
  timers.set(id, setTimeout(() => remove(id), ttlMs));
  if (autoHost && !hostRequested && typeof document !== 'undefined') {
    hostRequested = true;
    void import('../components/ui/undoHost').then(m => m.mountUndoHost()).catch(() => { hostRequested = false; });
  }
  return id;
}

export const dismissUndo = (id: string): void => remove(id);

/** Drop entries past their expiry (also called before every Ctrl+Z so a stale entry is never run). */
export function expireStale(now: number = Date.now()): void {
  const { entries } = useUndoStore.getState();
  entries.filter(e => e.expiresAt <= now).forEach(e => remove(e.id));
}

/** Run an entry's undo. Errors become an error toast; the entry is always removed afterwards. */
export async function runUndo(id: string): Promise<boolean> {
  expireStale();
  const entry = useUndoStore.getState().entries.find(e => e.id === id);
  if (!entry || !entry.undo || entry.running) return false;
  clearTimer(id);
  useUndoStore.setState(s => ({ entries: s.entries.map(e => (e.id === id ? { ...e, running: true } : e)) }));
  try {
    await entry.undo();
    remove(id);
    pushToast('success', `Undone: ${entry.label}`);
    return true;
  } catch (e) {
    remove(id);
    pushToast('error', `Could not undo "${entry.label}": ${e instanceof Error ? e.message : 'unknown error'}`);
    return false;
  }
}

/** Newest undoable entry. */
export function peekUndoable(): UndoEntry | undefined {
  expireStale();
  const list = useUndoStore.getState().entries.filter(e => e.undo && !e.running);
  return list[list.length - 1];
}

export const hasUndoable = (): boolean => !!peekUndoable();

/** Undo the newest entry (Ctrl/Cmd+Z, palette). Returns false when nothing is undoable. */
export async function undoLast(): Promise<boolean> {
  const e = peekUndoable();
  return e ? runUndo(e.id) : false;
}

export function __resetUndo(): void {
  timers.forEach(t => clearTimeout(t));
  timers.clear();
  useUndoStore.setState({ entries: [] });
}

// ---- deal helpers ------------------------------------------------------------------------------------------

const dealsOf = (): Record<string, Deal> => useDealStore.getState().deals;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Previous values of `keys` per deal. A missing value becomes null so the write clears the column again. */
export function captureFields(ids: string[], keys: Array<keyof Deal>, source: Record<string, Deal> = dealsOf()): Record<string, Partial<Deal>> {
  const out: Record<string, Partial<Deal>> = {};
  for (const id of ids) {
    const d = source[id];
    if (!d) continue;
    const prev: Record<string, unknown> = {};
    for (const k of keys) prev[k as string] = (d as any)[k] === undefined ? null : (d as any)[k];
    out[id] = prev as Partial<Deal>;
  }
  return out;
}

/** Group deals that share identical previous values so each group restores with ONE bulkUpdateDeals call. */
export function groupByPrevious(prev: Record<string, Partial<Deal>>): Array<{ ids: string[]; values: Partial<Deal> }> {
  const groups = new Map<string, { ids: string[]; values: Partial<Deal> }>();
  for (const [id, values] of Object.entries(prev)) {
    const key = JSON.stringify(values);
    const g = groups.get(key);
    if (g) g.ids.push(id); else groups.set(key, { ids: [id], values });
  }
  return [...groups.values()];
}

/** Restore captured field values; throws when any deal could not be restored (caller toasts). */
export async function restoreFields(prev: Record<string, Partial<Deal>>): Promise<void> {
  const store = useDealStore.getState();
  let failed = 0;
  for (const g of groupByPrevious(prev)) {
    const done = await store.bulkUpdateDeals(g.ids, g.values);
    failed += g.ids.length - done.length;
  }
  if (failed > 0) throw new Error(`${plural(failed, 'deal')} could not be restored`);
}

/** Bulk update with a before-state capture and an Undo toast. Returns the ids that succeeded. */
export async function undoableBulkUpdate(ids: string[], updates: Partial<Deal>, label: string): Promise<string[]> {
  const prev = captureFields(ids, Object.keys(updates) as Array<keyof Deal>);
  const done = await useDealStore.getState().bulkUpdateDeals(ids, updates);
  if (done.length > 0) {
    const kept: Record<string, Partial<Deal>> = {};
    done.forEach(id => { if (prev[id]) kept[id] = prev[id]; });
    pushUndo({ label: `${label} (${plural(done.length, 'deal')})`, undo: () => restoreFields(kept) });
  }
  return done;
}

/** Per-deal tag edits (each deal keeps its other tags) with one combined Undo. */
export async function undoableTagChange(ids: string[], compute: (current: string[]) => string[], label: string): Promise<string[]> {
  const store = useDealStore.getState();
  const prev = captureFields(ids, ['tags']);
  const results = await Promise.all(ids.map(id => {
    const current = dealsOf()[id]?.tags ?? [];
    return store.updateDeal(id, { tags: compute(current) }).then(() => id, () => null);
  }));
  const done = results.filter((x): x is string => x !== null);
  if (done.length > 0) {
    const kept: Record<string, Partial<Deal>> = {};
    done.forEach(id => { if (prev[id]) kept[id] = prev[id]; });
    pushUndo({ label: `${label} (${plural(done.length, 'deal')})`, undo: () => restoreFields(kept) });
  }
  return done;
}

type StagePos = { stage: string; position?: number };

async function restoreStages(prev: Record<string, StagePos>): Promise<void> {
  const store = useDealStore.getState();
  let failed = 0;
  for (const [id, p] of Object.entries(prev)) {
    if (!dealsOf()[id]) { failed++; continue; }
    const ok = await store.moveDeal(id, p.stage, p.position ?? 0);
    if (!ok) failed++;
  }
  if (failed > 0) throw new Error(`${plural(failed, 'deal')} could not be moved back`);
}

const stageName = (key: string): string => useDealStore.getState().stages.find(s => s.key === key)?.name ?? key;

/** Bulk stage move with Undo (restores stage and position). */
export async function undoableBulkMove(ids: string[], stageKey: string): Promise<string[]> {
  const before: Record<string, StagePos> = {};
  ids.forEach(id => { const d = dealsOf()[id]; if (d) before[id] = { stage: d.stage, position: d.position }; });
  const done = await useDealStore.getState().bulkMoveDeals(ids, stageKey);
  const moved = done.filter(id => before[id] && before[id].stage !== stageKey);
  if (moved.length > 0) {
    const kept: Record<string, StagePos> = {};
    moved.forEach(id => { kept[id] = before[id]; });
    pushUndo({ label: `Moved ${plural(moved.length, 'deal')} to ${stageName(stageKey)}`, undo: () => restoreStages(kept) });
  }
  return done;
}

/** Single stage move with Undo (no toast when the deal only changed position inside its column). */
export async function undoableMoveDeal(id: string, stageKey: string, position: number): Promise<boolean> {
  const d = dealsOf()[id];
  const before: StagePos | null = d ? { stage: d.stage, position: d.position } : null;
  const ok = await useDealStore.getState().moveDeal(id, stageKey, position);
  if (ok && before && before.stage !== stageKey) {
    pushUndo({ label: `Moved "${d?.title || d?.company}" to ${stageName(stageKey)}`, undo: () => restoreStages({ [id]: before }) });
  }
  return ok;
}

/** Soft delete with Undo (restoreDeals). Returns the deleted ids. */
export async function undoableDelete(ids: string[]): Promise<string[]> {
  const names = ids.map(id => dealsOf()[id]).filter(Boolean).map(d => d.title || d.company);
  const done = await useDealStore.getState().bulkSoftDelete(ids);
  if (done.length > 0) {
    const label = done.length === 1 && names[0] ? `Deleted "${names[0]}"` : `Deleted ${plural(done.length, 'deal')}`;
    pushUndo({
      label,
      undo: async () => {
        const n = await useDealStore.getState().restoreDeals(done);
        if (n < done.length) throw new Error(`${plural(done.length - n, 'deal')} could not be restored`);
      },
    });
  }
  return done;
}

/** Merge cannot be undone reliably (children are re-pointed to the survivor), so it only gets an informational toast. */
export function notifyMergeNotUndoable(count: number): void {
  pushUndo({
    label: `Merged ${plural(count, 'deal')}. Merging cannot be undone (related records were re-pointed to the surviving deal).`,
    ttlMs: 10000,
  });
}
