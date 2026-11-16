import React from 'react';
import { Settings2, SlidersHorizontal } from 'lucide-react';
import type { Deal } from '../../../types';
import type { CustomFieldValue } from '../../../types/customFields';
import { groupDefinitions, withCustomValue } from '../../../services/customFieldService';
import { CustomFieldCell } from './CustomFieldCell';
import { useFieldDefinitions } from './useFieldDefinitions';

export interface CustomFieldsSectionProps {
  deal: Deal;
  /** Persist a partial deal update (the section sends `{ customFields }`). */
  onUpdateDeal: (updates: Partial<Deal>) => Promise<unknown>;
  disabled?: boolean;
  /** Group names to hide (see `hiddenFieldGroups` on the overview). */
  hiddenGroups?: string[];
  /** Opens the ManageFieldsDialog; the button is hidden when omitted. */
  onManage?: () => void;
}

/** Custom field values of a deal, grouped by group_name, each editable inline. */
export const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = ({ deal, onUpdateDeal, disabled, hiddenGroups = [], onManage }) => {
  const { definitions } = useFieldDefinitions();
  const groups = groupDefinitions(definitions).filter(g => !hiddenGroups.includes(g.group));
  const values = deal.customFields ?? {};

  const setValue = (key: string, value: CustomFieldValue) =>
    onUpdateDeal({ customFields: withCustomValue(deal.customFields, key, value) });

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
              <CustomFieldCell key={d.id} definition={d} disabled={disabled} value={values[d.key]} onChange={v => setValue(d.key, v)} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
};

export default CustomFieldsSection;
