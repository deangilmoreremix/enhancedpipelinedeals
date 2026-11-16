import React from 'react';
import { Check, X, Loader2, ArrowRight } from 'lucide-react';
import { AssistantSuggestion, currentFieldValue, suggestionToUpdates } from '../../../services/dealAssistantService';
import type { Deal } from '../../../types';

export type CardState = 'idle' | 'applying' | 'applied' | 'dismissed';

/** A proposed change. Field edits can be applied ONLY by clicking Apply; nothing is written automatically. */
export const SuggestionCard: React.FC<{
  suggestion: AssistantSuggestion;
  deal?: Partial<Deal>;
  state: CardState;
  error?: string | null;
  canApply: boolean;
  onApply: (s: AssistantSuggestion) => void;
  onDismiss: (s: AssistantSuggestion) => void;
}> = ({ suggestion: s, deal, state, error, canApply, onApply, onDismiss }) => {
  const isEdit = s.kind === 'field_edit' && !!suggestionToUpdates(s);
  if (state === 'dismissed') return null;
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20" data-testid="suggestion-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">{isEdit ? 'Proposed edit' : 'Suggested next step'}</p>
      <p className="mt-0.5 font-medium text-gray-900 dark:text-white">{s.title}</p>
      {isEdit && s.field && (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-gray-700 dark:text-gray-200">
          <span className="font-mono text-xs">{s.field}</span>: {currentFieldValue(deal, s.field)} <ArrowRight className="h-3.5 w-3.5" /> <strong>{s.value}</strong>
        </p>
      )}
      {s.rationale && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{s.rationale}</p>}
      {error && <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-2 flex gap-2">
        {isEdit && state !== 'applied' && (
          <button type="button" onClick={() => onApply(s)} disabled={!canApply || state === 'applying'} className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-2.5 py-1 text-sm text-white hover:bg-purple-700 disabled:opacity-50">
            {state === 'applying' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Apply
          </button>
        )}
        {state === 'applied' && <span className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-300"><Check className="h-3.5 w-3.5" />Applied</span>}
        {state !== 'applied' && (
          <button type="button" onClick={() => onDismiss(s)} disabled={state === 'applying'} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-700 hover:bg-white dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            <X className="h-3.5 w-3.5" />Dismiss
          </button>
        )}
        {state === 'applied' && (
          <button type="button" onClick={() => onDismiss(s)} className="text-sm text-gray-500 underline dark:text-gray-400">Hide</button>
        )}
      </div>
    </div>
  );
};
