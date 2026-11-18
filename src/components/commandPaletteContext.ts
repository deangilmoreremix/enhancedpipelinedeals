import { useSyncExternalStore } from 'react';

/** Event the palette dispatches for record actions it cannot perform itself. */
export const DEAL_RECORD_ACTION_EVENT = 'deal-record:action';

export type DealRecordActionName =
  | 'add-note'
  | 'add-task'
  | 'merge-duplicates'
  | 'find-duplicates'
  | 'run-workflow';

export interface DealRecordActionDetail {
  action: DealRecordActionName;
  dealId: string;
}

export function dispatchDealRecordAction(action: DealRecordActionName, dealId: string): void {
  window.dispatchEvent(new CustomEvent<DealRecordActionDetail>(DEAL_RECORD_ACTION_EVENT, { detail: { action, dealId } }));
}

/** Subscribe to record actions; returns the unsubscribe function. */
export function onDealRecordAction(handler: (detail: DealRecordActionDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<DealRecordActionDetail>).detail);
  window.addEventListener(DEAL_RECORD_ACTION_EVENT, listener);
  return () => window.removeEventListener(DEAL_RECORD_ACTION_EVENT, listener);
}

export interface CommandContext {
  dealId: string | null;
}

let current: CommandContext = { dealId: null };
const listeners = new Set<() => void>();

/**
 * Tells the palette which deal is "current" (e.g. a deal modal is open). Pass null / {dealId: null} to clear.
 * The /deals/:id route is detected automatically; an explicit context wins over the route.
 */
export function setCommandContext(ctx: { dealId?: string | null } | null): void {
  const next: CommandContext = { dealId: ctx?.dealId ?? null };
  if (next.dealId === current.dealId) return;
  current = next;
  listeners.forEach(l => l());
}

export const getCommandContext = (): CommandContext => current;

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useCommandContext(): CommandContext {
  return useSyncExternalStore(subscribe, getCommandContext, getCommandContext);
}

/** Deal id from a /deals/:id pathname, else null. */
export function dealIdFromPath(pathname: string): string | null {
  const m = /^\/deals\/([^/?#]+)\/?/.exec(pathname);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}
