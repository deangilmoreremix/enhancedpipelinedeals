import { useCallback, useEffect, useMemo } from 'react';
import { useBoardSelectionStore } from '../store/boardSelectionStore';
import { useBoardHotkeys } from './useBoardHotkeys';
import { useStageKeyboardMove, StageMoveNotify } from './useStageKeyboardMove';

/**
 * Shared selection + keyboard behaviour for the non-kanban views (table, list, calendar, timeline).
 * Uses the same boardSelectionStore as the board, so the BulkActionBar works identically everywhere.
 * `orderedIds` are the visible deals in display order (Ctrl/Cmd+A selects all of them; Shift+click selects a range).
 */
export function useViewSelection(
  orderedIds: string[],
  opts: { onOpen: (id: string) => void; notify?: StageMoveNotify; enabled?: boolean }
) {
  const selectedIds = useBoardSelectionStore(s => s.selectedIds);
  const focusedId = useBoardSelectionStore(s => s.focusedId);
  const toggleSelect = useBoardSelectionStore(s => s.toggleSelect);
  const selectRange = useBoardSelectionStore(s => s.selectRange);
  const setSelection = useBoardSelectionStore(s => s.setSelection);
  const clearSelection = useBoardSelectionStore(s => s.clearSelection);
  const setFocused = useBoardSelectionStore(s => s.setFocused);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visible = useMemo(() => new Set(orderedIds), [orderedIds]);

  // Selection never outlives the rows it refers to (filters changing, deals deleted, view switch)
  useEffect(() => {
    const kept = useBoardSelectionStore.getState().selectedIds.filter(id => visible.has(id));
    if (kept.length !== useBoardSelectionStore.getState().selectedIds.length) setSelection(kept);
  }, [visible, setSelection]);
  useEffect(() => () => clearSelection(), [clearSelection]);

  const moveStage = useStageKeyboardMove(opts.notify);
  useBoardHotkeys({
    enabled: opts.enabled,
    getColumns: () => [{ key: 'all', ids: orderedIds }],
    onOpen: opts.onOpen,
    onMoveStage: (dir, ids) => void moveStage(dir, ids)
  });

  const select = useCallback((id: string, e?: { shiftKey?: boolean }) => {
    setFocused(id);
    if (e?.shiftKey) selectRange(id, orderedIds);
    else toggleSelect(id);
  }, [orderedIds, selectRange, setFocused, toggleSelect]);

  const allSelected = orderedIds.length > 0 && orderedIds.every(id => selected.has(id));
  const toggleAll = useCallback(() => {
    if (allSelected) clearSelection();
    else setSelection(orderedIds);
  }, [allSelected, clearSelection, orderedIds, setSelection]);

  return { selected, selectedIds, focusedId, select, toggleAll, allSelected, clearSelection, setFocused };
}
