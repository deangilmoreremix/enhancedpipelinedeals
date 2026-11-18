import { useEffect, useMemo, useRef, useState } from 'react';
import type { AdvancedFilterGroup, Deal, PipelineStage, ViewFilter, ViewSort } from '../types';
import { AdvancedFilteringService, FilterGroupNode } from '../services/advancedFilteringService';
import { searchDeals } from '../services/dealSearchService';
import { BoardGroupBy, presetForSorting, useBoardViewStore } from '../store/boardViewStore';
import type { BoardSortKey } from '../components/pipeline/kanban/kanbanUtils';
import type { BoardGrouping } from '../components/pipeline/KanbanBoard';
import { DEFAULT_STAGES } from '../utils/defaultStages';
import { sortViewDeals } from '../utils/viewDeals';
import type { DealFieldDefinition } from '../types/customFields';
import { decorateFormulas } from '../utils/customFieldRecords';
import { useFieldDefinitions } from '../components/deals/fields/useFieldDefinitions';

export const SEARCH_DEBOUNCE_MS = 200;

export interface BoardFilterInput {
  filters: ViewFilter[];
  groups: AdvancedFilterGroup[];
  favoritesOnly: boolean;
  /** When set, only deals whose id is in this set are kept (search hits). */
  matchIds?: Set<string> | null;
  /** Deal custom-field definitions: formula results become filterable (`customFields.<key>`). */
  customFieldDefs?: DealFieldDefinition[];
}

/** Pure: applies search hits, favorites, filter chips (AND) and advanced groups (AND of AND/OR groups). */
export function applyBoardFilters(deals: Deal[], input: BoardFilterInput): Deal[] {
  if (input.customFieldDefs?.some(d => d.isActive && d.type === 'formula')) {
    const { decorated, restore } = decorateFormulas('deal', deals, input.customFieldDefs);
    return restore(applyBoardFilters(decorated, { ...input, customFieldDefs: undefined }));
  }
  let result = deals;
  if (input.matchIds) result = result.filter(d => input.matchIds!.has(d.id));
  if (input.favoritesOnly) result = result.filter(d => d.isFavorite);
  if (input.filters.length > 0) result = AdvancedFilteringService.filterDeals(result, input.filters);
  const active = input.groups.filter(g => g.isActive !== false && g.filters.length > 0);
  if (active.length > 0) {
    const tree: FilterGroupNode = {
      logic: 'AND',
      children: active.map(g => ({ logic: g.logicalOperator === 'OR' ? 'OR' : 'AND', children: g.filters }) as FilterGroupNode)
    };
    result = AdvancedFilteringService.filterDealsByGroup(result, tree);
  }
  return result;
}

/** Pure: the single filtered AND sorted list every pipeline view renders (kanban sorts per column on top of it). */
export function computeViewDeals(
  deals: Deal[],
  input: BoardFilterInput,
  sorting: ViewSort[],
  stages: PipelineStage[]
): Deal[] {
  if (input.customFieldDefs?.some(d => d.isActive && d.type === 'formula')) {
    const { decorated, restore } = decorateFormulas('deal', deals, input.customFieldDefs);
    return restore(sortViewDeals(applyBoardFilters(decorated, { ...input, customFieldDefs: undefined }), sorting, stages));
  }
  return sortViewDeals(applyBoardFilters(deals, input), sorting, stages);
}

/** Debounced copy of `value`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export interface UseBoardFiltersResult {
  /** Deals passing search + all filters (unsorted; the board sorts per column). */
  deals: Deal[];
  /** `deals` after the active sort rules: the one list passed to every view (table/list/calendar/timeline/dashboard). */
  viewDeals: Deal[];
  totalCount: number;
  /** Quick-sort preset for KanbanBoard (`manual` when a custom multi-key sort is active). */
  sortBy: BoardSortKey;
  /** Props for KanbanBoard's `grouping`. */
  grouping: BoardGrouping;
  groupBy: BoardGroupBy;
  searchActive: boolean;
  activeFilterCount: number;
}

/**
 * Derives the board's deals from the raw store deals + boardViewStore (search, favorites, filters, groups, sort, group-by).
 * Search is debounced (200ms) and runs through dealSearchService (Postgres FTS RPC, Fuse.js fallback).
 */
export function useBoardFilters(dealsMap: Record<string, Deal>, stages: PipelineStage[] = DEFAULT_STAGES): UseBoardFiltersResult {
  const search = useBoardViewStore(s => s.search);
  const favoritesOnly = useBoardViewStore(s => s.favoritesOnly);
  const filters = useBoardViewStore(s => s.filters);
  const groups = useBoardViewStore(s => s.groups);
  const sorting = useBoardViewStore(s => s.sorting);
  const groupBy = useBoardViewStore(s => s.groupBy);

  const { definitions: fieldDefs } = useFieldDefinitions('deal', { lazy: true });
  const all = useMemo(() => Object.values(dealsMap), [dealsMap]);
  const allRef = useRef(all);
  allRef.current = all;

  const query = search.trim();
  const debounced = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const [hits, setHits] = useState<{ q: string; ids: Set<string> } | null>(null);

  useEffect(() => {
    if (!debounced) { setHits(null); return; }
    let cancelled = false;
    searchDeals(debounced, 200, allRef.current)
      .then(rows => { if (!cancelled) setHits({ q: debounced, ids: new Set(rows.map(r => r.id)) }); })
      .catch(() => { if (!cancelled) setHits(null); });
    return () => { cancelled = true; };
  }, [debounced, all.length]);

  const matchIds = query && hits ? hits.ids : null;

  // Formula results are merged into customFields copies once, so filter + sort treat computed fields like stored ones;
  // every list handed to the views is mapped back to the original deal objects.
  const hasFormulas = useMemo(() => fieldDefs.some(d => d.isActive && d.type === 'formula'), [fieldDefs]);
  const dec = useMemo(
    () => (hasFormulas ? decorateFormulas('deal', all, fieldDefs) : { decorated: all, restore: (l: Deal[]) => l }),
    [hasFormulas, all, fieldDefs]
  );
  const filteredDec = useMemo(
    () => applyBoardFilters(dec.decorated, { filters, groups, favoritesOnly, matchIds }),
    [dec, filters, groups, favoritesOnly, matchIds]
  );
  const filtered = useMemo(() => dec.restore(filteredDec), [dec, filteredDec]);
  const viewDeals = useMemo(() => dec.restore(sortViewDeals(filteredDec, sorting, stages)), [dec, filteredDec, sorting, stages]);

  const preset = presetForSorting(sorting);
  const grouping = useMemo<BoardGrouping>(
    () => ({
      groupBy,
      sortFn: preset === 'custom'
        ? (list: Deal[]) => {
            if (!hasFormulas) return AdvancedFilteringService.sortDeals(list, sorting);
            const d = decorateFormulas('deal', list, fieldDefs);
            return d.restore(AdvancedFilteringService.sortDeals(d.decorated, sorting));
          }
        : undefined
    }),
    [groupBy, preset, sorting, hasFormulas, fieldDefs]
  );

  const groupConditions = groups.reduce((n, g) => n + g.filters.length, 0);
  return {
    deals: filtered,
    viewDeals,
    totalCount: all.length,
    sortBy: preset === 'custom' ? 'manual' : preset,
    grouping,
    groupBy,
    searchActive: query !== '',
    activeFilterCount: filters.length + groupConditions + (favoritesOnly ? 1 : 0) + (query ? 1 : 0)
  };
}
