import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, User, X } from 'lucide-react';
import { useContactStore } from '../../../store/contactStore';
import { useInlineField } from './useInlineField';

export interface ContactRelationValue {
  contactId?: string;
  contact: string;
}

export interface ContactRelationFieldProps {
  label?: string;
  contactId?: string;
  contactName?: string;
  onSave: (next: ContactRelationValue) => Promise<unknown> | unknown;
  disabled?: boolean;
  className?: string;
}

/** Contact picker backed by useContactStore (search by name/email/company, clear to unlink). */
export const ContactRelationField: React.FC<ContactRelationFieldProps> = ({
  label = 'Contact', contactId, contactName, onSave, disabled, className = '',
}) => {
  const contacts = useContactStore(s => s.contacts);
  const f = useInlineField<ContactRelationValue>(onSave, label);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? contacts.filter(c => `${c.name} ${c.email} ${c.company}`.toLowerCase().includes(needle))
      : contacts;
    return list.slice(0, 8);
  }, [contacts, q]);

  const linked = contactId ? contacts.find(c => c.id === contactId) : undefined;
  const shownName = f.pending ? f.pending.value.contact : linked?.name ?? contactName ?? '';

  const choose = (next: ContactRelationValue) => { setOpen(false); setQ(''); void f.commit(next); };

  return (
    <div className={className} ref={wrapRef}>
      {label && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>}
      <div className="relative">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(o => !o)}
            aria-haspopup="listbox"
            className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left text-sm transition-colors hover:bg-gray-100 disabled:cursor-default dark:hover:bg-gray-700/60 ${
              shownName ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
            } ${f.pending ? 'opacity-60' : ''}`}
          >
            <User className="h-4 w-4 flex-shrink-0 text-gray-400" />
            {shownName || 'Link a contact'}
          </button>
          {shownName && !disabled && (
            <button type="button" aria-label="Unlink contact" onClick={() => choose({ contactId: undefined, contact: '' })}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {open && (
          <div className="absolute left-0 z-30 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                autoFocus
                aria-label="Search contacts"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search contacts"
                className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <ul role="listbox" className="max-h-56 overflow-y-auto">
              {matches.length === 0 && <li className="px-2 py-3 text-center text-xs text-gray-500">No contacts found</li>}
              {matches.map(c => (
                <li key={c.id} role="option" aria-selected={c.id === contactId}>
                  <button type="button" onClick={() => choose({ contactId: c.id, contact: c.name })}
                    className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{[c.title, c.company].filter(Boolean).join(' at ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {f.error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{f.error}</p>}
    </div>
  );
};

/** Company / owner relations are real pickers now (see CompanyPicker / OwnerPicker); legacy names kept as aliases. */
export { CompanyPicker as CompanyField } from './CompanyPicker';
export { OwnerPicker as OwnerField } from './OwnerPicker';
