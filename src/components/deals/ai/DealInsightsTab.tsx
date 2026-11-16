import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { useDealStore } from '../../../store/dealStore';
import { CachedInsights, aiErrorMessage, readCachedInsights, refreshInsights } from '../../../services/dealAssistantService';

const List: React.FC<{ title: string; items?: string[] }> = ({ title, items }) =>
  items && items.length > 0 ? (
    <div>
      <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h5>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800 dark:text-gray-200">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </div>
  ) : null;

/** AI Insights tab: real insights for the deal via the `deal_analyze` task, last result cached per browser. */
export const DealInsightsTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const deal = useDealStore(s => s.deals[dealId]);
  const [cached, setCached] = useState<CachedInsights | null>(() => readCachedInsights(dealId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { setCached(readCachedInsights(dealId)); setError(null); }, [dealId]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const refresh = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      setCached(await refreshInsights(dealId, deal, ctrl.signal));
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') setError(aiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const d = cached?.data;
  const has = !!d && !!(d.insights?.length || d.risks?.length || d.recommendations?.length || d.suggestedNextSteps?.length || d.notes);

  return (
    <section aria-label="AI insights" className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white"><Sparkles className="mr-2 h-5 w-5 text-purple-500" />AI insights</h4>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{cached ? 'Refresh' : 'Generate insights'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p role="status" className="text-sm text-gray-500 dark:text-gray-400">Analyzing this deal...</p>}
      {!cached && !loading && !error && <p className="text-sm text-gray-500 dark:text-gray-400">No insights generated for this deal yet. Generate them from the deal's data.</p>}
      {cached && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Generated {new Date(cached.at).toLocaleString()}{typeof d?.probability === 'number' ? ` · suggested probability ${Math.round(d.probability)}%` : ''}{typeof d?.confidence === 'number' ? ` (confidence ${Math.round(d.confidence)}%)` : ''}</p>
          {d?.notes && <p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-200">{d.notes}</p>}
          <List title="Insights" items={d?.insights} />
          <List title="Risks" items={d?.risks} />
          <List title="Recommendations" items={d?.recommendations} />
          <List title="Suggested next steps" items={d?.suggestedNextSteps} />
          {!has && <p className="text-sm text-gray-500 dark:text-gray-400">The AI returned no insights for this deal.</p>}
        </div>
      )}
    </section>
  );
};

export default DealInsightsTab;
