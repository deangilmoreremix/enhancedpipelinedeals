import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Clock, GitBranch, TrendingUp, RefreshCw } from 'lucide-react';
import { Deal } from '../types';
import { useDealStore } from '../store/dealStore';
import { getStageMeta } from '../utils/stageMeta';
import { DealAnalytics, loadDealAnalytics } from '../services/dealAnalyticsService';

interface DealAnalyticsDashboardProps {
  deal: Deal;
}

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#65a30d', '#db2777'];

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string }> = ({ icon, label, value, hint }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{icon}{label}</div>
    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
  </div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{children}</p>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section aria-label={title} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <h4 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">{title}</h4>
    {children}
  </section>
);

/** Deal analytics from real data only (see services/dealAnalyticsService). */
export const DealAnalyticsDashboard: React.FC<DealAnalyticsDashboardProps> = ({ deal }) => {
  const stages = useDealStore(s => s.stages);
  const [data, setData] = useState<DealAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDealAnalytics({ id: deal.id, stage: deal.stage, createdAt: deal.createdAt })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load analytics'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deal.id, deal.stage, deal.createdAt, tick]);

  const stageRows = useMemo(
    () => (data?.stageDurations ?? []).map(s => ({ name: getStageMeta(stages, s.stage).name + (s.current ? ' (current)' : ''), days: s.days })),
    [data, stages],
  );
  const weekRows = useMemo(() => (data?.weeks ?? []).map(w => ({ label: w.label, ...w.byType })), [data]);
  const probRows = useMemo(
    () => (data?.probabilityTrend ?? []).map(p => ({ label: new Date(p.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), probability: p.value })),
    [data],
  );

  if (loading) return <p role="status" className="py-8 text-center text-gray-500 dark:text-gray-400">Loading analytics...</p>;
  if (error) return <p role="alert" className="py-8 text-center text-red-600 dark:text-red-400">{error}</p>;
  if (!data) return null;

  const d = data;
  const totalDays = d.stageDurations.reduce((n, s) => n + s.days, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white"><Activity className="mr-2 h-5 w-5 text-blue-600" />Deal analytics</h3>
        <button type="button" onClick={() => setTick(t => t + 1)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
          <RefreshCw className="h-4 w-4" />Refresh
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {d.source === 'database' ? 'Computed from this deal\'s recorded history and activity.' : 'Demo mode: derived from this session\'s in-memory timeline only.'}
      </p>
      {d.errors.length > 0 && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">Some data could not be loaded: {d.errors.join('; ')}</p>}

      {!d.hasData && <Empty>No history or activity has been recorded for this deal yet, so there is nothing to analyze.</Empty>}

      {d.hasData && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Days since last activity" value={d.daysSinceLastActivity === null ? 'None' : String(d.daysSinceLastActivity)} hint={d.lastActivityAt ? new Date(d.lastActivityAt).toLocaleDateString() : 'No activity recorded'} />
            <Stat icon={<GitBranch className="h-3.5 w-3.5" />} label="Stage changes" value={String(d.stageChangeCount)} />
            <Stat icon={<Activity className="h-3.5 w-3.5" />} label={`Activities (last ${d.weeks.length} wks)`} value={String(d.weeks.reduce((n, w) => n + w.total, 0))} />
            <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Tracked time in stages" value={d.stageDurations.length ? `${Math.round(totalDays)} d` : 'n/a'} />
          </div>

          <Card title="Time in each stage">
            {stageRows.length === 0 ? <Empty>No stage history recorded yet.</Empty> : (
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={stageRows} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" unit=" d" />
                    <YAxis type="category" dataKey="name" width={120} />
                    <Tooltip formatter={(v: number) => `${v} days`} />
                    <Bar dataKey="days" name="Days" fill={PALETTE[0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {stageRows.length > 0 && (
              <ul className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {stageRows.map(r => <li key={r.name}>{r.name}: {r.days} days</li>)}
              </ul>
            )}
          </Card>

          <Card title="Activity by week">
            {d.totalActivities === 0 ? <Empty>No activity in the last {d.weeks.length} weeks.</Empty> : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={weekRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {d.activityTypes.map((t, i) => <Bar key={t} dataKey={t} stackId="a" fill={PALETTE[i % PALETTE.length]} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Win probability over time">
            {probRows.length === 0 ? <Empty>No probability changes recorded for this deal.</Empty> : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={probRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis domain={[0, 100]} unit="%" />
                    <Tooltip />
                    <Line type="monotone" dataKey="probability" stroke={PALETTE[1]} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {probRows.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><TrendingUp className="h-3.5 w-3.5" />Latest: {probRows[probRows.length - 1].probability}%</p>}
          </Card>
        </>
      )}
    </div>
  );
};

export default DealAnalyticsDashboard;
