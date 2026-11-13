import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { Company, Deal } from '../types';
import { useCompanyStore } from '../store/companyStore';
import { useDealStore } from '../store/dealStore';
import { useContactStore } from '../store/contactStore';
import { companyTotals, listRelated } from '../services/companyService';
import { getAIEnrichmentService } from '../services/aiEnrichmentService';
import { formatMoney } from '../utils/currencyMicros';
import { initialsAvatar } from '../utils/avatar';
import { OwnerPicker, TextField } from '../components/deals/fields';
import { AddDealButton, RelatedDealsList, SectionCard } from '../components/contacts/RelatedDeals';
import { PageContainer } from './PageHeader';
import type { Contact } from '../types/contact';

/** /companies/:id - company record: editable details, related contacts & deals, totals, research, notes. */
const CompanyPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const getById = useCompanyStore(s => s.getById);
  const updateCompany = useCompanyStore(s => s.update);
  const cached = useCompanyStore(s => s.companies[id]);
  const stages = useDealStore(s => s.stages);
  const dealsMap = useDealStore(s => s.deals);
  const fetchDeals = useDealStore(s => s.fetchDeals);
  const contactList = useContactStore(s => s.contacts);
  const fetchContacts = useContactStore(s => s.fetchContacts);

  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>(cached ? 'ready' : 'loading');
  const [researching, setResearching] = useState(false);
  const [researchMsg, setResearchMsg] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [related, setRelated] = useState<{ deals: Deal[]; contacts: Contact[] }>({ deals: [], contacts: [] });

  const company: Company | undefined = cached;

  useEffect(() => {
    if (Object.keys(dealsMap).length === 0) void fetchDeals();
    if (contactList.length === 0) void fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    getById(id).then(c => { if (alive) setStatus(c ? 'ready' : 'missing'); }).catch(() => { if (alive) setStatus('missing'); });
    return () => { alive = false; };
    // Re-resolve when deals/contacts arrive: demo-mode (`local-co-*`) companies are derived from them,
    // so a deep link / reload resolved against empty stores would otherwise stay "not found".
  }, [id, getById, Object.keys(dealsMap).length, contactList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!company) return;
    let alive = true;
    listRelated(company.id, company.name).then(r => { if (alive) setRelated(r); });
    return () => { alive = false; };
  }, [company?.id, company?.name, dealsMap, contactList]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => companyTotals(related.deals, stages), [related.deals, stages]);

  if (!company) {
    return (
      <PageContainer>
        <div className="py-16 text-center" role={status === 'loading' ? 'status' : undefined}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{status === 'loading' ? 'Loading company...' : 'Company not found'}</h2>
          {status === 'missing' && <Link to="/" className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">Back to pipeline</Link>}
        </div>
      </PageContainer>
    );
  }

  const save = (updates: Partial<Omit<Company, 'id'>>) => updateCompany(company.id, updates);

  const research = async () => {
    setResearching(true); setResearchError(null); setResearchMsg(null);
    try {
      const d = await getAIEnrichmentService().enrichCompany({ name: company.name, domain: company.domain ?? company.website, industry: company.industry });
      const updates: Partial<Omit<Company, 'id'>> = {};
      // Only fill empty fields; never overwrite existing values
      if (!company.industry && d.industry) updates.industry = d.industry;
      if (!company.size && d.size) updates.size = d.size;
      if (!company.domain && d.domain) updates.domain = d.domain;
      if (!company.address && d.headquarters) updates.address = d.headquarters;
      const lines: string[] = [];
      if (d.description) lines.push(d.description);
      if (d.revenue) lines.push(`Revenue: ${d.revenue}`);
      if (d.founded) lines.push(`Founded: ${d.founded}`);
      if (d.fundingHistory) lines.push(`Funding: ${d.fundingHistory}`);
      if (d.competitors?.length) lines.push(`Competitors: ${d.competitors.join(', ')}`);
      if (lines.length) updates.notes = [company.notes, `Public research (${new Date().toISOString().slice(0, 10)}):\n${lines.join('\n')}`].filter(Boolean).join('\n\n');
      if (Object.keys(updates).length > 0) await save(updates);
      setResearchMsg(
        d.notes && !lines.length
          ? d.notes
          : `Research complete${Object.keys(updates).length ? `; updated ${Object.keys(updates).join(', ')}` : '; nothing new to add'}.`,
      );
    } catch (e) {
      setResearchError(e instanceof Error ? e.message : 'Research failed');
    } finally {
      setResearching(false);
    }
  };

  const stat = (label: string, value: string) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm">
        <Link to="/" className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">Pipeline</Link>
        <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden />
        <span aria-current="page" className="font-medium text-gray-900 dark:text-white">{company.name}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={company.logoUrl || initialsAvatar(company.name)} alt="" className="h-16 w-16 rounded-xl object-cover" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{company.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{[company.industry, company.website ?? company.domain].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void research()} disabled={researching}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            <Sparkles className="h-4 w-4" aria-hidden />{researching ? 'Researching...' : 'Research company'}
          </button>
          <AddDealButton preset={{ company: company.name, companyId: company.id, contact: '' }} />
        </div>
      </div>

      {researchError && <p role="alert" className="mb-4 text-sm text-red-600">{researchError}</p>}
      {researchMsg && <p role="status" className="mb-4 text-sm text-gray-700 dark:text-gray-300">{researchMsg}</p>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat('Deals', String(totals.deals))}
        {stat('Open value', formatMoney(totals.openValue))}
        {stat('Weighted', formatMoney(totals.weightedValue))}
        {stat('Won value', formatMoney(totals.wonValue))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <SectionCard title="Details">
            <div className="space-y-4">
              <TextField label="Name" value={company.name} required onSave={name => save({ name })} />
              <TextField label="Industry" value={company.industry ?? ''} placeholder="Add industry" onSave={industry => save({ industry })} />
              <TextField label="Website" value={company.website ?? ''} placeholder="Add website" onSave={website => save({ website })} />
              <TextField label="Domain" value={company.domain ?? ''} placeholder="Add domain" onSave={domain => save({ domain })} />
              <TextField label="Size" value={company.size ?? ''} placeholder="Add size" onSave={size => save({ size })} />
              <TextField label="Phone" value={company.phone ?? ''} placeholder="Add phone" onSave={phone => save({ phone })} />
              <TextField label="Address" value={company.address ?? ''} placeholder="Add address" onSave={address => save({ address })} />
              <OwnerPicker fieldLabel="Owner" value={company.ownerId} onChange={ownerId => save({ ownerId })} />
            </div>
          </SectionCard>
          <SectionCard title="Notes">
            <TextField multiline label="" value={company.notes ?? ''} placeholder="Add notes about this company" onSave={notes => save({ notes })} />
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <SectionCard title={`Deals (${related.deals.length})`}>
            <RelatedDealsList deals={related.deals} emptyText="No deals for this company yet." />
          </SectionCard>
          <SectionCard title={`Contacts (${related.contacts.length})`}>
            {related.contacts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No contacts at this company yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {related.contacts.map(c => (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <img src={c.avatarSrc || initialsAvatar(c.name)} alt="" className="h-8 w-8 rounded-full object-cover" />
                    <div className="min-w-0">
                      <Link to={`/contacts/${c.id}`} className="block truncate text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">{c.name}</Link>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{[c.title, c.email].filter(Boolean).join(' · ')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
};

export default CompanyPage;
