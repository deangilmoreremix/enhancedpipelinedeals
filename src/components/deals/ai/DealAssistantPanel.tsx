import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { useDealStore } from '../../../store/dealStore';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  AssistantSuggestion, ChatTurn, aiErrorMessage, applySuggestion, askDealAssistant,
} from '../../../services/dealAssistantService';
import { SuggestionCard, CardState } from './SuggestionCard';

interface Msg { id: number; role: 'user' | 'assistant' | 'error'; content: string; suggestions?: AssistantSuggestion[] }

const STARTERS = ['Summarize where this deal stands', 'What should I do next?', 'Is the value or probability realistic?'];

/**
 * Chat-style assistant for one deal. Replies are grounded in the deal context loaded by the AI gateway.
 * It can PROPOSE field edits and next steps as cards; edits are applied through dealStore.updateDeal
 * only after the user clicks Apply.
 */
export const DealAssistantPanel: React.FC<{ dealId: string }> = ({ dealId }) => {
  const deal = useDealStore(s => s.deals[dealId]);
  const updateDeal = useDealStore(s => s.updateDeal);
  const { allowed } = usePermissions();
  const canEdit = allowed('edit', 'deal', deal);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [cardState, setCardState] = useState<Record<string, CardState>>({});
  const [cardError, setCardError] = useState<Record<string, string | null>>({});
  const idRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => { setMessages([]); setCardState({}); setCardError({}); }, [dealId]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const history: ChatTurn[] = messages.filter((m): m is Msg & { role: 'user' | 'assistant' } => m.role !== 'error').map(m => ({ role: m.role, content: m.content }));
    setMessages(m => [...m, { id: ++idRef.current, role: 'user', content: message }]);
    setInput('');
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await askDealAssistant({ dealId, deal, history, message, signal: ctrl.signal });
      setMessages(m => [...m, { id: ++idRef.current, role: 'assistant', content: r.reply, suggestions: r.suggestions }]);
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') setMessages(m => [...m, { id: ++idRef.current, role: 'error', content: aiErrorMessage(e) }]);
    } finally {
      setBusy(false);
    }
  };

  const keyOf = (msgId: number, s: AssistantSuggestion) => `${msgId}:${s.id}`;

  const apply = async (msgId: number, s: AssistantSuggestion) => {
    const k = keyOf(msgId, s);
    setCardState(c => ({ ...c, [k]: 'applying' }));
    setCardError(c => ({ ...c, [k]: null }));
    try {
      await applySuggestion(dealId, s, updateDeal);
      setCardState(c => ({ ...c, [k]: 'applied' }));
    } catch (e) {
      setCardState(c => ({ ...c, [k]: 'idle' }));
      setCardError(c => ({ ...c, [k]: e instanceof Error ? e.message : 'Could not apply this change' }));
    }
  };

  return (
    <section aria-label="Deal assistant" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-3 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
        <Sparkles className="mr-2 h-5 w-5 text-purple-500" />Deal assistant
      </h4>
      <div className="max-h-[420px] min-h-[120px] space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 && (
          <div>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">Ask about this deal. The assistant can suggest edits, but nothing changes until you click Apply.</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map(s => (
                <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : m.role === 'error' ? 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300' : 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'}`} role={m.role === 'error' ? 'alert' : undefined}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-2 space-y-2">
                  {m.suggestions.map(s => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      deal={deal}
                      state={cardState[keyOf(m.id, s)] ?? 'idle'}
                      error={cardError[keyOf(m.id, s)]}
                      canApply={canEdit && !!deal}
                      onApply={() => void apply(m.id, s)}
                      onDismiss={() => setCardState(c => ({ ...c, [keyOf(m.id, s)]: 'dismissed' }))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p role="status" className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Thinking...</p>}
        <div ref={endRef} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); void send(input); }}>
        <input
          aria-label="Message the deal assistant"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about this deal..."
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <button type="submit" disabled={busy || !input.trim()} className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50">
          <Send className="h-4 w-4" />Send
        </button>
      </form>
      {!canEdit && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">You do not have permission to edit this deal, so edits cannot be applied.</p>}
    </section>
  );
};

export default DealAssistantPanel;
