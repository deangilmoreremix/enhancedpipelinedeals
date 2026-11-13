import React, { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useInlineField } from './useInlineField';

export interface SelectFieldOption {
  value: string;
  label: string;
  /** Tailwind classes for the display chip. */
  chipClassName?: string;
}

export interface SelectFieldProps {
  label?: string;
  value: string;
  options: SelectFieldOption[];
  onSave: (next: string) => Promise<unknown> | unknown;
  disabled?: boolean;
  className?: string;
}

/** Click-to-edit select (e.g. priority). Change saves immediately; Esc/blur closes. */
export const SelectField: React.FC<SelectFieldProps> = ({ label, value, options, onSave, disabled, className = '' }) => {
  const f = useInlineField<string>(onSave, label);
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => { if (f.editing) ref.current?.focus(); }, [f.editing]);

  const current = f.pending ? f.pending.value : value;
  const opt = options.find(o => o.value === current);

  return (
    <div className={className}>
      {label && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>}
      {f.editing ? (
        <select
          ref={ref}
          aria-label={label}
          value={value}
          onChange={e => { const next = e.target.value; if (next === value) f.cancel(); else void f.commit(next); }}
          onBlur={() => f.cancel()}
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); f.cancel(); } }}
          className="w-full rounded-lg border border-blue-500 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={f.start}
          title={disabled ? undefined : 'Click to edit'}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-default ${
            opt?.chipClassName ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
          } ${f.pending ? 'opacity-60' : ''}`}
        >
          {opt?.label ?? (current || 'None')}
          {!disabled && <ChevronDown className="h-3 w-3" />}
        </button>
      )}
      {f.error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{f.error}</p>}
    </div>
  );
};

export const PRIORITY_OPTIONS: SelectFieldOption[] = [
  { value: 'high', label: 'High priority', chipClassName: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'medium', label: 'Medium priority', chipClassName: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { value: 'low', label: 'Low priority', chipClassName: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
];

export default SelectField;
