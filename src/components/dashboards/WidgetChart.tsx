import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '../analytics';
import type { WidgetConfig } from './widgetModel';
import type { WidgetResult } from './widgetData';

/** Categorical slots in fixed order (never cycled): blue, orange, aqua, yellow, magenta, green, violet, red. */
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
const OTHER = { light: '#9a9992', dark: '#898880' };

/** Follows the app's `dark` class on <html> (Tailwind dark mode) and the OS setting. */
export function useIsDark(): boolean {
  const read = () => {
    if (typeof document === 'undefined') return false;
    const el = document.documentElement;
    if (el.classList.contains('dark')) return true;
    if (el.classList.contains('light')) return false;
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;
    const mo = new MutationObserver(() => setDark(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export function valueFormatter(cfg: WidgetConfig): (v: number) => string {
  if (cfg.measure === 'count') return v => Math.round(v).toLocaleString();
  if (cfg.field === 'value' || cfg.field === 'revenue') return formatCurrency;
  if (cfg.field === 'probability') return v => `${Math.round(v * 10) / 10}%`;
  return v => (Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : String(Math.round(v * 100) / 100));
}

interface Props { cfg: WidgetConfig; result: WidgetResult; title: string; measureLabel: string; groupLabel: string }

const TICK = { fontSize: 11, fill: 'currentColor' };

/** Chart body for one widget. Always ships a visually hidden data table so values are readable without the colour/plot. */
export const WidgetChart: React.FC<Props> = ({ cfg, result, title, measureLabel, groupLabel }) => {
  const dark = useIsDark();
  const palette = dark ? SERIES_DARK : SERIES_LIGHT;
  const fmt = valueFormatter(cfg);
  const grid = dark ? '#383835' : '#f0efec';
  const tipStyle = { background: dark ? '#1a1a19' : '#fcfcfb', border: `1px solid ${dark ? '#383835' : '#e2e1dc'}`, color: dark ? '#f0efec' : '#0b0b0b', borderRadius: 8, fontSize: 12 };
  const summary = `${title}. ${result.rows.map(r => `${r.label}: ${fmt(r.value)}`).join('; ')}`;

  const srTable = (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead><tr><th scope="col">{groupLabel}</th><th scope="col">{measureLabel}</th></tr></thead>
      <tbody>{result.rows.map(r => <tr key={r.key}><th scope="row">{r.label}</th><td>{fmt(r.value)}</td></tr>)}</tbody>
    </table>
  );

  if (cfg.chart === 'number') {
    return (
      <div data-testid="widget-number" className="flex h-40 flex-col items-center justify-center">
        <div className="text-4xl font-semibold tabular-nums text-gray-900 dark:text-white" aria-label={`${measureLabel}: ${fmt(result.total)}`}>{fmt(result.total)}</div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{measureLabel} · {result.matched.toLocaleString()} record{result.matched === 1 ? '' : 's'}</div>
      </div>
    );
  }

  if (cfg.chart === 'table') {
    return (
      <div className="max-h-64 overflow-auto" data-testid="widget-table">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr><th scope="col" className="py-1.5 pr-3 font-medium">{groupLabel}</th><th scope="col" className="py-1.5 pr-3 text-right font-medium">{measureLabel}</th><th scope="col" className="py-1.5 text-right font-medium">Records</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {result.rows.map(r => (
              <tr key={r.key}>
                <th scope="row" className="py-1.5 pr-3 text-left font-normal text-gray-800 dark:text-gray-200">{r.label}</th>
                <td className="py-1.5 pr-3 text-right tabular-nums text-gray-900 dark:text-white">{fmt(r.value)}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (cfg.chart === 'pie') {
    // Hues are assigned in fixed order; anything past the 8th slot folds into "Other"
    const positive = result.rows.filter(r => r.value > 0);
    const head = positive.slice(0, 7);
    const rest = positive.slice(7);
    const slices = rest.length ? [...head, { key: '__other', label: 'Other', value: rest.reduce((a, r) => a + r.value, 0), count: rest.reduce((a, r) => a + r.count, 0) }] : positive;
    const colorOf = (i: number, key: string) => (key === '__other' ? (dark ? OTHER.dark : OTHER.light) : palette[i % palette.length]);
    return (
      <div className="h-64" data-testid="widget-pie" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke={dark ? '#1a1a19' : '#fcfcfb'} strokeWidth={2} isAnimationActive={false}>
              {slices.map((s, i) => <Cell key={s.key} fill={colorOf(i, s.key)} />)}
            </Pie>
            <Tooltip contentStyle={tipStyle} formatter={(v: number) => fmt(v)} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        {srTable}
      </div>
    );
  }

  const data = result.rows.map(r => ({ name: r.label, value: r.value }));
  const color = palette[0];
  return (
    <div className="h-64 text-gray-500 dark:text-gray-400" data-testid={cfg.chart === 'line' ? 'widget-line' : 'widget-bar'} role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        {cfg.chart === 'line' ? (
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} width={52} tickFormatter={v => fmt(Number(v))} />
            <Tooltip contentStyle={tipStyle} formatter={(v: number) => [fmt(v), measureLabel]} />
            <Line type="monotone" dataKey="value" name={measureLabel} stroke={color} strokeWidth={2} dot={{ r: 4, fill: color, stroke: dark ? '#1a1a19' : '#fcfcfb', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} width={52} tickFormatter={v => fmt(Number(v))} />
            <Tooltip contentStyle={tipStyle} cursor={{ fill: dark ? '#ffffff12' : '#00000008' }} formatter={(v: number) => [fmt(v), measureLabel]} />
            <Bar dataKey="value" name={measureLabel} fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
      {srTable}
    </div>
  );
};
