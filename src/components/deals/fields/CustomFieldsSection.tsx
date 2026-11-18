import React, { useMemo } from 'react';
import { Settings2, SlidersHorizontal } from 'lucide-react';
import type { Deal } from '../../../types';
import type { CustomFieldEntityType, CustomFieldValue } from '../../../types/customFields';
import { computedForRecord } from '../../../utils/customFieldRecords';
import type { FormulaValue } from '../../../utils/formula';
import { groupDefinitions, withCustomValue } from '../../../services/customFieldService';
import { CustomFieldCell } from './CustomFieldCell';
import { useFieldDefinitions } from './useFieldDefinitions';

export interface CustomFieldsSectionProps {
  /** Which kind of record (default 'deal'). */
  entityType?: CustomFieldEntityType;
  /** Deal record (entityType 'deal'): values come from `deal.customFields`, saves go through `onUpdateDeal`. */
  deal?: Deal;
  /** Persist a partial deal update (the section sends `{ customFields }`). */
  onUpdateDeal?: (updates: Partial<Deal>) => Promise<unknown>;
  /** Contact / company record: built-in fields (formulas may reference them). */
  record?: Record<string, unknown> | null;
  /** Contact / company: current custom values. */
  values?: Record<string, CustomFieldValue>;
  /** Contact / company: persist the full next values map (reject to roll back). */
  onSaveValues?: (next: Record<string, CustomFieldValue>) => Promise<unknown>;
  /** Rollup values by definition key (company records). */
  rollups?: Record<string, FormulaValue>;
  disabled?: boolean;
  /** Group names to hide (see `hiddenFieldGroups` on the overview). */
  hiddenGroups?: string[];
  /** Opens the ManageFieldsDialog; the button is hidden when omitted. */
  onManage?: () => void;
}

/** Custom field values of a deal / contact / company, grouped by group_name, each editable inline. */
export const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = ({
  entityType = 'deal', deal, onUpdateDeal, record, values: valuesProp, onSaveValues, rollups, disabled, hiddenGroups = [], onManage,
}) => {
  const { definitions } = useFieldDefinitions(entityType);
  const groups = groupDefinitions(definitions).filter(g => !hiddenGroups.includes(g.group));
  const values = (entityType === 'deal' ? deal?.customFields : valuesProp) ?? {};
  const computed = useMemo(
    () => computedForRecord(entityType, definitions, (entityType === 'deal' ? deal : record) as Record<string, unknown> | null, values, rollups),
    [entityType, definitions, deal, record, values, rollups],
  );

  const setValue = (key: string, value: CustomFieldValue) => {
    const next = withCustomValue(values, key, value);
    if (entityType === 'deal') return onUpdateDeal?.({ customFields: next });
    return onSaveValues?.(next);
  };

  return (
    <section aria-label="Custom fields" className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
          <SlidersHorizontal className="mr-2 h-5 w-5 text-gray-600 dark:text-gray-400" />Custom fields
        </h4>
        {onManage && (
          <button type="button" onClick={onManage} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20">
            <Settings2 className="h-4 w-4" />Manage fields
          </button>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          {definitions.some(d => d.isActive) ? 'All custom field groups are hidden.' : 'No custom fields yet.'}
        </p>
      ) : groups.map(g => (
        <div key={g.group} role="group" aria-label={g.group} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h5 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{g.group}</h5>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {g.defs.map(d => (
              <CustomFieldCell key={d.id} definition={d} disabled={disabled} value={values[d.key]} computed={computed[d.key]} onChange={v => setValue(d.key, v)} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
};

export default CustomFieldsSection;
