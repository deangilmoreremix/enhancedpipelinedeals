import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { CustomFieldValue, DealFieldDefinition } from '../../../types/customFields';
import { RATING_MAX, isEmptyValue, validateCustomValue } from '../../../services/customFieldService';
import { ERROR_TEXT, formatComputed, type ComputedFieldValue } from '../../../utils/formula';
import { TextField } from './TextField';
import { SelectField } from './SelectField';
import { DateField } from './DateField';
import { MultiSelectField } from './MultiSelectField';
import { RatingField } from './RatingField';

export interface CustomFieldCellProps {
  definition: DealFieldDefinition;
  value: CustomFieldValue | undefined;
  /** Persist the normalised value (null clears). Rejection surfaces inline + as a toast. */
  onChange: (value: CustomFieldValue) => Promise<unknown> | unknown;
  disabled?: boolean;
  /** Computed result for `formula` / `rollup` definitions (read-only; '#ERR' + tooltip on failure). */
  computed?: ComputedFieldValue;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toIsoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Inline-edit cell for one custom field; picks the editor from the definition type. */
export const CustomFieldCell: React.FC<CustomFieldCellProps> = ({ definition: def, value, onChange, disabled, computed }) => {
  const save = (raw: unknown) => {
    const r = validateCustomValue(def, raw);
    if (!r.ok) throw new Error(r.error);
    return onChange(r.value);
  };

  switch (def.type) {
    case 'formula':
    case 'rollup': {
      const text = formatComputed(computed, def.config);
      return (
        <div data-testid={`computed-${def.key}`}>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{def.label}</div>
          <div
            title={computed?.error ?? `${def.type === 'formula' ? 'Calculated' : 'Rolled up'} automatically`}
            aria-label={`${def.label}: ${text || 'empty'}`}
            className={`rounded-lg px-2 py-1 text-sm ${computed?.error ? 'font-semibold text-red-600 dark:text-red-400' : text ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}
          >
            {text || (computed?.error ? ERROR_TEXT : '-')}
          </div>
        </div>
      );
    }
    case 'select':
      return (
        <SelectField
          label={def.label}
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
          options={[{ value: '', label: 'None' }, ...def.options.map(o => ({ value: o, label: o }))]}
          onSave={next => save(next)}
        />
      );
    case 'multi_select':
      return <MultiSelectField label={def.label} disabled={disabled} value={Array.isArray(value) ? value : []} options={def.options} onSave={next => save(next)} />;
    case 'rating':
      return <RatingField label={def.label} disabled={disabled} max={RATING_MAX} value={typeof value === 'number' ? value : null} onSave={next => save(next)} />;
    case 'date':
      return (
        <DateField
          label={def.label}
          disabled={disabled}
          value={typeof value === 'string' && value ? new Date(`${value.slice(0, 10)}T00:00:00`) : null}
          onSave={d => save(d ? toIsoDay(d) : null)}
        />
      );
    default: {
      const text = isEmptyValue(value) ? '' : String(value);
      const href = text
        ? def.type === 'email' ? `mailto:${text}` : def.type === 'phone' ? `tel:${text}` : def.type === 'link' ? text : null
        : null;
      return (
        <div className="relative">
          <TextField
            label={def.label}
            disabled={disabled}
            value={text}
            placeholder={def.type === 'link' ? 'https://' : 'Empty'}
            validate={next => { const r = validateCustomValue(def, next); return r.ok ? null : r.error; }}
            onSave={next => save(next)}
            className={href ? 'pr-7' : ''}
          />
          {href && (
            <a
              href={href}
              target={def.type === 'link' ? '_blank' : undefined}
              rel="noopener noreferrer"
              aria-label={`Open ${def.label}`}
              className="absolute bottom-1.5 right-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      );
    }
  }
};

export default CustomFieldCell;
