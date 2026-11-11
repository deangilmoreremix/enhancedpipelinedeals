import type { Deal, PipelineStage } from '../types';

export interface WipBlock {
  stageKey: string;
  stageName: string;
  limit: number;
  /** Deals the stage would hold after the move. */
  wouldReach: number;
}

/** Would moving `movingIds` into `destKey` exceed its WIP limit? Returns the block, or null when allowed. */
export function wipBlock(
  stages: PipelineStage[],
  deals: Record<string, Deal>,
  destKey: string,
  movingIds: string[]
): WipBlock | null {
  const stage = stages.find(s => s.key === destKey);
  if (!stage || !stage.wipLimit || stage.wipLimit <= 0) return null;
  const moving = new Set(movingIds);
  const staying = Object.values(deals).filter(d => d.stage === destKey && !moving.has(d.id)).length;
  // Cards already in the destination do not add to the count
  const incoming = movingIds.filter(id => deals[id] && deals[id].stage !== destKey).length;
  const wouldReach = staying + incoming;
  if (incoming > 0 && wouldReach > stage.wipLimit) {
    return { stageKey: stage.key, stageName: stage.name, limit: stage.wipLimit, wouldReach };
  }
  return null;
}

/** Visible stages in display order. */
export const visibleStageList = (stages: PipelineStage[]): PipelineStage[] =>
  [...stages].filter(s => s.visible).sort((a, b) => a.position - b.position);

/** The visible stage before/after `currentKey`, or null at the edge / for an unknown stage. */
export function adjacentVisibleStage(stages: PipelineStage[], currentKey: string, dir: -1 | 1): PipelineStage | null {
  const list = visibleStageList(stages);
  const i = list.findIndex(s => s.key === currentKey);
  if (i < 0) return null;
  return list[i + dir] ?? null;
}

export interface StageMovePlan {
  moves: Array<{ toKey: string; toName: string; ids: string[] }>;
  blocked: WipBlock[];
  /** Deals that cannot move (already at the edge, or in a hidden stage). */
  skipped: string[];
}

/**
 * Plan an Alt+Arrow keyboard move: each deal goes to the previous/next visible stage of its own stage.
 * WIP-limited targets are reported in `blocked` (and excluded) unless `override` is set.
 */
export function planStageMove(
  ids: string[],
  dir: -1 | 1,
  stages: PipelineStage[],
  deals: Record<string, Deal>,
  override = false
): StageMovePlan {
  const byTarget = new Map<string, string[]>();
  const skipped: string[] = [];
  ids.forEach(id => {
    const d = deals[id];
    if (!d) return;
    const target = adjacentVisibleStage(stages, d.stage, dir);
    if (!target) { skipped.push(id); return; }
    byTarget.set(target.key, [...(byTarget.get(target.key) ?? []), id]);
  });
  const plan: StageMovePlan = { moves: [], blocked: [], skipped };
  byTarget.forEach((group, toKey) => {
    const block = override ? null : wipBlock(stages, deals, toKey, group);
    if (block) { plan.blocked.push(block); return; }
    plan.moves.push({ toKey, toName: stages.find(s => s.key === toKey)?.name ?? toKey, ids: group });
  });
  return plan;
}
