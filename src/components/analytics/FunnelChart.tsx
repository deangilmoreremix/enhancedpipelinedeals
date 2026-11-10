import React from 'react';
import type { FunnelStep } from '../../services/analyticsService';
import ChartCard, { colorFor } from './ChartCard';

interface Props { steps: FunnelStep[] }

/** Horizontal funnel built from divs (accessible, no chart lib needed). */
export const FunnelChart: React.FC<Props> = ({ steps }) => {
  const max = Math.max(1, ...steps.map(s => s.reached));
  const empty = steps.every(s => s.reached === 0);
  const source = steps[0]?.source === 'history' ? 'from stage history' : 'from current stages';
  return (
    <ChartCard title="Stage conversion funnel" subtitle={`Deals reaching each stage (${source})`} empty={empty}>
      <ul className="space-y-2" data-testid="funnel-chart">
        {steps.map((s, i) => (
          <li key={s.key}>
            <div className="flex justify-between text-xs mb-1 text-gray-600 dark:text-gray-300">
              <span className="font-medium">{s.name}</span>
              <span>
                {s.reached}
                {i > 0 && <span className="ml-2 text-gray-400">{Math.round(s.conversionFromPrev * 100)}% of prev</span>}
              </span>
            </div>
            <div className="h-5 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div className="h-full rounded" style={{ width: `${(s.reached / max) * 100}%`, background: colorFor(s.color, i) }} />
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
};

export default FunnelChart;
