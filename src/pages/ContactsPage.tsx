import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useContactStore } from '../store/contactStore';
import { Contact } from '../types/contact';
import { ContactImportWizard } from '../components/contacts/ContactImportWizard';
import { ContactForm } from '../components/contacts/ContactForm';
import { AIInsightsPanel } from '../components/contacts/AIInsightsPanel';
import { AutomationPanel } from '../components/contacts/AutomationPanel';
import { getAIEnrichmentService, PublicContactResearch } from '../services/aiEnrichmentService';
import { searchContacts, SemanticContactMatch } from '../services/semanticSearchService';
import { PageContainer, PageHeader } from './PageHeader';

const ENRICHMENT_OPTIONS = {
  enrichCompanyData: true,
  discoverSocialProfiles: true,
  analyzeBuyingSignals: false,
  generateLeadScoring: false,
  includeWebResearch: true,
  maxResearchResults: 5,
};

interface EnrichmentResult {
  applied: Record<string, any>;
  suggestions: Record<string, string>;
  research: PublicContactResearch;
}

const ContactsPage: React.FC = () => {
  const contacts = useContactStore(s => s.contacts);
  const isLoading = useContactStore(s => s.isLoading);
  const error = useContactStore(s => s.error);
  const fetchContacts = useContactStore(s => s.fetchContacts);
  const createContact = useContactStore(s => s.createContact);
  const updateContact = useContactStore(s => s.updateContact);

  const [query, setQuery] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState<SemanticContactMatch[] | null>(null);
  const [semanticBusy, setSemanticBusy] = useState(false);
  const [semanticError, setSemanticError] = useState<string | null>(null);

  const [enriching, setEnriching] = useState(false);
  const [enrichment, setEnrichment] = useState<EnrichmentResult | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c =>
      [c.name, c.email, c.company, c.title, c.status].some(v => (v || '').toLowerCase().includes(q)),
    );
  }, [contacts, query]);

  const selected = contacts.find(c => c.id === selectedId) ?? null;

  const openContact = (c: Contact) => {
    setSelectedId(c.id);
    setEnrichment(null);
    setEnrichError(null);
  };

  const runSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semanticQuery.trim()) return;
    setSemanticBusy(true);
    setSemanticError(null);
    try {
      setSemanticResults(await searchContacts(semanticQuery.trim()));
    } catch (err) {
      setSemanticResults(null);
      setSemanticError(err instanceof Error ? err.message : 'Semantic search failed');
    } finally {
      setSemanticBusy(false);
    }
  };

  const enrich = async (contact: Contact) => {
    setEnriching(true);
    setEnrichError(null);
    setEnrichment(null);
    try {
      const result = await getAIEnrichmentService().enrichContactFromWeb(contact);
      if (Object.keys(result.applied).length > 0) {
        await updateContact(contact.id, result.applied as Partial<Contact>);
      }
      setEnrichment(result);
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setEnriching(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contact${contacts.length === 1 ? '' : 's'}`}
        actions={
          <>
            <button onClick={() => setShowImport(true)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm">
              Import
            </button>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">
              New contact
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <input
          type="search"
          aria-label="Filter contacts"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by name, email, company..."
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
        />
        <form onSubmit={runSemanticSearch} className="flex gap-2">
          <input
            type="search"
            aria-label="Semantic search"
            value={semanticQuery}
            onChange={e => setSemanticQuery(e.target.value)}
            placeholder='Search by meaning, e.g. "CTO at a logistics startup"'
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          />
          <button type="submit" disabled={semanticBusy} className="px-4 py-2 rounded-lg bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm disabled:opacity-50">
            {semanticBusy ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {semanticError && <p role="alert" className="mb-4 text-sm text-red-600">{semanticError}</p>}
      {semanticResults && (
        <section className="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex justify-between mb-2">
            <h3 className="font-semibold">Semantic matches</h3>
            <button className="text-sm text-blue-600" onClick={() => setSemanticResults(null)}>Clear</button>
          </div>
          {semanticResults.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No matches. Contacts may not be indexed yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {semanticResults.map(m => {
                const c = contacts.find(x => x.id === m.contact_id);
                return (
                  <li key={m.contact_id} className="py-2 flex items-start justify-between gap-3">
                    <div>
                      <button className="font-medium text-blue-600 dark:text-blue-400 text-left" onClick={() => c && openContact(c)} disabled={!c}>
                        {c ? c.name : m.contact_id}
                      </button>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{m.content}</p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{Math.round(m.similarity * 100)}% match</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      {isLoading && contacts.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">Loading contacts...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-left text-gray-600 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(c => (
                <tr key={c.id} onClick={() => openContact(c)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-2 font-medium">
                    <Link to={`/contacts/${c.id}`} onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline dark:text-blue-400">{c.name}</Link>
                  </td>
                  <td className="px-4 py-2">{c.company}</td>
                  <td className="px-4 py-2">{c.title}</td>
                  <td className="px-4 py-2">{c.email}</td>
                  <td className="px-4 py-2 capitalize">{c.status}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No contacts found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ContactImportWizard
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImportComplete={() => { setShowImport(false); void fetchContacts(); }}
      />

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-label="New contact">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <ContactForm
              enrichmentOptions={ENRICHMENT_OPTIONS}
              onCancel={() => setShowForm(false)}
              onSubmit={async data => {
                const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
                await createContact(rest);
                setShowForm(false);
              }}
            />
          </div>
        </div>
      )}

      {selected && (
        <aside
          role="dialog"
          aria-label="Contact details"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-6 space-y-6"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold">
                <Link to={`/contacts/${selected.id}`} className="hover:text-blue-600 hover:underline dark:hover:text-blue-400">{selected.name}</Link>
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{selected.title}{selected.title && selected.company ? ' at ' : ''}{selected.company}</p>
              <p className="text-sm">{selected.email}</p>
            </div>
            <button aria-label="Close" onClick={() => setSelectedId(null)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">✕</button>
          </div>

          <section className="space-y-3">
            <button
              onClick={() => enrich(selected)}
              disabled={enriching}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
            >
              {enriching ? 'Researching...' : 'Research public info'}
            </button>
            {enrichError && <p role="alert" className="text-sm text-red-600">{enrichError}</p>}
            {enrichment && <EnrichmentSummary result={enrichment} />}
          </section>

          <AIInsightsPanel contact={selected} />
          <AutomationPanel contact={selected} />
        </aside>
      )}
    </PageContainer>
  );
};

const EnrichmentSummary: React.FC<{ result: EnrichmentResult }> = ({ result }) => {
  const { applied, suggestions, research } = result;
  const appliedKeys = Object.keys(applied).filter(k => k !== 'lastEnrichment');
  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm space-y-3">
      {!research.found && <p>No reliable public information was found.</p>}
      {appliedKeys.length > 0 && (
        <div>
          <h4 className="font-medium">Applied to contact</h4>
          <ul className="list-disc pl-5">
            {appliedKeys.map(k => (
              <li key={k}>
                <strong>{k}</strong>: {typeof applied[k] === 'string' ? (applied[k] as string).slice(0, 200) : Object.keys(applied[k]).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Object.keys(suggestions).length > 0 && (
        <div>
          <h4 className="font-medium">Suggestions (existing values kept)</h4>
          <ul className="list-disc pl-5">
            {Object.entries(suggestions).map(([k, v]) => <li key={k}><strong>{k}</strong>: {v}</li>)}
          </ul>
        </div>
      )}
      {research.sources.length > 0 && (
        <div>
          <h4 className="font-medium">Sources</h4>
          <ul className="list-disc pl-5">
            {research.sources.map(s => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">{s.title || s.url}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-gray-500">Confidence: {Math.round((research.confidence <= 1 ? research.confidence * 100 : research.confidence))}%</p>
    </div>
  );
};

export default ContactsPage;
