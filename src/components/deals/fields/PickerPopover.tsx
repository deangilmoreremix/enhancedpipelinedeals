import React, { useEffect, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export interface PickerOption {
  key: string;
  label: string;
  description?: string;
  /** Image src (logo / avatar). */
  avatar?: string;
  selected?: boolean;
  /** Rendered with a "create" accent. */
  create?: boolean;
}

export interface PickerPopoverProps {
  options: PickerOption[];
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (option: PickerOption) => void | Promise<unknown>;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  ariaLabel: string;
  emptyText?: string;
  loading?: boolean;
  placement?: 'bottom' | 'top';
  avatarShape?: 'circle' | 'square';
  disabled?: boolean;
  className?: string;
  renderTrigger: (p: { open: boolean; toggle: () => void; disabled?: boolean; listId: string }) => React.ReactNode;
}

/**
 * Searchable single-select popover shared by CompanyPicker / OwnerPicker.
 * Keyboard: Arrow Up/Down move, Enter selects, Esc closes (focus returns to the trigger wrapper).
 */
export const PickerPopover: React.FC<PickerPopoverProps> = ({
  options, query, onQueryChange, onSelect, onOpenChange, placeholder, ariaLabel, emptyText = 'No results',
  loading, placement = 'bottom', avatarShape = 'circle', disabled, className = '', renderTrigger,
}) => {
  const [open, setOpenState] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const setOpen = (next: boolean) => { setOpenState(next); onOpenChange?.(next); };
  const toggle = () => { if (!disabled) setOpen(!open); };

  useEffect(() => { setActive(0); }, [query, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpenState(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const choose = (opt: PickerOption) => {
    setOpen(false);
    onQueryChange('');
    void onSelect(opt);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = options[active]; if (o) choose(o); }
  };

  const avatarCls = avatarShape === 'circle' ? 'rounded-full' : 'rounded-md';

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      {renderTrigger({ open, toggle, disabled, listId })}
      {open && (
        <div
          className={`absolute left-0 z-40 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
            placement === 'top' ? 'bottom-full mb-2' : 'mt-1'
          }`}
          onKeyDown={onKeyDown}
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-label={ariaLabel}
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-y-auto">
            {options.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-gray-500 dark:text-gray-400">{loading ? 'Searching...' : emptyText}</li>
            )}
            {options.map((o, i) => (
              <li key={o.key} id={`${listId}-${i}`} role="option" aria-selected={!!o.selected}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
                    i === active ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'
                  }`}
                >
                  {o.avatar && <img src={o.avatar} alt="" className={`h-6 w-6 flex-shrink-0 object-cover ${avatarCls}`} />}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${o.create ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'} ${o.selected ? 'font-semibold' : ''}`}>{o.label}</span>
                    {o.description && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{o.description}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
