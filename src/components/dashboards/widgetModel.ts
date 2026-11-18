import type { AdvancedFilterGroup } from '../../types';
import type { DealFieldDefinition } from '../../types/customFields';
import type { DateRangeKey } from '../../services/analyticsService';

export const CHART_TYPES = ['number', 'bar', 'line', 'pie', 'table'] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export const OBJECTS = ['deals', 'tasks', 'contacts', 'companies'] as const;
export type WidgetObject = (typeof OBJECTS)[number];
export const MEASURES = ['count', 'sum', 'avg', 'min', 'max'] as const;
export type Measure = (typeof MEASURES)[number];
export const GROUP_KEYS = ['none', 'stage', 'owner', 'priority', 'company', 'status', 'industry', 'created_month', 'close_month'] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];
export const RANGES: DateRangeKey[] = ['all', '7d', '30d', '90d', '365d'];
export type WidgetCols = 1 | 2 | 3;

export const CHART_LABEL: Record<ChartType, string> = { number: 'Number', bar: 'Bar', line: 'Line over time', pie: 'Pie / donut', table: 'Table' };
export const OBJECT_LABEL: Record<WidgetObject, string> = { deals: 'Deals', tasks: 'Tasks', contacts: 'Contacts', companies: 'Companies' };
export const MEASURE_LABEL: Record<Measure, string> = { count: 'Count', sum: 'Sum', avg: 'Average', min: 'Minimum', max: 'Maximum' };
export const GROUP_LABEL: Record<GroupKey, string> = {
  none: 'No grouping', stage: 'Stage', owner: 'Owner', priority: 'Priority', company: 'Company', status: 'Status',
  industry: 'Industry', created_month: 'Created month', close_month: 'Close / due month',
};
export const RANGE_LABEL: Record<DateRangeKey, string> = { all: 'All time', '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', '365d': 'Last 12 months' };

/** Which group-by keys make sense per object. */
export const GROUPS_FOR: Record<WidgetObject, GroupKey[]> = {
  deals: ['stage', 'owner', 'priority', 'company', 'created_month', 'close_month'],
  tasks: ['status', 'owner', 'created_month', 'close_month'],
  contacts: ['status', 'company', 'created_month'],
  companies: ['industry', 'owner', 'created_month'],
};

export const isMonthGroup = (g: GroupKey): boolean => g === 'created_month' || g === 'close_month';

export interface NumericField { id: string; label: string }

/** Numeric fields a measure can aggregate: built-ins plus number / rating custom fields of that object. */
export function numericFieldsFor(object: WidgetObject, defs: DealFieldDefinition[] = []): NumericField[] {
  const builtin: Record<WidgetObject, NumericField[]> = {
    deals: [{ id: 'value', label: 'Deal value' }, { id: 'probability', label: 'Probability' }],
    tasks: [],
    contacts: [{ id: 'aiScore', label: 'AI score' }],
    companies: [{ id: 'revenue', label: 'Revenue' }],
  };
  const entity = object === 'deals' ? 'deal' : object === 'contacts' ? 'contact' : object === 'companies' ? 'company' : null;
  const custom = entity
    ? defs.filter(d => (d.entityType ?? 'deal') === entity && d.isActive !== false && (d.type === 'number' || d.type === 'rating'))
      .map(d => ({ id: `custom:${d.key}`, label: d.label }))
    : [];
  return [...builtin[object], ...custom];
}

export interface WidgetConfig {
  chart: ChartType;
  object: WidgetObject;
  measure: Measure;
  /** Numeric field for sum / avg / min / max (ignored for count). */
  field?: string;
  groupBy: GroupKey;
  /** Groups are ANDed; inside a group `logicalOperator` combines the conditions (same shape as the board filters). */
  filterGroups: AdvancedFilterGroup[];
  range: DateRangeKey;
  cols: WidgetCols;
}

export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  chart: 'bar', object: 'deals', measure: 'count', groupBy: 'stage', filterGroups: [], range: 'all', cols: 1,
};

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

export type ConfigResult = { ok: true; config: WidgetConfig } | { ok: false; errors: string[] };

/**
 * Validates and normalises an untrusted config (form state or a stored jsonb). Never throws.
 * Rules: grouped charts need a group; line charts need a month group; non-count measures need a numeric field of the object.
 */
export function validateWidgetConfig(raw: unknown, defs: DealFieldDefinition[] = []): ConfigResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const chart = oneOf(CHART_TYPES, r.chart) ? r.chart : (errors.push('Choose a chart type'), DEFAULT_WIDGET_CONFIG.chart);
  const object = oneOf(OBJECTS, r.object) ? r.object : (errors.push('Choose an object'), DEFAULT_WIDGET_CONFIG.object);
  const measure = oneOf(MEASURES, r.measure) ? r.measure : (errors.push('Choose a measure'), 'count' as Measure);
  const range = oneOf(RANGES, r.range) ? r.range : 'all';
  const colsN = Number(r.cols);
  const cols = (colsN === 2 || colsN === 3 ? colsN : 1) as WidgetCols;

  let groupBy: GroupKey = oneOf(GROUP_KEYS, r.groupBy) ? r.groupBy : chart === 'number' ? 'none' : 'stage';
  if (chart === 'number') groupBy = 'none';
  else if (groupBy === 'none') errors.push('Choose a group by');
  else if (!GROUPS_FOR[object].includes(groupBy)) errors.push(`${GROUP_LABEL[groupBy]} is not available for ${OBJECT_LABEL[object].toLowerCase()}`);
  else if (chart === 'line' && !isMonthGroup(groupBy)) errors.push('Line charts group by a month (created or close date)');

  let field: string | undefined;
  if (measure !== 'count') {
    const allowed = numericFieldsFor(object, defs);
    if (typeof r.field !== 'string' || !r.field) errors.push('Choose a numeric field to aggregate');
    else if (!allowed.some(f => f.id === r.field)) errors.push(`"${r.field}" is not a numeric field of ${OBJECT_LABEL[object].toLowerCase()}`);
    else field = r.field;
  }

  const groups = Array.isArray(r.filterGroups) ? (r.filterGroups as AdvancedFilterGroup[]).filter(g => g && Array.isArray(g.filters)) : [];
  if (errors.length) return { ok: false, errors };
  return { ok: true, config: { chart, object, measure, ...(field ? { field } : {}), groupBy, filterGroups: groups, range, cols } };
}

/** A sensible default title, e.g. "Sum of Deal value by Stage". */
export function defaultWidgetTitle(c: WidgetConfig, defs: DealFieldDefinition[] = []): string {
  const what = c.measure === 'count'
    ? `${OBJECT_LABEL[c.object]} count`
    : `${MEASURE_LABEL[c.measure]} ${(numericFieldsFor(c.object, defs).find(f => f.id === c.field)?.label ?? 'value').toLowerCase()}`;
  return c.groupBy === 'none' ? what : `${what} by ${GROUP_LABEL[c.groupBy].toLowerCase()}`;
}

export interface DashboardRecord { id: string; name: string; description?: string | null }
export interface WidgetRecord { id: string; dashboardId: string; title: string; config: WidgetConfig; order: number }
