import type { ConnectionLabel, StepType, Workflow, WorkflowStep, WorkflowTrigger } from '../../types/workflow';
import { ACTION_ENTRIES, CONDITION_ENTRY, getActionEntry, getConfigValue, getTriggerEntry, type RegistryEntry } from '../../services/workflowActionRegistry';

/** Source handle ids used by the node component. */
export type SourceHandle = 'out' | 'true' | 'false' | 'item' | 'done';

export const GRID = 20;
export const NODE_WIDTH = 260;

let counter = 0;
export const newId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const isIterator = (s: WorkflowStep): boolean => s.type === 'action' && s.action?.type === 'iterator';

/** Which source handles a step exposes. */
export function sourceHandlesOf(step: WorkflowStep): SourceHandle[] {
  if (step.type === 'condition') return ['true', 'false'];
  if (isIterator(step)) return ['item', 'done'];
  return ['out'];
}

/** Handle an existing connection is drawn from (unlabelled condition = true, unlabelled iterator = item). */
export function handleForConnection(step: WorkflowStep, targetId: string): SourceHandle {
  const label = step.connectionLabels?.[targetId];
  if (step.type === 'condition') return label === 'false' ? 'false' : 'true';
  if (isIterator(step)) return label === 'done' ? 'done' : 'item';
  return 'out';
}

const labelForHandle = (step: WorkflowStep, handle: string | null | undefined): ConnectionLabel | undefined => {
  if (step.type === 'condition' && (handle === 'true' || handle === 'false')) return handle;
  if (isIterator(step) && (handle === 'item' || handle === 'done')) return handle;
  return undefined;
};

export const snap = (n: number): number => Math.round(n / GRID) * GRID;

// ---- step factory -------------------------------------------------------------------------------

export function createStepFromEntry(entry: RegistryEntry, position: { x: number; y: number }): WorkflowStep {
  const base = { id: newId('step'), description: entry.description, position, connections: [] as string[], isActive: true };
  if (entry.category === 'Triggers') {
    const config: Record<string, any> = {};
    for (const f of entry.fields) if (f.defaultValue !== undefined && !f.key.includes('.')) config[f.key] = f.defaultValue;
    if (entry.key === 'scheduled') config.schedule = { frequency: 'daily', time: '09:00' };
    const trigger: WorkflowTrigger = {
      id: newId('trigger'), type: entry.key as WorkflowTrigger['type'], name: entry.label, description: entry.description,
      config, isActive: true
    };
    return { ...base, name: entry.label, type: 'trigger', trigger };
  }
  if (entry.key === CONDITION_ENTRY.key) {
    return { ...base, name: 'Condition', type: 'condition', condition: { id: newId('cond'), field: '', operator: 'equals', value: '' } };
  }
  if (entry.key === 'delay') {
    return { ...base, name: 'Delay', type: 'delay', delay: 60 };
  }
  const config: Record<string, any> = {};
  for (const f of entry.fields) if (f.defaultValue !== undefined && !f.key.includes('.')) config[f.key] = f.defaultValue;
  return {
    ...base, name: entry.label, type: 'action',
    action: { id: newId('action'), type: entry.key as NonNullable<WorkflowStep['action']>['type'], name: entry.label, description: entry.description, config }
  };
}

export function entryOfStep(step: WorkflowStep): RegistryEntry | undefined {
  if (step.type === 'trigger') return getTriggerEntry(step.trigger?.type);
  if (step.type === 'condition') return CONDITION_ENTRY;
  if (step.type === 'delay') return ACTION_ENTRIES.find(e => e.key === 'delay');
  return getActionEntry(step.action?.type);
}

// ---- graph operations (pure; return new arrays) ---------------------------------------------------

export function connectSteps(steps: WorkflowStep[], source: string, target: string, handle?: string | null): WorkflowStep[] {
  if (source === target) return steps;
  const src = steps.find(s => s.id === source);
  const tgt = steps.find(s => s.id === target);
  if (!src || !tgt || tgt.type === 'trigger') return steps;
  const label = labelForHandle(src, handle);
  // A branch handle can target a given step only once; plain handles toggle nothing (idempotent).
  const conns = src.connections.includes(target) ? src.connections : [...src.connections, target];
  const labels = { ...(src.connectionLabels ?? {}) };
  if (label) labels[target] = label;
  else if (src.connectionLabels && target in labels && !label) delete labels[target];
  return steps.map(s => (s.id === source
    ? { ...s, connections: conns, ...(Object.keys(labels).length ? { connectionLabels: labels } : { connectionLabels: undefined }) }
    : s));
}

export function disconnectSteps(steps: WorkflowStep[], source: string, target: string): WorkflowStep[] {
  return steps.map(s => {
    if (s.id !== source) return s;
    const labels = { ...(s.connectionLabels ?? {}) };
    delete labels[target];
    return { ...s, connections: s.connections.filter(c => c !== target), connectionLabels: Object.keys(labels).length ? labels : undefined };
  });
}

export function removeSteps(steps: WorkflowStep[], ids: string[]): WorkflowStep[] {
  const gone = new Set(ids);
  return steps.filter(s => !gone.has(s.id)).map(s => {
    if (!s.connections.some(c => gone.has(c))) return s;
    const labels = { ...(s.connectionLabels ?? {}) };
    for (const id of gone) delete labels[id];
    return { ...s, connections: s.connections.filter(c => !gone.has(c)), connectionLabels: Object.keys(labels).length ? labels : undefined };
  });
}

/** Puts `newStep` between `source` and `target` on an existing edge (preserving the branch label). */
export function insertOnEdge(steps: WorkflowStep[], source: string, target: string, newStep: WorkflowStep): WorkflowStep[] {
  const src = steps.find(s => s.id === source);
  if (!src) return [...steps, newStep];
  const label = src.connectionLabels?.[target];
  const handle = label ?? undefined;
  let next = disconnectSteps(steps, source, target);
  const withNew = [...next, { ...newStep, connections: newStep.type === 'trigger' ? [] : [target] }];
  next = connectSteps(withNew, source, newStep.id, handle);
  return next;
}

/** Appends `newStep` after `source` (via the given handle). */
export function appendAfter(steps: WorkflowStep[], source: string, handle: string | null | undefined, newStep: WorkflowStep): WorkflowStep[] {
  return connectSteps([...steps, newStep], source, newStep.id, handle);
}

/** Workflow-level `triggers` must mirror trigger steps (the server matches events against it). */
export function withDerivedTriggers(workflow: Workflow, steps: WorkflowStep[]): Workflow {
  const fromSteps = steps.filter(s => s.type === 'trigger' && s.trigger).map(s => ({ ...(s.trigger as WorkflowTrigger), isActive: s.isActive !== false && s.trigger?.isActive !== false }));
  return { ...workflow, steps, triggers: fromSteps.length > 0 ? fromSteps : workflow.triggers };
}

/** Next free position below the lowest existing step (or below `anchor`). */
export function nextPosition(steps: WorkflowStep[], anchor?: WorkflowStep): { x: number; y: number } {
  if (anchor) return { x: snap(anchor.position.x), y: snap(anchor.position.y + 170) };
  if (steps.length === 0) return { x: 0, y: 0 };
  const last = steps.reduce((a, b) => (b.position.y >= a.position.y ? b : a));
  return { x: snap(last.position.x), y: snap(last.position.y + 170) };
}

// ---- display helpers ------------------------------------------------------------------------------

export function stepSummary(step: WorkflowStep): string {
  const clip = (v: unknown, n = 44) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
  if (step.type === 'delay') return `Wait ${step.delay ?? 0} min`;
  if (step.type === 'condition') {
    const c = step.condition;
    if (!c?.field) return 'Not configured';
    const noValue = c.operator === 'is_empty' || c.operator === 'is_not_empty';
    return clip(`${c.field} ${c.operator.replace(/_/g, ' ')}${noValue ? '' : ` ${c.value ?? ''}`}`);
  }
  if (step.type === 'trigger') {
    const c = (step.trigger?.config ?? {}) as Record<string, any>;
    const t = step.trigger?.type;
    if (t === 'stage_changed') return `${c.fromStage || 'any'} → ${c.toStage || 'any'}`;
    if (t === 'field_changed') return c.fieldName ? `Field: ${c.fieldName}` : 'Not configured';
    if (t === 'scheduled') return c.schedule?.cronExpression || `${c.schedule?.frequency ?? 'daily'} ${c.schedule?.time ?? ''}`.trim();
    return c.recordType ? `On ${c.recordType}` : getTriggerEntry(t)?.description ?? '';
  }
  const a = step.action;
  if (!a) return 'Not configured';
  const cfg = (a.config ?? {}) as Record<string, any>;
  const first = getActionEntry(a.type)?.fields.find(f => f.required) ?? getActionEntry(a.type)?.fields[0];
  const v = first ? getConfigValue(cfg, first.key) : undefined;
  if (v === undefined || v === '') return getActionEntry(a.type)?.description ?? a.type;
  return clip(typeof v === 'object' ? JSON.stringify(v) : v);
}

export type RunStatus = 'completed' | 'failed' | 'skipped' | 'waiting' | 'running' | 'pending';
