import type { Deal } from '../types';
import type { BoardGroupBy } from '../store/boardViewStore';
import { ownerLabel } from './ownerLabel';
import type { DealFieldDefinition } from '../types/customFields';
import { customKeyOf, isCustomColumnKey, computedForRecord } from './customFieldRecords';

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

/** Owner display name: ownerId (via the user directory) is canonical, assignedTo text is the fallback. */
export const ownerOf = (d: Deal): string => ownerLabel(d);
export const companyOf = (d: Deal): string => (d.company ?? '').trim();

/** Whether dropping a card in a column of this grouping changes the deal (company grouping is read-only). */
export const isGroupingDroppable = (groupBy: BoardGroupBy): boolean => groupBy === 'priority' || groupBy === 'owner';

/** Custom field types the board can be grouped by (one column per value / number bucket). */
export const GROUPABLE_FIELD_TYPES = ['text', 'email', 'phone', 'link', 'select', 'number', 'rating', 'formula'] as const;
export const isGroupableField = (d: Pick<DealFieldDefinition, 'type' | 'isActive'>): boolean =>
  d.isActive && (GROUPABLE_FIELD_TYPES as readonly string[]).includes(d.type);

type Scalar = string | number | boolean | null;
const MAX_BUCKETS = 4;
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Columns for a custom-field grouping: one per distinct text/select/boolean value, number buckets for numeric fields. */
export function buildCustomGroupColumns(deals: Deal[], groupBy: `cf:${string}`, defs: DealFieldDefinition[]): BoardGroupColumn[] {
  const key = customKeyOf(groupBy);
  const def = defs.find(d => d.key === key);
  const computed = def?.type === 'formula';
  const valueOf = (d: Deal): Scalar => {
    if (computed) {
      const c = computedForRecord('deal', defs, d as unknown as Record<string, unknown>, d.customFields)[key];
      return c && !c.error ? c.value : null;
    }
    const v = d.customFields?.[key];
    return Array.isArray(v) ? v.join(', ') : v ?? null;
  };
  const vals = deals.map(d => ({ d, v: valueOf(d) }));
  const empty = vals.filter(x => x.v === null || x.v === '').map(x => x.d);
  const filled = vals.filter(x => !(x.v === null || x.v === ''));
  const out: BoardGroupColumn[] = [];

  const numeric = filled.length > 0 && filled.every(x => typeof x.v === 'number');
  if (numeric && def?.type !== 'rating') {
    const nums = filled.map(x => x.v as number);
    const distinct = [...new Set(nums)].sort((a, b) => a - b);
    if (distinct.length <= MAX_BUCKETS + 1) {
      distinct.forEach(n => out.push({ key: String(n), title: fmt(n), deals: filled.filter(x => x.v === n).map(x => x.d) }));
    } else {
      const min = distinct[0];
      const max = distinct[distinct.length - 1];
      const width = (max - min) / MAX_BUCKETS;
      for (let i = 0; i < MAX_BUCKETS; i++) {
        const lo = min + width * i;
        const hi = i === MAX_BUCKETS - 1 ? max : min + width * (i + 1);
        const inBucket = filled.filter(x => {
          const n = x.v as number;
          return i === MAX_BUCKETS - 1 ? n >= lo && n <= hi : n >= lo && n < hi;
        }).map(x => x.d);
        out.push({ key: `bucket:${i}`, title: `${fmt(lo)} - ${fmt(hi)}`, deals: inBucket });
      }
    }
  } else {
    const groups = new Map<string, BoardGroupColumn>();
    for (const { d, v } of filled) {
      const title = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : def?.type === 'rating' ? `${v} star${v === 1 ? '' : 's'}` : String(v);
      const k = title.toLowerCase();
      const col = groups.get(k);
      if (col) col.deals.push(d); else groups.set(k, { key: title, title, deals: [d] });
    }
    const order = def?.type === 'select' ? def.options.map(o => o.toLowerCase()) : null;
    out.push(...[...groups.entries()].sort(([ka, a], [kb, b]) => {
      if (order) return (order.indexOf(ka) + 1 || 999) - (order.indexOf(kb) + 1 || 999);
      if (def?.type === 'rating') return Number.parseInt(b.title, 10) - Number.parseInt(a.title, 10);
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
    }).map(([, c]) => c));
  }
  out.push({ key: NONE_KEY, title: `No ${def?.label ?? 'value'}`, deals: empty });
  return out;
}

/** Columns (with their deals, in input order) for owner / priority / company grouping. Names merge case-insensitively. */
export function buildGroupColumns(deals: Deal[], groupBy: Exclude<BoardGroupBy, 'stage'>, defs: DealFieldDefinition[] = []): BoardGroupColumn[] {
  if (isCustomColumnKey(groupBy)) return buildCustomGroupColumns(deals, groupBy, defs);
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
      return { assignedTo: null as unknown as undefined, assignedToId: null as unknown as undefined, ownerId: null as unknown as undefined };
    }
    const sample = allDeals.find(d => ownerOf(d).toLowerCase() === targetKey.toLowerCase() && (d.ownerId ?? d.assignedToId));
    const ownerId = sample?.ownerId ?? sample?.assignedToId;
    return {
      assignedTo: targetKey,
      assignedToId: ownerId ?? (null as unknown as undefined),
      ownerId: ownerId ?? (null as unknown as undefined),
    };
  }
  return null;
}
