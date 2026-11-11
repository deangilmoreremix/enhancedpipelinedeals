import React from 'react';
import { BaseEdge, EdgeLabelRenderer, Handle, Position, getBezierPath, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, MinusCircle, Plus, X, XCircle } from 'lucide-react';
import type { WorkflowStep } from '../../types/workflow';
import { entryOfStep, isIterator, stepSummary, type RunStatus, type SourceHandle } from './workflowGraph';
import { accentForStep, iconFor } from './workflowIcons';
import type { WorkflowIssue } from './workflowValidation';

export interface StepNodeData extends Record<string, unknown> {
  step: WorkflowStep;
  issues: WorkflowIssue[];
  readOnly?: boolean;
  status?: RunStatus;
  durationMs?: number | null;
  output?: unknown;
  error?: string | null;
  onToggleActive?: (id: string, active: boolean) => void;
}

export type StepNode = Node<StepNodeData, 'step'>;

export const STATUS_STYLE: Record<RunStatus, { ring: string; chip: string; label: string }> = {
  completed: { ring: 'border-green-500', chip: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300', label: 'Completed' },
  failed: { ring: 'border-red-500', chip: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', label: 'Failed' },
  skipped: { ring: 'border-gray-400 border-dashed', chip: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', label: 'Skipped' },
  waiting: { ring: 'border-amber-500', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', label: 'Waiting' },
  running: { ring: 'border-blue-500 animate-pulse', chip: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', label: 'Running' },
  pending: { ring: 'border-gray-300 dark:border-gray-600 opacity-60', chip: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400', label: 'Not run' }
};

const StatusIcon: React.FC<{ status: RunStatus }> = ({ status }) =>
  status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> :
  status === 'failed' ? <XCircle className="w-3 h-3" /> :
  status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> :
  status === 'skipped' ? <MinusCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />;

const fmtMs = (ms?: number | null) => (ms === undefined || ms === null ? '' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

const handleCls = '!w-3 !h-3 !bg-blue-600 !border-2 !border-white dark:!border-gray-800';

const BRANCH_LABEL: Record<SourceHandle, string> = { out: '', true: 'True', false: 'False', item: 'Item', done: 'Done' };

export const WorkflowNode: React.FC<NodeProps<StepNode>> = ({ data, selected }) => {
  const { step, issues, readOnly, status, durationMs, output, error, onToggleActive } = data;
  const entry = entryOfStep(step);
  const Icon = iconFor(entry?.icon);
  const accent = accentForStep(step.type, step.action?.type);
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const st = status ? STATUS_STYLE[status] : undefined;
  const handles: SourceHandle[] = step.type === 'condition' ? ['true', 'false'] : isIterator(step) ? ['item', 'done'] : ['out'];

  return (
    <div
      data-testid={`wf-node-${step.id}`}
      className={`relative w-[260px] rounded-xl border-2 bg-white dark:bg-gray-800 shadow-sm transition-shadow ${st ? st.ring : selected ? 'border-blue-500 shadow-md' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'} ${selected && st ? 'shadow-md ring-2 ring-blue-400' : ''} ${step.isActive === false ? 'opacity-60' : ''}`}
    >
      {step.type !== 'trigger' && <Handle type="target" position={Position.Top} id="in" className={handleCls} />}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-[10px] ${accent.bar}`} aria-hidden />
      <div className="pl-4 pr-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`p-1.5 rounded-lg ${accent.chip}`}><Icon className="w-4 h-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{step.name || entry?.label || 'Step'}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">{step.type === 'action' ? entry?.label ?? step.action?.type ?? 'Action' : step.type}</div>
          </div>
          {(errors.length > 0 || warnings.length > 0) && !st && (
            <span
              title={[...errors, ...warnings].map(i => i.message).join('\n')}
              className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${errors.length ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}
              aria-label={errors.length ? `${errors.length} error(s)` : `${warnings.length} warning(s)`}
            >
              <AlertTriangle className="w-3 h-3" />{errors.length || warnings.length}
            </span>
          )}
          {!readOnly && (
            <button
              type="button"
              role="switch"
              aria-checked={step.isActive !== false}
              aria-label={`${step.isActive === false ? 'Enable' : 'Disable'} ${step.name}`}
              onClick={e => { e.stopPropagation(); onToggleActive?.(step.id, step.isActive === false); }}
              className={`nodrag relative w-7 h-4 rounded-full transition-colors shrink-0 ${step.isActive === false ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-600'}`}
            >
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${step.isActive === false ? 'left-0.5' : 'left-3.5'}`} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300 line-clamp-2 break-words">{stepSummary(step)}</p>
        {st && status && (
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${st.chip}`}><StatusIcon status={status} />{st.label}</span>
            {durationMs !== undefined && durationMs !== null && <span className="text-[10px] text-gray-500 dark:text-gray-400">{fmtMs(durationMs)}</span>}
          </div>
        )}
        {st && selected && (error || output !== undefined) && (
          <div role="dialog" aria-label={`${step.name} result`} className="nodrag nowheel absolute left-0 top-full mt-2 z-20 w-72 max-h-56 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-2 text-left">
            {error && <p className="text-xs text-red-600 dark:text-red-400 mb-1 break-words">{error}</p>}
            {output !== undefined && <pre className="text-[10px] text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{JSON.stringify(output, null, 2)}</pre>}
          </div>
        )}
      </div>
      {handles.length === 1 ? (
        <Handle type="source" position={Position.Bottom} id="out" className={handleCls} />
      ) : (
        handles.map((h, i) => (
          <React.Fragment key={h}>
            <Handle type="source" position={Position.Bottom} id={h} style={{ left: i === 0 ? '28%' : '72%' }} className={`${handleCls} ${h === 'false' ? '!bg-red-500' : h === 'done' ? '!bg-gray-500' : ''}`} />
            <span className="absolute -bottom-5 text-[10px] font-medium text-gray-500 dark:text-gray-400 -translate-x-1/2 pointer-events-none" style={{ left: i === 0 ? '28%' : '72%' }}>{BRANCH_LABEL[h]}</span>
          </React.Fragment>
        ))
      )}
    </div>
  );
};

// ---- edge with "+" insert button -------------------------------------------------------------------

export interface InsertEdgeData extends Record<string, unknown> {
  label?: string;
  readOnly?: boolean;
  onInsert?: (source: string, target: string, client: { x: number; y: number }) => void;
  onRemove?: (source: string, target: string) => void;
}

export const InsertEdge: React.FC<EdgeProps> = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd, style }) => {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const d = (data ?? {}) as InsertEdgeData;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: selected ? '#2563eb' : '#9ca3af', strokeWidth: 2, ...style }} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute flex items-center gap-1 pointer-events-auto"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {d.label && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 border border-gray-200 dark:border-gray-600">{d.label}</span>}
          {!d.readOnly && (
            <>
              <button
                type="button"
                aria-label="Insert step"
                title="Insert step"
                onClick={e => d.onInsert?.(source, target, { x: e.clientX, y: e.clientY })}
                className="w-5 h-5 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-blue-600 hover:border-blue-400 flex items-center justify-center shadow-sm"
              >
                <Plus className="w-3 h-3" />
              </button>
              {selected && (
                <button
                  type="button"
                  aria-label="Remove connection"
                  title="Remove connection"
                  onClick={() => d.onRemove?.(source, target)}
                  className="w-5 h-5 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-red-600 hover:border-red-400 flex items-center justify-center shadow-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
