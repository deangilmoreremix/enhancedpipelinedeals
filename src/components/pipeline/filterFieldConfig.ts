import type { PipelineStage, ViewFilter } from '../../types';
import { RELATIVE_DATE_OPTIONS, getRelativeToken } from '../../services/advancedFilteringService';

export type FieldKind = 'text' | 'number' | 'select' | 'date' | 'tags' | 'boolean';

export interface FilterFieldDef {
  /** Property path on Deal (what advancedFilteringService evaluates). */
  id: string;
  label: string;
  kind: FieldKind;
}

export const BOARD_FILTER_FIELDS: FilterFieldDef[] = [
  { id: 'stage', label: 'Stage', kind: 'select' },
  { id: 'priority', label: 'Priority', kind: 'select' },
  { id: 'value', label: 'Value', kind: 'number' },
  { id: 'probability', label: 'Probability', kind: 'number' },
  { id: 'company', label: 'Company', kind: 'text' },
  { id: 'contact', label: 'Contact', kind: 'text' },
  { id: 'title', label: 'Title', kind: 'text' },
  { id: 'assignedTo', label: 'Owner', kind: 'text' },
  { id: 'dueDate', label: 'Close / due date', kind: 'date' },
  { id: 'createdAt', label: 'Created date', kind: 'date' },
  { id: 'tags', label: 'Tags', kind: 'tags' },
  { id: 'isFavorite', label: 'Favorite', kind: 'boolean' },
  { id: 'healthScore', label: 'Health score', kind: 'number' }
];

export const PRIORITY_OPTIONS = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' }
];

export const fieldDef = (id: string): FilterFieldDef =>
  BOARD_FILTER_FIELDS.find(f => f.id === id) ?? { id, label: id, kind: 'text' };

/** UI operator. `relative` is stored as a `between` filter whose value is `{ relative: token }`. */
export interface OperatorDef {
  id: string;
  label: string;
  needsValue: boolean;
}

const op = (id: string, label: string, needsValue = true): OperatorDef => ({ id, label, needsValue });

export function operatorsForKind(kind: FieldKind): OperatorDef[] {
  switch (kind) {
    case 'text':
      return [op('contains', 'contains'), op('not_contains', 'does not contain'), op('equals', 'is'), op('not_equals', 'is not'),
        op('is_null', 'is empty', false), op('is_not_null', 'is not empty', false)];
    case 'number':
      return [op('equals', '='), op('greater_than', '>'), op('less_than', '<'), op('between', 'between'),
        op('is_null', 'is empty', false), op('is_not_null', 'is not empty', false)];
    case 'select':
      return [op('equals', 'is'), op('not_equals', 'is not'), op('in', 'is any of'), op('not_in', 'is none of')];
    case 'date':
      return [op('relative', 'is'), op('greater_than', 'after'), op('less_than', 'before'), op('equals', 'on'), op('between', 'between'),
        op('is_null', 'is empty', false), op('is_not_null', 'is not empty', false)];
    case 'tags':
      return [op('contains', 'has tag'), op('not_contains', 'does not have tag'), op('in', 'has any of'),
        op('is_null', 'has no tags', false), op('is_not_null', 'has tags', false)];
    case 'boolean':
      return [op('equals', 'is')];
    default:
      return [op('equals', 'is')];
  }
}

/** Operator key used by the UI for a stored filter (detects relative dates). */
export const operatorKeyOf = (f: ViewFilter): string =>
  f.operator === 'between' && getRelativeToken(f.value) ? 'relative' : f.operator;

const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (v: unknown): string => {
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const startIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toISOString(); };
const endIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString(); };

/** Editable draft value for (kind, operator): string | string[] | boolean. */
export type DraftValue = string | boolean | string[];

export function defaultDraft(kind: FieldKind, opKey: string): DraftValue {
  if (opKey === 'is_null' || opKey === 'is_not_null') return '';
  if (opKey === 'between') return ['', ''];
  if (opKey === 'in' || opKey === 'not_in') return [];
  if (opKey === 'relative') return 'last_7_days';
  if (kind === 'boolean') return true;
  if (kind === 'select') return '';
  return '';
}

/** Stored filter -> draft for the editor. */
export function draftFromFilter(f: ViewFilter): { opKey: string; draft: DraftValue } {
  const opKey = operatorKeyOf(f);
  const kind = fieldDef(f.field).kind;
  if (opKey === 'relative') return { opKey, draft: getRelativeToken(f.value) ?? 'last_7_days' };
  if (opKey === 'is_null' || opKey === 'is_not_null') return { opKey, draft: '' };
  if (opKey === 'between') {
    const arr = Array.isArray(f.value) ? f.value : ['', ''];
    return { opKey, draft: kind === 'date' ? arr.map(toDateInput) : arr.map(v => String(v ?? '')) };
  }
  if (opKey === 'in' || opKey === 'not_in') return { opKey, draft: (Array.isArray(f.value) ? f.value : []).map(String) };
  if (kind === 'boolean') return { opKey, draft: f.value === true || f.value === 'true' };
  if (kind === 'date') return { opKey, draft: toDateInput(f.value) };
  return { opKey, draft: String(f.value ?? '') };
}

/** Is this draft complete enough to apply? */
export function isDraftValid(kind: FieldKind, opKey: string, draft: DraftValue): boolean {
  if (opKey === 'is_null' || opKey === 'is_not_null') return true;
  if (kind === 'boolean') return typeof draft === 'boolean';
  if (opKey === 'between') return Array.isArray(draft) && draft.length === 2 && draft.every(v => String(v).trim() !== '');
  if (opKey === 'in' || opKey === 'not_in') return Array.isArray(draft) && draft.length > 0;
  if (typeof draft !== 'string') return false;
  if (draft.trim() === '') return false;
  if (kind === 'number') return !isNaN(Number(draft));
  return true;
}

/** Draft -> ViewFilter understood by advancedFilteringService. */
export function filterFromDraft(field: string, opKey: string, draft: DraftValue): ViewFilter {
  const kind = fieldDef(field).kind;
  if (opKey === 'is_null' || opKey === 'is_not_null') return { field, operator: opKey, value: null };
  if (opKey === 'relative') return { field, operator: 'between', value: { relative: String(draft) } };
  if (opKey === 'between' && Array.isArray(draft)) {
    if (kind === 'date') return { field, operator: 'between', value: [startIso(draft[0]), endIso(draft[1])] };
    return { field, operator: 'between', value: draft.map(Number) };
  }
  if ((opKey === 'in' || opKey === 'not_in') && Array.isArray(draft)) {
    return { field, operator: opKey, value: draft };
  }
  const operator = opKey as ViewFilter['operator'];
  if (kind === 'number') return { field, operator, value: Number(draft) };
  if (kind === 'boolean') return { field, operator, value: draft === true };
  if (kind === 'date' && typeof draft === 'string') {
    // "on" compares the calendar day; before/after compare instants
    if (opKey === 'greater_than') return { field, operator, value: endIso(draft) };
    if (opKey === 'less_than') return { field, operator, value: startIso(draft) };
    return { field, operator, value: draft };
  }
  return { field, operator, value: typeof draft === 'string' ? draft.trim() : draft };
}

/** Human labels for a chip. */
export function describeFilter(f: ViewFilter, stages: PipelineStage[]): { field: string; operator: string; value: string } {
  const def = fieldDef(f.field);
  const opKey = operatorKeyOf(f);
  const opLabel = operatorsForKind(def.kind).find(o => o.id === opKey)?.label ?? opKey;
  const stageName = (k: unknown) => stages.find(s => s.key === k)?.name ?? String(k);
  const fmtVal = (v: unknown): string => {
    if (f.field === 'stage') return stageName(v);
    if (f.field === 'priority') return PRIORITY_OPTIONS.find(p => p.id === v)?.label ?? String(v);
    if (def.kind === 'date') {
      const d = new Date(String(v));
      return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
    }
    return String(v);
  };
  let value = '';
  if (opKey === 'is_null' || opKey === 'is_not_null') value = '';
  else if (opKey === 'relative') value = RELATIVE_DATE_OPTIONS.find(o => o.id === getRelativeToken(f.value))?.label ?? String(getRelativeToken(f.value));
  else if (Array.isArray(f.value)) value = opKey === 'between' ? f.value.map(fmtVal).join(' - ') : f.value.map(fmtVal).join(', ');
  else if (def.kind === 'boolean') value = f.value === true || f.value === 'true' ? 'Yes' : 'No';
  else value = fmtVal(f.value);
  return { field: def.label, operator: opLabel, value };
}
