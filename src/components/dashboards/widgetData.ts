import type { Company, Deal, PipelineStage } from '../../types';
import type { Contact } from '../../types/contact';
import type { DealTask } from '../../services/dealTasksService';
import { TASK_STATUS_LABEL } from '../../services/dealTasksService';
import { AdvancedFilteringService, FilterGroupNode } from '../../services/advancedFilteringService';
import { rangeStart, type AggregateRow } from '../../services/analyticsService';
import { ownerLabel } from '../../utils/ownerLabel';
import { WidgetConfig, WidgetObject, isMonthGroup } from './widgetModel';

export interface WidgetSources {
  deals: Deal[];
  tasks: DealTask[];
  contacts: Contact[];
  companies: Company[];
  stages: PipelineStage[];
  /** user id -> display name */
  userName?: (id: string) => string | undefined;
}

export interface DataRow { key: string; label: string; value: number; count: number }
export interface WidgetResult {
  /** Single aggregate over every matched record (the headline for number widgets). */
  total: number;
  /** Records that matched filters + range. */
  matched: number;
  rows: DataRow[];
  empty: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthKey = (t: number): string => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const monthLabel = (k: string): string => {
  const [y, m] = k.split('-').map(Number);
  return Number.isFinite(y) && Number.isFinite(m) ? `${MONTHS[m - 1]} ${y}` : k;
};
const time = (v: unknown): number => {
  if (v === undefined || v === null || v === '') return NaN;
  return v instanceof Date ? v.getTime() : new Date(v as string).getTime();
};
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const MAX_ROWS = 50;

interface Rec { raw: any; created: number; close: number }

function records(object: WidgetObject, s: WidgetSources): Rec[] {
  switch (object) {
    case 'deals': return s.deals.map(d => ({ raw: d, created: time(d.createdAt), close: time(d.dueDate) }));
    case 'tasks': return s.tasks.map(t => ({ raw: t, created: time(t.createdAt), close: time(t.dueDate) }));
    case 'contacts': return s.contacts.map(c => ({ raw: c, created: time(c.createdAt), close: NaN }));
    case 'companies': return s.companies.map(c => ({ raw: c, created: time(c.createdAt), close: NaN }));
  }
}

/** Numeric value of `field` on a record, or null when absent / not a finite number. */
export function numericValue(object: WidgetObject, raw: any, field: string): number | null {
  let v: unknown;
  if (field.startsWith('custom:')) v = raw?.customFields?.[field.slice(7)];
  else v = raw?.[field];
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function groupOf(cfg: WidgetConfig, rec: Rec, s: WidgetSources): { key: string; label: string } {
  const raw = rec.raw;
  const named = (id: string | null | undefined, text?: string) => {
    const label = (text ?? '').trim() || (id ? s.userName?.(id) ?? '' : '');
    return label ? { key: label.toLowerCase(), label } : { key: '__none', label: 'Unassigned' };
  };
  switch (cfg.groupBy) {
    case 'stage': { const st = s.stages.find(x => x.key === raw.stage); return { key: raw.stage, label: st?.name ?? raw.stage }; }
    case 'owner':
      if (cfg.object === 'deals') return named(raw.ownerId ?? raw.assignedToId, ownerLabel(raw));
      if (cfg.object === 'tasks') return named(raw.assigneeId);
      return named(raw.ownerId);
    case 'priority': return { key: raw.priority || '__none', label: raw.priority ? cap(raw.priority) : 'None' };
    case 'company': { const c = String(raw.company ?? '').trim(); return { key: c ? c.toLowerCase() : '__none', label: c || 'No company' }; }
    case 'status': {
      if (cfg.object === 'tasks') return { key: raw.status, label: TASK_STATUS_LABEL[raw.status as DealTask['status']] ?? raw.status };
      const v = String(raw.status ?? ''); return { key: v || '__none', label: v ? cap(v) : 'None' };
    }
    case 'industry': { const v = String(raw.industry ?? '').trim(); return { key: v ? v.toLowerCase() : '__none', label: v || 'Unknown' }; }
    case 'created_month':
    case 'close_month': {
      const t = cfg.groupBy === 'created_month' ? rec.created : rec.close;
      if (!Number.isFinite(t)) return { key: '__none', label: cfg.groupBy === 'created_month' ? 'No date' : 'No due date' };
      const k = monthKey(t); return { key: k, label: monthLabel(k) };
    }
    default: return { key: 'all', label: 'All' };
  }
}

function aggregate(cfg: WidgetConfig, items: Rec[]): { value: number; count: number } {
  if (cfg.measure === 'count' || !cfg.field) return { value: items.length, count: items.length };
  const nums = items.map(r => numericValue(cfg.object, r.raw, cfg.field as string)).filter((n): n is number => n !== null);
  if (nums.length === 0) return { value: 0, count: items.length };
  const sum = nums.reduce((a, b) => a + b, 0);
  const value = cfg.measure === 'sum' ? sum : cfg.measure === 'avg' ? sum / nums.length : cfg.measure === 'min' ? Math.min(...nums) : Math.max(...nums);
  return { value, count: items.length };
}

/** Filters groups (ANDed together, each group's own AND/OR inside) applied with the shared board filter engine. */
export function applyFilterGroups<T>(items: T[], groups: WidgetConfig['filterGroups'], get: (x: T) => unknown = x => x): T[] {
  const active = groups.filter(g => g.isActive !== false && g.filters.length > 0);
  if (!active.length) return items;
  const nodes: FilterGroupNode[] = active.map(g => ({ logic: g.logicalOperator, children: g.filters }));
  return items.filter(x => nodes.every(n => AdvancedFilteringService.evaluateNode(get(x), n)));
}

/** Add empty months between the first and last so line charts do not skip periods. */
function fillMonths(rows: DataRow[]): DataRow[] {
  const dated = rows.filter(r => /^\d{4}-\d{2}$/.test(r.key)).sort((a, b) => a.key.localeCompare(b.key));
  if (dated.length < 2) return [...dated, ...rows.filter(r => !/^\d{4}-\d{2}$/.test(r.key))];
  const have = new Map(dated.map(r => [r.key, r]));
  const out: DataRow[] = [];
  let [y, m] = dated[0].key.split('-').map(Number);
  const [ey, em] = dated[dated.length - 1].key.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    out.push(have.get(k) ?? { key: k, label: monthLabel(k), value: 0, count: 0 });
    if (++m > 12) { m = 1; y++; }
  }
  return [...out, ...rows.filter(r => !/^\d{4}-\d{2}$/.test(r.key))];
}

/** Pure: compute a widget's data from in-memory sources. */
export function computeWidget(cfg: WidgetConfig, s: WidgetSources, now: Date = new Date()): WidgetResult {
  const start = rangeStart(cfg.range, now)?.getTime();
  let recs = records(cfg.object, s);
  if (start !== undefined) recs = recs.filter(r => Number.isFinite(r.created) && r.created >= start);
  recs = applyFilterGroups(recs, cfg.filterGroups, r => r.raw);
  const total = aggregate(cfg, recs);
  if (cfg.groupBy === 'none') {
    return { total: total.value, matched: recs.length, rows: [{ key: 'all', label: 'Total', value: total.value, count: recs.length }], empty: recs.length === 0 };
  }
  const groups = new Map<string, { label: string; items: Rec[] }>();
  for (const r of recs) {
    const g = groupOf(cfg, r, s);
    const e = groups.get(g.key) ?? { label: g.label, items: [] };
    e.items.push(r); groups.set(g.key, e);
  }
  let rows: DataRow[] = [...groups.entries()].map(([key, g]) => ({ key, label: g.label, ...aggregate(cfg, g.items) }));
  if (cfg.groupBy === 'stage') {
    // every stage shows (empty ones too) so the chart lines up with the board columns
    const order = [...s.stages].sort((a, b) => a.position - b.position);
    const known = new Set(order.map(x => x.key));
    rows = [
      ...order.map(st => rows.find(r => r.key === st.key) ?? { key: st.key, label: st.name, value: 0, count: 0 }),
      ...rows.filter(r => !known.has(r.key)),
    ];
  } else if (isMonthGroup(cfg.groupBy)) rows = fillMonths(rows);
  else if (cfg.object === 'tasks' && cfg.groupBy === 'status') {
    const order = ['todo', 'in_progress', 'done'];
    rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  } else rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  return { total: total.value, matched: recs.length, rows: rows.slice(0, MAX_ROWS), empty: recs.length === 0 };
}

/** Whether `pipeline_aggregates` can answer this widget exactly (per-stage count/sum/avg/min/max of value or probability, no filters). */
export function canUseServerAggregate(cfg: WidgetConfig): boolean {
  return cfg.object === 'deals' && (cfg.groupBy === 'stage' || cfg.groupBy === 'none') && cfg.range === 'all'
    && cfg.filterGroups.every(g => !g.isActive || g.filters.length === 0)
    && (cfg.measure === 'count' || cfg.field === 'value' || cfg.field === 'probability');
}

/** Map `pipeline_aggregates` rows onto the same result shape as {@link computeWidget}. */
export function resultFromAggregates(cfg: WidgetConfig, agg: AggregateRow[], stages: PipelineStage[]): WidgetResult {
  const byStage = new Map(agg.map(r => [r.stage, r]));
  const count = agg.reduce((a, r) => a + r.deal_count, 0);
  const values = agg.map(r => r.agg);
  const total = cfg.measure === 'count' ? count
    : cfg.measure === 'sum' ? values.reduce((a, b) => a + b, 0)
    : cfg.measure === 'avg' ? (count ? agg.reduce((a, r) => a + r.agg * r.deal_count, 0) / count : 0)
    : cfg.measure === 'min' ? (values.length ? Math.min(...values) : 0) : (values.length ? Math.max(...values) : 0);
  if (cfg.groupBy === 'none') {
    return { total, matched: count, rows: [{ key: 'all', label: 'Total', value: total, count }], empty: count === 0 };
  }
  const order = [...stages].sort((a, b) => a.position - b.position);
  const known = new Set(order.map(s => s.key));
  const rows: DataRow[] = [
    ...order.map(st => { const r = byStage.get(st.key); return { key: st.key, label: st.name, value: r ? (cfg.measure === 'count' ? r.deal_count : r.agg) : 0, count: r?.deal_count ?? 0 }; }),
    ...agg.filter(r => !known.has(r.stage)).map(r => ({ key: r.stage, label: r.stage, value: cfg.measure === 'count' ? r.deal_count : r.agg, count: r.deal_count })),
  ];
  return { total, matched: count, rows, empty: count === 0 };
}

// ---- CSV ------------------------------------------------------------------------------------------

/** RFC 4180 quoting; text that a spreadsheet could read as a formula is prefixed with an apostrophe. */
export function csvCell(v: string | number): string {
  let s = typeof v === 'number' ? String(v) : v;
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function widgetToCsv(title: string, cfg: WidgetConfig, result: WidgetResult, measureLabel: string, groupLabel: string): string {
  const lines: string[] = [];
  if (cfg.groupBy === 'none') {
    lines.push([csvCell('Widget'), csvCell(measureLabel)].join(','));
    lines.push([csvCell(title), csvCell(Math.round(result.total * 100) / 100)].join(','));
  } else {
    lines.push([csvCell(groupLabel), csvCell(measureLabel), csvCell('Records')].join(','));
    for (const r of result.rows) lines.push([csvCell(r.label), csvCell(Math.round(r.value * 100) / 100), csvCell(r.count)].join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

