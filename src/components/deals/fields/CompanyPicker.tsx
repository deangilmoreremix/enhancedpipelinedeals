import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useCompanyStore } from '../../../store/companyStore';
import { initialsAvatar } from '../../../utils/avatar';
import type { Company } from '../../../types';
import { useInlineField } from './useInlineField';
import { PickerOption, PickerPopover } from './PickerPopover';

export interface CompanyPickerProps {
  /** Linked company id (undefined = free-text / none). */
  value?: string;
  /** Display name (the deal's `company` text) used when the id is unknown or unresolved. */
  label?: string;
  /** Called with (companyId, companyName). Clearing passes (undefined, ''). */
  onChange: (id: string | undefined, name: string) => Promise<unknown> | unknown;
  /** Field label shown above (variant="field"). */
  fieldLabel?: string;
  variant?: 'field' | 'cell';
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  className?: string;
}

const CREATE_KEY = '__create__';
const CLEAR_KEY = '__clear__';

const logoFor = (c: Pick<Company, 'name' | 'logoUrl'>) => c.logoUrl || initialsAvatar(c.name, 48);

/** Searchable company picker with create-on-type. Keeps `companyId` + `company` text in sync via onChange(id, name). */
export const CompanyPicker: React.FC<CompanyPickerProps> = ({
  value, label = '', onChange, fieldLabel = 'Company', variant = 'field', placeholder = 'Add company', disabled, allowCreate = true, className = '',
}) => {
  const search = useCompanyStore(s => s.search);
  const create = useCompanyStore(s => s.create);
  const cached = useCompanyStore(s => (value ? s.companies[value] : undefined));
  const f = useInlineField<{ id: string | undefined; name: string }>(
    next => onChange(next.id, next.name), fieldLabel,
  );
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      search(query).then(list => { if (alive) setResults(list); }).finally(() => { if (alive) setLoading(false); });
    }, query ? 150 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [open, query, search]);

  const shownName = f.pending ? f.pending.value.name : cached?.name ?? label;
  const shownLogo = cached?.logoUrl ?? (shownName ? initialsAvatar(shownName, 48) : undefined);

  const options = useMemo<PickerOption[]>(() => {
    const out: PickerOption[] = results.map(c => ({
      key: c.id, label: c.name, description: [c.industry, c.domain ?? c.website].filter(Boolean).join(' · ') || undefined,
      avatar: logoFor(c), selected: c.id === value,
    }));
    const q = query.trim();
    if (allowCreate && q && !results.some(c => c.name.trim().toLowerCase() === q.toLowerCase())) {
      out.push({ key: CREATE_KEY, label: `Create ‘${q}’`, create: true });
    }
    if (value || shownName) out.push({ key: CLEAR_KEY, label: 'No company' });
    return out;
  }, [results, query, value, shownName, allowCreate]);

  const select = async (o: PickerOption) => {
    if (o.key === CLEAR_KEY) { await f.commit({ id: undefined, name: '' }); return; }
    if (o.key === CREATE_KEY) {
      try {
        const c = await create(query.trim());
        await f.commit({ id: c.id, name: c.name });
      } catch (e) {
        f.setError(e instanceof Error ? e.message : 'Could not create company');
      }
      return;
    }
    const c = results.find(r => r.id === o.key);
    if (c) await f.commit({ id: c.id, name: c.name });
  };

  const isCell = variant === 'cell';
  return (
    <div className={className}>
      {!isCell && fieldLabel && (
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{fieldLabel}</div>
      )}
      <PickerPopover
        options={options}
        query={query}
        onQueryChange={setQuery}
        onSelect={select}
        onOpenChange={setOpen}
        ariaLabel="Search companies"
        placeholder="Search or create company"
        emptyText="No companies found"
        loading={loading}
        avatarShape="square"
        disabled={disabled}
        className={isCell ? 'w-full' : ''}
        renderTrigger={({ open: isOpen, toggle, listId }) => (
          <button
            type="button"
            disabled={disabled}
            onClick={toggle}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={isOpen ? listId : undefined}
            aria-label={isCell ? `Company: ${shownName || 'none'}` : undefined}
            className={`flex w-full items-center gap-2 rounded-lg text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-gray-700/60 ${
              isCell ? 'px-1.5 py-0.5' : 'px-2 py-1'
            } ${shownName ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'} ${f.pending ? 'opacity-60' : ''}`}
          >
            {shownName && shownLogo
              ? <img src={shownLogo} alt="" className={`flex-shrink-0 rounded-md object-cover ${isCell ? 'h-5 w-5' : 'h-6 w-6'}`} />
              : <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />}
            <span className="min-w-0 flex-1 truncate">{shownName || placeholder}</span>
            {!isCell && !disabled && <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" aria-hidden />}
          </button>
        )}
      />
      {f.error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{f.error}</p>}
    </div>
  );
};


export default CompanyPicker;
