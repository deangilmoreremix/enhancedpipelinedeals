import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Deal, PipelineStage } from '../../types';
import { AggregateOp, GroupBy, groupAggregate } from '../../services/analyticsService';
import ChartCard, { formatCurrency } from './ChartCard';

const GROUPS: Array<{ id: GroupBy; label: string }> = [
  { id: 'stage', label: 'Stage' }, { id: 'owner', label: 'Owner' }, { id: 'priority', label: 'Priority' },
  { id: 'company', label: 'Company' }, { id: 'month', label: 'Created month' }
];
const OPS: Array<{ id: AggregateOp; label: string }> = [
  { id: 'count', label: 'Count' }, { id: 'sum', label: 'Sum of value' }, { id: 'avg', label: 'Average value' }
];

const selectCls = 'border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-xs';

interface Props {
  deals: Deal[];
  stages: PipelineStage[];
  initialGroupBy?: GroupBy;
  initialOp?: AggregateOp;
}

/** Chart with user-selectable group-by dimension and aggregate operation. */
export const GroupAggregateChart: React.FC<Props> = ({ deals, stages, initialGroupBy = 'stage', initialOp = 'sum' }) => {
  const [groupBy, setGroupBy] = useState<GroupBy>(initialGroupBy);
  const [op, setOp] = useState<AggregateOp>(initialOp);
  const data = useMemo(() => groupAggregate(deals, stages, groupBy, op).slice(0, 12), [deals, stages, groupBy, op]);
  const fmt = (v: number) => (op === 'count' ? String(Math.round(v)) : formatCurrency(v));

  return (
    <ChartCard
      title="Explore pipeline"
      subtitle="Group and aggregate deals"
      empty={data.length === 0}
      actions={
        <div className="flex gap-2">
          <select aria-label="Group by" value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)} className={selectCls}>
            {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
          <select aria-label="Aggregate" value={op} onChange={e => setOp(e.target.value as AggregateOp)} className={selectCls}>
            {OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      }
    >
      <div className="h-56" data-testid="group-aggregate-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af33" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmt(Number(v))} width={52} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default GroupAggregateChart;
