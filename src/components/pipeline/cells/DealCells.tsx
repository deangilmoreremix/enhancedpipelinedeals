import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Deal, PipelineStage } from '../../../types';
import { useInlineField } from '../../deals/fields/useInlineField';
import { OwnerPicker } from '../../deals/fields/OwnerPicker';
import { CompanyPicker } from '../../deals/fields/CompanyPicker';
import { parseAmountInput } from '../../../utils/currencyMicros';
import { stageColorClasses } from '../../../utils/stageMeta';

/**
 * Compact inline-edit cells for table rows, list rows and board cards.
 * They render the same text/chips as the read-only UI until hovered (subtle ring) or clicked.
 * Enter/blur saves, Esc cancels. Saves go through `onSave(updates)` (dealStore.updateDeal: optimistic,
 * rolls back and rejects on failure; useInlineField raises the error toast). Mouse events stop propagating
 * so row/card clicks, selection and drag-and-drop are never triggered from inside an editor.
 */

export type CellSave = (updates: Partial<Deal>) => Promise<unknown> | unknown;

const stop = (e: React.SyntheticEvent) => e.stopPropagation();
export const cellHoverClass =
  'rounded px-1 -mx-1 cursor-text transition-shadow hover:ring-1 hover:ring-blue-300 dark:hover:ring-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const editorClass =
  'w-full min-w-[4rem] rounded border border-blue-500 bg-white px-1.5 py-0.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

interface BaseCellProps {
  /** Accessible name, e.g. "Title". */
  label: string;
  disabled?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Text / number / date
// ---------------------------------------------------------------------------

interface InputCellProps<T> extends BaseCellProps {
  value: T;
  /** Render the read-only content (defaults to the raw value). */
  display?: (value: T) => React.ReactNode;
  onCommit: (next: T) => Promise<unknown> | unknown;
}

const InputCell = <T extends string | number | Date | null | undefined>({
  label, value, display, onCommit, disabled, className = '',
  inputType, toDraft, fromDraft, inputMode, placeholder
}: InputCellProps<T> & {
  inputType: 'text' | 'date';
  toDraft: (v: T) => string;
  /** Returns the parsed value, or an error message. */
  fromDraft: (draft: string) => { ok: true; value: T } | { ok: false; error: string };
  inputMode?: 'decimal' | 'numeric';
  placeholder?: string;
}) => {
  const f = useInlineField<T>(onCommit, label);
  const [draft, setDraft] = useState(toDraft(value));
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (f.editing) { setDraft(toDraft(value)); setErr(null); setTimeout(() => ref.current?.focus(), 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.editing]);

  const save = () => {
    if (f.cancelled.current) return;
    const parsed = fromDraft(draft);
    if (!parsed.ok) { setErr(parsed.error); return; }
    if (toDraft(parsed.value) === toDraft(value)) { f.cancel(); return; }
    void f.commit(parsed.value);
  };

  const shown = (f.pending ? f.pending.value : value) as T;

  if (f.editing) {
    return (
      <span className={`block ${className}`} onClick={stop} onMouseDown={stop} onPointerDown={stop}>
        <input
          ref={ref}
          type={inputType}
          inputMode={inputMode}
          aria-label={label}
          aria-invalid={err ? true : undefined}
          placeholder={placeholder}
          value={draft}
          onChange={e => { setDraft(e.target.value); setErr(null); }}
          onBlur={save}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Escape') { e.preventDefault(); f.cancel(); }
            else if (e.key === 'Enter') { e.preventDefault(); save(); }
          }}
          className={editorClass}
        />
        {err && <span role="alert" className="block text-xs text-red-600 dark:text-red-400">{err}</span>}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Edit ${label}`}
      title={disabled ? undefined : `Click to edit ${label.toLowerCase()}`}
      onClick={e => { e.stopPropagation(); if (!disabled) f.start(); }}
      onMouseDown={stop}
      onPointerDown={stop}
      className={`block max-w-full text-left ${disabled ? '' : cellHoverClass} ${f.pending ? 'opacity-60' : ''} ${className}`}
    >
      {display ? display(shown) : String(shown ?? '')}
    </button>
  );
};

export const TextCell: React.FC<BaseCellProps & {
  value: string;
  onCommit: (next: string) => Promise<unknown> | unknown;
  display?: (v: string) => React.ReactNode;
  required?: boolean;
  placeholder?: string;
}> = ({ required, ...p }) => (
  <InputCell<string>
    {...p}
    inputType="text"
    toDraft={v => v ?? ''}
    fromDraft={d => (required && !d.trim() ? { ok: false, error: `${p.label} is required` } : { ok: true, value: d.trim() })}
  />
);

/** Money / plain number. `integer` limits to whole numbers within [min, max]. */
export const NumberCell: React.FC<BaseCellProps & {
  value: number;
  onCommit: (next: number) => Promise<unknown> | unknown;
  display?: (v: number) => React.ReactNode;
  min?: number;
  max?: number;
  integer?: boolean;
}> = ({ min = 0, max, integer, ...p }) => (
  <InputCell<number>
    {...p}
    inputType="text"
    inputMode="decimal"
    toDraft={v => (Number.isFinite(v) ? String(v) : '')}
    fromDraft={d => {
      const n = parseAmountInput(d);
      if (n === null || n < min || (max !== undefined && n > max)) return { ok: false, error: 'Enter a valid number' };
      return { ok: true, value: integer ? Math.round(n) : n };
    }}
  />
);

const toDateInput = (v?: Date | null): string => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const DateCell: React.FC<BaseCellProps & {
  value?: Date | string | null;
  onCommit: (next: Date | null) => Promise<unknown> | unknown;
  display?: (v: Date | null) => React.ReactNode;
  placeholder?: string;
}> = ({ value, placeholder = 'Set date', display, ...p }) => {
  const asDate = value ? new Date(value) : null;
  return (
    <InputCell<Date | null>
      {...p}
      value={asDate && !isNaN(asDate.getTime()) ? asDate : null}
      inputType="date"
      toDraft={toDateInput}
      fromDraft={d => {
        if (!d) return { ok: true, value: null };
        const [y, m, day] = d.split('-').map(Number);
        return { ok: true, value: new Date(y, m - 1, day) };
      }}
      display={v => (display ? display(v) : v ? v.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>)}
    />
  );
};

// ---------------------------------------------------------------------------
// Chip menus (stage, priority)
// ---------------------------------------------------------------------------

export interface ChipOption {
  value: string;
  label: string;
  chipClassName: string;
  chipStyle?: React.CSSProperties;
}

const ChipMenuCell: React.FC<BaseCellProps & {
  value: string;
  options: ChipOption[];
  onCommit: (next: string) => Promise<unknown> | unknown;
  chipBase: string;
  /** Custom button content (defaults to the option label). */
  renderLabel?: (opt: ChipOption | undefined, current: string) => React.ReactNode;
}> = ({ label, value, options, onCommit, disabled, className = '', chipBase, renderLabel }) => {
  const f = useInlineField<string>(onCommit, label);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 4 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const current = f.pending ? f.pending.value : value;
  const opt = options.find(o => o.value === current);

  return (
    <span className={`inline-block ${className}`} onClick={stop} onMouseDown={stop} onPointerDown={stop}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${opt?.label ?? current}`}
        onClick={e => { e.stopPropagation(); if (!disabled) setOpen(o => !o); }}
        style={opt?.chipStyle}
        className={`${chipBase} ${opt?.chipClassName ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'} ${disabled ? '' : 'hover:ring-1 hover:ring-blue-300 dark:hover:ring-blue-600'} ${f.pending ? 'opacity-60' : ''}`}
      >
        {renderLabel ? renderLabel(opt, current) : opt?.label ?? current}
      </button>
      {open && pos && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={label}
          style={{ position: 'fixed', left: pos.left, top: pos.top }}
          className="z-[70] min-w-[10rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {options.map(o => (
            <li key={o.value} role="option" aria-selected={o.value === current}>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setOpen(false); if (o.value !== value) void f.commit(o.value); }}
                className={`flex w-full items-center px-3 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700 ${o.value === current ? 'font-semibold' : ''}`}
              >
                <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${o.chipClassName.split(' ')[0]}`} style={o.chipStyle ? { backgroundColor: o.chipStyle.color as string } : undefined} />
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
};

/** Stage chip (tinted by the stage colour) with a dropdown of visible stages (+ the current one). */
export const StageCell: React.FC<BaseCellProps & {
  value: string;
  stages: PipelineStage[];
  onCommit: (next: string) => Promise<unknown> | unknown;
  chipBase?: string;
}> = ({ stages, value, chipBase = 'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full', ...p }) => {
  const options: ChipOption[] = [...stages]
    .sort((a, b) => a.position - b.position)
    .filter(s => s.visible || s.key === value)
    .map(s => {
      const c = stageColorClasses(s.color);
      return { value: s.key, label: s.name, chipClassName: c.chip, chipStyle: c.style };
    });
  if (!options.some(o => o.value === value)) options.push({ value, label: value, chipClassName: stageColorClasses('gray').chip });
  return <ChipMenuCell {...p} value={value} options={options} chipBase={chipBase} />;
};

const PRIORITY_CHIPS: ChipOption[] = [
  { value: 'high', label: 'High', chipClassName: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'medium', label: 'Medium', chipClassName: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { value: 'low', label: 'Low', chipClassName: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }
];

export const PriorityCell: React.FC<BaseCellProps & {
  value: Deal['priority'];
  onCommit: (next: Deal['priority']) => Promise<unknown> | unknown;
  chipBase?: string;
}> = ({ chipBase = 'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize', onCommit, value, ...p }) => (
  <ChipMenuCell {...p} value={value} options={PRIORITY_CHIPS} chipBase={chipBase} onCommit={v => onCommit(v as Deal['priority'])} />
);

const PRIORITY_DOT: Record<string, string> = { high: 'bg-red-500', medium: 'bg-yellow-500', low: 'bg-green-500' };
const PRIORITY_DOT_OPTIONS: ChipOption[] = [
  { value: 'high', label: 'High Priority', chipClassName: '' },
  { value: 'medium', label: 'Medium Priority', chipClassName: '' },
  { value: 'low', label: 'Low Priority', chipClassName: '' }
];

/** Priority as the board card shows it (dot + label), editable in place. */
export const PriorityDotCell: React.FC<BaseCellProps & {
  value: Deal['priority'];
  onCommit: (next: Deal['priority']) => Promise<unknown> | unknown;
}> = ({ value, onCommit, ...p }) => (
  <ChipMenuCell
    {...p}
    value={value}
    options={PRIORITY_DOT_OPTIONS}
    chipBase="inline-flex items-center space-x-2 rounded-full px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300 font-medium"
    onCommit={v => onCommit(v as Deal['priority'])}
    renderLabel={(opt, cur) => (
      <>
        <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[cur] ?? 'bg-gray-400'}`} />
        <span>{opt?.label ?? cur}</span>
      </>
    )}
  />
);

// ---------------------------------------------------------------------------
// Relations (G's pickers in compact `cell` variant)
// ---------------------------------------------------------------------------

export const OwnerCell: React.FC<{ deal: Deal; onSave: CellSave; disabled?: boolean }> = ({ deal, onSave, disabled }) => (
  <span className="block" onClick={stop} onMouseDown={stop} onPointerDown={stop}>
    <OwnerPicker
      variant="cell"
      value={deal.ownerId ?? deal.assignedToId}
      label={deal.assignedTo}
      disabled={disabled}
      onChange={(ownerId, name) => onSave({
        // null clears the columns (the mapper writes explicit nulls)
        ownerId: (ownerId ?? null) as unknown as string | undefined,
        assignedToId: (ownerId ?? null) as unknown as string | undefined,
        assignedTo: (name || null) as unknown as string | undefined
      })}
    />
  </span>
);

export const CompanyCell: React.FC<{ deal: Deal; onSave: CellSave; disabled?: boolean }> = ({ deal, onSave, disabled }) => (
  <span className="block" onClick={stop} onMouseDown={stop} onPointerDown={stop}>
    <CompanyPicker
      variant="cell"
      value={deal.companyId}
      label={deal.company}
      disabled={disabled}
      onChange={(companyId, company) => onSave({ companyId: (companyId ?? null) as unknown as string | undefined, company })}
    />
  </span>
);
