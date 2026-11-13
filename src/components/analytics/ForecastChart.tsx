import React from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ForecastMonth } from '../../services/analyticsService';
import ChartCard, { formatCurrency } from './ChartCard';

export const ForecastChart: React.FC<{ months: ForecastMonth[] }> = ({ months }) => (
  <ChartCard title="Forecast by close month" subtitle="Open pipeline vs probability-weighted" empty={months.length === 0}>
    <div className="h-56" data-testid="forecast-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af33" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(Number(v))} width={52} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="total" name="Pipeline" fill="#93c5fd" radius={[4, 4, 0, 0]} />
          <Line dataKey="weighted" name="Weighted" stroke="#2563eb" strokeWidth={2} dot />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </ChartCard>
);

export default ForecastChart;
