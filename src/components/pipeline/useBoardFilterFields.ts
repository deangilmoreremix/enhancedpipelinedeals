import { useMemo } from 'react';
import { useFieldDefinitions } from '../deals/fields/useFieldDefinitions';
import { BOARD_FILTER_FIELDS, customFilterFields, type FilterFieldDef } from './filterFieldConfig';

/** Built-in board filter fields followed by the active deal custom fields (kept current as definitions change). */
export function useBoardFilterFields(): FilterFieldDef[] {
  const { definitions } = useFieldDefinitions('deal', { lazy: true });
  return useMemo(() => [...BOARD_FILTER_FIELDS, ...customFilterFields(definitions)], [definitions]);
}
