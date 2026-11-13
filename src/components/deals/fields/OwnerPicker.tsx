import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, UserCircle2, UserPlus } from 'lucide-react';
import { useUserDirectoryStore } from '../../../store/userDirectoryStore';
import { initialsAvatar } from '../../../utils/avatar';
import { useInlineField } from './useInlineField';
import { PickerOption, PickerPopover } from './PickerPopover';

export interface OwnerPickerProps {
  /** Owner id (profiles.id). */
  value?: string;
  /** Display-name fallback (deal.assignedTo) shown when the id is not in the directory. */
  label?: string;
  /** Called with (ownerId, ownerName). Unassigned passes (undefined, ''). */
  onChange: (id: string | undefined, name: string) => Promise<unknown> | unknown;
  fieldLabel?: string;
  /** field = labelled record field, cell = compact inline (tables/cards), button = "Set owner…" action trigger. */
  variant?: 'field' | 'cell' | 'button';
  buttonLabel?: string;
  /** Where the menu opens (use "top" for bottom-fixed bars). */
  placement?: 'bottom' | 'top';
  includeUnassigned?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}

const UNASSIGNED = '__unassigned__';

/** Avatar + name owner picker backed by the user directory (profiles + current user). */
export const OwnerPicker: React.FC<OwnerPickerProps> = ({
  value, label = '', onChange, fieldLabel = 'Owner', variant = 'field', buttonLabel = 'Set owner…', placement = 'bottom',
  includeUnassigned = true, disabled, className = '', buttonClassName = '',
}) => {
  const users = useUserDirectoryStore(s => s.users);
  const load = useUserDirectoryStore(s => s.load);
  const f = useInlineField<{ id: string | undefined; name: string }>(next => onChange(next.id, next.name), fieldLabel);
  const [query, setQuery] = useState('');

  useEffect(() => { void load(); }, [load]);

  const current = value ? users.find(u => u.id === value) : undefined;
  const shownName = f.pending ? f.pending.value.name : current?.name ?? label;
  const shownAvatar = current?.avatar ?? (shownName ? initialsAvatar(shownName, 48) : undefined);

  const options = useMemo<PickerOption[]>(() => {
    const needle = query.trim().toLowerCase();
    const list = users.filter(u => !needle || u.name.toLowerCase().includes(needle));
    const out: PickerOption[] = [];
    if (includeUnassigned && (!needle || 'unassigned'.includes(needle))) {
      out.push({ key: UNASSIGNED, label: 'Unassigned', selected: !value && !label });
    }
    list.forEach(u => out.push({ key: u.id, label: u.name, avatar: u.avatar ?? initialsAvatar(u.name, 48), selected: u.id === value }));
    return out;
  }, [users, query, includeUnassigned, value, label]);

  const select = async (o: PickerOption) => {
    if (o.key === UNASSIGNED) { await f.commit({ id: undefined, name: '' }); return; }
    const u = users.find(x => x.id === o.key);
    if (u) await f.commit({ id: u.id, name: u.name });
  };

  const isCell = variant === 'cell';
  const isButton = variant === 'button';
  return (
    <div className={className}>
      {variant === 'field' && fieldLabel && (
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{fieldLabel}</div>
      )}
      <PickerPopover
        options={options}
        query={query}
        onQueryChange={setQuery}
        onSelect={select}
        ariaLabel="Search people"
        placeholder="Search people"
        emptyText="No people found"
        placement={placement}
        disabled={disabled}
        className={variant === 'field' || isCell ? 'w-full' : ''}
        renderTrigger={({ open, toggle, listId }) =>
          isButton ? (
            <button
              type="button"
              disabled={disabled}
              onClick={toggle}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              className={buttonClassName || 'flex items-center space-x-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              <span>{buttonLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={toggle}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-label={isCell ? `Owner: ${shownName || 'unassigned'}` : undefined}
              className={`flex w-full items-center gap-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-gray-700/60 ${
                isCell ? 'px-1.5 py-0.5' : 'px-2 py-1'
              } ${shownName ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'} ${f.pending ? 'opacity-60' : ''}`}
            >
              {shownName && shownAvatar
                ? <img src={shownAvatar} alt="" className={`flex-shrink-0 rounded-full object-cover ${isCell ? 'h-5 w-5' : 'h-6 w-6'}`} />
                : <UserCircle2 className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{shownName || 'Unassigned'}</span>
              {!isCell && !disabled && <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" aria-hidden />}
            </button>
          )
        }
      />
      {f.error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{f.error}</p>}
    </div>
  );
};

export default OwnerPicker;
