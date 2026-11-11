import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShiftOverride } from '../../hooks/useShiftOverride';
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
  useMouseSensor,
  useTouchSensor
} from '@hello-pangea/dnd';
import { Eye, Plus, X } from 'lucide-react';
import { Deal, PipelineStage } from '../../types';
import { useDealStore } from '../../store/dealStore';
import { useBoardSelectionStore } from '../../store/boardSelectionStore';
import { useBoardHotkeys } from '../../hooks/useBoardHotkeys';
import { useMarqueeSelection } from '../../hooks/useMarqueeSelection';
import { useStageKeyboardMove } from '../../hooks/useStageKeyboardMove';
import { dragGroup, dropSelectionOnStage } from '../../utils/multiDrag';
import { computeDropPosition, getDestinationIndex } from '../../utils/boardPositions';
import { BoardSortKey, sortDeals } from './kanban/kanbanUtils';
import { BoardColumn, PAGE_SIZE, UNCATEGORIZED_ID } from './BoardColumn';
import { StageMenu } from './StageMenu';
import { BulkActionBar } from './BulkActionBar';
import { DealCardIndicators } from '../AIEnhancedDealCard';
import type { BoardGroupBy } from '../../store/boardViewStore';
import { GroupedBoard } from './GroupedBoard';
import { usePermissions } from '../../hooks/usePermissions';
import { permissionMessage } from '../../utils/rlsError';

export interface BoardCardContext {
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onRangeSelect: () => void;
  indicators: DealCardIndicators;
}

/** Optional grouping/sorting override from the saved-view toolbar (additive; omit for the stage board). */
export interface BoardGrouping {
  groupBy: BoardGroupBy;
  /** Multi-key sort applied inside each column; when set, manual (positional) reordering is disabled. */
  sortFn?: (deals: Deal[]) => Deal[];
}

export interface KanbanBoardProps {
  /** Deals passing the active search/filters. */
  deals: Deal[];
  stages: PipelineStage[];
  sortBy: BoardSortKey;
  isLoading: boolean;
  indicators: DealCardIndicators;
  onOpenDeal: (dealId: string) => void;
  renderCard: (deal: Deal, ctx: BoardCardContext) => React.ReactNode;
  grouping?: BoardGrouping;
  /** Opens the full stage manager ("Edit all stages…" in the column menu). */
  onEditStages?: () => void;
}

type ToastType = 'info' | 'success' | 'warning' | 'error';
interface BoardToast { id: number; message: string; type: ToastType }

const TOAST_STYLES: Record<ToastType, string> = {
  info: 'bg-blue-600',
  success: 'bg-green-600',
  warning: 'bg-yellow-600',
  error: 'bg-red-600'
};

const columnDragId = (key: string) => `col:${key}`;
const sensors = [useMouseSensor, useTouchSensor];

/** Stage board by default; owner / priority / company columns when `grouping.groupBy` is not 'stage'. */
export const KanbanBoard: React.FC<KanbanBoardProps> = (props) => {
  if (props.grouping && props.grouping.groupBy !== 'stage') return <GroupedBoard {...props} />;
  return <StageBoard {...props} />;
};

const StageBoard: React.FC<KanbanBoardProps> = ({
  deals, stages, sortBy, isLoading, indicators, onOpenDeal, renderCard, grouping, onEditStages
}) => {
  const applySort = useCallback(
    (list: Deal[]) => (grouping?.sortFn ? grouping.sortFn(list) : sortDeals(list, sortBy)),
    [grouping, sortBy]
  );
  const manualOrder = sortBy === 'manual' && !grouping?.sortFn;
  const perms = usePermissions();
  const canManageStages = perms.allowed('manage_stages', 'stage');
  const allDealsMap = useDealStore(s => s.deals);
  const moveDeal = useDealStore(s => s.moveDeal);
  const bulkMoveDeals = useDealStore(s => s.bulkMoveDeals);
  const createDeal = useDealStore(s => s.createDeal);
  const updateStage = useDealStore(s => s.updateStage);
  const reorderStages = useDealStore(s => s.reorderStages);
  const removeStage = useDealStore(s => s.removeStage);
  const addStage = useDealStore(s => s.addStage);

  const selectedIds = useBoardSelectionStore(s => s.selectedIds);
  const focusedId = useBoardSelectionStore(s => s.focusedId);
  const toggleSelect = useBoardSelectionStore(s => s.toggleSelect);
  const selectRange = useBoardSelectionStore(s => s.selectRange);
  const setFocused = useBoardSelectionStore(s => s.setFocused);

  const [limits, setLimits] = useState<Record<string, number>>({});
  const [quickCreateKey, setQuickCreateKey] = useState<string | null>(null);
  const [toasts, setToasts] = useState<BoardToast[]>([]);
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const toastId = useRef(0);
  const isShiftHeld = useShiftOverride();

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, message, type }]);
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);
  const visibleStages = useMemo(() => sortedStages.filter(s => s.visible), [sortedStages]);
  const hiddenStages = useMemo(() => sortedStages.filter(s => !s.visible), [sortedStages]);

  // Columns: visible stages + synthetic Uncategorized for deals whose stage isn't visible
  const { columns, uncategorized } = useMemo(() => {
    const visibleKeys = new Set(visibleStages.map(s => s.key));
    const byStage: Record<string, Deal[]> = {};
    const orphans: Deal[] = [];
    deals.forEach(d => {
      if (visibleKeys.has(d.stage)) (byStage[d.stage] ||= []).push(d);
      else orphans.push(d);
    });
    return {
      columns: visibleStages.map(stage => ({ stage, deals: applySort(byStage[stage.key] ?? []) })),
      uncategorized: applySort(orphans)
    };
  }, [deals, visibleStages, applySort]);

  const limitFor = (key: string) => limits[key] ?? PAGE_SIZE;
  const showMore = useCallback((key: string) => {
    setLimits(l => ({ ...l, [key]: (l[key] ?? PAGE_SIZE) + PAGE_SIZE }));
  }, []);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(allDealsMap).forEach(d => { counts[d.stage] = (counts[d.stage] ?? 0) + 1; });
    return counts;
  }, [allDealsMap]);

  // Keyboard navigation works on what is actually rendered
  const hotkeyColumns = useCallback(() => {
    const cols = columns.map(c => ({ key: c.stage.key, ids: c.deals.slice(0, limitFor(c.stage.key)).map(d => d.id) }));
    if (uncategorized.length > 0) cols.push({ key: UNCATEGORIZED_ID, ids: uncategorized.slice(0, limitFor(UNCATEGORIZED_ID)).map(d => d.id) });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, uncategorized, limits]);

  const moveByKeyboard = useStageKeyboardMove(notify);
  useBoardHotkeys({
    getColumns: hotkeyColumns,
    onOpen: onOpenDeal,
    onQuickCreate: (key) => { if (key !== UNCATEGORIZED_ID) setQuickCreateKey(key); },
    onMoveStage: (dir, ids) => void moveByKeyboard(dir, ids)
  });

  // Drag-rectangle selection on the board background
  const scrollRef = useRef<HTMLDivElement>(null);
  const marquee = useMarqueeSelection(scrollRef);

  // Drop selection entries for deals that vanished (deleted/moved by realtime)
  const clearSelection = useBoardSelectionStore(s => s.clearSelection);
  useEffect(() => {
    if (focusedId && !allDealsMap[focusedId]) setFocused(null);
  }, [allDealsMap, focusedId, setFocused]);
  useEffect(() => () => clearSelection(), [clearSelection]);

  // ---- stage ordering -----------------------------------------------------
  const applyVisibleOrder = (newVisibleKeys: string[]) => {
    const visibleSet = new Set(visibleStages.map(s => s.key));
    let i = 0;
    const merged = sortedStages.map(s => (visibleSet.has(s.key) ? newVisibleKeys[i++] : s.key));
    void reorderStages(merged);
  };

  const moveStage = (key: string, dir: -1 | 1) => {
    const keys = visibleStages.map(s => s.key);
    const from = keys.indexOf(key);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= keys.length) return;
    [keys[from], keys[to]] = [keys[to], keys[from]];
    applyVisibleOrder(keys);
  };

  // ---- drag & drop --------------------------------------------------------
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;

    if (type === 'COLUMN') {
      if (destination.index === source.index) return;
      if (!canManageStages) { notify(permissionMessage('manage_stages', 'stage'), 'error'); return; }
      const keys = visibleStages.map(s => s.key);
      const [moved] = keys.splice(source.index, 1);
      keys.splice(destination.index, 0, moved);
      applyVisibleOrder(keys);
      return;
    }

    const sameColumn = destination.droppableId === source.droppableId;
    if (sameColumn && destination.index === source.index) return;

    const deal = allDealsMap[draggableId];
    const destStage = visibleStages.find(s => s.key === destination.droppableId);
    if (!deal || !destStage) return;
    if (!perms.allowed('edit', 'deal', deal)) { notify("You don't have permission to move this deal", 'error'); return; }

    // Multi-card drag: dragging a selected card carries the whole selection to the target stage
    const group = dragGroup(draggableId, useBoardSelectionStore.getState().selectedIds, allDealsMap);
    if (group.length > 1) {
      if (!perms.canAll('edit', 'deal', group.map(id => allDealsMap[id])).allowed) {
        notify("You don't have permission to move all of these deals", 'error');
        return;
      }
      if (!sameColumn) {
        void dropSelectionOnStage(group, destStage.key, {
          stages: visibleStages, deals: allDealsMap, bulkMoveDeals, notify, override: isShiftHeld()
        });
        return;
      }
      // dropping inside the same column only reorders the dragged card (below)
    }

    // WIP limit: block unless Shift is held (same-column reorders never change the count)
    if (!sameColumn && destStage.wipLimit && destStage.wipLimit > 0) {
      const inDest = Object.values(allDealsMap).filter(d => d.stage === destStage.key && d.id !== deal.id).length;
      if (inDest >= destStage.wipLimit) {
        if (!isShiftHeld()) {
          notify(`${destStage.name} is at its WIP limit (${destStage.wipLimit}). Hold Shift while dropping to override.`, 'warning');
          return;
        }
        notify(`${destStage.name} exceeds its WIP limit of ${destStage.wipLimit}.`, 'info');
      }
    }

    const destAll = sortDeals(Object.values(allDealsMap).filter(d => d.stage === destStage.key && d.id !== deal.id), 'manual');

    if (!manualOrder) {
      if (sameColumn) {
        notify('Switch sorting to "Manual order" to reorder cards within a column.', 'info');
        return;
      }
      // Cards are displayed sorted, so a precise slot is meaningless: append
      void moveDeal(deal.id, destStage.key, computeDropPosition(destAll.map(d => d.position ?? 0), destAll.length));
      return;
    }

    const destVisible = (columns.find(c => c.stage.key === destStage.key)?.deals ?? []).filter(d => d.id !== deal.id);
    const index = getDestinationIndex(destVisible.map(d => d.id), destAll.map(d => d.id), destination.index);
    const position = computeDropPosition(destAll.map(d => d.position ?? 0), index);
    void moveDeal(deal.id, destStage.key, position);
  };

  const handleAddStage = async () => {
    const created = await addStage(newStageName);
    if (created) {
      setNewStageName('');
      setAddingStage(false);
    } else {
      notify('Could not add stage', 'error');
    }
  };

  const makeCardContext = (deal: Deal, orderedIds: string[]): BoardCardContext => ({
    isSelected: selectedIds.includes(deal.id),
    isFocused: focusedId === deal.id,
    onSelect: () => { setFocused(deal.id); toggleSelect(deal.id); },
    onRangeSelect: () => { setFocused(deal.id); selectRange(deal.id, orderedIds); },
    indicators
  });

  const renderColumnCards = (list: Deal[]) => {
    const orderedIds = list.map(d => d.id);
    return (deal: Deal) => renderCard(deal, makeCardContext(deal, orderedIds));
  };

  return (
    <div className="relative">
      {hiddenStages.length > 0 && (
        <div className="flex justify-end mb-2 relative">
          <button
            type="button"
            onClick={() => setHiddenOpen(o => !o)}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-haspopup="true"
            aria-expanded={hiddenOpen}
          >
            <Eye className="w-4 h-4" />
            <span>{hiddenStages.length} hidden stage{hiddenStages.length === 1 ? '' : 's'}</span>
          </button>
          {hiddenOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
              {hiddenStages.map(s => (
                <div key={s.key} className="flex items-center justify-between px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200">
                  <span className="truncate">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => { void updateStage(s.key, { visible: true }); setHiddenOpen(false); }}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Show
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd} sensors={sensors} enableDefaultSensors={false}>
        <div
          ref={scrollRef}
          onMouseDown={marquee.onMouseDown}
          className="overflow-auto pb-4 max-h-[calc(100vh-9rem)] min-h-[600px]"
          data-testid="kanban-scroll"
        >
          <div className="flex items-start gap-4 relative">
            {marquee.rect && (
              <div
                aria-hidden
                data-testid="marquee-rect"
                className="absolute z-20 pointer-events-none rounded-sm border border-blue-600 bg-blue-600/10"
                style={{ left: marquee.rect.left, top: marquee.rect.top, width: marquee.rect.right - marquee.rect.left, height: marquee.rect.bottom - marquee.rect.top }}
              />
            )}
            <Droppable droppableId="board-columns" type="COLUMN" direction="horizontal">
              {(boardProvided) => (
                <div ref={boardProvided.innerRef} {...boardProvided.droppableProps} className="flex items-start gap-4">
                  {columns.map(({ stage, deals: colDeals }, index) => (
                    <Draggable key={stage.key} draggableId={columnDragId(stage.key)} index={index} isDragDisabled={!canManageStages}>
                      {(colProvided) => (
                        <div
                          ref={colProvided.innerRef}
                          {...colProvided.draggableProps}
                          className="w-80 flex-shrink-0"
                        >
                          <BoardColumn
                            columnKey={stage.key}
                            title={stage.name}
                            stage={stage}
                            deals={colDeals}
                            totalInStage={stageCounts[stage.key] ?? 0}
                            renderLimit={limitFor(stage.key)}
                            onShowMore={() => showMore(stage.key)}
                            isLoading={isLoading}
                            dragHandleProps={colProvided.dragHandleProps}
                            quickCreateOpen={quickCreateKey === stage.key}
                            onQuickCreateOpenChange={(open) => setQuickCreateKey(open ? stage.key : null)}
                            onQuickCreate={async (title, value) => {
                              await createDeal({
                                title,
                                company: '',
                                contact: '',
                                value,
                                stage: stage.key,
                                probability: stage.probability,
                                priority: 'medium'
                              });
                              notify(`Added "${title}" to ${stage.name}`, 'success');
                            }}
                            renderCard={renderColumnCards(colDeals)}
                            menu={!canManageStages ? undefined : (
                              <StageMenu
                                stage={stage}
                                otherStages={sortedStages.filter(s => s.key !== stage.key)}
                                canMoveLeft={index > 0}
                                canMoveRight={index < columns.length - 1}
                                dealCount={stageCounts[stage.key] ?? 0}
                                onRename={(name) => void updateStage(stage.key, { name })}
                                onColor={(color) => void updateStage(stage.key, { color })}
                                onWipLimit={(limit) => void updateStage(stage.key, { wipLimit: limit })}
                                onProbability={(probability) => void updateStage(stage.key, { probability })}
                                onOutcome={(o) => void updateStage(stage.key, { isWon: o === 'won', isLost: o === 'lost' })}
                                onEditAll={onEditStages}
                                onHide={() => void updateStage(stage.key, { visible: false })}
                                onMove={(dir) => moveStage(stage.key, dir)}
                                onDelete={async (moveTo) => {
                                  const ok = await removeStage(stage.key, moveTo);
                                  notify(ok ? `Deleted stage "${stage.name}"` : 'Could not delete stage', ok ? 'success' : 'error');
                                }}
                              />
                            )}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {boardProvided.placeholder}
                </div>
              )}
            </Droppable>

            {uncategorized.length > 0 && (
              <div className="w-80 flex-shrink-0">
                <BoardColumn
                  columnKey={UNCATEGORIZED_ID}
                  title="Uncategorized"
                  deals={uncategorized}
                  totalInStage={uncategorized.length}
                  renderLimit={limitFor(UNCATEGORIZED_ID)}
                  onShowMore={() => showMore(UNCATEGORIZED_ID)}
                  isLoading={isLoading}
                  quickCreateOpen={false}
                  onQuickCreateOpenChange={() => undefined}
                  onQuickCreate={async () => undefined}
                  renderCard={renderColumnCards(uncategorized)}
                />
              </div>
            )}

            {/* Add stage */}
            {canManageStages && <div className="w-72 flex-shrink-0">
              {addingStage ? (
                <div className="p-3 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl space-y-2">
                  <input
                    autoFocus
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void handleAddStage(); }
                      if (e.key === 'Escape') { setAddingStage(false); setNewStageName(''); }
                    }}
                    placeholder="Stage name"
                    aria-label="New stage name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => { setAddingStage(false); setNewStageName(''); }}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      aria-label="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAddStage()}
                      disabled={!newStageName.trim()}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                    >
                      Add stage
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingStage(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add stage
                </button>
              )}
            </div>}
          </div>
        </div>
      </DragDropContext>

      <BulkActionBar onNotify={notify} />

      {/* Toasts */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 space-y-2 pointer-events-none" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} role="status" className={`px-4 py-2 rounded-lg shadow-lg text-sm text-white pointer-events-auto ${TOAST_STYLES[t.type]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
};
