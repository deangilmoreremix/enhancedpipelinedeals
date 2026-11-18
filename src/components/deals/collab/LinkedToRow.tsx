import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, Building2, Link2, Plus, Search, User, X } from 'lucide-react';
import { useDealStore } from '../../../store/dealStore';
import { useContactStore } from '../../../store/contactStore';
import { useCompanyStore } from '../../../store/companyStore';
import { RecordTarget, TARGET_TYPES, TargetType, targetKey } from '../../../services/recordTargetsService';

const ICON: Record<TargetType, React.FC<{ className?: string }>> = { deal: Briefcase, contact: User, company: Building2 };
const TYPE_LABEL: Record<TargetType, string> = { deal: 'Deal', contact: 'Contact', company: 'Company' };

/** Display name for a linked record (deal title, contact name, company name). */
export function useTargetLabel(t: RecordTarget): string {
  const deal = useDealStore(s => (t.type === 'deal' ? s.deals[t.id] : undefined));
  const contact = useContactStore(s => (t.type === 'contact' ? s.contacts.find(c => c.id === t.id) : undefined));
  const company = useCompanyStore(s => (t.type === 'company' ? s.companies[t.id] : undefined));
  const getCompany = useCompanyStore(s => s.getById);
  useEffect(() => {
    if (t.type === 'company' && !company) void getCompany(t.id).catch(() => undefined);
  }, [t.type, t.id, company, getCompany]);
  if (t.label) return t.label;
  if (t.type === 'deal') return deal ? deal.title || deal.company || 'Deal' : 'Deal';
  if (t.type === 'contact') return contact?.name ?? 'Contact';
  return company?.name ?? 'Company';
}

const TargetChip: React.FC<{ target: RecordTarget; onRemove?: () => void }> = ({ target, onRemove }) => {
  const label = useTargetLabel(target);
  const Icon = ICON[target.type];
  return (
    <span data-testid="linked-chip" className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
      <Icon className="h-3 w-3" />
      <span className="max-w-[10rem] truncate">{label}</span>
      {onRemove && (
        <button type="button" aria-label={`Remove link to ${label}`} onClick={onRemove} className="rounded-full p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
};

/** "From contact: Jane" / "From company: Acme" badge for items that show on a deal via a related record. */
export const SourceBadge: React.FC<{ source?: RecordTarget | null }> = ({ source }) => {
  const label = useTargetLabel(source ?? { type: 'deal', id: '' });
  if (!source || source.type === 'deal') return null;
  return (
    <span data-testid="source-badge" className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
      From {source.type}: {label}
    </span>
  );
};

interface Option { target: RecordTarget; name: string; description?: string }

const AddPicker: React.FC<{ existing: Set<string>; onPick: (t: RecordTarget) => void; onClose: () => void }> = ({ existing, onPick, onClose }) => {
  const [type, setType] = useState<TargetType>('deal');
  const [q, setQ] = useState('');
  const [companies, setCompanies] = useState<Option[]>([]);
  const deals = useDealStore(s => s.deals);
  const contacts = useContactStore(s => s.contacts);
  const searchCompanies = useCompanyStore(s => s.search);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  useEffect(() => {
    if (type !== 'company') return;
    let alive = true;
    const t = setTimeout(() => {
      searchCompanies(q).then(list => {
        if (alive) setCompanies(list.map(c => ({ target: { type: 'company' as const, id: c.id }, name: c.name, description: c.industry })));
      });
    }, q ? 150 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [type, q, searchCompanies]);

  const options = useMemo<Option[]>(() => {
    const needle = q.trim().toLowerCase();
    if (type === 'company') return companies;
    if (type === 'deal') {
      return Object.values(deals)
        .map(d => ({ target: { type: 'deal' as const, id: d.id }, name: d.title || d.company, description: d.company }))
        .filter(o => !needle || `${o.name} ${o.description}`.toLowerCase().includes(needle))
        .slice(0, 8);
    }
    return contacts
      .filter(c => !needle || `${c.name} ${c.email} ${c.company}`.toLowerCase().includes(needle))
      .slice(0, 8)
      .map(c => ({ target: { type: 'contact' as const, id: c.id }, name: c.name, description: c.company }));
  }, [type, q, companies, deals, contacts]);

  return (
    <div ref={ref} className="absolute left-0 z-30 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <div role="tablist" aria-label="Record type" className="mb-2 flex gap-1">
        {TARGET_TYPES.map(t => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium ${type === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
        <input
          autoFocus
          aria-label={`Search ${type}s`}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={`Search ${type}s`}
          className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>
      <ul role="listbox" className="max-h-52 overflow-y-auto">
        {options.length === 0 && <li className="px-2 py-3 text-center text-xs text-gray-500">No {type}s found</li>}
        {options.map(o => {
          const linked = existing.has(targetKey(o.target));
          return (
            <li key={targetKey(o.target)} role="option" aria-selected={linked}>
              <button
                type="button"
                disabled={linked}
                onClick={() => onPick({ ...o.target, label: o.name })}
                className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-white">{o.name}{linked ? ' (linked)' : ''}</span>
                {o.description && <span className="text-xs text-gray-500 dark:text-gray-400">{o.description}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export interface LinkedToRowProps {
  targets: RecordTarget[];
  onChange: (next: RecordTarget[]) => void | Promise<unknown>;
  disabled?: boolean;
  className?: string;
}

/** "Linked to" chips with add/remove. At least one link must remain. */
export const LinkedToRow: React.FC<LinkedToRowProps> = ({ targets, onChange, disabled, className = '' }) => {
  const [open, setOpen] = useState(false);
  const existing = useMemo(() => new Set(targets.map(targetKey)), [targets]);
  return (
    <div className={`relative flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Linked to">
      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><Link2 className="h-3 w-3" />Linked to</span>
      {targets.map(t => (
        <TargetChip
          key={targetKey(t)}
          target={t}
          onRemove={!disabled && targets.length > 1 ? () => void onChange(targets.filter(x => targetKey(x) !== targetKey(t))) : undefined}
        />
      ))}
      {!disabled && (
        <button type="button" aria-label="Add link" onClick={() => setOpen(o => !o)} className="inline-flex items-center rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
          <Plus className="mr-0.5 h-3 w-3" />Link
        </button>
      )}
      {open && (
        <AddPicker
          existing={existing}
          onClose={() => setOpen(false)}
          onPick={t => { setOpen(false); void onChange([...targets, t]); }}
        />
      )}
    </div>
  );
};
