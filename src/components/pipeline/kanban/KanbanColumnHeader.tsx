import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, ChevronDown, AlertTriangle } from 'lucide-react';
import {
  AGGREGATE_FIELDS,
  AGGREGATE_OPERATIONS,
  AggregateField,
  AggregateOperation,
  formatAggregate
} from './kanbanUtils';
import { formatCurrency } from '../../../utils/formatters';

export interface ColumnAggregation {
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

export interface KanbanColumnHeaderProps {
  title: string;
  aggregation: ColumnAggregation;
  wipLimit?: number;
  color: string;
  onEdit?: () => void;
  /** Selected aggregate (defaults to sum of value, computed from `aggregation`). */
  operation?: AggregateOperation;
  field?: AggregateField;
  /** Pre-computed aggregate for operation/field; falls back to `aggregation.sum`. */
  aggregateValue?: number;
  onAggregateChange?: (operation: AggregateOperation, field: AggregateField) => void;
  /** Spread onto the grip so the whole column can be dragged by its header. */
  dragHandleProps?: React.HTMLAttributes<HTMLElement> | null;
  /** Slot for the stage manage menu. */
  menu?: React.ReactNode;
  /** Highlights the header as an invalid/valid drop target. */
  className?: string;
}

/**
 * Kanban column header: title, count / WIP badge and a configurable aggregate
 * (count, sum, avg, min, max over value or probability).
 */
export const KanbanColumnHeader: React.FC<KanbanColumnHeaderProps> = ({
  title,
  aggregation,
  wipLimit,
  color,
  onEdit,
  operation = 'sum',
  field = 'value',
  aggregateValue,
  onAggregateChange,
  dragHandleProps,
  menu,
  className = ''
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const isOverLimit = !!wipLimit && aggregation.count > wipLimit;
  const atLimit = !!wipLimit && aggregation.count >= wipLimit;

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  const value = aggregateValue ?? aggregation.sum;
  const opLabel = AGGREGATE_OPERATIONS.find(o => o.id === operation)?.label ?? 'Sum';
  const fieldLabel = AGGREGATE_FIELDS.find(f => f.id === field)?.label ?? 'Value';
  const selectClass =
    'w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white';

  return (
    <div className={`p-4 border-b border-gray-200 dark:border-gray-700 rounded-t-xl ${color} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2 min-w-0">
          {dragHandleProps && (
            <span
              {...dragHandleProps}
              aria-label={`Drag column ${title}`}
              className="cursor-grab text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <GripVertical className="w-4 h-4" />
            </span>
          )}
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{title}</h3>
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              aria-label={`Edit ${title}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`px-2 py-1 rounded-md text-xs font-medium ${
              isOverLimit
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                : atLimit
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {aggregation.count}
            {wipLimit ? ` / ${wipLimit}` : ''}
          </span>
          {isOverLimit && <AlertTriangle className="w-4 h-4 text-red-500" />}
          {menu}
        </div>
      </div>

      {/* Aggregate (count / sum / avg / min / max over value or probability) */}
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => onAggregateChange && setPickerOpen(o => !o)}
          className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          aria-label="Change column aggregate"
          aria-haspopup="true"
          aria-expanded={pickerOpen}
        >
          <span>{operation === 'count' ? 'Count' : `${opLabel} of ${fieldLabel}`}:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {onAggregateChange || aggregateValue !== undefined ? formatAggregate(value, operation, field) : formatCurrency(value)}
          </span>
          {onAggregateChange && <ChevronDown className="w-3 h-3" />}
        </button>
        {pickerOpen && onAggregateChange && (
          <div className="absolute left-0 top-full mt-1 z-30 w-48 p-3 space-y-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              Operation
              <select
                value={operation}
                onChange={(e) => onAggregateChange(e.target.value as AggregateOperation, field)}
                className={`${selectClass} mt-1`}
              >
                {AGGREGATE_OPERATIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              Field
              <select
                value={field}
                disabled={operation === 'count'}
                onChange={(e) => onAggregateChange(operation, e.target.value as AggregateField)}
                className={`${selectClass} mt-1 disabled:opacity-50`}
              >
                {AGGREGATE_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
