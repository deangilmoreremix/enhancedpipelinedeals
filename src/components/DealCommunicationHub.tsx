/**
 * DealCommunicationHub: the deal's communication history from real data.
 * Email threads (expandable, with reply), logged calls / messages, queued outgoing email and meetings for the
 * deal and its contact / company contacts. Outgoing email is QUEUED (outbound_messages), never sent from the browser.
 * Demo mode shows a small, clearly labelled sample set instead.
 *
 * Props: { deal, contact? }  (unchanged). `refreshKey` can be bumped by the parent to force a reload.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Deal } from '../types';
import { Contact } from '../types/contact';
import { MessageSquare, Send, RefreshCw } from 'lucide-react';
import { ModernButton } from './ui/ModernButton';
import { EmailComposer, EmailReplyContext } from './EmailComposer';
import { CommEntryCard, CHANNEL_META } from './deals/comms/CommEntryCard';
import { buildReply, CommChannel, CommEntry, DealCommsResult, loadDealCommunications } from '../services/dealCommunicationService';

interface DealCommunicationHubProps {
  deal: Deal;
  contact?: Contact | null;
  refreshKey?: number;
}

type Filter = 'all' | CommChannel;

const EMPTY_COPY: Record<Filter, string> = {
  all: 'No communications recorded for this deal yet.',
  email: 'No email threads for this deal yet.',
  call: 'No calls logged for this deal yet.',
  meeting: 'No meetings for this deal yet.',
  message: 'No messages for this deal yet.',
};

export const DealCommunicationHub: React.FC<DealCommunicationHubProps> = ({ deal, contact, refreshKey = 0 }) => {
  const [result, setResult] = useState<DealCommsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState<{ open: boolean; reply: EmailReplyContext | null }>({ open: false, reply: null });
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDealCommunications({ dealId: deal.id, contactId: contact?.id ?? deal.contactId, companyId: deal.companyId })
      .then(r => { if (!cancelled) setResult(r); })
      .catch(e => { if (!cancelled) setResult({ entries: [], errors: [e instanceof Error ? e.message : 'Failed to load communications'], sample: false }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deal.id, deal.contactId, deal.companyId, contact?.id, refreshKey, reloadTick]);

  const entries = result?.entries ?? [];
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: entries.length, email: 0, call: 0, meeting: 0, message: 0 };
    entries.forEach(e => { c[e.channel]++; });
    return c;
  }, [entries]);
  const visible = filter === 'all' ? entries : entries.filter(e => e.channel === filter);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const openReply = (entry: CommEntry) => {
    const r = buildReply(entry);
    setComposer({ open: true, reply: { subject: r.subject, quote: r.quote, threadId: entry.threadId ?? null } });
  };

  const canCompose = !!contact;
  const filters: Filter[] = ['all', 'email', 'call', 'meeting', 'message'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
          <MessageSquare className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />Communication
        </h3>
        <div className="flex gap-2">
          <ModernButton variant="outline" size="sm" onClick={() => setReloadTick(t => t + 1)} leftIcon={<RefreshCw className="h-4 w-4" />} aria-label="Refresh communications">Refresh</ModernButton>
          <ModernButton variant="primary" size="sm" leftIcon={<Send className="h-4 w-4" />} disabled={!canCompose} title={canCompose ? undefined : 'Link a contact to email from this deal'} onClick={() => setComposer({ open: true, reply: null })}>
            New email
          </ModernButton>
        </div>
      </div>

      {result?.sample && (
        <p role="note" className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
          Demo mode: the items marked "Sample" are example data, not real communications.
        </p>
      )}
      {result && result.errors.length > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          Some sources could not be loaded: {result.errors.join('; ')}
        </p>
      )}

      <div role="tablist" aria-label="Channel filter" className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {filters.map(f => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${filter === f ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            {f === 'all' ? 'All' : CHANNEL_META[f].label}
            {counts[f] > 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">{counts[f]}</span>}
          </button>
        ))}
      </div>

      <div className="min-h-[200px]">
        {loading ? (
          <p role="status" className="py-8 text-center text-gray-500 dark:text-gray-400">Loading communications...</p>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-400 dark:text-gray-500" />
            <p className="text-gray-500 dark:text-gray-400">{EMPTY_COPY[filter]}</p>
            {canCompose && filter !== 'call' && filter !== 'meeting' && (
              <button className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700" onClick={() => setComposer({ open: true, reply: null })}>Write the first email</button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map(e => (
              <CommEntryCard key={e.id} entry={e} expanded={expanded.has(e.id)} onToggle={() => toggle(e.id)} onReply={canCompose ? openReply : undefined} />
            ))}
          </ul>
        )}
      </div>

      {contact && composer.open && (
        <EmailComposer
          contact={contact}
          deal={deal}
          isOpen
          replyTo={composer.reply}
          onClose={() => setComposer({ open: false, reply: null })}
          onQueued={() => setReloadTick(t => t + 1)}
        />
      )}
    </div>
  );
};

export default DealCommunicationHub;
