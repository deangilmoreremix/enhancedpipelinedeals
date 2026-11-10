import React, { useEffect, useMemo, useState } from 'react';
import KPIWidgets from '../components/deals/KPIWidgets';
import WeightedPipelineTotal from '../components/deals/WeightedPipelineTotal';
import SLAIndicator from '../components/deals/SLAIndicator';
import {
  FunnelChart, ForecastChart, GroupAggregateChart, TimeInStageChart, ValueByStageChart, WinRateGauge, ChartCard, formatCurrency
} from '../components/analytics';
import { PageContainer, PageHeader } from './PageHeader';
import { useDeals } from './hooks';
import { useDealStore } from '../store/dealStore';
import {
  DateRangeKey, HistoryRow, atRiskDeals, conversionFunnel, cycleTime, fetchDealHistory, fetchPipelineAggregates,
  filterDealsByRange, forecastByMonth, isOpenDeal, pipelineVelocity, rangeStart, timeInStage, weightedForecast, winRate
} from '../services/analyticsService';

const HOUR = 3600 * 1000;

const RANGES: Array<{ id: DateRangeKey; label: string; kpi: 'week' | 'month' | 'quarter' | 'year' }> = [
  { id: '7d', label: 'Last 7 days', kpi: 'week' },
  { id: '30d', label: 'Last 30 days', kpi: 'month' },
  { id: '90d', label: 'Last 90 days', kpi: 'quarter' },
  { id: '365d', label: 'Last 12 months', kpi: 'year' },
  { id: 'all', label: 'All time', kpi: 'year' }
];

const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className="text-xl font-semibold text-gray-900 dark:text-white mt-1">{value}</div>
    {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
  </div>
);

const AnalyticsPage: React.FC = () => {
  const { deals, isLoading } = useDeals();
  const stages = useDealStore(s => s.stages);
  const connected = useDealStore(s => s.isConnectedToDatabase);
  const [range, setRange] = useState<DateRangeKey>('90d');
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [serverTotal, setServerTotal] = useState<number | null>(null);

  const allDeals = useMemo(() => Object.values(deals), [deals]);
  const dealList = useMemo(() => filterDealsByRange(allDeals, range), [allDeals, range]);
  const rangeDef = RANGES.find(r => r.id === range) ?? RANGES[2];

  useEffect(() => {
    let cancelled = false;
    void fetchDealHistory(rangeStart(range) ?? undefined).then(rows => { if (!cancelled) setHistory(rows); });
    return () => { cancelled = true; };
  }, [range]);

  // Server-side aggregate (pipeline_aggregates RPC) for the headline total when connected
  useEffect(() => {
    if (!connected) { setServerTotal(null); return; }
    let cancelled = false;
    void fetchPipelineAggregates('sum', 'value').then(rows => {
      if (!cancelled) setServerTotal(rows ? rows.reduce((s, r) => s + r.agg, 0) : null);
    });
    return () => { cancelled = true; };
  }, [connected, allDeals.length]);

  const analytics = useMemo(() => {
    const forecast = weightedForecast(dealList, stages);
    const wr = winRate(dealList, stages);
    const cycle = cycleTime(dealList, stages, history);
    return {
      forecast,
      wr,
      cycle,
      velocity: pipelineVelocity(dealList, stages, history),
      funnel: conversionFunnel(dealList, stages, history),
      months: forecastByMonth(dealList, stages),
      tis: timeInStage(dealList, stages, history),
      risky: atRiskDeals(dealList, stages, { limit: 6 })
    };
  }, [dealList, stages, history]);

  const totalValue = dealList.reduce((s, d) => s + (d.value || 0), 0);
  const headlineTotal = range === 'all' && serverTotal !== null ? serverTotal : totalValue;

  // SLA derived from each open deal's own created -> due window
  const slaDeals = useMemo(() => {
    const now = Date.now();
    return dealList
      .filter(d => d.dueDate && isOpenDeal(d, stages))
      .slice(0, 6)
      .map(d => {
        const start = new Date(d.createdAt).getTime();
        const due = new Date(d.dueDate as Date).getTime();
        const target = Math.max(1, Math.round((due - start) / HOUR));
        const elapsed = Math.max(0, Math.round((now - start) / HOUR));
        const status: 'on-track' | 'at-risk' | 'breached' =
          elapsed >= target ? 'breached' : elapsed >= target * 0.8 ? 'at-risk' : 'on-track';
        return { deal: d, target, elapsed, status };
      });
  }, [dealList, stages]);

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        subtitle="Pipeline performance, forecasts and KPIs"
        actions={
          <select
            aria-label="Date range"
            value={range}
            onChange={e => setRange(e.target.value as DateRangeKey)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-sm"
          >
            {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        }
      />
      {isLoading && allDeals.length === 0 && <p className="text-sm text-gray-500 mb-4">Loading deals…</p>}
      <div className="space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Pipeline value" value={formatCurrency(headlineTotal)} hint={`${dealList.length} deals`} />
          <Stat label="Weighted forecast" value={formatCurrency(analytics.forecast.weighted)} hint={`${analytics.forecast.count} open deals`} />
          <Stat label="Avg. sales cycle" value={analytics.cycle.samples ? `${analytics.cycle.avgDays} days` : '—'} hint={`${analytics.cycle.samples} won deals`} />
          <Stat label="Pipeline velocity" value={analytics.velocity ? `${formatCurrency(analytics.velocity)}/day` : '—'} hint="open × avg size × win rate ÷ cycle" />
        </div>

        <KPIWidgets deals={deals} timeRange={rangeDef.kpi} />
        <WeightedPipelineTotal deals={dealList} showBreakdown />

        <div className="grid gap-4 lg:grid-cols-2">
          <ValueByStageChart deals={dealList} stages={stages} metric="value" />
          <ValueByStageChart deals={dealList} stages={stages} metric="count" />
          <FunnelChart steps={analytics.funnel} />
          <WinRateGauge result={analytics.wr} />
          <ForecastChart months={analytics.months} />
          <TimeInStageChart rows={analytics.tis} />
        </div>

        <GroupAggregateChart deals={dealList} stages={stages} />

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Stale and at-risk deals" subtitle="Quiet or past their close date" empty={analytics.risky.length === 0} emptyText="Nothing at risk right now">
            <ul className="divide-y divide-gray-100 dark:divide-gray-700" data-testid="at-risk-list">
              {analytics.risky.map(r => (
                <li key={r.deal.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{r.deal.title || r.deal.company}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{r.reasons.join(' · ')}</div>
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatCurrency(r.deal.value)}</span>
                </li>
              ))}
            </ul>
          </ChartCard>

          {slaDeals.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Deal SLAs</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {slaDeals.map(({ deal, target, elapsed, status }) => (
                  <SLAIndicator
                    key={deal.id}
                    dealId={deal.id}
                    slaTargetHours={target}
                    elapsedHours={elapsed}
                    status={status}
                    lastUpdated={new Date(deal.updatedAt)}
                    compact
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default AnalyticsPage;
