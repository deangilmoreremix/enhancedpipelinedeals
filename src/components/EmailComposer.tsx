import React, { useEffect, useRef, useState } from 'react';
import { Contact } from '../types/contact';
import { Deal } from '../types';
import { X, Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { ModernButton } from './ui/ModernButton';
import { composeEmailDraft, queueEmail, QueueEmailResult } from '../services/dealCommunicationService';
import { expandShortcut, listTemplates, renderTemplate, type EmailTemplateRow } from '../services/emailTemplateService';

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
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const tplCtx = { deal, contact: { name: contact.name, firstName: contact.firstName } };

  // Templates and snippets (best effort: the composer works without them)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    listTemplates().then(t => { if (!cancelled) setTemplates(t); }).catch(() => { /* picker stays empty */ });
    return () => { cancelled = true; };
  }, [isOpen]);

  const applyTemplate = (id: string) => {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    setSubject(renderTemplate(t.subject, tplCtx).text);
    setBody(renderTemplate(t.body, tplCtx).text);
  };
  const insertAtCursor = (text: string, replaceFrom?: number) => {
    const el = bodyRef.current;
    const start = replaceFrom ?? el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? start;
    setBody(b => b.slice(0, start) + text + b.slice(Math.max(end, start)));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length); });
  };
  const snippets = templates.filter(t => t.is_snippet);
  const fullTemplates = templates.filter(t => !t.is_snippet);
  /** Typing `/shortcut` followed by space, Tab or Enter inserts the snippet (variables resolved). */
  const onBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== ' ' && e.key !== 'Tab' && e.key !== 'Enter') return;
    const el = e.currentTarget;
    const upto = body.slice(0, el.selectionStart ?? body.length);
    const hit = expandShortcut(upto, snippets);
    if (!hit) return;
    e.preventDefault();
    insertAtCursor(renderTemplate(hit.snippet.body, tplCtx).text, hit.before.length);
  };
  const resolvedSubject = renderTemplate(subject, tplCtx);
  const resolvedBody = renderTemplate(body, tplCtx);
  const unresolved = [...new Set([...resolvedSubject.unresolved, ...resolvedBody.unresolved])];

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
        subject: resolvedSubject.text,
        body: resolvedBody.text,
        threadId: replyTo?.threadId ?? null,
      });
      clearDraft(key);
      setQueued(result);
      setSubject(replyTo?.subject ?? `Regarding ${deal.title || deal.company}`);
      setBody('');
      onQueued?.(result);
      onSend?.({ to: contact.email, subject: resolvedSubject.text.trim(), body: resolvedBody.text.trim() });
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
            <div className="flex items-center gap-2">
              {fullTemplates.length > 0 && (
                <select aria-label="Insert template" value="" onChange={e => applyTemplate(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
                  <option value="">Template...</option>
                  {fullTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              {snippets.length > 0 && (
                <select aria-label="Insert snippet" value="" onChange={e => { const sn = snippets.find(x => x.id === e.target.value); if (sn) insertAtCursor(renderTemplate(sn.body, tplCtx).text); }} className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
                  <option value="">Snippet...</option>
                  {snippets.map(t => <option key={t.id} value={t.id}>/{t.shortcut} {t.name}</option>)}
                </select>
              )}
              <ModernButton variant="outline" size="xs" onClick={() => setShowPreview(p => !p)} aria-pressed={showPreview}>{showPreview ? 'Hide preview' : 'Preview'}</ModernButton>
            </div>
            <ModernButton variant="outline" size="xs" onClick={handleAI} disabled={isDrafting || !contact.id} loading={isDrafting} leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
              Draft with AI
            </ModernButton>
          </div>
          <textarea
            id="email-body"
            ref={bodyRef}
            onKeyDown={onBodyKeyDown}
            value={body}
            onChange={e => setBody(e.target.value)}
            className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Compose your email..."
          />
          {snippets.length > 0 && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tip: type /{snippets[0].shortcut} then Space to insert a snippet.</p>}
          {showPreview && (
            <div aria-label="Resolved preview" className="mt-3 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview (what will be queued)</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white" data-testid="composer-preview-subject">{resolvedSubject.text}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200" data-testid="composer-preview-body">{resolvedBody.text}</p>
              {unresolved.length > 0 && <p role="alert" className="mt-2 text-xs text-amber-700 dark:text-amber-300">No value for: {unresolved.map(v => `{{${v}}}`).join(', ')}. These stay as written.</p>}
            </div>
          )}
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
