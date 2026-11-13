import { useCallback, useEffect, useRef } from 'react';
import { useDealStore } from '../store/dealStore';
import { planStageMove } from '../utils/stageMove';

export type StageMoveNotify = (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;

/**
 * Handler for useBoardHotkeys' `onMoveStage` (Alt+Left/Right): moves the focused card or the selection to the
 * previous/next visible stage via dealStore.moveDeal (one deal) / bulkMoveDeals (several) and reports a toast.
 * Hold Shift as well to override a WIP limit.
 */
export function useStageKeyboardMove(notify?: StageMoveNotify) {
  const shiftRef = useRef(false);
  useEffect(() => {
    const track = (e: KeyboardEvent) => { shiftRef.current = e.shiftKey; };
    window.addEventListener('keydown', track);
    window.addEventListener('keyup', track);
    return () => { window.removeEventListener('keydown', track); window.removeEventListener('keyup', track); };
  }, []);

  return useCallback(async (direction: -1 | 1, ids: string[]) => {
    const { stages, deals, moveDeal, bulkMoveDeals } = useDealStore.getState();
    const plan = planStageMove(ids, direction, stages, deals, shiftRef.current);
    plan.blocked.forEach(b =>
      notify?.(`${b.stageName} is at its WIP limit (${b.limit}). Hold Shift as well to override.`, 'warning'));
    if (plan.moves.length === 0) {
      if (plan.blocked.length === 0 && plan.skipped.length > 0) {
        notify?.(direction === 1 ? 'Already in the last stage' : 'Already in the first stage', 'info');
      }
      return;
    }
    for (const move of plan.moves) {
      if (move.ids.length === 1) {
        const dest = Object.values(useDealStore.getState().deals).filter(d => d.stage === move.toKey);
        const position = dest.reduce((m, d) => Math.max(m, d.position ?? 0), 0) + 1;
        const ok = await moveDeal(move.ids[0], move.toKey, position);
        notify?.(ok ? `Moved to ${move.toName}` : 'Could not move the deal', ok ? 'success' : 'error');
      } else {
        const done = await bulkMoveDeals(move.ids, move.toKey);
        notify?.(
          done.length === move.ids.length ? `Moved ${done.length} deals to ${move.toName}` : `Moved ${done.length} of ${move.ids.length} deals to ${move.toName}`,
          done.length === move.ids.length ? 'success' : 'warning'
        );
      }
    }
  }, [notify]);
}
