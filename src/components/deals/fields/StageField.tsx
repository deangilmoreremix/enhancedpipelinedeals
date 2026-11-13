import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PipelineStage } from '../../../types';
import { useDealStore } from '../../../store/dealStore';
import { useInlineField } from './useInlineField';
import { stageChip } from './stageColors';

export interface StageFieldProps {
  label?: string;
  /** Stage key. */
  value: string;
  /** Defaults to the stages in useDealStore. */
  stages?: PipelineStage[];
  onSave: (nextKey: string) => Promise<unknown> | unknown;
  disabled?: boolean;
  className?: string;
}

/** Stage chip (colored from pipeline_stages) with a dropdown of visible stages. */
export const StageField: React.FC<StageFieldProps> = ({ label, value, stages, onSave, disabled, className = '' }) => {
  const storeStages = useDealStore(s => s.stages);
  const list = [...(stages ?? storeStages)].filter(s => s.visible || s.key === value).sort((a, b) => a.position - b.position);
  const f = useInlineField<string>(onSave, label ?? 'Stage');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const current = f.pending ? f.pending.value : value;
  const stage = list.find(s => s.key === current);
  const chip = stageChip(stage?.color);
  const name = stage?.name ?? current.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const pick = (key: string) => {
    setOpen(false);
    if (key !== value) void f.commit(key);
  };

  return (
    <div className={className} ref={wrapRef}>
      {label && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>}
      <div className="relative inline-block">
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          style={chip.style}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-default ${chip.className} ${f.pending ? 'opacity-60' : ''}`}
        >
          {name}
          {!disabled && <ChevronDown className="h-3 w-3" />}
        </button>
        {open && (
          <ul role="listbox" aria-label="Stage" className="absolute left-0 z-30 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {list.map(s => {
              const c = stageChip(s.color);
              return (
                <li key={s.key} role="option" aria-selected={s.key === current}>
                  <button
                    type="button"
                    onClick={() => pick(s.key)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${s.key === current ? 'font-semibold' : ''} text-gray-800 dark:text-gray-100`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${c.className}`} style={c.style} />
                    {s.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {f.error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{f.error}</p>}
    </div>
  );
};

export default StageField;
