import React from 'react';
import { formatCurrency } from '../../utils/formatters';

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
}

/**
 * Enhanced Kanban Column Header with aggregation metrics and WIP limits
 */
export const KanbanColumnHeader: React.FC<KanbanColumnHeaderProps> = ({
  title,
  aggregation,
  wipLimit,
  color,
  onEdit
}) => {
  const isOverLimit = wipLimit && aggregation.count > wipLimit;

  return (
    <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${color}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-md text-xs font-medium ${
            isOverLimit
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {aggregation.count}
            {wipLimit && ` / ${wipLimit}`}
          </span>
          {isOverLimit && (
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>

      {/* Aggregation Metrics */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-gray-600 dark:text-gray-400">Total</div>
          <div className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(aggregation.sum)}
          </div>
        </div>
        <div>
          <div className="text-gray-600 dark:text-gray-400">Average</div>
          <div className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(aggregation.average)}
          </div>
        </div>
        <div className="col-span-2 mt-1">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Range: {formatCurrency(aggregation.min)} - {formatCurrency(aggregation.max)}
          </div>
        </div>
      </div>
    </div>
  );
};