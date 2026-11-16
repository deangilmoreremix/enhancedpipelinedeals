import React, { useEffect, useRef, useState } from 'react';
import { Contact } from '../types/contact';
import { Deal } from '../types';
import { X, Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { ModernButton } from './ui/ModernButton';
import { composeEmailDraft, queueEmail, QueueEmailResult } from '../services/dealCommunicationService';

export interface EmailData {
  to: string;
  subject: string;
  body: string;
}

export interface EmailReplyContext {
  /** Subject to pre-fill (already "Re: ..."). */
  subject: string;
  /** Quoted previous message appended below the cursor area. */
  quote?: string;
  threadId?: string | null;
}

interface EmailComposerProps {
  contact: Contact;
  deal: Deal;
  isOpen: boolean;
  onClose: () => void;
  /** Called after the message has been QUEUED (not delivered). */
  onSend?: (emailData: EmailData) => void;
  /** Reply mode: pre-fills the thread subject and quotes the last message. */
  replyTo?: EmailReplyContext | null;
  /** Called with the queue result (e.g. so the communication hub can refresh). */
  onQueued?: (result: QueueEmailResult) => void;
  /** Render in the page flow instead of as a modal overlay. */
  inline?: boolean;
}

const draftKey = (dealId: string, threadId?: string | null) => `email-draft:${dealId}:${threadId ?? 'new'}`;
const readDraft = (key: string): { subject: string; body: string } | null => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
};
const writeDraft = (key: string, v: { subject: string; body: string }) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };
const clearDraft = (key: string) => { try { localStorage.removeItem(key); } catch { /* ignore */ } };

export const EmailComposer: React.FC<EmailComposerProps> = ({ contact, deal, isOpen, onClose, onSend, replyTo, onQueued, inline = false }) => {
  const key = draftKey(deal.id, replyTo?.threadId);
  const initial = () => {
    const saved = readDraft(key);
    if (saved) return saved;
    const greeting = `Hi ${contact.firstName || contact.name},\n\n`;
    return {
      subject: replyTo?.subject ?? `Regarding ${deal.title || deal.company}`,
      body: `${greeting}${replyTo?.quote ?? ''}`,
    };
  };
  const [subject, setSubject] = useState(() => initial().subject);
  const [body, setBody] = useState(() => initial().body);
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<QueueEmailResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Re-seed when switching between threads / reply targets.
  useEffect(() => {
    const d = initial();
    setSubject(d.subject);
    setBody(d.body);
    setQueued(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, replyTo?.subject]);

  // Persist the unsent draft (per deal + thread).
  useEffect(() => {
    if (queued) return;
    writeDraft(key, { subject, body });
  }, [key, subject, body, queued]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const canSend = !!contact.email && !!subject.trim() && !!body.trim() && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    setError(null);
    try {
      const result = await queueEmail({
        dealId: deal.id,
        contactId: contact.id,
        to: contact.email,
        subject,
        body,
        threadId: replyTo?.threadId ?? null,
      });
      clearDraft(key);
      setQueued(result);
      setSubject(replyTo?.subject ?? `Regarding ${deal.title || deal.company}`);
      setBody('');
      onQueued?.(result);
      onSend?.({ to: contact.email, subject: subject.trim(), body: body.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not queue the email');
    } finally {
      setIsSending(false);
    }
  };

  const handleAI = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const previous = body;
    setIsDrafting(true);
    setError(null);
    try {
      await composeEmailDraft({
        contactId: contact.id,
        dealId: deal.id,
        input: body.trim() || (replyTo?.quote ? `Reply to this message:${replyTo.quote}` : ''),
        onText: setBody,
        signal: ctrl.signal,
      });
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') {
        setBody(previous);
        setError(e instanceof Error ? e.message : 'AI draft failed');
      }
    } finally {
      setIsDrafting(false);
    }
  };

  if (!isOpen) return null;

  const form = (
    <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" role="dialog" aria-label={replyTo ? 'Reply' : 'Compose email'}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold dark:text-white">{replyTo ? 'Reply' : 'Compose Email'}</h3>
        <button onClick={onClose} aria-label="Close" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
              {contact.email ? (
                <>
                  <span className="text-gray-900 dark:text-white">{contact.email}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">({contact.name})</span>
                </>
              ) : (
                <span className="text-amber-700 dark:text-amber-400 text-sm">This contact has no email address.</span>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="email-subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
            <input
              id="email-subject"
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter email subject"
            />
          </div>
        </div>

        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="email-body" className="text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
            <ModernButton variant="outline" size="xs" onClick={handleAI} disabled={isDrafting || !contact.id} loading={isDrafting} leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
              Draft with AI
            </ModernButton>
          </div>
          <textarea
            id="email-body"
            value={body}
            onChange={e => setBody(e.target.value)}
            className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Compose your email..."
          />
          {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {queued && (
            <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                Queued. {queued.persisted ? 'The message is saved in the outbound queue and logged on the timeline; it has not been delivered yet.' : 'This deal is not saved to the database, so the message is only kept in memory for this session and will not be delivered.'}
                {queued.timelineError ? ` (Timeline entry failed: ${queued.timelineError})` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-500 dark:text-gray-400">{body.length} characters. Messages are queued, not sent from the browser.</div>
        <div className="flex space-x-3">
          <ModernButton variant="outline" onClick={onClose}>{queued ? 'Close' : 'Cancel'}</ModernButton>
          <ModernButton variant="primary" leftIcon={<Send className="w-4 h-4" />} onClick={handleSend} disabled={!canSend} loading={isSending}>
            Queue email
          </ModernButton>
        </div>
      </div>
    </div>
  );

  if (inline) return form;
  return <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">{form}</div>;
};
