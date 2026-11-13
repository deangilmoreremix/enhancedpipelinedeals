/**
 * Tiny in-browser event bus for deal lifecycle events.
 * Emitters (store, import, forms) call `emitDealEvent`; the workflow trigger service subscribes
 * (lazily, on first emit) so workflows can run instantly without coupling the store to the engine.
 * The server-side workflow-runner de-duplicates against runs already made here.
 */
import type { Deal } from '../types';

export type DealEvent =
  | { type: 'created'; deal: Deal }
  | { type: 'updated'; id: string; before: Partial<Deal>; after: Partial<Deal> }
  | { type: 'stage_changed'; id: string; from: string; to: string; deal: Partial<Deal> }
  | { type: 'deleted'; id: string; deal?: Partial<Deal> };

export type DealEventListener = (event: DealEvent) => void | Promise<void>;

const listeners = new Set<DealEventListener>();
let defaultsAttached = false;

export function subscribeDealEvents(listener: DealEventListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function attachDefaultSubscribers(): Promise<void> {
  if (defaultsAttached) return;
  defaultsAttached = true;
  try {
    const { workflowTriggerService } = await import('./workflowTriggerService');
    workflowTriggerService.startDealEventBridge();
  } catch (e) {
    defaultsAttached = false;
    console.warn('Workflow event bridge unavailable:', e);
  }
}

/** Fire-and-forget; listener errors never reach the emitter. */
export function emitDealEvent(event: DealEvent): void {
  void attachDefaultSubscribers();
  for (const l of [...listeners]) {
    try {
      const r = l(event);
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(e => console.warn('Deal event listener failed:', e));
    } catch (e) {
      console.warn('Deal event listener failed:', e);
    }
  }
}

/** Test helper. */
export function resetDealEvents(): void {
  listeners.clear();
  defaultsAttached = false;
}
