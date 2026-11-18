import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';
import { proposalKey, useWorkspaceChatStore } from '../../store/workspaceChatStore';
import { applyProposal, chatErrorMessage, describeProposal, sendChat, type ChatMessage, type Proposal } from '../../services/workspaceChatService';
import { usePermissions } from '../../hooks/usePermissions';
import { MarkdownLite } from './WorkspaceChatMarkdown';
import { dealIdFromPath, getCommandContext } from '../commandPaletteContext';
import { BTN, BTN_ICON, BTN_PRIMARY } from '../ui/buttonStyles';

let seq = 0;
const mid = () => `m${Date.now()}-${++seq}`;

/** The deal the user is looking at (open record / side panel), or null. */
export const currentDealId = (): string | null =>
  getCommandContext().dealId ?? (typeof window === 'undefined' ? null : dealIdFromPath(window.location.pathname));

const ProposalCard: React.FC<{ messageId: string; proposal: Proposal; onApply: (p: Proposal, key: string) => void }> = ({ messageId, proposal, onApply }) => {
  const deals = useDealStore(s => s.deals);
  const stages = useDealStore(s => s.stages);
  const key = proposalKey(messageId, proposal);
  const st = useWorkspaceChatStore(s => s.states[key]);
  const setState = useWorkspaceChatStore(s => s.setProposalState);
  const done = st?.state === 'applied' || st?.state === 'dismissed';
  return (
    <li
      data-testid="chat-proposal"
      className={`rounded-lg border p-3 text-sm ${st?.state === 'applied' ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'} ${st?.state === 'dismissed' ? 'opacity-60' : ''}`}
    >
      <p className="font-medium text-gray-900 dark:text-white">{describeProposal(proposal, deals, stages)}</p>
      {proposal.reason && <p className="mt-0.5 text-gray-600 dark:text-gray-300">{proposal.reason}</p>}
      {st?.state === 'applied' && <p role="status" className="mt-1 flex items-center gap-1 text-green-700 dark:text-green-300"><Check className="h-4 w-4" />{st.message ?? 'Applied'}. Undo is available in the toast.</p>}
      {st?.state === 'dismissed' && <p className="mt-1 text-gray-500 dark:text-gray-400">Dismissed</p>}
      {st?.state === 'failed' && <p role="alert" className="mt-1 text-red-600 dark:text-red-400">{st.message ?? 'Could not apply.'}</p>}
      {!done && (
        <div className="mt-2 flex gap-2">
          <button type="button" className={BTN_PRIMARY} disabled={st?.state === 'applying'} onClick={() => onApply(proposal, key)}>
            {st?.state === 'applying' ? 'Applying...' : 'Apply'}
          </button>
          <button type="button" className={BTN} disabled={st?.state === 'applying'} onClick={() => setState(key, 'dismissed')}>Dismiss</button>
        </div>
      )}
    </li>
  );
};

/** Slide-over assistant. Never applies anything by itself: proposals need an explicit Apply. */
export const WorkspaceChat: React.FC = () => {
  const { open, messages, pending, states } = useWorkspaceChatStore();
  const { setOpen, add, setPending, setProposalState, clear } = useWorkspaceChatStore.getState();
  const perms = usePermissions();
  const deals = useDealStore(s => s.deals);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [ctxDeal, setCtxDeal] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCtxDeal(currentDealId());
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
  }, [open, setOpen]);

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages.length, pending]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft('');
    const user: ChatMessage = { id: mid(), role: 'user', content: text };
    add(user);
    setPending(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const history = [...useWorkspaceChatStore.getState().messages];
      const r = await sendChat(history, { dealId: currentDealId(), signal: ctrl.signal });
      add({ id: mid(), role: 'assistant', content: r.reply, proposals: r.proposals });
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') add({ id: mid(), role: 'assistant', content: chatErrorMessage(e), error: true });
    } finally {
      setPending(false);
    }
  }, [draft, pending, add, setPending]);

  const apply = useCallback(async (p: Proposal, key: string) => {
    setProposalState(key, 'applying');
    const r = await applyProposal(p, { can: perms.can });
    setProposalState(key, r.ok ? 'applied' : 'failed', r.message);
  }, [perms.can, setProposalState]);

  const applyAll = async (m: ChatMessage) => {
    for (const p of m.proposals ?? []) {
      const key = proposalKey(m.id, p);
      const s = useWorkspaceChatStore.getState().states[key]?.state;
      if (s === 'applied' || s === 'dismissed' || s === 'applying') continue;
      await apply(p, key); // sequential: later proposals may touch the same deal
    }
  };

  if (!open) return null;
  const ctx = ctxDeal ? deals[ctxDeal] : undefined;

  return (
    <div className="fixed inset-0 z-[85]">
      <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label="Workspace AI chat"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-gray-50 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
      >
        <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h2 className="flex-1 text-base font-semibold text-gray-900 dark:text-white">Ask AI</h2>
          <button type="button" className={BTN} disabled={messages.length === 0 && !pending} onClick={() => { abortRef.current?.abort(); clear(); }} aria-label="Clear conversation"><Trash2 className="h-4 w-4" />Clear</button>
          <button type="button" className={BTN_ICON} onClick={() => setOpen(false)} aria-label="Close AI chat"><X className="h-4 w-4" /></button>
        </header>
        {ctx && <p className="border-b border-gray-200 bg-purple-50 px-4 py-1.5 text-xs text-purple-800 dark:border-gray-700 dark:bg-purple-900/20 dark:text-purple-200">Context: {ctx.title || ctx.company}</p>}

        <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
              Ask about your pipeline, e.g. "Which deals have gone quiet for 2 weeks?" The assistant reads your data and may suggest changes. Nothing changes until you press Apply.
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`max-w-[92%] rounded-xl px-3 py-2 ${m.role === 'user' ? 'bg-blue-600 text-white' : m.error ? 'border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200' : 'border border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'}`} role={m.error ? 'alert' : undefined}>
                {m.role === 'user' || m.error ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <MarkdownLite text={m.content} />}
                {m.proposals && m.proposals.length > 0 && (
                  <div className="mt-3">
                    <ul className="space-y-2" aria-label="Proposed changes">
                      {m.proposals.map(p => <ProposalCard key={p.id} messageId={m.id} proposal={p} onApply={apply} />)}
                    </ul>
                    {m.proposals.filter(p => !['applied', 'dismissed'].includes(states[proposalKey(m.id, p)]?.state ?? '')).length > 1 && (
                      <button type="button" className={`${BTN} mt-2`} onClick={() => void applyAll(m)}>Apply all</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {pending && <p role="status" className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Thinking...</p>}
          <div ref={endRef} />
        </div>

        <form className="flex items-end gap-2 border-t border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800" onSubmit={e => { e.preventDefault(); void send(); }}>
          <label htmlFor="workspace-chat-input" className="sr-only">Message</label>
          <textarea
            id="workspace-chat-input"
            ref={inputRef}
            rows={2}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Ask about your deals..."
            className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
          <button type="submit" className={BTN_PRIMARY} disabled={!draft.trim() || pending} aria-label="Send message"><Send className="h-4 w-4" />Send</button>
        </form>
      </aside>
    </div>
  );
};

export default WorkspaceChat;
