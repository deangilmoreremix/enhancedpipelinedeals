import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ExternalLink, User } from 'lucide-react';
import type { Company, Deal } from '../../types';
import type { Contact } from '../../types/contact';
import { initialsAvatar } from '../../utils/avatar';
import { useCompanyStore } from '../../store/companyStore';
import { normalizeName } from '../../services/companyService';

const cardCls = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800';

export const RelatedContactCard: React.FC<{ contact: Contact | null }> = ({ contact }) => {
  if (!contact) return null;
  return (
    <div className={cardCls} aria-label="Related contact">
      <h4 className="mb-3 flex items-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <User className="mr-1.5 h-4 w-4" aria-hidden />Contact
      </h4>
      <div className="flex items-center gap-3">
        <img src={contact.avatarSrc || initialsAvatar(contact.name)} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <Link to={`/contacts/${contact.id}`} className="block truncate font-medium text-blue-600 hover:underline dark:text-blue-400">
            {contact.name}
          </Link>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{[contact.title, contact.company].filter(Boolean).join(' at ')}</p>
        </div>
        <Link to={`/contacts/${contact.id}`} aria-label={`Open ${contact.name}`} className="text-gray-400 hover:text-blue-600"><ExternalLink className="h-4 w-4" /></Link>
      </div>
    </div>
  );
};

/** Resolves the deal's company (by companyId, else by exact company-name match) and links to /companies/:id. */
export const RelatedCompanyCard: React.FC<{ deal: Deal; onLinked?: (company: Company) => void }> = ({ deal, onLinked }) => {
  const getById = useCompanyStore(s => s.getById);
  const search = useCompanyStore(s => s.search);
  const create = useCompanyStore(s => s.create);
  const [company, setCompany] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (deal.companyId) { const c = await getById(deal.companyId); if (alive) setCompany(c); return; }
      const name = normalizeName(deal.company);
      if (!name) { if (alive) setCompany(null); return; }
      const list = await search(deal.company);
      if (alive) setCompany(list.find(c => normalizeName(c.name) === name) ?? null);
    })().catch(() => { if (alive) setCompany(null); });
    return () => { alive = false; };
  }, [deal.companyId, deal.company, getById, search]);

  if (!deal.company && !company) return null;
  const name = company?.name ?? deal.company;

  const link = async () => {
    setBusy(true);
    try { const c = await create(deal.company); setCompany(c); onLinked?.(c); } finally { setBusy(false); }
  };

  return (
    <div className={cardCls} aria-label="Related company">
      <h4 className="mb-3 flex items-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Building2 className="mr-1.5 h-4 w-4" aria-hidden />Company
      </h4>
      <div className="flex items-center gap-3">
        <img src={company?.logoUrl || initialsAvatar(name)} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          {company ? (
            <Link to={`/companies/${company.id}`} className="block truncate font-medium text-blue-600 hover:underline dark:text-blue-400">{name}</Link>
          ) : (
            <span className="block truncate font-medium text-gray-900 dark:text-white">{name}</span>
          )}
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{company?.industry ?? company?.website ?? (company ? '' : 'Not linked to a company record')}</p>
        </div>
        {company
          ? <Link to={`/companies/${company.id}`} aria-label={`Open ${name}`} className="text-gray-400 hover:text-blue-600"><ExternalLink className="h-4 w-4" /></Link>
          : <button type="button" disabled={busy} onClick={() => void link()} className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Create record</button>}
      </div>
    </div>
  );
};
