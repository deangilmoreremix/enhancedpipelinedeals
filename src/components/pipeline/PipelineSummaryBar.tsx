import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Deal, PipelineStage } from '../../types';
import { stageSummaries, weightedForecast, winRate } from '../../services/analyticsService';
import { colorFor, formatCurrency } from '../analytics/ChartCard';

export interface PipelineSummaryBarProps {
  deals: Deal[];
  stages: PipelineStage[];
  defaultCollapsed?: boolean;
}

/** Compact, collapsible board summary: totals, weighted forecast, win rate and a per-stage stacked bar. */
export const PipelineSummaryBar: React.FC<PipelineSummaryBarProps> = ({ deals, stages, defaultCollapsed = false }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const { summaries, forecast, wr, openValue } = useMemo(() => {
    const summaries = stageSummaries(deals, stages);
    const forecast = weightedForecast(deals, stages);
    return { summaries, forecast, wr: winRate(deals, stages), openValue: forecast.total };
  }, [deals, stages]);

  const totalValue = summaries.reduce((s, x) => s + x.value, 0);
  const stat = (label: string, value: string) => (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{value}</div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3" data-testid="pipeline-summary-bar">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          {stat('Total value', formatCurrency(totalValue))}
          {stat('Weighted forecast', formatCurrency(forecast.weighted))}
          {stat('Deals', String(deals.length))}
          {stat('Win rate', wr.won + wr.lost ? `${Math.round(wr.rate * 100)}%` : '—')}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand pipeline summary' : 'Collapse pipeline summary'}
          className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>
      {!collapsed && (
        <div className="mt-3" data-testid="pipeline-summary-stages">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700" role="img" aria-label="Value by stage">
            {totalValue > 0 && summaries.filter(s => s.value > 0).map((s, i) => (
              <div key={s.key} title={`${s.name}: ${formatCurrency(s.value)}`} style={{ width: `${(s.value / totalValue) * 100}%`, background: colorFor(s.color, i) }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
            {summaries.map((s, i) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorFor(s.color, i) }} />
                {s.name}: {s.count} · {formatCurrency(s.value)}
              </li>
            ))}
          </ul>
          <div className="sr-only">Open pipeline {formatCurrency(openValue)}</div>
        </div>
      )}
    </div>
  );
};

export default PipelineSummaryBar;
