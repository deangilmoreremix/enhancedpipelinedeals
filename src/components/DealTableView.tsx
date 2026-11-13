import { useDealStore } from '../store/dealStore';
import { toastFailure } from '../utils/permissionToast';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Deal } from '../types';
import {
  DollarSign, ChevronDown, ChevronUp, Star, Sparkles,
  ExternalLink, ArrowUpDown, Columns3, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  TABLE_COLUMN_LABELS, TableColumnConfig, TableColumnKey, useBoardViewStore
} from '../store/boardViewStore';
import { useStageMeta } from '../utils/stageUtils';
import { SORT_FIELD_FOR_COLUMN } from '../utils/viewDeals';
import {
  AGGREGATE_FIELDS, AGGREGATE_OPERATIONS, AggregateField, AggregateOperation,
  aggregateDeals, formatAggregate
} from './pipeline/kanban/kanbanUtils';
import { useViewSelection } from '../hooks/useViewSelection';
import { BulkActionBar } from './pipeline/BulkActionBar';
import { usePermissions } from '../hooks/usePermissions';
import { useViewToasts } from './pipeline/ViewToasts';
import {
  CompanyCell, DateCell, NumberCell, OwnerCell, PriorityCell, StageCell, TextCell,
  DealEditScope
} from './pipeline/cells/DealCells';

export interface DealTableViewProps {
  /** Filtered AND sorted deals (Pipeline's single `viewDeals`). */
  deals: Deal[];
  onDealClick: (dealId: string) => void;
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => Promise<unknown> | void;
  /** True when search/filters are narrowing the list (empty-state copy). */
  isFiltered?: boolean;
}

const SORTABLE: TableColumnKey[] = ['title', 'company', 'contact', 'owner', 'value', 'stage', 'priority', 'probability', 'closeDate', 'dueDate', 'updated', 'aiScore'];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const th = 'px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider';

export const DealTableView: React.FC<DealTableViewProps> = ({ deals, onDealClick, onDealUpdate, isFiltered = false }) => {
  const { stages, meta } = useStageMeta();
  const perms = usePermissions();
  const tableColumns = useBoardViewStore(s => s.tableColumns);
  const sorting = useBoardViewStore(s => s.sorting);
  const toggleSortField = useBoardViewStore(s => s.toggleSortField);
  const toggleTableColumn = useBoardViewStore(s => s.toggleTableColumn);
  const moveTableColumn = useBoardViewStore(s => s.moveTableColumn);
  const setTableColumnWidth = useBoardViewStore(s => s.setTableColumnWidth);

  const { notify, toastsNode } = useViewToasts();
  const orderedIds = useMemo(() => deals.map(d => d.id), [deals]);
  const sel = useViewSelection(orderedIds, { onOpen: onDealClick, notify });

  const [columnsOpen, setColumnsOpen] = useState(false);
  const [aggOp, setAggOp] = useState<AggregateOperation>('sum');
  const [aggField, setAggField] = useState<AggregateField>('value');
  const [subtotals, setSubtotals] = useState(false);
  const [resizing, setResizing] = useState<{ key: TableColumnKey; width: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnsOpen) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setColumnsOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [columnsOpen]);

  const visibleColumns = useMemo(() => tableColumns.filter(c => c.visible), [tableColumns]);
  const activeSort = sorting.length > 0 ? sorting[0] : null;

  const save = (deal: Deal) => (updates: Partial<Deal>) => onDealUpdate(deal.id, updates);

  const startResize = (e: React.MouseEvent, col: TableColumnConfig) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const th = (e.currentTarget as HTMLElement).closest('th');
    const startWidth = col.width ?? th?.getBoundingClientRect().width ?? 140;
    let last = startWidth;
    const move = (ev: MouseEvent) => {
      last = Math.max(60, Math.round(startWidth + ev.clientX - startX));
      setResizing({ key: col.key, width: last });
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      setResizing(null);
      setTableColumnWidth(col.key, last);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const widthOf = (c: TableColumnConfig) => (resizing?.key === c.key ? resizing.width : c.width);

  const renderHeader = (col: TableColumnConfig) => {
    const label = TABLE_COLUMN_LABELS[col.key];
    const field = SORT_FIELD_FOR_COLUMN[col.key];
    const sortable = SORTABLE.includes(col.key);
    const isActive = !!activeSort && activeSort.field === field;
    const w = widthOf(col);
    return (
      <th
        key={col.key}
        style={w ? { width: w, minWidth: w, maxWidth: w } : undefined}
        aria-sort={isActive ? (activeSort!.direction === 'asc' ? 'ascending' : 'descending') : undefined}
        onClick={sortable ? () => toggleSortField(field, col.key === 'title' || col.key === 'company' || col.key === 'contact' || col.key === 'owner' ? 'asc' : 'desc') : undefined}
        className={`relative ${th} ${sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors' : ''}`}
      >
        <div className="flex items-center space-x-1">
          <span>{label}</span>
          {sortable && (isActive
            ? (activeSort!.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)
            : <ArrowUpDown className="w-3 h-3 opacity-40" />)}
        </div>
        <span
          role="separator"
          aria-label={`Resize ${label}`}
          onMouseDown={(e) => startResize(e, col)}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400/60"
        />
      </th>
    );
  };

  const renderCell = (col: TableColumnConfig, deal: Deal) => {
    const s = save(deal);
    const w = widthOf(col);
    const cellStyle = w ? { width: w, minWidth: w, maxWidth: w } : undefined;
    let body: React.ReactNode;
    switch (col.key) {
      case 'title':
        body = (
          <TextCell label="Title" value={deal.title ?? ''} required onCommit={v => s({ title: v })}
            className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs"
            display={v => v || <span className="text-gray-400">Untitled</span>} />
        );
        break;
      case 'company':
        body = <div className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs"><CompanyCell deal={deal} onSave={s} /></div>;
        break;
      case 'contact':
        body = (
          <TextCell label="Contact" value={deal.contact ?? ''} onCommit={v => s({ contact: v })}
            className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs"
            display={v => v || <span className="text-gray-400">-</span>} />
        );
        break;
      case 'owner':
        body = <div className="text-sm text-gray-600 dark:text-gray-400"><OwnerCell deal={deal} onSave={s} /></div>;
        break;
      case 'value':
        body = (
          <NumberCell label="Value" value={deal.value} onCommit={v => s({ value: v })}
            className="text-sm font-medium text-gray-900 dark:text-white" display={formatCurrency} />
        );
        break;
      case 'stage':
        body = <StageCell label="Stage" value={deal.stage} stages={stages} onCommit={v => s({ stage: v })} />;
        break;
      case 'priority':
        body = <PriorityCell label="Priority" value={deal.priority} onCommit={v => s({ priority: v })} />;
        break;
      case 'probability':
        body = (
          <NumberCell label="Win probability" value={deal.probability} integer min={0} max={100}
            onCommit={v => s({ probability: v })} className="text-sm text-gray-900 dark:text-white"
            display={v => `${v}%`} />
        );
        break;
      case 'closeDate':
        body = <DateCell label="Close date" value={deal.closeDate} onCommit={d => s({ closeDate: d ?? undefined })} className="text-sm text-gray-600 dark:text-gray-400" />;
        break;
      case 'dueDate':
        body = <DateCell label="Due date" value={deal.dueDate} onCommit={d => s({ dueDate: d ?? undefined })} className="text-sm text-gray-600 dark:text-gray-400" />;
        break;
      case 'updated':
        body = <div className="text-sm text-gray-600 dark:text-gray-400">{formatDate(deal.updatedAt)}</div>;
        break;
      case 'aiScore':
        body = deal.aiScore && deal.aiScore > 0 ? (
          <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full w-fit">
            <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{deal.aiScore}</span>
          </div>
        ) : <span className="text-xs text-gray-400 dark:text-gray-600">-</span>;
        break;
      default:
        body = null;
    }
    return (
      <td key={col.key} style={cellStyle} className="px-4 py-4 whitespace-nowrap overflow-hidden text-ellipsis">
        <DealEditScope deal={deal}>{body}</DealEditScope>
      </td>
    );
  };

  const toggleFavorite = (e: React.MouseEvent, deal: Deal) => {
    e.stopPropagation();
    void useDealStore.getState().toggleFavorite(deal.id).catch(err => toastFailure(err, 'edit', 'deal', 'Could not update favorite'));
  };

  // ---- aggregates ------------------------------------------------------------
  const aggregateScope = sel.selectedIds.length > 0 ? deals.filter(d => sel.selected.has(d.id)) : deals;
  const aggregateValue = aggregateDeals(aggregateScope, aggOp, aggField);
  const stageSubtotals = useMemo(() => {
    if (!subtotals) return [];
    const byStage = new Map<string, Deal[]>();
    deals.forEach(d => byStage.set(d.stage, [...(byStage.get(d.stage) ?? []), d]));
    return [...byStage.entries()]
      .map(([key, list]) => ({ key, m: meta(key), count: list.length, value: aggregateDeals(list, aggOp, aggField) }))
      .sort((a, b) => a.m.position - b.m.position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotals, deals, aggOp, aggField, stages]);

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <DollarSign className="w-8 h-8 text-gray-400 dark:text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No deals found</h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
          {isFiltered ? 'Try adjusting your search or filter criteria' : 'Get started by creating your first deal'}
        </p>
      </div>
    );
  }

  const selectClass = 'px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white';

  return (
    <div className="space-y-4" data-testid="deal-table-view">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
          {sel.selectedIds.length > 0 ? `${sel.selectedIds.length} of ${deals.length} selected` : ' '}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setColumnsOpen(o => !o)}
            aria-haspopup="true"
            aria-expanded={columnsOpen}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Columns3 className="w-4 h-4" /><span>Columns</span>
          </button>
          {columnsOpen && (
            <div role="menu" aria-label="Choose columns" className="absolute right-0 top-full mt-1 z-30 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
              {tableColumns.map((c, i) => (
                <div key={c.key} className="flex items-center justify-between px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200">
                  <label className="flex items-center space-x-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={c.visible}
                      onChange={() => toggleTableColumn(c.key)}
                      aria-label={`Show ${TABLE_COLUMN_LABELS[c.key]}`}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="truncate">{TABLE_COLUMN_LABELS[c.key]}</span>
                  </label>
                  <div className="flex items-center">
                    <button type="button" disabled={i === 0} onClick={() => moveTableColumn(c.key, -1)} aria-label={`Move ${TABLE_COLUMN_LABELS[c.key]} up`} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" disabled={i === tableColumns.length - 1} onClick={() => moveTableColumn(c.key, 1)} aria-label={`Move ${TABLE_COLUMN_LABELS[c.key]} down`} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all deals"
                    checked={sel.allSelected}
                    onChange={sel.toggleAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </th>
                <th className={th}>Favorite</th>
                {visibleColumns.map(renderHeader)}
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {deals.map((deal) => {
                const isSel = sel.selected.has(deal.id);
                const isFocused = sel.focusedId === deal.id;
                return (
                  <tr
                    key={deal.id}
                    data-deal-id={deal.id}
                    aria-selected={isSel}
                    onClick={() => onDealClick(deal.id)}
                    className={`cursor-pointer transition-colors ${
                      isSel ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    } ${isFocused ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${deal.title ?? deal.company}`}
                        checked={isSel}
                        onChange={(e) => sel.select(deal.id, { shiftKey: (e.nativeEvent as MouseEvent).shiftKey })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => toggleFavorite(e, deal)}
                        disabled={!perms.allowed('edit', 'deal', deal)}
                        aria-label={deal.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                      >
                        <Star className={`w-4 h-4 ${deal.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400 dark:text-gray-600'}`} />
                      </button>
                    </td>
                    {visibleColumns.map(c => renderCell(c, deal))}
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onDealClick(deal.id)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                          title="View details"
                          aria-label={`Open ${deal.title ?? deal.company}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2" data-testid="table-footer">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {deals.length} deal{deals.length !== 1 ? 's' : ''}
            {sel.selectedIds.length > 0 && ` · ${sel.selectedIds.length} selected`}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="sr-only" htmlFor="agg-op">Aggregate</label>
            <select id="agg-op" aria-label="Aggregate operation" value={aggOp} onChange={(e) => setAggOp(e.target.value as AggregateOperation)} className={selectClass}>
              {AGGREGATE_OPERATIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {aggOp !== 'count' && (
              <select aria-label="Aggregate field" value={aggField} onChange={(e) => setAggField(e.target.value as AggregateField)} className={selectClass}>
                {AGGREGATE_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            )}
            <span className="font-medium text-gray-900 dark:text-white" data-testid="table-aggregate">
              {sel.selectedIds.length > 0 ? 'Selected: ' : 'Total: '}{formatAggregate(aggregateValue, aggOp, aggField)}
            </span>
            <label className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={subtotals} onChange={(e) => setSubtotals(e.target.checked)} className="w-4 h-4 text-blue-600 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700" />
              <span>By stage</span>
            </label>
          </div>
        </div>
        {subtotals && (
          <ul className="flex flex-wrap gap-2" aria-label="Stage subtotals">
            {stageSubtotals.map(r => (
              <li key={r.key} className="flex items-center space-x-2 px-2 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs">
                <span className="font-medium text-gray-700 dark:text-gray-200">{r.m.name}</span>
                <span className="text-gray-500 dark:text-gray-400">{r.count} · {formatAggregate(r.value, aggOp, aggField)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BulkActionBar onNotify={notify} />
      {toastsNode}
    </div>
  );
};
