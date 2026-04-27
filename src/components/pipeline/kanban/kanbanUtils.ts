import { Deal } from '../../../types';

export interface ColumnAggregation {
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

/**
 * Calculate aggregation metrics for deals in a column
 */
export const calculateColumnAggregation = (deals: Deal[]): ColumnAggregation => {
  if (deals.length === 0) {
    return {
      count: 0,
      sum: 0,
      average: 0,
      min: 0,
      max: 0
    };
  }

  const values = deals.map(deal => deal.value || 0);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const average = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    count: deals.length,
    sum,
    average,
    min,
    max
  };
};

/**
 * Get stage color classes for kanban columns
 */
export const getStageColor = (stageId: string): string => {
  const colors: Record<string, string> = {
    new: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    contacted: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    qualified: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
    proposal: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    closed: 'border-green-500 bg-green-50 dark:bg-green-900/20',
    'closed-won': 'border-green-500 bg-green-50 dark:bg-green-900/20',
    'closed-lost': 'border-red-500 bg-red-50 dark:bg-red-900/20'
  };

  return colors[stageId] || 'border-gray-500 bg-gray-50 dark:bg-gray-900/20';
};