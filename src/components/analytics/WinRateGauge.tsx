import React from 'react';
import type { WinRateResult } from '../../services/analyticsService';
import ChartCard, { formatCurrency } from './ChartCard';

export const WinRateGauge: React.FC<{ result: WinRateResult }> = ({ result }) => {
  const pct = Math.round(result.rate * 100);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const closed = result.won + result.lost;
  return (
    <ChartCard title="Win rate" subtitle="Won ÷ (won + lost)" empty={closed === 0} emptyText="No closed deals yet">
      <div className="flex items-center gap-5" data-testid="win-rate-gauge">
        <svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={`Win rate ${pct}%`}>
          <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" className="stroke-gray-200 dark:stroke-gray-700" />
          <circle
            cx="64" cy="64" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
            stroke="#10b981" strokeDasharray={circ} strokeDashoffset={circ * (1 - result.rate)}
            transform="rotate(-90 64 64)"
          />
          <text x="64" y="70" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="24" fontWeight="700">{pct}%</text>
        </svg>
        <dl className="text-sm space-y-1">
          <div><dt className="inline text-gray-500 dark:text-gray-400">Won: </dt><dd className="inline font-medium text-gray-900 dark:text-white">{result.won} ({formatCurrency(result.wonValue)})</dd></div>
          <div><dt className="inline text-gray-500 dark:text-gray-400">Lost: </dt><dd className="inline font-medium text-gray-900 dark:text-white">{result.lost} ({formatCurrency(result.lostValue)})</dd></div>
        </dl>
      </div>
    </ChartCard>
  );
};

export default WinRateGauge;
