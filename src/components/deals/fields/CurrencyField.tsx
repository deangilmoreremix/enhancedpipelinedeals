import React, { useEffect, useRef, useState } from 'react';
import { useInlineField } from './useInlineField';
import { CURRENCY_CODES, formatMoney, parseAmountInput, toMicros } from '../../../utils/currencyMicros';

export interface CurrencyValue {
  /** Major units (e.g. 1500.25). */
  value: number;
  /** Integer micros (1_500_250_000) - what `deals.amount_micros` stores. */
  amountMicros: number;
  currencyCode: string;
}

export interface CurrencyFieldProps {
  label?: string;
  /** Amount in major units. */
  value: number;
  currencyCode?: string;
  onSave: (next: CurrencyValue) => Promise<unknown> | unknown;
  disabled?: boolean;
  className?: string;
}

/**
 * Click-to-edit money. Displays/edits major units, emits micros + currency code on save.
 * Focus may move between the amount input and the currency select without saving; leaving both saves.
 */
export const CurrencyField: React.FC<CurrencyFieldProps> = ({
  label = 'Amount', value, currencyCode = 'USD', onSave, disabled, className = '',
}) => {
  const f = useInlineField<CurrencyValue>(onSave, label);
  const [draft, setDraft] = useState(String(value));
  const [code, setCode] = useState(currencyCode);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (f.editing) {
      setDraft(Number.isFinite(value) ? String(value) : '');
      setCode(currencyCode);
      setLocalError(null);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [f.editing, value, currencyCode]);

  const save = () => {
    if (f.cancelled.current) return;
    const amount = parseAmountInput(draft);
    if (amount === null || amount < 0) { setLocalError('Enter a valid amount'); return; }
    if (amount === value && code === currencyCode) { f.cancel(); return; }
    void f.commit({ value: amount, amountMicros: toMicros(amount), currencyCode: code });
  };

  const onBlurWithin = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    save();
  };

  const shown = f.pending ? f.pending.value : { value, currencyCode, amountMicros: toMicros(value) };
  const error = localError ?? f.error;

  return (
    <div className={className}>
      {label && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>}
      {f.editing ? (
        <div className="flex items-center gap-2" onBlur={onBlurWithin}>
          <input
            ref={inputRef}
            aria-label={label}
            inputMode="decimal"
            value={draft}
            autoFocus
            onChange={e => { setDraft(e.target.value); setLocalError(null); }}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.preventDefault(); f.cancel(); }
              else if (e.key === 'Enter') { e.preventDefault(); save(); }
            }}
            className="w-full rounded-lg border border-blue-500 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <select
            aria-label="Currency"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); f.cancel(); } }}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {[...new Set([currencyCode, ...CURRENCY_CODES])].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={f.start}
          title={disabled ? undefined : 'Click to edit'}
          className={`w-full rounded-lg px-2 py-1 text-left text-lg font-semibold text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-default disabled:hover:bg-transparent dark:text-white dark:hover:bg-gray-700/60 ${f.pending ? 'opacity-60' : ''}`}
        >
          {formatMoney(shown.value, shown.currencyCode)}
        </button>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default CurrencyField;
