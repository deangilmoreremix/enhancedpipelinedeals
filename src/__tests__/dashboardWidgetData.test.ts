import { describe, it, expect, jest } from '@jest/globals';
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
import type { Deal, PipelineStage } from '../types';
import type { DealTask } from '../services/dealTasksService';
import type { DealFieldDefinition } from '../types/customFields';
import { computeWidget, widgetToCsv, csvCell, canUseServerAggregate, resultFromAggregates, WidgetSources } from '../components/dashboards/widgetData';
import { DEFAULT_WIDGET_CONFIG, WidgetConfig, defaultWidgetTitle, numericFieldsFor, reorderWidgets, validateWidgetConfig } from '../components/dashboards/widgetModel';

const stages = [
  { key: 'qual', name: 'Qualification', position: 0 }, { key: 'prop', name: 'Proposal', position: 1 }, { key: 'won', name: 'Won', position: 2 },
] as unknown as PipelineStage[];
const deal = (id: string, stage: string, value: number, over: Partial<Deal> = {}) => ({
  id, company: 'Acme', contact: 'x', value, stage, probability: 50, priority: 'high', createdAt: new Date(2026, 0, 10), updatedAt: new Date(), ...over,
}) as unknown as Deal;
const sources: WidgetSources = {
  deals: [
    deal('1', 'qual', 100, { createdAt: new Date(2026, 0, 5), dueDate: new Date(2026, 2, 1), assignedTo: 'Alex', customFields: { seats: 10 } }),
    deal('2', 'qual', 300, { createdAt: new Date(2026, 2, 5), assignedTo: 'Alex', priority: 'low', customFields: { seats: 30 } }),
    deal('3', 'prop', 600, { company: 'Beta', assignedTo: 'Sam', createdAt: new Date(2026, 2, 9) }),
  ],
  tasks: [
    { id: 't1', status: 'todo', title: 'a', assigneeId: 'u1', createdAt: '2026-03-02T00:00:00Z', dueDate: null },
    { id: 't2', status: 'done', title: 'b', assigneeId: null, createdAt: '2026-03-03T00:00:00Z', dueDate: null },
    { id: 't3', status: 'todo', title: 'c', assigneeId: 'u1', createdAt: '2026-03-04T00:00:00Z', dueDate: null },
  ] as unknown as DealTask[],
  contacts: [], companies: [], stages, userName: id => (id === 'u1' ? 'Una' : undefined),
};
const cfg = (p: Partial<WidgetConfig>): WidgetConfig => ({ ...DEFAULT_WIDGET_CONFIG, ...p });
const rowsOf = (c: WidgetConfig) => computeWidget(c, sources, new Date(2026, 3, 1)).rows.map(r => [r.label, r.value]);

describe('computeWidget', () => {
  it('counts and sums by stage in stage order, including empty stages', () => {
    expect(rowsOf(cfg({ measure: 'count' }))).toEqual([['Qualification', 2], ['Proposal', 1], ['Won', 0]]);
    expect(rowsOf(cfg({ measure: 'sum', field: 'value' }))).toEqual([['Qualification', 400], ['Proposal', 600], ['Won', 0]]);
  });
  it('avg / min / max over a numeric field, and custom numeric fields skip deals without a value', () => {
    expect(rowsOf(cfg({ measure: 'avg', field: 'value' }))[0]).toEqual(['Qualification', 200]);
    expect(rowsOf(cfg({ measure: 'min', field: 'value' }))[0]).toEqual(['Qualification', 100]);
    expect(rowsOf(cfg({ measure: 'max', field: 'value' }))[0]).toEqual(['Qualification', 300]);
    expect(rowsOf(cfg({ measure: 'sum', field: 'custom:seats' }))).toEqual([['Qualification', 40], ['Proposal', 0], ['Won', 0]]);
    expect(computeWidget(cfg({ chart: 'number', groupBy: 'none', measure: 'avg', field: 'custom:seats' }), sources).total).toBe(20);
  });
  it('number widgets return one total', () => {
    const r = computeWidget(cfg({ chart: 'number', groupBy: 'none', measure: 'sum', field: 'value' }), sources);
    expect(r.total).toBe(1000); expect(r.matched).toBe(3); expect(r.empty).toBe(false);
  });
  it('groups by owner / priority / company', () => {
    expect(rowsOf(cfg({ groupBy: 'owner' }))).toEqual([['Alex', 2], ['Sam', 1]]);
    expect(rowsOf(cfg({ groupBy: 'priority' }))).toEqual([['High', 2], ['Low', 1]]);
    expect(rowsOf(cfg({ groupBy: 'company' }))).toEqual([['Acme', 2], ['Beta', 1]]);
  });
  it('groups by month and fills the gap months for time series', () => {
    expect(rowsOf(cfg({ chart: 'line', groupBy: 'created_month' }))).toEqual([['Jan 2026', 1], ['Feb 2026', 0], ['Mar 2026', 2]]);
    expect(rowsOf(cfg({ groupBy: 'close_month' })).some(r => r[0] === 'No due date')).toBe(true);
  });
  it('applies the time range on creation date', () => {
    const r = computeWidget(cfg({ range: '30d' }), sources, new Date(2026, 2, 20));
    expect(r.matched).toBe(2);
  });
  it('applies filter groups with the shared engine (AND between groups, OR inside)', () => {
    const g = (logicalOperator: 'AND' | 'OR', filters: any[]) => ({ id: 'g', name: 'g', logicalOperator, filters, isActive: true, createdBy: 'u', createdAt: new Date() });
    expect(computeWidget(cfg({ filterGroups: [g('AND', [{ field: 'value', operator: 'greater_than', value: 200 }])] }), sources).matched).toBe(2);
    expect(computeWidget(cfg({ filterGroups: [g('OR', [{ field: 'stage', operator: 'equals', value: 'prop' }, { field: 'value', operator: 'less_than', value: 150 }])] }), sources).matched).toBe(2);
    expect(computeWidget(cfg({ filterGroups: [g('AND', [{ field: 'value', operator: 'greater_than', value: 200 }]), g('AND', [{ field: 'stage', operator: 'equals', value: 'qual' }])] }), sources).matched).toBe(1);
  });
  it('tasks by status / owner with user names', () => {
    expect(rowsOf(cfg({ object: 'tasks', groupBy: 'status' }))).toEqual([['To do', 2], ['Done', 1]]);
    expect(rowsOf(cfg({ object: 'tasks', groupBy: 'owner' }))).toEqual([['Una', 2], ['Unassigned', 1]]);
  });
  it('is empty when nothing matches', () => {
    expect(computeWidget(cfg({ object: 'contacts' }), sources).empty).toBe(true);
  });
});

describe('server aggregate mapping', () => {
  it('only applies to unfiltered per-stage deal value/probability/count', () => {
    expect(canUseServerAggregate(cfg({ measure: 'sum', field: 'value' }))).toBe(true);
    expect(canUseServerAggregate(cfg({ measure: 'sum', field: 'custom:seats' }))).toBe(false);
    expect(canUseServerAggregate(cfg({ range: '30d' }))).toBe(false);
    expect(canUseServerAggregate(cfg({ object: 'tasks', groupBy: 'status' }))).toBe(false);
  });
  it('matches the local result shape', () => {
    const agg = [{ stage: 'qual', deal_count: 2, agg: 400 }, { stage: 'prop', deal_count: 1, agg: 600 }];
    const c = cfg({ measure: 'sum', field: 'value' });
    const r = resultFromAggregates(c, agg, stages);
    expect(r.rows.map(x => [x.label, x.value])).toEqual([['Qualification', 400], ['Proposal', 600], ['Won', 0]]);
    expect(r.total).toBe(1000);
    expect(resultFromAggregates(cfg({ chart: 'number', groupBy: 'none', measure: 'avg', field: 'value' }), [{ stage: 'a', deal_count: 1, agg: 100 }, { stage: 'b', deal_count: 3, agg: 200 }], stages).total).toBe(175);
  });
});

describe('validateWidgetConfig', () => {
  const defs = [{ key: 'seats', label: 'Seats', type: 'number', isActive: true, entityType: 'deal' }, { key: 'note', label: 'Note', type: 'text', isActive: true }] as unknown as DealFieldDefinition[];
  it('accepts a valid config and clamps cols', () => {
    const r = validateWidgetConfig({ ...DEFAULT_WIDGET_CONFIG, cols: 9 }, defs);
    expect(r.ok && r.config.cols).toBe(1);
  });
  it('requires a numeric field of the object for non-count measures', () => {
    expect(validateWidgetConfig(cfg({ measure: 'sum' }), defs).ok).toBe(false);
    expect(validateWidgetConfig(cfg({ measure: 'sum', field: 'custom:seats' }), defs).ok).toBe(true);
    expect(validateWidgetConfig(cfg({ measure: 'sum', field: 'custom:note' }), defs).ok).toBe(false);
    expect(validateWidgetConfig(cfg({ object: 'tasks', measure: 'sum', field: 'value' }), defs).ok).toBe(false);
  });
  it('requires a valid group, month grouping for line charts, no group for numbers', () => {
    expect(validateWidgetConfig(cfg({ groupBy: 'none' }), defs).ok).toBe(false);
    expect(validateWidgetConfig(cfg({ chart: 'line', groupBy: 'stage' }), defs).ok).toBe(false);
    expect(validateWidgetConfig(cfg({ chart: 'line', groupBy: 'created_month' }), defs).ok).toBe(true);
    expect(validateWidgetConfig(cfg({ object: 'tasks', groupBy: 'stage' }), defs).ok).toBe(false);
    const n = validateWidgetConfig(cfg({ chart: 'number', groupBy: 'stage' }), defs);
    expect(n.ok && n.config.groupBy).toBe('none');
  });
  it('never throws on garbage', () => {
    for (const g of [null, undefined, 5, 'x', [], { chart: 'pie3d' }]) expect(validateWidgetConfig(g).ok).toBe(false);
  });
  it('lists numeric fields and builds titles', () => {
    expect(numericFieldsFor('deals', defs).map(f => f.id)).toEqual(['value', 'probability', 'custom:seats']);
    expect(numericFieldsFor('tasks', defs)).toEqual([]);
    expect(defaultWidgetTitle(cfg({ measure: 'sum', field: 'value' }))).toBe('Sum deal value by stage');
  });
});

describe('csv export', () => {
  it('quotes values and neutralises spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(-5)).toBe('-5');
  });
  it('writes a header and one row per group', () => {
    const c = cfg({ measure: 'sum', field: 'value' });
    const csv = widgetToCsv('t', c, computeWidget(c, sources), 'Sum of Deal value', 'Stage');
    expect(csv.split('\r\n')).toEqual(['Stage,Sum of Deal value,Records', 'Qualification,400,2', 'Proposal,600,1', 'Won,0,0', '']);
  });
});

describe('reorderWidgets', () => {
  const w = (id: string, order: number) => ({ id, dashboardId: 'd', title: id, config: DEFAULT_WIDGET_CONFIG, order });
  it('swaps neighbours and renumbers; edges are no-ops', () => {
    expect(reorderWidgets([w('a', 0), w('b', 5), w('c', 9)], 'b', -1).map(x => [x.id, x.order])).toEqual([['b', 0], ['a', 1], ['c', 2]]);
    expect(reorderWidgets([w('a', 0), w('b', 1)], 'a', -1).map(x => x.id)).toEqual(['a', 'b']);
  });
});
