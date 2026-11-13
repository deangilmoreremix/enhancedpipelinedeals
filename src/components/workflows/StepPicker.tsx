import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { ALL_ENTRIES, CATEGORY_ORDER, entryRef, type RegistryEntry } from '../../services/workflowActionRegistry';
import { iconFor } from './workflowIcons';

export const STEP_DRAG_MIME = 'application/x-workflow-step';

interface StepPickerProps {
  onSelect: (entry: RegistryEntry) => void;
  onClose?: () => void;
  /** 'panel' = embedded palette (draggable items), 'popover' = floating picker. */
  variant?: 'panel' | 'popover';
  /** The workflow already has a trigger step: further triggers are disabled. */
  hasTrigger?: boolean;
  /** Triggers cannot be added in this context (e.g. after another step). */
  triggerBlockedReason?: string;
  title?: string;
}

/** Why an entry cannot be added (undefined = available). */
export function disabledReason(entry: RegistryEntry, hasTrigger: boolean, triggerBlockedReason?: string): string | undefined {
  if (!entry.engines.server) {
    return entry.engines.client
      ? 'Not supported by the server runner yet (browser only), so it cannot run automatically.'
      : 'Not supported yet.';
  }
  if (entry.category === 'Triggers' && triggerBlockedReason) return triggerBlockedReason;
  if (entry.category === 'Triggers' && hasTrigger) return 'This workflow already has a trigger.';
  return undefined;
}

export const StepPicker: React.FC<StepPickerProps> = ({ onSelect, onClose, variant = 'popover', hasTrigger = false, triggerBlockedReason, title = 'Add a step' }) => {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matches = ALL_ENTRIES.filter(e => !needle || `${e.label} ${e.description} ${e.key} ${e.category}`.toLowerCase().includes(needle));
    return CATEGORY_ORDER.map(c => ({ category: c, items: matches.filter(e => e.category === c) })).filter(g => g.items.length > 0);
  }, [q]);

  return (
    <div
      role={variant === 'popover' ? 'dialog' : 'region'}
      aria-label={title}
      className={variant === 'popover'
        ? 'w-80 max-h-[26rem] flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl'
        : 'flex flex-col h-full min-h-0'}
    >
      <div className="p-3 border-b border-gray-100 dark:border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-2 text-gray-400" aria-hidden />
          <input
            autoFocus={variant === 'popover'}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search steps"
            aria-label="Search steps"
            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {groups.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 p-2">No matching steps.</p>}
        {groups.map(g => (
          <div key={g.category}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{g.category}</div>
            <ul className="space-y-1">
              {g.items.map(entry => {
                const Icon = iconFor(entry.icon);
                const reason = disabledReason(entry, hasTrigger, triggerBlockedReason);
                return (
                  <li key={entryRef(entry)}>
                    <button
                      type="button"
                      disabled={Boolean(reason)}
                      title={reason ?? entry.description}
                      draggable={!reason && variant === 'panel'}
                      onDragStart={e => { e.dataTransfer.setData(STEP_DRAG_MIME, entryRef(entry)); e.dataTransfer.effectAllowed = 'move'; }}
                      onClick={() => onSelect(entry)}
                      className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left border border-transparent hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-transparent"
                    >
                      <span className="mt-0.5 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"><Icon className="w-4 h-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
                          {entry.label}
                          {entry.engines.server
                            ? <span className="text-[9px] px-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Server</span>
                            : <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Browser only</span>}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{entry.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepPicker;
