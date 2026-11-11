import { useEffect, useMemo, useRef, useState } from 'react';
import type { AdvancedFilterGroup, Deal, PipelineStage, ViewFilter, ViewSort } from '../types';
import { AdvancedFilteringService, FilterGroupNode } from '../services/advancedFilteringService';
import { searchDeals } from '../services/dealSearchService';
import { BoardGroupBy, presetForSorting, useBoardViewStore } from '../store/boardViewStore';
import type { BoardSortKey } from '../components/pipeline/kanban/kanbanUtils';
import type { BoardGrouping } from '../components/pipeline/KanbanBoard';
import { DEFAULT_STAGES } from '../utils/defaultStages';
import { sortViewDeals } from '../utils/viewDeals';

export const SEARCH_DEBOUNCE_MS = 200;

export interface BoardFilterInput {
  filters: ViewFilter[];
  groups: AdvancedFilterGroup[];
  favoritesOnly: boolean;
  /** When set, only deals whose id is in this set are kept (search hits). */
  matchIds?: Set<string> | null;
}

/** Pure: applies search hits, favorites, filter chips (AND) and advanced groups (AND of AND/OR groups). */
export function applyBoardFilters(deals: Deal[], input: BoardFilterInput): Deal[] {
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

  const filtered = useMemo(
    () => applyBoardFilters(all, { filters, groups, favoritesOnly, matchIds }),
    [all, filters, groups, favoritesOnly, matchIds]
  );

  const viewDeals = useMemo(() => sortViewDeals(filtered, sorting, stages), [filtered, sorting, stages]);

  const preset = presetForSorting(sorting);
  const grouping = useMemo<BoardGrouping>(
    () => ({
      groupBy,
      sortFn: preset === 'custom' ? (list: Deal[]) => AdvancedFilteringService.sortDeals(list, sorting) : undefined
    }),
    [groupBy, preset, sorting]
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
