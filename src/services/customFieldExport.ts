import type { CustomFieldEntityType, CustomFieldValue, DealFieldDefinition } from '../types/customFields';
import { isComputedType } from '../types/customFields';
import { getCachedDefinitions, hasLoadedDefinitions, listFieldDefinitions, recordCustomValues } from './customFieldService';
import { rollupValuesForDefs, type CompanyRollup } from '../utils/rollups';
import { ERROR_TEXT, computeFieldValues, type FormulaValue } from '../utils/formula';

export interface CustomExportColumn {
  key: string;
  /** Header text: the field label. */
  header: string;
  def: DealFieldDefinition;
}

export interface CustomExportContext {
  /** Defaults to the cached active definitions of the entity (loaded on demand). */
  defs?: DealFieldDefinition[];
  /** Company rollup rows by company id (rollup columns stay empty without them). */
  rollups?: Map<string, CompanyRollup>;
}

/** Active definitions to export (one column each). Loads them when nothing is cached yet. */
export async function exportDefinitions(entity: CustomFieldEntityType, defs?: DealFieldDefinition[]): Promise<DealFieldDefinition[]> {
  let list = defs;
  if (!list) {
    if (!hasLoadedDefinitions(entity)) { try { await listFieldDefinitions(entity); } catch { /* export without custom columns */ } }
    list = getCachedDefinitions(entity);
  }
  return list;
}

/** Text of one cell: arrays joined with ';', formula/rollup results computed, failures as '#ERR'. */
export function exportCellValue(v: CustomFieldValue | FormulaValue | undefined): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(';');
  return String(v).replace(/\r?\n/g, ' ');
}

/**
 * Custom-field columns for an export of `entity` records: one column per ACTIVE definition (label as header, definition
 * order), stored values read from the record (+ local overlay) and formula / rollup values computed.
 */
export function customExportColumns<R extends { id: string; customFields?: unknown; custom_fields?: unknown }>(
  entity: CustomFieldEntityType, allDefs: DealFieldDefinition[], ctx: CustomExportContext = {},
): { headers: string[]; columns: CustomExportColumn[]; cells: (record: R) => string[] } {
  const defs = [...allDefs].sort((a, b) => a.position - b.position).filter(d => d.isActive);
  const columns = defs.map(def => ({ key: def.key, header: def.label, def }));
  const hasComputed = defs.some(d => isComputedType(d.type));
  return {
    headers: columns.map(c => c.header),
    columns,
    cells: record => {
      const values = recordCustomValues(entity, record.id, record);
      const computed = hasComputed
        ? computeFieldValues(entity, allDefs, record as unknown as Record<string, unknown>, values, rollupValuesForDefs(allDefs, ctx.rollups?.get(record.id)))
        : {};
      return columns.map(c => {
        if (isComputedType(c.def.type)) {
          const r = computed[c.key];
          return !r ? '' : r.error ? ERROR_TEXT : exportCellValue(r.value);
        }
        return exportCellValue(values[c.key]);
      });
    },
  };
}
