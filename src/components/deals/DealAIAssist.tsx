import React, { useState } from 'react';
import { Sparkles, Target, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { canUseRemote } from '../../services/dealRecordShared';
import { AnalysisMode, DealAnalysis, aiErrorMessage, analyzeDeal } from '../../services/dealAssistantService';
import { useDealStore } from '../../store/dealStore';

export { DealAssistantPanel } from './ai/DealAssistantPanel';

const List: React.FC<{ title: string; items?: string[] }> = ({ title, items }) =>
  items && items.length > 0 ? (
    <div>
      <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h5>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">
        {items.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  ) : null;

/** Summarize / next-best-action helpers; shares dealAssistantService with the assistant and insights tab. */
export const DealAIAssist: React.FC<{ dealId: string }> = ({ dealId }) => {
  const deal = useDealStore(s => s.deals[dealId]);
  const [loading, setLoading] = useState<Exclude<AnalysisMode, 'insights'> | null>(null);
  const [result, setResult] = useState<{ mode: 'summary' | 'next'; data: DealAnalysis; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (mode: 'summary' | 'next') => {
    setLoading(mode);
    setError(null);
    try {
      const res = await analyzeDeal(dealId, mode, deal);
      setResult({ mode, data: res.data, text: res.text });
    } catch (e) {
      setError(aiErrorMessage(e));
    } finally {
      setLoading(null);
    }
  };

  const d = result?.data;
  const hasStructured = !!d && (d.notes || d.insights?.length || d.recommendations?.length || d.suggestedNextSteps?.length || d.risks?.length);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
          <Sparkles className="mr-2 h-5 w-5 text-purple-500" />AI assist
        </h4>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => void run('summary')}>
            {loading === 'summary' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}Summarize deal
          </Button>
          <Button size="sm" variant="outline" disabled={loading !== null} onClick={() => void run('next')}>
            {loading === 'next' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Target className="mr-1 h-4 w-4" />}Next best action
          </Button>
        </div>
      </div>
      {!canUseRemote(dealId) && (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">This deal is not saved to the database, so the assistant only sees the fields shown on the card, not its full CRM context.</p>
      )}
      {error && <Alert variant="error"><span className="text-sm">{error}</span></Alert>}
      {loading && <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Thinking...</p>}
      {result && !loading && (
        <div className="space-y-4">
          {d?.notes && <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800 dark:text-gray-200">{d.notes}</p>}
          <List title={result.mode === 'next' ? 'Next best action' : 'Key points'} items={result.mode === 'next' ? d?.suggestedNextSteps : d?.insights} />
          <List title={result.mode === 'next' ? 'Why' : 'Risks'} items={result.mode === 'next' ? d?.recommendations : d?.risks} />
          {!hasStructured && result.text && <p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-200">{result.text}</p>}
        </div>
      )}
      {!result && !loading && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Generate a quick summary or the next best action from this deal's data.</p>
      )}
    </div>
  );
};

export default DealAIAssist;
