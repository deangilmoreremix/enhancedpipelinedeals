import React, { useEffect, useState } from 'react';
import type { PipelineStage } from '../../types';
import { RELATIVE_DATE_OPTIONS } from '../../services/advancedFilteringService';
import { ViewFilterValueInput } from '../views/ViewFilterValueInput';
import { DraftValue, FieldKind, PRIORITY_OPTIONS } from './filterFieldConfig';

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent';

interface Props {
  field: string;
  kind: FieldKind;
  opKey: string;
  value: DraftValue;
  onChange: (v: DraftValue) => void;
  stages: PipelineStage[];
  ariaLabel?: string;
}

/** Comma separated list input that keeps what the user typed while exposing string[]. */
const ListInput: React.FC<{ value: string[]; onChange: (v: string[]) => void; ariaLabel?: string }> = ({ value, onChange, ariaLabel }) => {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => {
    // external reset (e.g. operator switch)
    if (value.length === 0 && text.trim() !== '' && text.split(',').every(t => !t.trim())) setText('');
  }, [value, text]);
  return (
    <input
      type="text"
      value={text}
      aria-label={ariaLabel}
      placeholder="Comma separated"
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.split(',').map(t => t.trim()).filter(Boolean));
      }}
      className={INPUT_CLASS}
    />
  );
};

const dayString = (v: string | number | Date): string => {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  return String(v);
};

/** Value editor for one filter condition; adapts to the field kind and operator. */
export const FilterBarValueInput: React.FC<Props> = ({ field, kind, opKey, value, onChange, stages, ariaLabel }) => {
  if (opKey === 'is_null' || opKey === 'is_not_null') {
    return <p className="text-xs text-gray-500 dark:text-gray-400 py-2">No value needed.</p>;
  }

  if (opKey === 'relative') {
    return (
      <select value={String(value)} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel ?? 'Relative date'} className={INPUT_CLASS}>
        {RELATIVE_DATE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  }

  if (kind === 'boolean') {
    return (
      <select value={value === true ? 'true' : 'false'} onChange={(e) => onChange(e.target.value === 'true')} aria-label={ariaLabel ?? 'Value'} className={INPUT_CLASS}>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  const options = field === 'stage'
    ? stages.map(s => ({ id: s.key, label: s.name, value: s.key }))
    : field === 'priority'
      ? PRIORITY_OPTIONS.map(p => ({ ...p, value: p.id }))
      : undefined;

  if (opKey === 'in' || opKey === 'not_in') {
    const selected = Array.isArray(value) ? value : [];
    if (!options) return <ListInput value={selected} onChange={onChange} ariaLabel={ariaLabel} />;
    return (
      <div className="max-h-44 overflow-auto space-y-1" role="group" aria-label={ariaLabel ?? 'Values'}>
        {options.map(o => (
          <label key={o.id} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter(v => v !== o.id))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (opKey === 'between') {
    const pair = Array.isArray(value) && value.length === 2 ? value : ['', ''];
    const set = (i: 0 | 1, v: string) => onChange(i === 0 ? [v, pair[1]] : [pair[0], v]);
    if (kind === 'date') {
      return (
        <div className="space-y-2">
          <ViewFilterValueInput field={field} operator="after" value={pair[0]} fieldType="date" hideOperator ariaLabel="From date" onChange={(v) => set(0, dayString(v))} />
          <ViewFilterValueInput field={field} operator="before" value={pair[1]} fieldType="date" hideOperator ariaLabel="To date" onChange={(v) => set(1, dayString(v))} />
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-2">
        <input type="number" value={pair[0]} placeholder="Min" aria-label="Minimum" onChange={(e) => set(0, e.target.value)} className={INPUT_CLASS} />
        <span className="text-gray-500 text-sm">and</span>
        <input type="number" value={pair[1]} placeholder="Max" aria-label="Maximum" onChange={(e) => set(1, e.target.value)} className={INPUT_CLASS} />
      </div>
    );
  }

  const scalar = typeof value === 'string' ? value : '';

  if (kind === 'number') {
    return <input type="number" value={scalar} placeholder="Enter number" aria-label={ariaLabel ?? 'Value'} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />;
  }

  if (kind === 'date') {
    return <ViewFilterValueInput field={field} operator={opKey} value={scalar} fieldType="date" hideOperator ariaLabel={ariaLabel ?? 'Date'} onChange={(v) => onChange(dayString(v))} />;
  }

  if (kind === 'select' && options) {
    return <ViewFilterValueInput field={field} operator={opKey} value={scalar} fieldType="select" options={options} hideOperator ariaLabel={ariaLabel ?? 'Value'} onChange={(v) => onChange(dayString(v))} />;
  }

  return <ViewFilterValueInput field={field} operator={opKey} value={scalar} fieldType="text" hideOperator ariaLabel={ariaLabel ?? 'Value'} onChange={(v) => onChange(dayString(v))} />;
};

export default FilterBarValueInput;
