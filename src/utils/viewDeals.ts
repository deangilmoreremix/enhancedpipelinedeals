import type { Deal, PipelineStage, ViewSort } from '../types';
import { AdvancedFilteringService } from '../services/advancedFilteringService';
import { sortedStages } from './stageMeta';

/** Table/list column key -> Deal field used for sorting. */
export const SORT_FIELD_FOR_COLUMN: Record<string, string> = {
  title: 'title',
  company: 'company',
  contact: 'contact',
  owner: 'assignedTo',
  value: 'value',
  stage: 'stage',
  priority: 'priority',
  probability: 'probability',
  closeDate: 'closeDate',
  dueDate: 'dueDate',
  updated: 'updatedAt',
  aiScore: 'aiScore'
};

const STAGE_RANK = '__stageRank';

/**
 * The ONE ordering every pipeline view uses: the board-view sort rules (multi-key) applied to the filtered deals.
 * `stage` sorts by stage position (not alphabetically). With no rules the order is pipeline order:
 * stage position, then manual (fractional) position.
 */
export function sortViewDeals(deals: Deal[], sorting: ViewSort[], stages: PipelineStage[]): Deal[] {
  const rank = new Map(sortedStages(stages).map((s, i) => [s.key, i]));
  const rankOf = (d: Deal) => rank.get(d.stage) ?? Number.MAX_SAFE_INTEGER;
  const byId = new Map<string, Deal>();
  const decorated = deals.map(d => {
    byId.set(d.id, d);
    return { ...d, [STAGE_RANK]: rankOf(d) } as Deal & { [STAGE_RANK]: number };
  });
  const keys: ViewSort[] = sorting.length === 0
    ? [{ field: STAGE_RANK, direction: 'asc', priority: 0 }]
    : sorting.map(s => (s.field === 'stage' ? { ...s, field: STAGE_RANK } : s));
  return AdvancedFilteringService.sortDeals(decorated, keys).map(d => byId.get(d.id) as Deal);
}

export interface ViewTotals {
  count: number;
  sum: number;
  avg: number;
}

/** Count / sum / average of deal value (compact footer for list & timeline). */
export function totalsOf(deals: Deal[]): ViewTotals {
  const sum = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  return { count: deals.length, sum, avg: deals.length ? sum / deals.length : 0 };
}

export const formatMoneyCompact = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
