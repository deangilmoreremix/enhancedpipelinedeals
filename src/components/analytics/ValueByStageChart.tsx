import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Deal, PipelineStage } from '../../types';
import { stageSummaries } from '../../services/analyticsService';
import ChartCard, { colorFor, formatCurrency } from './ChartCard';

interface Props {
  deals: Deal[];
  stages: PipelineStage[];
  metric?: 'value' | 'count';
}

export const ValueByStageChart: React.FC<Props> = ({ deals, stages, metric = 'value' }) => {
  const data = stageSummaries(deals, stages).map((s, i) => ({
    name: s.name,
    amount: metric === 'value' ? s.value : s.count,
    fill: colorFor(s.color, i)
  }));
  const empty = data.every(d => d.amount === 0);
  return (
    <ChartCard title={metric === 'value' ? 'Value by stage' : 'Deals by stage'} subtitle={metric === 'value' ? 'Total deal value per stage' : 'Number of deals per stage'} empty={empty}>
      <div className="h-56" data-testid="value-by-stage-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af33" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (metric === 'value' ? formatCurrency(Number(v)) : String(v))} width={52} />
            <Tooltip formatter={(v: number) => (metric === 'value' ? formatCurrency(v) : v)} />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {data.map(d => <Cell key={d.name} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default ValueByStageChart;
