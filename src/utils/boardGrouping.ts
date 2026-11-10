import type { Deal } from '../types';
import type { BoardGroupBy } from '../store/boardViewStore';

export const NONE_KEY = '__none__';

export interface BoardGroupColumn {
  key: string;
  title: string;
  deals: Deal[];
}

const PRIORITY_COLUMNS: Array<{ key: Deal['priority']; title: string }> = [
  { key: 'high', title: 'High priority' },
  { key: 'medium', title: 'Medium priority' },
  { key: 'low', title: 'Low priority' }
];

export const ownerOf = (d: Deal): string => (d.assignedTo ?? '').trim();
export const companyOf = (d: Deal): string => (d.company ?? '').trim();

/** Whether dropping a card in a column of this grouping changes the deal (company grouping is read-only). */
export const isGroupingDroppable = (groupBy: BoardGroupBy): boolean => groupBy === 'priority' || groupBy === 'owner';

/** Column key a deal belongs to for a non-stage grouping. */
export const groupKeyOf = (d: Deal, groupBy: Exclude<BoardGroupBy, 'stage'>): string => {
  switch (groupBy) {
    case 'priority': return d.priority ?? 'medium';
    case 'owner': return ownerOf(d) || NONE_KEY;
    case 'company': return companyOf(d) || NONE_KEY;
  }
};

/** Columns (with their deals, in input order) for owner / priority / company grouping. */
export function buildGroupColumns(deals: Deal[], groupBy: Exclude<BoardGroupBy, 'stage'>): BoardGroupColumn[] {
  if (groupBy === 'priority') {
    return PRIORITY_COLUMNS.map(c => ({ key: c.key, title: c.title, deals: deals.filter(d => (d.priority ?? 'medium') === c.key) }));
  }
  const map = new Map<string, Deal[]>();
  deals.forEach(d => {
    const k = groupKeyOf(d, groupBy);
    const list = map.get(k);
    if (list) list.push(d); else map.set(k, [d]);
  });
  const emptyTitle = groupBy === 'owner' ? 'Unassigned' : 'No company';
  const named = [...map.keys()].filter(k => k !== NONE_KEY).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const cols: BoardGroupColumn[] = named.map(k => ({ key: k, title: k, deals: map.get(k) ?? [] }));
  // Owner grouping always offers an "Unassigned" drop target
  if (map.has(NONE_KEY) || groupBy === 'owner') cols.push({ key: NONE_KEY, title: emptyTitle, deals: map.get(NONE_KEY) ?? [] });
  return cols;
}

/** Field updates for dropping `deal` into column `targetKey` (null = not allowed / nothing to change). */
export function updatesForGroupDrop(
  groupBy: BoardGroupBy,
  targetKey: string,
  allDeals: Deal[]
): Partial<Deal> | null {
  if (groupBy === 'priority') {
    return targetKey === 'high' || targetKey === 'medium' || targetKey === 'low' ? { priority: targetKey } : null;
  }
  if (groupBy === 'owner') {
    if (targetKey === NONE_KEY) {
      // null clears the column (dealMapper writes explicit nulls)
      return { assignedTo: null as unknown as undefined, assignedToId: null as unknown as undefined };
    }
    const sample = allDeals.find(d => ownerOf(d) === targetKey && d.assignedToId);
    return { assignedTo: targetKey, assignedToId: sample?.assignedToId ?? (null as unknown as undefined) };
  }
  return null;
}
