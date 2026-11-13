import type { AdvancedFilterGroup, Deal, ViewFilter } from '../types';
import { AdvancedFilteringService, RELATIVE_DATE_OPTIONS, resolveRelativeRange } from '../services/advancedFilteringService';

// useBoardFilters only imports types/services that touch Supabase; keep them out of this pure test
jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false, getSupabaseService: () => ({}) }));
jest.mock('../services/dealSearchService', () => ({ searchDeals: jest.fn(async () => []) }));

import { applyBoardFilters } from '../hooks/useBoardFilters';

const NOW = new Date(2026, 5, 15, 12, 0, 0); // Mon 15 Jun 2026, local time
const daysAgo = (n: number) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n, 9, 0, 0);

const mk = (id: string, over: Partial<Deal> = {}): Deal => ({
  id, title: `Deal ${id}`, company: 'Acme', contact: 'Jane', value: 1000, stage: 'lead', probability: 20, priority: 'medium',
  createdAt: daysAgo(30), updatedAt: daysAgo(1), position: Number(id.replace(/\D/g, '')) || 0, ...over
});

const DEALS: Deal[] = [
  mk('1', { company: 'Acme', value: 5000, priority: 'high', stage: 'lead', tags: ['vip', 'web'], dueDate: daysAgo(3), isFavorite: true }),
  mk('2', { company: 'Globex', value: 12000, priority: 'low', stage: 'qualified', tags: ['web'], dueDate: daysAgo(-5), assignedTo: 'Sam' }),
  mk('3', { company: 'Initech', value: 800, priority: 'medium', stage: 'closed-won', tags: [], healthScore: 40 }),
  mk('4', { company: 'acme labs', value: 25000, priority: 'high', stage: 'qualified', dueDate: daysAgo(40), assignedTo: 'Pat' })
];

const ids = (ds: Deal[]) => ds.map(d => d.id);
const f = (field: string, operator: ViewFilter['operator'], value: any): ViewFilter => ({ field, operator, value });

describe('AdvancedFilteringService operators', () => {
  beforeAll(() => { jest.useFakeTimers().setSystemTime(NOW); });
  afterAll(() => { jest.useRealTimers(); });

  it('supports equals / contains / numeric / between / in / empty operators', () => {
    const run = (flt: ViewFilter) => ids(AdvancedFilteringService.filterDeals(DEALS, [flt]));
    expect(run(f('company', 'equals', 'acme'))).toEqual(['1']);            // case-insensitive
    expect(run(f('company', 'contains', 'ACME'))).toEqual(['1', '4']);
    expect(run(f('value', 'greater_than', 5000))).toEqual(['2', '4']);
    expect(run(f('value', 'less_than', 1000))).toEqual(['3']);
    expect(run(f('value', 'between', [1000, 12000]))).toEqual(['1', '2']);
    expect(run(f('stage', 'in', ['lead', 'closed-won']))).toEqual(['1', '3']);
    expect(run(f('stage', 'not_in', ['lead', 'closed-won']))).toEqual(['2', '4']);
    expect(run(f('owner', 'is_null', null))).toEqual(['1', '3']);          // alias for assignedTo
    expect(run(f('assignedTo', 'is_not_null', null))).toEqual(['2', '4']);
    expect(run(f('isFavorite', 'equals', true))).toEqual(['1']);
    expect(run(f('health', 'less_than', 50))).toEqual(['3']);              // alias; deals without a score never match
  });

  it('matches on tag arrays', () => {
    const run = (flt: ViewFilter) => ids(AdvancedFilteringService.filterDeals(DEALS, [flt]));
    expect(run(f('tags', 'contains', 'vip'))).toEqual(['1']);
    expect(run(f('tags', 'in', ['web', 'x']))).toEqual(['1', '2']);
    expect(run(f('tags', 'is_null', null))).toEqual(['3', '4']);
  });

  it('evaluates relative dates against "now"', () => {
    const run = (token: string, field = 'dueDate') => ids(AdvancedFilteringService.filterDeals(DEALS, [f(field, 'between', { relative: token })]));
    expect(run('last_7_days')).toEqual(['1']);
    expect(run('next_7_days')).toEqual(['2']);
    expect(run('last_30_days')).toEqual(['1']);
    expect(run('overdue')).toEqual(['1', '4']);
    expect(run('last_90_days')).toEqual(['1', '4']);
    expect(run('this_year', 'createdAt')).toEqual(['1', '2', '3', '4']);
    expect(ids(AdvancedFilteringService.filterDeals(DEALS, [f('dueDate', 'between', 'rel:last_7_days')]))).toEqual(['1']);
  });

  it('resolves relative ranges', () => {
    const [start, end] = resolveRelativeRange('this_month', NOW)!;
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(30);
    expect(resolveRelativeRange('nope', NOW)).toBeNull();
    expect(RELATIVE_DATE_OPTIONS.every(o => resolveRelativeRange(o.id, NOW) !== null)).toBe(true);
  });

  it('validates relative between filters', () => {
    expect(AdvancedFilteringService.validateFilters([f('dueDate', 'between', { relative: 'today' })]).isValid).toBe(true);
    expect(AdvancedFilteringService.validateFilters([f('dueDate', 'between', ['x'])]).isValid).toBe(false);
  });
});

describe('nested AND / OR groups', () => {
  it('evaluates nested group trees', () => {
    const tree = {
      logic: 'AND' as const,
      children: [
        f('priority', 'equals', 'high'),
        { logic: 'OR' as const, children: [f('company', 'equals', 'Acme'), f('value', 'greater_than', 20000)] }
      ]
    };
    expect(ids(AdvancedFilteringService.filterDealsByGroup(DEALS, tree))).toEqual(['1', '4']);
    expect(ids(AdvancedFilteringService.filterDealsByGroup(DEALS, { logic: 'OR', children: [f('stage', 'equals', 'closed-won'), f('company', 'equals', 'Globex')] }))).toEqual(['2', '3']);
    expect(AdvancedFilteringService.filterDealsByGroup(DEALS, { logic: 'AND', children: [] })).toBe(DEALS);
  });

  it('applyBoardFilters combines search hits, favorites, chips and AND-ed advanced groups', () => {
    const group = (logic: 'AND' | 'OR', filters: ViewFilter[]): AdvancedFilterGroup => ({
      id: Math.random().toString(), name: 'g', filters, logicalOperator: logic, isActive: true, createdBy: 't', createdAt: new Date()
    });
    const base = { filters: [], groups: [], favoritesOnly: false };

    expect(ids(applyBoardFilters(DEALS, base))).toEqual(['1', '2', '3', '4']);
    expect(ids(applyBoardFilters(DEALS, { ...base, matchIds: new Set(['2', '3']) }))).toEqual(['2', '3']);
    expect(ids(applyBoardFilters(DEALS, { ...base, favoritesOnly: true }))).toEqual(['1']);
    expect(ids(applyBoardFilters(DEALS, { ...base, filters: [f('priority', 'equals', 'high')] }))).toEqual(['1', '4']);

    const groups = [
      group('OR', [f('company', 'equals', 'Acme'), f('company', 'equals', 'Globex')]),
      group('AND', [f('value', 'greater_than', 4000), f('value', 'less_than', 20000)])
    ];
    expect(ids(applyBoardFilters(DEALS, { ...base, groups }))).toEqual(['1', '2']);
    expect(ids(applyBoardFilters(DEALS, { ...base, groups, filters: [f('stage', 'equals', 'qualified')] }))).toEqual(['2']);
    // inactive / empty groups are ignored
    expect(ids(applyBoardFilters(DEALS, { ...base, groups: [{ ...groups[0], isActive: false }, group('AND', [])] }))).toHaveLength(4);
  });
});

describe('multi-key sort', () => {
  it('sorts by several keys with nullish values last and priority ranking', () => {
    const sorted = AdvancedFilteringService.sortDeals(DEALS, [
      { field: 'priority', direction: 'desc', priority: 0 },
      { field: 'value', direction: 'asc', priority: 1 }
    ]);
    expect(ids(sorted)).toEqual(['1', '4', '3', '2']);
    const byOwner = AdvancedFilteringService.sortDeals(DEALS, [{ field: 'assignedTo', direction: 'asc', priority: 0 }]);
    expect(ids(byOwner)).toEqual(['4', '2', '1', '3']); // Pat, Sam, then deals without owner (manual order)
  });

  it('falls back to manual position when no keys are given', () => {
    expect(ids(AdvancedFilteringService.sortDeals([DEALS[3], DEALS[0]], []))).toEqual(['1', '4']);
  });
});
