import { Deal, PipelineStage } from '../../../types';
import { getActiveStages, getStageMeta, stageColorClasses } from '../../../utils/stageMeta';

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

const GENERIC_STAGE_COLORS: Record<string, string> = {
  new: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
  contacted: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  qualified: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
  proposal: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
  closed: 'border-green-500 bg-green-50 dark:bg-green-900/20'
};

/**
 * Stage colour classes (border + tinted background) for a stage key. Configured stages (pass `stages`, or the
 * live registry) win; the generic names above are only a fallback for keys that are not configured stages.
 */
export const getStageColor = (stageId: string, stages?: PipelineStage[]): string => {
  const list = stages ?? getActiveStages();
  const meta = getStageMeta(list, stageId);
  if (stages || (!meta.unknown && !GENERIC_STAGE_COLORS[stageId])) {
    const c = stageColorClasses(meta.color);
    return `${c.border} ${c.bg}`.trim();
  }
  return GENERIC_STAGE_COLORS[stageId] || 'border-gray-500 bg-gray-50 dark:bg-gray-900/20';
};

// ---------------------------------------------------------------------------
// Board helpers (aggregates, sorting, stage colours)
// ---------------------------------------------------------------------------

export type AggregateOperation = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type AggregateField = 'value' | 'probability';

export const AGGREGATE_OPERATIONS: Array<{ id: AggregateOperation; label: string }> = [
  { id: 'count', label: 'Count' },
  { id: 'sum', label: 'Sum' },
  { id: 'avg', label: 'Average' },
  { id: 'min', label: 'Min' },
  { id: 'max', label: 'Max' }
];

export const AGGREGATE_FIELDS: Array<{ id: AggregateField; label: string }> = [
  { id: 'value', label: 'Value' },
  { id: 'probability', label: 'Probability' }
];

/** Client-side aggregate of `field` over `deals`. Empty set yields 0. */
export const aggregateDeals = (deals: Deal[], op: AggregateOperation, field: AggregateField): number => {
  if (op === 'count') return deals.length;
  if (deals.length === 0) return 0;
  const nums = deals.map(d => Number(field === 'value' ? d.value : d.probability) || 0);
  switch (op) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    default: return 0;
  }
};

export const formatAggregate = (value: number, op: AggregateOperation, field: AggregateField): string => {
  if (op === 'count') return String(Math.round(value));
  if (field === 'probability') return `${Math.round(value * 10) / 10}%`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

export type BoardSortKey = 'manual' | 'value' | 'createdAt' | 'probability' | 'title';

export const BOARD_SORT_OPTIONS: Array<{ id: BoardSortKey; label: string }> = [
  { id: 'manual', label: 'Manual order' },
  { id: 'value', label: 'Value (high to low)' },
  { id: 'createdAt', label: 'Newest first' },
  { id: 'probability', label: 'Probability (high to low)' },
  { id: 'title', label: 'Title (A-Z)' }
];

const dealTitle = (d: Deal) => (d.title || d.company || '').toLowerCase();

/** Returns a sorted copy. `manual` orders by fractional position (ties by creation date). */
export const sortDeals = (deals: Deal[], sortBy: BoardSortKey): Deal[] => {
  const manual = (a: Deal, b: Deal) =>
    (a.position ?? 0) - (b.position ?? 0) || a.createdAt.getTime() - b.createdAt.getTime();
  const out = [...deals];
  switch (sortBy) {
    case 'value': return out.sort((a, b) => (b.value || 0) - (a.value || 0) || manual(a, b));
    case 'createdAt': return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || manual(a, b));
    case 'probability': return out.sort((a, b) => (b.probability || 0) - (a.probability || 0) || manual(a, b));
    case 'title': return out.sort((a, b) => dealTitle(a).localeCompare(dealTitle(b)) || manual(a, b));
    case 'manual':
    default: return out.sort(manual);
  }
};

// Static class names so Tailwind can see them
const STAGE_PALETTE: Record<string, { border: string; header: string; dot: string }> = {
  blue: { border: 'border-blue-500', header: 'bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-500' },
  indigo: { border: 'border-indigo-500', header: 'bg-indigo-50 dark:bg-indigo-900/20', dot: 'bg-indigo-500' },
  purple: { border: 'border-purple-500', header: 'bg-purple-50 dark:bg-purple-900/20', dot: 'bg-purple-500' },
  green: { border: 'border-green-500', header: 'bg-green-50 dark:bg-green-900/20', dot: 'bg-green-500' },
  red: { border: 'border-red-500', header: 'bg-red-50 dark:bg-red-900/20', dot: 'bg-red-500' },
  yellow: { border: 'border-yellow-500', header: 'bg-yellow-50 dark:bg-yellow-900/20', dot: 'bg-yellow-500' },
  orange: { border: 'border-orange-500', header: 'bg-orange-50 dark:bg-orange-900/20', dot: 'bg-orange-500' },
  pink: { border: 'border-pink-500', header: 'bg-pink-50 dark:bg-pink-900/20', dot: 'bg-pink-500' },
  teal: { border: 'border-teal-500', header: 'bg-teal-50 dark:bg-teal-900/20', dot: 'bg-teal-500' },
  gray: { border: 'border-gray-500', header: 'bg-gray-50 dark:bg-gray-900/20', dot: 'bg-gray-500' }
};

export const STAGE_COLOR_OPTIONS = Object.keys(STAGE_PALETTE);

const normalizeColor = (color?: string): string => {
  const c = (color || '').replace(/^border-/, '').replace(/-\d+$/, '');
  return STAGE_PALETTE[c] ? c : 'gray';
};

/** Column border class for a PipelineStage.color value. */
export const getStageBorderClass = (color?: string): string => STAGE_PALETTE[normalizeColor(color)].border;

/** Header tint classes for a PipelineStage.color value. */
export const getStageHeaderClass = (color?: string): string => STAGE_PALETTE[normalizeColor(color)].header;

/** Solid dot class for swatches. */
export const getStageDotClass = (color?: string): string => STAGE_PALETTE[normalizeColor(color)].dot;
