import React, { useEffect, useRef, useState } from 'react';
import { useInlineField } from './useInlineField';

export interface TextFieldProps {
  label?: string;
  value: string;
  onSave: (next: string) => Promise<unknown> | unknown;
  placeholder?: string;
  multiline?: boolean;
  /** Return an error message to block the save. */
  validate?: (next: string) => string | null;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  displayClassName?: string;
}

/** Click-to-edit text. Enter (Ctrl/Cmd+Enter when multiline) or blur saves; Esc cancels. */
export const TextField: React.FC<TextFieldProps> = ({
  label, value, onSave, placeholder = 'Empty', multiline, validate, required, disabled, className = '', displayClassName = '',
}) => {
  const f = useInlineField<string>(onSave, label);
  const [draft, setDraft] = useState(value);
  const [localError, setLocalError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { if (f.editing) { setDraft(value); setLocalError(null); setTimeout(() => ref.current?.focus(), 0); } }, [f.editing, value]);

  const save = () => {
    if (f.cancelled.current) return;
    const next = draft.trim();
    if (next === value.trim()) { f.cancel(); return; }
    const problem = required && !next ? `${label ?? 'This field'} is required` : validate?.(next) ?? null;
    if (problem) { setLocalError(problem); return; }
    void f.commit(next);
  };

  const shown = f.pending ? f.pending.value : value;
  const error = localError ?? f.error;

  return (
    <div className={className}>
      {label && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>}
      {f.editing ? (
        multiline ? (
          <textarea
            ref={ref}
            aria-label={label}
            value={draft}
            rows={4}
            onChange={e => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); f.cancel(); }
              else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
            }}
            className="w-full rounded-lg border border-blue-500 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        ) : (
          <input
            ref={ref}
            aria-label={label}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); f.cancel(); }
              else if (e.key === 'Enter') { e.preventDefault(); save(); }
            }}
            className="w-full rounded-lg border border-blue-500 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        )
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={f.start}
          title={disabled ? undefined : 'Click to edit'}
          className={`w-full rounded-lg px-2 py-1 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-gray-700/60 ${
            shown ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
          } ${f.pending ? 'opacity-60' : ''} ${displayClassName}`}
        >
          <span className={multiline ? 'whitespace-pre-line' : ''}>{shown || placeholder}</span>
        </button>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default TextField;
