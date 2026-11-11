import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Draggable, Droppable, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { useBoardSelectionStore } from '../../store/boardSelectionStore';
import { Deal, PipelineStage } from '../../types';
import { KanbanColumnHeader } from './kanban/KanbanColumnHeader';
import { WIPLimitIndicator } from './kanban/WIPLimitIndicator';
import {
  AggregateField,
  AggregateOperation,
  aggregateDeals,
  calculateColumnAggregation,
  getStageBorderClass,
  getStageHeaderClass
} from './kanban/kanbanUtils';
import { stageColorClasses } from '../../utils/stageMeta';
import { QuickCreateDeal } from './QuickCreateDeal';
import { ColumnSkeleton } from './BoardSkeleton';

export const UNCATEGORIZED_ID = '__uncategorized__';
export const PAGE_SIZE = 25;

interface BoardColumnProps {
  columnKey: string;
  title: string;
  /** Undefined for the synthetic "Uncategorized" column. */
  stage?: PipelineStage;
  /** Filtered + sorted deals for this column. */
  deals: Deal[];
  /** Unfiltered number of deals in the stage (drives the WIP indicator). */
  totalInStage: number;
  renderLimit: number;
  onShowMore: () => void;
  isLoading: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  menu?: React.ReactNode;
  quickCreateOpen: boolean;
  onQuickCreateOpenChange: (open: boolean) => void;
  onQuickCreate: (title: string, value: number) => Promise<void>;
  renderCard: (deal: Deal) => React.ReactNode;
  /** Grouped (non stage) boards: cards can be dragged out but not dropped here. */
  dropDisabled?: boolean;
  /** Hide the "Add Deal" affordances (grouped boards). */
  hideAddDeal?: boolean;
  /** Overrides the stage colour (grouped boards). */
  color?: string;
  emptyText?: string;
}

export const BoardColumn: React.FC<BoardColumnProps> = ({
  columnKey, title, stage, deals, totalInStage, renderLimit, onShowMore, isLoading,
  dragHandleProps, menu, quickCreateOpen, onQuickCreateOpenChange, onQuickCreate, renderCard,
  dropDisabled = false, hideAddDeal = false, color, emptyText
}) => {
  const [operation, setOperation] = useState<AggregateOperation>('sum');
  const [field, setField] = useState<AggregateField>('value');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const selectedIds = useBoardSelectionStore(s => s.selectedIds);
  const isUncategorized = columnKey === UNCATEGORIZED_ID;
  const wipLimit = stage?.wipLimit && stage.wipLimit > 0 ? stage.wipLimit : undefined;

  const aggregation = useMemo(() => calculateColumnAggregation(deals), [deals]);
  const aggregateValue = useMemo(() => aggregateDeals(deals, operation, field), [deals, operation, field]);
  const shown = deals.slice(0, renderLimit);
  const hasMore = deals.length > shown.length;

  // Reveal more cards as the sentinel scrolls into view (plain IntersectionObserver)
  useEffect(() => {
    if (!hasMore) return;
    if (typeof IntersectionObserver === 'undefined') { onShowMore(); return; }
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) onShowMore();
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, shown.length, onShowMore]);

  const sc = stageColorClasses(color ?? stage?.color);
  // Custom (hex/rgb) stage colours have no Tailwind class: fall back to an inline border colour
  const border = sc.style ? '' : getStageBorderClass(color ?? stage?.color);
  const headerTint = getStageHeaderClass(color ?? stage?.color);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border-2 ${border} shadow-sm flex flex-col`}
      style={sc.style ? { borderColor: sc.style.borderColor } : undefined}
      data-column-key={columnKey}
    >
      {/* Sticky header (opaque backing so cards don't show through the tint) */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 rounded-t-xl">
        <KanbanColumnHeader
          title={title}
          aggregation={{ ...aggregation, count: wipLimit ? totalInStage : deals.length }}
          wipLimit={wipLimit}
          color={headerTint}
          operation={operation}
          field={field}
          aggregateValue={aggregateValue}
          onAggregateChange={(op, f) => { setOperation(op); setField(f); }}
          dragHandleProps={dragHandleProps}
          menu={menu}
        />
        {wipLimit && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700" title="Work-in-progress limit (hold Shift while dropping to override)">
            <WIPLimitIndicator current={totalInStage} limit={wipLimit} />
          </div>
        )}
      </div>

      <Droppable droppableId={columnKey} isDropDisabled={isUncategorized || dropDisabled}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`p-3 min-h-[200px] flex-1 space-y-3 rounded-b-xl ${
              snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            {quickCreateOpen && !isUncategorized && !hideAddDeal && (
              <QuickCreateDeal
                stageName={title}
                onCreate={onQuickCreate}
                onClose={() => onQuickCreateOpenChange(false)}
              />
            )}

            {isLoading && deals.length === 0 ? (
              <ColumnSkeleton />
            ) : (
              shown.map((deal, index) => (
                <Draggable key={deal.id} draggableId={deal.id} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={`relative ${dragSnapshot.isDragging ? 'rotate-2 shadow-xl' : ''}`}
                    >
                      {renderCard(deal)}
                      {dragSnapshot.isDragging && selectedIds.length > 1 && selectedIds.includes(deal.id) && (
                        <span
                          data-testid="multi-drag-chip"
                          className="absolute -top-2 -right-2 z-10 px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded-full shadow"
                        >
                          +{selectedIds.length - 1}
                        </span>
                      )}
                    </div>
                  )}
                </Draggable>
              ))
            )}
            {provided.placeholder}

            {!isLoading && deals.length === 0 && !snapshot.isDraggingOver && !quickCreateOpen && (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                {emptyText ?? (isUncategorized ? 'No uncategorized deals' : 'No deals in this stage')}
              </div>
            )}

            {hasMore && (
              <div ref={sentinelRef} className="py-2 text-center">
                <button
                  type="button"
                  onClick={onShowMore}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Show more ({deals.length - shown.length} remaining)
                </button>
              </div>
            )}

            {!isUncategorized && !quickCreateOpen && !hideAddDeal && (
              <button
                type="button"
                onClick={() => onQuickCreateOpenChange(true)}
                className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Deal
              </button>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};
