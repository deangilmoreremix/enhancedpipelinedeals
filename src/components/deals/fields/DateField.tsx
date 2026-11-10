import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useInlineField } from './useInlineField';

export interface DateFieldProps {
  label?: string;
  value?: Date | string | null;
  /** Receives a Date (local midnight) or null when cleared. */
  onSave: (next: Date | null) => Promise<unknown> | unknown;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const toInput = (v?: Date | string | null): string => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const fromInput = (s: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Click-to-edit date (close date / due date). Enter or blur saves, Esc cancels, empty clears. */
export const DateField: React.FC<DateFieldProps> = ({ label, value, onSave, disabled, placeholder = 'Set date', className = '' }) => {
  const f = useInlineField<Date | null>(onSave, label);
  const [draft, setDraft] = useState(toInput(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (f.editing) { setDraft(toInput(value)); setTimeout(() => ref.current?.focus(), 0); } }, [f.editing, value]);

  const save = () => {
    if (f.cancelled.current) return;
    if (draft === toInput(value)) { f.cancel(); return; }
    void f.commit(fromInput(draft));
  };

  const shownDate = f.pending ? f.pending.value : value ? new Date(value) : null;

  return (
    <div className={className}>
      {label && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>}
      {f.editing ? (
        <input
          ref={ref}
          type="date"
          aria-label={label ?? 'Date'}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); f.cancel(); }
            else if (e.key === 'Enter') { e.preventDefault(); save(); }
          }}
          className="w-full rounded-lg border border-blue-500 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={f.start}
          title={disabled ? undefined : 'Click to edit'}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-gray-700/60 ${
            shownDate && !isNaN(shownDate.getTime()) ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
          } ${f.pending ? 'opacity-60' : ''}`}
        >
          <Calendar className="h-4 w-4 flex-shrink-0 text-gray-400" />
          {shownDate && !isNaN(shownDate.getTime()) ? shownDate.toLocaleDateString() : placeholder}
        </button>
      )}
      {f.error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{f.error}</p>}
    </div>
  );
};

export default DateField;
