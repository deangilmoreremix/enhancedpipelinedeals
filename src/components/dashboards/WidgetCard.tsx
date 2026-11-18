import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Pencil, Trash2 } from 'lucide-react';
import type { DealFieldDefinition } from '../../types/customFields';
import { useDealStore } from '../../store/dealStore';
import { fetchPipelineAggregates } from '../../services/analyticsService';
import { BTN_ICON } from '../ui/buttonStyles';
import { WidgetChart } from './WidgetChart';
import { GROUP_LABEL, MEASURE_LABEL, WidgetRecord, numericFieldsFor, validateWidgetConfig } from './widgetModel';
import { WidgetResult, WidgetSources, canUseServerAggregate, computeWidget, resultFromAggregates, widgetToCsv } from './widgetData';
import type { DashboardSources } from './useDashboardSources';

interface Props {
  widget: WidgetRecord;
  data: DashboardSources;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onResize: (cols: 1 | 2 | 3) => void;
}

const SPAN: Record<number, string> = { 1: 'md:col-span-1 lg:col-span-1', 2: 'md:col-span-2 lg:col-span-2', 3: 'md:col-span-2 lg:col-span-3' };

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function useWidgetResult(cfgInput: WidgetRecord['config'], defs: DealFieldDefinition[], sources: WidgetSources) {
  const connected = useDealStore(s => s.isConnectedToDatabase);
  const verdict = useMemo(() => validateWidgetConfig(cfgInput, defs), [cfgInput, defs]);
  const local = useMemo<WidgetResult | null>(() => (verdict.ok ? computeWidget(verdict.config, sources) : null), [verdict, sources]);
  const [server, setServer] = useState<WidgetResult | null>(null);
  const cfg = verdict.ok ? verdict.config : null;
  const dealSig = sources.deals.length;
  useEffect(() => {
    setServer(null);
    if (!cfg || !connected || !canUseServerAggregate(cfg)) return undefined;
    let cancelled = false;
    // Server aggregate (pipeline_aggregates RPC); null = unavailable, so the locally computed result stays
    void fetchPipelineAggregates(cfg.measure, cfg.field === 'probability' ? 'probability' : 'value').then(rows => {
      if (!cancelled && rows) setServer(resultFromAggregates(cfg, rows, sources.stages));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, connected, dealSig, sources.stages]);
  return { verdict, result: server ?? local };
}

export const WidgetCard: React.FC<Props> = ({ widget, data, canEdit, isFirst, isLast, onEdit, onDelete, onMove, onResize }) => {
  const { verdict, result } = useWidgetResult(widget.config, data.defs, data.sources);
  const cfg = verdict.ok ? verdict.config : widget.config;
  const sourceError = data.errors[cfg.object];
  const fieldLabel = numericFieldsFor(cfg.object, data.defs).find(f => f.id === cfg.field)?.label;
  const measureLabel = cfg.measure === 'count' ? 'Count' : `${MEASURE_LABEL[cfg.measure]} of ${fieldLabel ?? cfg.field}`;
  const groupLabel = GROUP_LABEL[cfg.groupBy];
  const iconBtn = `${BTN_ICON} !h-8 !w-8`;

  const exportCsv = () => {
    if (!result) return;
    downloadCsv(`${widget.title.replace(/[^\w-]+/g, '_') || 'widget'}.csv`, widgetToCsv(widget.title, cfg, result, measureLabel, groupLabel));
  };

  let body: React.ReactNode;
  if (!verdict.ok) {
    body = <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">This widget's settings are invalid: {verdict.errors.join('; ')}. {canEdit ? 'Edit it to fix.' : ''}</div>;
  } else if (sourceError) {
    body = (
      <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
        Could not load {cfg.object}: {sourceError}{' '}
        <button type="button" onClick={data.reload} className="font-medium underline">Retry</button>
      </div>
    );
  } else if (data.loading && !result?.matched) {
    body = <p role="status" className="flex h-40 items-center justify-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  } else if (!result || result.empty) {
    body = <p className="flex h-40 items-center justify-center text-sm text-gray-500 dark:text-gray-400">No {cfg.object} match this widget yet</p>;
  } else {
    body = <WidgetChart cfg={cfg} result={result} title={widget.title} measureLabel={measureLabel} groupLabel={groupLabel} />;
  }

  return (
    <section aria-label={`Widget: ${widget.title}`} data-testid="dashboard-widget" data-widget-id={widget.id} data-cols={cfg.cols}
      className={`col-span-1 ${SPAN[cfg.cols]} rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800`}>
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{widget.title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{measureLabel}{cfg.groupBy !== 'none' ? ` by ${groupLabel.toLowerCase()}` : ''}</p>
        </div>
        <div className="flex flex-shrink-0 gap-1">
          <button type="button" aria-label={`Export ${widget.title} as CSV`} title="Export CSV" disabled={!result || result.empty} onClick={exportCsv} className={iconBtn}><Download className="h-4 w-4" /></button>
          {canEdit && (
            <>
              <button type="button" aria-label={`Move ${widget.title} earlier`} title="Move earlier" disabled={isFirst} onClick={() => onMove(-1)} className={iconBtn}><ArrowLeft className="h-4 w-4" /></button>
              <button type="button" aria-label={`Move ${widget.title} later`} title="Move later" disabled={isLast} onClick={() => onMove(1)} className={iconBtn}><ArrowRight className="h-4 w-4" /></button>
              <select aria-label={`Width of ${widget.title}`} value={cfg.cols} onChange={e => onResize(Number(e.target.value) as 1 | 2 | 3)}
                className="h-8 rounded-lg border border-gray-300 bg-white px-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                <option value={1}>1 col</option><option value={2}>2 cols</option><option value={3}>3 cols</option>
              </select>
              <button type="button" aria-label={`Edit ${widget.title}`} title="Edit" onClick={onEdit} className={iconBtn}><Pencil className="h-4 w-4" /></button>
              <button type="button" aria-label={`Remove ${widget.title}`} title="Remove" onClick={onDelete} className={iconBtn}><Trash2 className="h-4 w-4" /></button>
            </>
          )}
        </div>
      </header>
      {body}
    </section>
  );
};
