import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, DropResult, useMouseSensor, useTouchSensor } from '@hello-pangea/dnd';
import type { Deal } from '../../types';
import { useDealStore } from '../../store/dealStore';
import { useBoardSelectionStore } from '../../store/boardSelectionStore';
import { useBoardHotkeys } from '../../hooks/useBoardHotkeys';
import { buildGroupColumns, isGroupingDroppable, updatesForGroupDrop } from '../../utils/boardGrouping';
import { sortDeals } from './kanban/kanbanUtils';
import { BoardColumn, PAGE_SIZE } from './BoardColumn';
import { BulkActionBar } from './BulkActionBar';
import type { BoardCardContext, KanbanBoardProps } from './KanbanBoard';

const sensors = [useMouseSensor, useTouchSensor];

const PRIORITY_COLORS: Record<string, string> = { high: 'red', medium: 'yellow', low: 'blue' };

/** Board grouped by owner / priority / company. Dragging between columns edits that field (company is read-only). */
export const GroupedBoard: React.FC<KanbanBoardProps> = ({ deals, sortBy, isLoading, indicators, onOpenDeal, renderCard, grouping }) => {
  const groupBy = (grouping?.groupBy ?? 'owner') as 'owner' | 'priority' | 'company';
  const updateDeal = useDealStore(s => s.updateDeal);
  const allDealsMap = useDealStore(s => s.deals);

  const selectedIds = useBoardSelectionStore(s => s.selectedIds);
  const focusedId = useBoardSelectionStore(s => s.focusedId);
  const toggleSelect = useBoardSelectionStore(s => s.toggleSelect);
  const selectRange = useBoardSelectionStore(s => s.selectRange);
  const setFocused = useBoardSelectionStore(s => s.setFocused);
  const clearSelection = useBoardSelectionStore(s => s.clearSelection);

  const [limits, setLimits] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(() => () => { window.clearTimeout(toastTimer.current); clearSelection(); }, [clearSelection]);

  const applySort = useCallback(
    (list: Deal[]) => (grouping?.sortFn ? grouping.sortFn(list) : sortDeals(list, sortBy)),
    [grouping, sortBy]
  );

  const columns = useMemo(
    () => buildGroupColumns(deals, groupBy).map(c => ({ ...c, deals: applySort(c.deals) })),
    [deals, groupBy, applySort]
  );

  const limitFor = (key: string) => limits[key] ?? PAGE_SIZE;
  const showMore = useCallback((key: string) => setLimits(l => ({ ...l, [key]: (l[key] ?? PAGE_SIZE) + PAGE_SIZE })), []);

  const hotkeyColumns = useCallback(
    () => columns.map(c => ({ key: c.key, ids: c.deals.slice(0, limits[c.key] ?? PAGE_SIZE).map(d => d.id) })),
    [columns, limits]
  );
  useBoardHotkeys({ getColumns: hotkeyColumns, onOpen: onOpenDeal, onQuickCreate: () => undefined });

  const droppable = isGroupingDroppable(groupBy);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) {
      if (destination && destination.index !== source.index) notify('Group by Stage to reorder cards manually.');
      return;
    }
    const updates = updatesForGroupDrop(groupBy, destination.droppableId, Object.values(allDealsMap));
    if (!updates) return;
    void updateDeal(draggableId, updates).catch(() => notify('Could not update the deal'));
  };

  const makeCardContext = (deal: Deal, orderedIds: string[]): BoardCardContext => ({
    isSelected: selectedIds.includes(deal.id),
    isFocused: focusedId === deal.id,
    onSelect: () => { setFocused(deal.id); toggleSelect(deal.id); },
    onRangeSelect: () => { setFocused(deal.id); selectRange(deal.id, orderedIds); },
    indicators
  });

  return (
    <div className="relative" data-testid="grouped-board">
      {!droppable && (
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          Grouped by company: cards can be opened and selected, but moving them between groups is disabled.
        </p>
      )}
      <DragDropContext onDragEnd={handleDragEnd} sensors={sensors} enableDefaultSensors={false}>
        <div className="overflow-auto pb-4 max-h-[calc(100vh-9rem)] min-h-[600px]" data-testid="kanban-scroll">
          <div className="flex items-start gap-4">
            {columns.map(col => {
              const ordered = col.deals.map(d => d.id);
              return (
                <div key={col.key} className="w-80 flex-shrink-0">
                  <BoardColumn
                    columnKey={col.key}
                    title={col.title}
                    deals={col.deals}
                    totalInStage={col.deals.length}
                    renderLimit={limitFor(col.key)}
                    onShowMore={() => showMore(col.key)}
                    isLoading={isLoading}
                    quickCreateOpen={false}
                    onQuickCreateOpenChange={() => undefined}
                    onQuickCreate={async () => undefined}
                    renderCard={(deal) => renderCard(deal, makeCardContext(deal, ordered))}
                    dropDisabled={!droppable}
                    hideAddDeal
                    color={groupBy === 'priority' ? PRIORITY_COLORS[col.key] : undefined}
                    emptyText="No deals in this group"
                  />
                </div>
              );
            })}
            {columns.length === 0 && (
              <div className="py-16 w-full text-center text-sm text-gray-500 dark:text-gray-400">No deals to group.</div>
            )}
          </div>
        </div>
      </DragDropContext>

      <BulkActionBar onNotify={(m) => notify(m)} />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none" aria-live="polite">
          <div role="status" className="px-4 py-2 rounded-lg shadow-lg text-sm text-white bg-blue-600 pointer-events-auto">{toast}</div>
        </div>
      )}
    </div>
  );
};
