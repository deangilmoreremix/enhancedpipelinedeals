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

/** Columns (with their deals, in input order) for owner / priority / company grouping. Names merge case-insensitively. */
export function buildGroupColumns(deals: Deal[], groupBy: Exclude<BoardGroupBy, 'stage'>): BoardGroupColumn[] {
  if (groupBy === 'priority') {
    return PRIORITY_COLUMNS.map(c => ({ key: c.key, title: c.title, deals: deals.filter(d => (d.priority ?? 'medium') === c.key) }));
  }
  const text = (d: Deal) => (groupBy === 'owner' ? ownerOf(d) : companyOf(d));
  const groups = new Map<string, BoardGroupColumn>(); // lower-cased name -> column (title = first spelling seen)
  const empty: Deal[] = [];
  deals.forEach(d => {
    const name = text(d);
    if (!name) { empty.push(d); return; }
    const k = name.toLowerCase();
    const col = groups.get(k);
    if (col) col.deals.push(d); else groups.set(k, { key: name, title: name, deals: [d] });
  });
  const cols = [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  // Owner grouping always offers an "Unassigned" drop target
  if (empty.length > 0 || groupBy === 'owner') {
    cols.push({ key: NONE_KEY, title: groupBy === 'owner' ? 'Unassigned' : 'No company', deals: empty });
  }
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
    const sample = allDeals.find(d => ownerOf(d).toLowerCase() === targetKey.toLowerCase() && d.assignedToId);
    return { assignedTo: targetKey, assignedToId: sample?.assignedToId ?? (null as unknown as undefined) };
  }
  return null;
}
