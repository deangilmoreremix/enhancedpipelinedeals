import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Mail, Phone, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useContactStore } from '../store/contactStore';
import { useDealStore } from '../store/dealStore';
import type { Contact } from '../types/contact';
import { initialsAvatar } from '../utils/avatar';
import { getAIEnrichmentService, PublicContactResearch } from '../services/aiEnrichmentService';
import { getContactTimeline, TimelineEvent } from '../services/dealTimelineService';
import { normalizeName } from '../services/companyService';
import { useCompanyStore } from '../store/companyStore';
import { CompanyPicker, SelectField, TextField } from '../components/deals/fields';
import { AddDealButton, RelatedDealsList, SectionCard } from '../components/contacts/RelatedDeals';
import { PageContainer } from './PageHeader';

const STATUS_OPTIONS = [
  { value: 'lead', label: 'Lead' }, { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' }, { value: 'churned', label: 'Churned' },
];

/** /contacts/:id - contact record: editable details, related deals, activity timeline, AI enrichment. */
const ContactPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const contacts = useContactStore(s => s.contacts);
  const isLoading = useContactStore(s => s.isLoading);
  const fetchContacts = useContactStore(s => s.fetchContacts);
  const updateContact = useContactStore(s => s.updateContact);
  const dealsMap = useDealStore(s => s.deals);
  const fetchDeals = useDealStore(s => s.fetchDeals);
  const searchCompanies = useCompanyStore(s => s.search);

  const contact = contacts.find(c => c.id === id);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [companyLinkId, setCompanyLinkId] = useState<string | undefined>(undefined);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<{ applied: string[]; suggestions: Record<string, string>; research: PublicContactResearch } | null>(null);

  useEffect(() => {
    if (contacts.length === 0 && !isLoading) void fetchContacts();
    if (Object.keys(dealsMap).length === 0) void fetchDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deals = useMemo(() => {
    if (!contact) return [];
    const name = normalizeName(contact.name);
    return Object.values(dealsMap)
      .filter(d => !d.deletedAt && (d.contactId === contact.id || (!d.contactId && !!name && normalizeName(d.contact) === name)))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [contact, dealsMap]);
  const dealKey = deals.map(d => d.id).join(',');

  useEffect(() => {
    if (!contact) return;
    let alive = true;
    getContactTimeline(contact.id, dealKey ? dealKey.split(',') : [])
      .then(list => { if (alive) setEvents(list); })
      .catch(() => { if (alive) setEvents([]); });
    return () => { alive = false; };
  }, [contact?.id, dealKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve the company record to link to
  const companyId = contact?.companyId ?? companyLinkId;
  useEffect(() => {
    if (!contact?.company || contact.companyId) { setCompanyLinkId(undefined); return; }
    let alive = true;
    searchCompanies(contact.company).then(list => {
      const hit = list.find(c => normalizeName(c.name) === normalizeName(contact.company));
      if (alive) setCompanyLinkId(hit?.id);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [contact?.company, contact?.companyId, searchCompanies]);

  if (!contact) {
    return (
      <PageContainer>
        <div className="py-16 text-center" role={isLoading ? 'status' : undefined}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{isLoading ? 'Loading contact...' : 'Contact not found'}</h2>
          {!isLoading && <Link to="/contacts" className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">Back to contacts</Link>}
        </div>
      </PageContainer>
    );
  }

  const save = (updates: Partial<Contact>) => updateContact(contact.id, updates);

  const enrich = async () => {
    setEnriching(true); setEnrichError(null); setEnrichment(null);
    try {
      const result = await getAIEnrichmentService().enrichContactFromWeb(contact);
      if (Object.keys(result.applied).length > 0) await updateContact(contact.id, result.applied as Partial<Contact>);
      setEnrichment({ applied: Object.keys(result.applied).filter(k => k !== 'lastEnrichment'), suggestions: result.suggestions, research: result.research });
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : 'Research failed');
    } finally {
      setEnriching(false);
    }
  };

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm">
        <Link to="/contacts" className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">Contacts</Link>
        <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden />
        <span aria-current="page" className="font-medium text-gray-900 dark:text-white">{contact.name}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={contact.avatarSrc || initialsAvatar(contact.name)} alt="" className="h-16 w-16 rounded-full object-cover" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{contact.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {contact.title}{contact.title && contact.company ? ' at ' : ''}
              {companyId ? <Link to={`/companies/${companyId}`} className="text-blue-600 hover:underline dark:text-blue-400">{contact.company}</Link> : contact.company}
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"><Mail className="h-3.5 w-3.5" aria-hidden />{contact.email}</a>}
              {contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"><Phone className="h-3.5 w-3.5" aria-hidden />{contact.phone}</a>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void enrich()} disabled={enriching}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            <Sparkles className="h-4 w-4" aria-hidden />{enriching ? 'Researching...' : 'Research public info'}
          </button>
          <AddDealButton preset={{ contact: contact.name, contactId: contact.id, company: contact.company ?? '', companyId: companyId }} />
        </div>
      </div>

      {enrichError && <p role="alert" className="mb-4 text-sm text-red-600">{enrichError}</p>}
      {enrichment && (
        <div className="mb-6 space-y-2 rounded-xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
          {!enrichment.research.found && <p>No reliable public information was found.</p>}
          {enrichment.applied.length > 0 && <p><strong>Applied:</strong> {enrichment.applied.join(', ')}</p>}
          {Object.entries(enrichment.suggestions).map(([k, v]) => <p key={k}><strong>Suggestion for {k}:</strong> {v} (existing value kept)</p>)}
          {enrichment.research.sources.length > 0 && (
            <ul className="list-disc pl-5">
              {enrichment.research.sources.slice(0, 5).map(s => (
                <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline dark:text-blue-400">{s.title || s.url}</a></li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <SectionCard title="Details">
            <div className="space-y-4">
              <TextField label="Name" value={contact.name} required onSave={name => save({ name })} />
              <TextField label="Title" value={contact.title ?? ''} placeholder="Add title" onSave={title => save({ title })} />
              <TextField label="Email" value={contact.email ?? ''} placeholder="Add email" onSave={email => save({ email })}
                validate={v => (v && !/^\S+@\S+\.\S+$/.test(v) ? 'Enter a valid email' : null)} />
              <TextField label="Phone" value={contact.phone ?? ''} placeholder="Add phone" onSave={phone => save({ phone })} />
              <CompanyPicker
                fieldLabel="Company"
                value={companyId}
                label={contact.company}
                onChange={(cid, company) => save({ company, companyId: cid })}
              />
              <SelectField label="Status" value={contact.status} options={STATUS_OPTIONS} onSave={status => save({ status: status as Contact['status'] })} />
            </div>
          </SectionCard>
          <SectionCard title="Notes">
            <TextField multiline label="" value={contact.notes ?? ''} placeholder="Add notes about this contact" onSave={notes => save({ notes })} />
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <SectionCard title={`Deals (${deals.length})`}>
            <RelatedDealsList deals={deals} emptyText="No deals linked to this contact yet." />
          </SectionCard>
          <SectionCard title="Activity">
            {events.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {events.slice(0, 50).map(e => (
                  <li key={e.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{e.title}</p>
                      {e.description && <p className="truncate text-sm text-gray-600 dark:text-gray-300">{e.description}</p>}
                    </div>
                    <time dateTime={e.at.toISOString()} className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">{format(e.at, 'PP')}</time>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
};

export default ContactPage;
