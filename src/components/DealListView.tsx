import React, { useMemo } from 'react';
import { Deal } from '../types';
import {
  DollarSign, Calendar, TrendingUp, Building2, User,
  ChevronDown, ChevronUp, Star, Sparkles, ArrowUpDown
} from 'lucide-react';
import { useBoardViewStore } from '../store/boardViewStore';
import { useStageMeta } from '../utils/stageUtils';
import { formatMoneyCompact, totalsOf } from '../utils/viewDeals';
import { useViewSelection } from '../hooks/useViewSelection';
import { BulkActionBar } from './pipeline/BulkActionBar';
import { usePermissions } from '../hooks/usePermissions';
import { useViewToasts } from './pipeline/ViewToasts';
import {
  CompanyCell, DateCell, NumberCell, OwnerCell, PriorityCell, StageCell, TextCell,
  DealEditScope
} from './pipeline/cells/DealCells';

export interface DealListViewProps {
  /** Filtered AND sorted deals (Pipeline's single `viewDeals`). */
  deals: Deal[];
  onDealClick: (dealId: string) => void;
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => Promise<unknown> | void;
  isFiltered?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const SORTS: Array<{ field: string; label: string; dir: 'asc' | 'desc' }> = [
  { field: 'title', label: 'Title', dir: 'asc' },
  { field: 'company', label: 'Company', dir: 'asc' },
  { field: 'value', label: 'Value', dir: 'desc' },
  { field: 'probability', label: 'Probability', dir: 'desc' },
  { field: 'updatedAt', label: 'Updated', dir: 'desc' }
];

export const DealListView: React.FC<DealListViewProps> = ({ deals, onDealClick, onDealUpdate, isFiltered = false }) => {
  const { stages } = useStageMeta();
  const perms = usePermissions();
  const sorting = useBoardViewStore(s => s.sorting);
  const toggleSortField = useBoardViewStore(s => s.toggleSortField);
  const tableColumns = useBoardViewStore(s => s.tableColumns);
  const { notify, toastsNode } = useViewToasts();
  const orderedIds = useMemo(() => deals.map(d => d.id), [deals]);
  const sel = useViewSelection(orderedIds, { onOpen: onDealClick, notify });
  const totals = useMemo(() => totalsOf(deals), [deals]);

  // The list shares the table's column choice for its optional fields
  const show = (key: string) => tableColumns.some(c => c.key === key && c.visible);
  const activeSort = sorting[0];

  const SortButton: React.FC<{ s: typeof SORTS[number] }> = ({ s }) => {
    const active = !!activeSort && activeSort.field === s.field;
    return (
      <button
        onClick={() => toggleSortField(s.field, s.dir)}
        className="flex items-center space-x-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <span>{s.label}</span>
        {active ? (activeSort.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    );
  };

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No deals found</h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
          {isFiltered ? 'Try adjusting your search or filter criteria' : 'Get started by creating your first deal'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="deal-list-view">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-6">
          <input
            type="checkbox"
            aria-label="Select all deals"
            checked={sel.allSelected}
            onChange={sel.toggleAll}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          />
          {SORTS.map(s => <SortButton key={s.field} s={s} />)}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {deals.length} deal{deals.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-2">
        {deals.map((deal) => {
          const save = (updates: Partial<Deal>) => onDealUpdate(deal.id, updates);
          const isSel = sel.selected.has(deal.id);
          return (
            <DealEditScope key={deal.id} deal={deal}>
            <div
              data-deal-id={deal.id}
              aria-selected={isSel}
              onClick={() => onDealClick(deal.id)}
              className={`rounded-lg border hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group ${
                isSel ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              } ${sel.focusedId === deal.id ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start flex-1 min-w-0 pr-4">
                    <input
                      type="checkbox"
                      aria-label={`Select ${deal.title ?? deal.company}`}
                      checked={isSel}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => sel.select(deal.id, { shiftKey: (e.nativeEvent as MouseEvent).shiftKey })}
                      className="w-4 h-4 mt-2 mr-3 flex-shrink-0 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <TextCell
                          label="Title"
                          value={deal.title ?? ''}
                          required
                          onCommit={v => save({ title: v })}
                          className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate"
                          display={v => v || <span className="text-gray-400">Untitled</span>}
                        />
                        {deal.isFavorite && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                        {deal.aiScore && deal.aiScore > 0 && (
                          <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full flex-shrink-0">
                            <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{deal.aiScore}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <Building2 className="w-4 h-4 flex-shrink-0" />
                          <div className="min-w-0 flex-1 truncate"><CompanyCell deal={deal} onSave={save} /></div>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <User className="w-4 h-4 flex-shrink-0" />
                          <TextCell label="Contact" value={deal.contact ?? ''} onCommit={v => save({ contact: v })} className="truncate"
                            display={v => v || <span className="text-gray-400">-</span>} />
                        </div>
                        <div className="flex items-center space-x-2 text-sm font-medium text-gray-900 dark:text-white">
                          <DollarSign className="w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                          <NumberCell label="Value" value={deal.value} onCommit={v => save({ value: v })} display={formatCurrency} />
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <TrendingUp className="w-4 h-4 flex-shrink-0" />
                          <NumberCell label="Win probability" value={deal.probability} integer min={0} max={100}
                            onCommit={v => save({ probability: v })} display={v => `${v}% probability`} />
                        </div>
                        {show('owner') && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                            <User className="w-4 h-4 flex-shrink-0" />
                            <div className="min-w-0 flex-1"><OwnerCell deal={deal} onSave={save} /></div>
                          </div>
                        )}
                        {show('priority') && (
                          <div className="flex items-center text-sm"><PriorityCell label="Priority" value={deal.priority} onCommit={v => save({ priority: v })} /></div>
                        )}
                        {show('closeDate') && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="w-4 h-4 flex-shrink-0" />
                            <DateCell label="Close date" value={deal.closeDate} onCommit={d => save({ closeDate: d ?? undefined })} placeholder="Close date" />
                          </div>
                        )}
                        {show('dueDate') && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="w-4 h-4 flex-shrink-0" />
                            <DateCell label="Due date" value={deal.dueDate} onCommit={d => save({ dueDate: d ?? undefined })} placeholder="Due date" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); void onDealUpdate(deal.id, { isFavorite: !deal.isFavorite }); }}
                      aria-label={deal.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      disabled={!perms.allowed('edit', 'deal', deal)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Star className={`w-5 h-5 ${deal.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400 dark:text-gray-600'}`} />
                    </button>
                    <StageCell label="Stage" value={deal.stage} stages={stages} onCommit={v => save({ stage: v })}
                      chipBase="px-3 py-1 inline-flex rounded-full text-xs font-medium" />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span>Updated {formatDate(deal.updatedAt)}</span>
                  </div>
                  {deal.notes && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-md">
                      {deal.notes.length > 100 ? `${deal.notes.substring(0, 100)}...` : deal.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </DealEditScope>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-testid="list-footer">
        <span className="text-sm text-gray-600 dark:text-gray-400">{totals.count} deal{totals.count !== 1 ? 's' : ''}</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">Total: {formatMoneyCompact(totals.sum)}</span>
      </div>

      <BulkActionBar onNotify={notify} />
      {toastsNode}
    </div>
  );
};
