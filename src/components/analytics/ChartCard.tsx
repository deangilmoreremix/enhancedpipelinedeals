import React from 'react';

export const CHART_COLORS: Record<string, string> = {
  blue: '#3b82f6', indigo: '#6366f1', purple: '#8b5cf6', green: '#10b981', red: '#ef4444',
  yellow: '#f59e0b', orange: '#f97316', pink: '#ec4899', teal: '#14b8a6', gray: '#6b7280'
};

export const colorFor = (color: string | undefined, fallbackIndex = 0): string => {
  if (color && CHART_COLORS[color]) return CHART_COLORS[color];
  if (color && /^#|^rgb|^hsl/.test(color)) return color;
  const keys = Object.keys(CHART_COLORS);
  return CHART_COLORS[keys[fallbackIndex % keys.length]];
};

export const formatCurrency = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  empty?: boolean;
  emptyText?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, actions, className = '', children, empty, emptyText = 'No data for this range yet' }) => (
  <section className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
    <div className="flex items-start justify-between gap-2 mb-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
    {empty ? (
      <div className="h-48 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">{emptyText}</div>
    ) : (
      children
    )}
  </section>
);

export default ChartCard;
