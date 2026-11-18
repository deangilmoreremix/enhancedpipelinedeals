import type { Deal } from '../types';
import type { DealFieldDefinition } from '../types/customFields';
import { applyBoardFilters, computeViewDeals } from '../hooks/useBoardFilters';
import { DEFAULT_STAGES } from '../utils/defaultStages';
import {
  customFilterFields, defaultDraft, describeFilter, fieldDef, filterFromDraft, isDraftValid, operatorsForKind,
} from '../components/pipeline/filterFieldConfig';
import { __resetDefinitionCache, createFieldDefinition } from '../services/customFieldService';
import { buildGroupColumns, isGroupableField, NONE_KEY } from '../utils/boardGrouping';
import { isBoardGroupBy, normalizeTableColumns, useBoardViewStore } from '../store/boardViewStore';
import { decorateFormulas } from '../utils/customFieldRecords';

jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

const deal = (id: string, o: Partial<Deal> = {}): Deal => ({
  id, title: id, company: 'Co', contact: '', value: 1000, stage: 'qualification', probability: 50, priority: 'low',
  createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 2), ...o,
});

const def = (o: Partial<DealFieldDefinition> & Pick<DealFieldDefinition, 'key' | 'type'>): DealFieldDefinition => ({
  id: `def-${o.key}`, label: o.key, options: [], position: 0, groupName: null, isActive: true, entityType: 'deal', ...o,
});

const deals = [
  deal('a', { customFields: { tier: 'Gold', seats: 10, fit: 5, renew: '2026-03-01', tags: ['x', 'y'] } }),
  deal('b', { customFields: { tier: 'Silver', seats: 40, fit: 3, renew: '2026-06-01', tags: ['y'] } }),
  deal('c', { customFields: { tier: 'Gold', seats: 25 } }),
  deal('d', {}),
];
const defs = [
  def({ key: 'tier', type: 'select', options: ['Gold', 'Silver'] }),
  def({ key: 'seats', type: 'number' }),
  def({ key: 'fit', type: 'rating' }),
  def({ key: 'renew', type: 'date' }),
  def({ key: 'tags', type: 'multi_select', options: ['x', 'y'] }),
  def({ key: 'seatValue', type: 'formula', config: { formula: '{seats} * {value}' } }),
];
const none = { filters: [], groups: [], favoritesOnly: false };
const ids = (list: Deal[]) => list.map(d => d.id);

describe('filtering by custom field', () => {
  it('maps field types to filter kinds and operators', () => {
    const fields = customFilterFields(defs);
    expect(fields.map(f => [f.id, f.kind])).toEqual([
      ['customFields.tier', 'select'], ['customFields.seats', 'number'], ['customFields.fit', 'number'],
      ['customFields.renew', 'date'], ['customFields.tags', 'tags'], ['customFields.seatValue', 'text'],
    ]);
    expect(fields[0].options).toEqual([{ id: 'Gold', label: 'Gold' }, { id: 'Silver', label: 'Silver' }]);
    expect(operatorsForKind('number').map(o => o.id)).toContain('between');
  });

  it('filters select / number / date / multi-select / empty through the shared engine', () => {
    const f = (field: string, op: string, v: any) => ids(applyBoardFilters(deals, { ...none, filters: [filterFromDraft(`customFields.${field}`, op, v)] }));
    expect(f('tier', 'equals', 'Gold')).toEqual(['a', 'c']);
    expect(f('tier', 'not_equals', 'Gold')).toEqual(['b', 'd']);
    expect(f('tier', 'in', ['Silver', 'Gold'])).toEqual(['a', 'b', 'c']);
    expect(f('seats', 'greater_than', '20')).toEqual(['b', 'c']);
    expect(f('seats', 'between', ['10', '25'])).toEqual(['a', 'c']);
    expect(f('fit', 'is_null', '')).toEqual(['c', 'd']);
    expect(f('tags', 'contains', 'x')).toEqual(['a']);
    expect(f('renew', 'less_than', '2026-04-01')).toEqual(['a']);
    expect(f('renew', 'is_not_null', '')).toEqual(['a', 'b']);
  });

  it('supports AND/OR advanced groups on custom fields', () => {
    const groups = [{
      id: 'g', name: 'G', logicalOperator: 'OR' as const, isActive: true, createdBy: 'u', createdAt: new Date(),
      filters: [filterFromDraft('customFields.tier', 'equals', 'Silver'), filterFromDraft('customFields.seats', 'less_than', '15')],
    }];
    expect(ids(applyBoardFilters(deals, { ...none, groups }))).toEqual(['a', 'b']);
  });

  it('filters on formula results without touching the original deals', () => {
    const input = { ...none, customFieldDefs: defs, filters: [filterFromDraft('customFields.seatValue', 'equals', '25000')] };
    const out = applyBoardFilters(deals, input);
    expect(ids(out)).toEqual(['c']);
    expect(out[0]).toBe(deals[2]); // original object, no computed value leaked into customFields
    expect(out[0].customFields).toEqual({ tier: 'Gold', seats: 25 });
    const num = { ...none, customFieldDefs: defs.map(d => (d.key === 'seatValue' ? { ...d, type: 'formula' as const } : d)), filters: [filterFromDraft('customFields.seatValue', 'greater_than', '20000')] };
    expect(ids(applyBoardFilters(deals, num))).toEqual(['b', 'c']);
  });

  it('draft validation and chip labels use the custom field', async () => {
    __resetDefinitionCache();
    await createFieldDefinition({ label: 'Tier', type: 'select', options: ['Gold', 'Silver'] });
    expect(fieldDef('customFields.tier')).toMatchObject({ label: 'Tier', kind: 'select', custom: true });
    expect(isDraftValid('select', 'equals', defaultDraft('select', 'equals'))).toBe(false);
    const chip = describeFilter(filterFromDraft('customFields.tier', 'equals', 'Gold'), DEFAULT_STAGES);
    expect(chip).toEqual({ field: 'Tier', operator: 'is', value: 'Gold' });
    expect(fieldDef('customFields.gone')).toMatchObject({ label: 'gone', kind: 'text' });
  });
});

describe('sorting by custom field', () => {
  it('sorts by a stored number, a select and a formula; empties last', () => {
    const sort = (field: string, direction: 'asc' | 'desc') =>
      ids(computeViewDeals(deals, { ...none, customFieldDefs: defs }, [{ field, direction, priority: 0 }], DEFAULT_STAGES));
    expect(sort('customFields.seats', 'asc')).toEqual(['a', 'c', 'b', 'd']);
    expect(sort('customFields.seats', 'desc')).toEqual(['b', 'c', 'a', 'd']);
    expect(sort('customFields.tier', 'asc')).toEqual(['a', 'c', 'b', 'd']);
    expect(sort('customFields.seatValue', 'desc')).toEqual(['b', 'c', 'a', 'd']);
  });
});

describe('grouping by custom field', () => {
  it('accepts cf: group-by keys and column keys', () => {
    expect(isBoardGroupBy('cf:tier')).toBe(true);
    expect(isBoardGroupBy('cf:')).toBe(false);
    expect(isBoardGroupBy('nope')).toBe(false);
    expect(isGroupableField(defs[0])).toBe(true);
    expect(isGroupableField(defs[4])).toBe(false); // multi-select would duplicate cards
    expect(normalizeTableColumns([{ key: 'title', visible: true }, { key: 'cf:tier', visible: true }, { key: 'bogus', visible: true }]).filter(c => c.visible).map(c => c.key))
      .toEqual(['title', 'cf:tier']);
  });

  it('groups by select value in option order with a "No value" column', () => {
    const cols = buildGroupColumns(deals, 'cf:tier', defs);
    expect(cols.map(c => [c.title, ids(c.deals)])).toEqual([['Gold', ['a', 'c']], ['Silver', ['b']], ['No tier', ['d']]]);
    expect(cols[2].key).toBe(NONE_KEY);
  });

  it('buckets numbers (distinct values when few, equal-width ranges when many) and ratings', () => {
    const few = buildGroupColumns(deals, 'cf:seats', defs);
    expect(few.map(c => c.title)).toEqual(['10', '25', '40', 'No seats']);
    const many = Array.from({ length: 8 }, (_, i) => deal(`n${i}`, { customFields: { seats: (i + 1) * 10 } }));
    const buckets = buildGroupColumns(many, 'cf:seats', defs);
    expect(buckets.slice(0, 4).map(c => c.title)).toEqual(['10 - 27.5', '27.5 - 45', '45 - 62.5', '62.5 - 80']);
    expect(buckets.slice(0, 4).reduce((n, c) => n + c.deals.length, 0)).toBe(8);
    expect(buildGroupColumns(deals, 'cf:fit', defs).map(c => c.title)).toEqual(['5 stars', '3 stars', 'No fit']);
  });

  it('groups by formula results and text values (case-insensitive merge)', () => {
    const text = [deal('t1', { customFields: { note: 'Acme' } }), deal('t2', { customFields: { note: 'acme' } }), deal('t3', { customFields: { note: 'Zed' } })];
    const cols = buildGroupColumns(text, 'cf:note', [def({ key: 'note', type: 'text' })]);
    expect(cols.map(c => [c.title, c.deals.length])).toEqual([['Acme', 2], ['Zed', 1], ['No note', 0]]);
    const f = buildGroupColumns(deals, 'cf:seatValue', defs);
    expect(f.map(c => c.title).slice(0, 4)).toEqual(['0', '10,000', '25,000', '40,000']);
  });
});

describe('columns and saved views', () => {
  beforeEach(() => useBoardViewStore.getState().reset());

  it('adds a custom column the first time it is toggled and persists it in the saved-view payload', () => {
    const s = useBoardViewStore.getState();
    s.toggleTableColumn('cf:tier');
    s.setGroupBy('cf:tier');
    s.setFilters([filterFromDraft('customFields.tier', 'equals', 'Gold')]);
    s.setSorting([{ field: 'customFields.seats', direction: 'desc', priority: 0 }]);
    const payload = useBoardViewStore.getState().getPayload();
    expect(payload.columns.find(c => c.key === 'cf:tier')).toEqual({ key: 'cf:tier', visible: true });
    expect(payload.group_by).toBe('cf:tier');
    expect(payload.filters.conditions[0].field).toBe('customFields.tier');
    expect(payload.sorting[0].field).toBe('customFields.seats');
    // round trip through applyView
    useBoardViewStore.getState().reset();
    useBoardViewStore.getState().applyView({ id: 'v1', name: 'V', filters: payload.filters, sorting: payload.sorting, group_by: payload.group_by, columns: payload.columns, view_type: 'table' } as any);
    const st = useBoardViewStore.getState();
    expect(st.groupBy).toBe('cf:tier');
    expect(st.tableColumns.some(c => c.key === 'cf:tier' && c.visible)).toBe(true);
    expect(st.sorting[0].field).toBe('customFields.seats');
  });
});

describe('decorateFormulas', () => {
  it('is a no-op without formula definitions and restores originals otherwise', () => {
    const plain = decorateFormulas('deal', deals, [defs[0]]);
    expect(plain.decorated).toBe(deals);
    const dec = decorateFormulas('deal', deals, defs);
    expect(dec.decorated[2].customFields?.seatValue).toBe(25000);
    expect(dec.decorated[3].customFields?.seatValue).toBe(0 * 1000);
    expect(dec.restore([dec.decorated[1]])[0]).toBe(deals[1]);
  });
});
