import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useInlineField } from './useInlineField';

export interface MultiSelectFieldProps {
  label?: string;
  value: string[];
  options: string[];
  onSave: (next: string[]) => Promise<unknown> | unknown;
  disabled?: boolean;
  className?: string;
}

/** Click-to-edit multi select: tick options, Save commits, Cancel/Esc discards. */
export const MultiSelectField: React.FC<MultiSelectFieldProps> = ({ label, value, options, onSave, disabled, className = '' }) => {
  const f = useInlineField<string[]>(onSave, label);
  const [draft, setDraft] = useState<string[]>(value);
  useEffect(() => { if (f.editing) setDraft(value); }, [f.editing, value]);

  const shown = f.pending ? f.pending.value : value;
  const toggle = (o: string) => setDraft(d => (d.includes(o) ? d.filter(x => x !== o) : [...d, o]));
  const changed = draft.length !== value.length || draft.some(x => !value.includes(x));

  return (
    <div className={className}>
      {label && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>}
      {f.editing ? (
        <div
          role="group"
          aria-label={label}
          className="rounded-lg border border-blue-500 bg-white p-2 dark:bg-gray-700"
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); f.cancel(); } }}
        >
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {options.map(o => (
              <label key={o} className="flex cursor-pointer items-center gap-2 text-sm text-gray-900 dark:text-white">
                <input type="checkbox" checked={draft.includes(o)} onChange={() => toggle(o)} aria-label={o} />
                {o}
              </label>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={f.cancel} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600">Cancel</button>
            <button
              type="button"
              disabled={!changed}
              onClick={() => (changed ? void f.commit(draft) : f.cancel())}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />Save
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={f.start}
          title={disabled ? undefined : 'Click to edit'}
          className={`flex min-h-[2rem] w-full flex-wrap items-center gap-1 rounded-lg px-2 py-1 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-gray-700/60 ${f.pending ? 'opacity-60' : ''}`}
        >
          {shown.length === 0
            ? <span className="text-gray-400 dark:text-gray-500">Empty</span>
            : shown.map(v => <span key={v} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{v}</span>)}
        </button>
      )}
      {f.error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{f.error}</p>}
    </div>
  );
};

export default MultiSelectField;
