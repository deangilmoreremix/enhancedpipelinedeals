import type { Deal, PipelineStage } from '../types';
import { wipBlock } from './stageMove';

export interface MultiDropDeps {
  stages: PipelineStage[];
  deals: Record<string, Deal>;
  bulkMoveDeals: (ids: string[], stageKey: string) => Promise<string[]>;
  notify?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  /** Shift held while dropping overrides a WIP limit. */
  override?: boolean;
}

export type MultiDropResult = 'moved' | 'blocked' | 'noop';

/** The ids a drag of `draggedId` carries: the whole selection when the dragged card is part of a multi-selection. */
export function dragGroup(draggedId: string, selectedIds: string[], deals: Record<string, Deal>): string[] {
  if (selectedIds.length > 1 && selectedIds.includes(draggedId)) {
    const ids = selectedIds.filter(id => deals[id]);
    // keep the dragged card first so it lands first
    return [draggedId, ...ids.filter(id => id !== draggedId)];
  }
  return [draggedId];
}

/**
 * Drop a multi-card drag on `destKey`: respects the WIP limit (blocked unless `override`) and moves every
 * card through dealStore.bulkMoveDeals.
 */
export async function dropSelectionOnStage(ids: string[], destKey: string, deps: MultiDropDeps): Promise<MultiDropResult> {
  const { stages, deals, bulkMoveDeals, notify, override } = deps;
  const dest = stages.find(s => s.key === destKey);
  const moving = ids.filter(id => deals[id] && deals[id].stage !== destKey);
  if (!dest || moving.length === 0) return 'noop';
  const block = wipBlock(stages, deals, destKey, moving);
  if (block) {
    if (!override) {
      notify?.(`${block.stageName} is at its WIP limit (${block.limit}); moving ${moving.length} deals would reach ${block.wouldReach}. Hold Shift while dropping to override.`, 'warning');
      return 'blocked';
    }
    notify?.(`${block.stageName} exceeds its WIP limit of ${block.limit}.`, 'info');
  }
  const done = await bulkMoveDeals(moving, destKey);
  notify?.(
    done.length === moving.length ? `Moved ${done.length} deals to ${dest.name}` : `Moved ${done.length} of ${moving.length} deals to ${dest.name}`,
    done.length === moving.length ? 'success' : 'warning'
  );
  return 'moved';
}
