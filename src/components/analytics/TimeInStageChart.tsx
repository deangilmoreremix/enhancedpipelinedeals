import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TimeInStageRow } from '../../services/analyticsService';
import ChartCard, { colorFor } from './ChartCard';

export const TimeInStageChart: React.FC<{ rows: TimeInStageRow[] }> = ({ rows }) => {
  const visible = rows.filter(r => r.samples > 0);
  const estimated = visible.length > 0 && visible.every(r => r.source === 'estimated');
  return (
    <ChartCard
      title="Average time in stage"
      subtitle={estimated ? 'Estimated from last update (no stage history yet)' : 'Days, from stage history'}
      empty={visible.length === 0}
    >
      <div className="h-56" data-testid="time-in-stage-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={visible} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af33" />
            <XAxis type="number" tick={{ fontSize: 11 }} unit="d" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
            <Tooltip formatter={(v: number) => `${v} days`} />
            <Bar dataKey="avgDays" name="Avg days" radius={[0, 4, 4, 0]}>
              {visible.map((r, i) => <Cell key={r.key} fill={colorFor(r.color, i)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

export default TimeInStageChart;
