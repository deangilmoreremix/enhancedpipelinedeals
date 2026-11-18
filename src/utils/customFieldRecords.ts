import type { CustomFieldEntityType, CustomFieldType, CustomFieldValue, DealFieldDefinition } from '../types/customFields';
import { isComputedType } from '../types/customFields';
import { computeFieldValues, formatComputed, type ComputedFieldValue, type FormulaValue } from './formula';

export type CustomFieldFilterKind = 'text' | 'number' | 'select' | 'date' | 'tags' | 'boolean';

/** How the filter builder treats a custom field type. */
export function filterKindForType(def: Pick<DealFieldDefinition, 'type' | 'config'>): CustomFieldFilterKind {
  switch (def.type as CustomFieldType) {
    case 'number': case 'rating': return 'number';
    case 'select': return 'select';
    case 'multi_select': return 'tags';
    case 'date': return 'date';
    case 'rollup': return def.config?.metric === 'last_activity' ? 'date' : 'number';
    default: return 'text'; // text, email, phone, link, formula
  }
}

export const customFieldPath = (key: string): string => `customFields.${key}`;
export const CUSTOM_COLUMN_PREFIX = 'cf:';
export const customColumnKey = (key: string): string => `${CUSTOM_COLUMN_PREFIX}${key}`;
export const isCustomColumnKey = (k: unknown): k is `cf:${string}` => typeof k === 'string' && k.startsWith(CUSTOM_COLUMN_PREFIX) && k.length > CUSTOM_COLUMN_PREFIX.length;
export const customKeyOf = (columnOrGroup: string): string => columnOrGroup.slice(CUSTOM_COLUMN_PREFIX.length);

type WithCustom = { customFields?: Record<string, CustomFieldValue> };

/** Computed (formula / rollup) values of one record. */
export function computedForRecord(
  et: CustomFieldEntityType, defs: DealFieldDefinition[], record: Record<string, unknown> | null | undefined,
  values?: Record<string, CustomFieldValue>, rollups?: Record<string, FormulaValue>,
): Record<string, ComputedFieldValue> {
  const computed = defs.filter(d => d.isActive && isComputedType(d.type));
  if (computed.length === 0) return {};
  // formulas may reference inactive stored fields too, so pass every definition
  return computeFieldValues(et, defs, record, values ?? (record as WithCustom | null)?.customFields, rollups);
}

/**
 * Deals with their formula results merged into `customFields` (copies; originals untouched) so filter / sort / group
 * engines treat computed fields like stored ones. Returns the copies plus a restore map back to the originals.
 */
export function decorateFormulas<T extends WithCustom & { id: string }>(
  et: CustomFieldEntityType, records: T[], defs: DealFieldDefinition[],
): { decorated: T[]; restore: (list: T[]) => T[] } {
  const formulas = defs.filter(d => d.isActive && d.type === 'formula');
  if (formulas.length === 0) return { decorated: records, restore: l => l };
  const byId = new Map<string, T>();
  const decorated = records.map(r => {
    byId.set(r.id, r);
    const out = computeFieldValues(et, defs, r as unknown as Record<string, unknown>, r.customFields);
    const merged: Record<string, CustomFieldValue> = { ...(r.customFields ?? {}) };
    for (const f of formulas) {
      const c = out[f.key];
      if (c && !c.error && c.value !== null && c.value !== '') merged[f.key] = c.value as CustomFieldValue;
      else delete merged[f.key];
    }
    return { ...r, customFields: merged } as T;
  });
  return { decorated, restore: list => list.map(d => byId.get(d.id) ?? d) };
}

/** Text shown for any definition's value on a record (stored or computed). */
export function displayValue(def: DealFieldDefinition, stored: CustomFieldValue | undefined, computed?: ComputedFieldValue): string {
  if (isComputedType(def.type)) return formatComputed(computed, def.config);
  if (stored === null || stored === undefined) return '';
  return Array.isArray(stored) ? stored.join(', ') : String(stored);
}
