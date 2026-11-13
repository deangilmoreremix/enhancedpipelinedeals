import type { WorkflowStep } from '../../types/workflow';
import { getActionEntry, getTriggerEntry, missingRequired } from '../../services/workflowActionRegistry';

export type IssueSeverity = 'error' | 'warning';

export interface WorkflowIssue {
  severity: IssueSeverity;
  message: string;
  stepId?: string;
  code:
    | 'missing_trigger' | 'duplicate_trigger' | 'trigger_has_input' | 'unreachable' | 'cycle' | 'dangling'
    | 'missing_config' | 'unknown_type' | 'condition_branch' | 'iterator_branch' | 'engine_support';
}

export interface ValidationResult {
  issues: WorkflowIssue[];
  errors: WorkflowIssue[];
  warnings: WorkflowIssue[];
  byStep: Record<string, WorkflowIssue[]>;
  /** True when Save must be blocked. */
  hasErrors: boolean;
}

/** Ids of steps that sit on a cycle (iterative Tarjan-free DFS colouring). */
export function findCycleSteps(steps: WorkflowStep[]): Set<string> {
  const ids = new Set(steps.map(s => s.id));
  const adj = new Map(steps.map(s => [s.id, (s.connections ?? []).filter(c => ids.has(c))]));
  const color = new Map<string, 0 | 1 | 2>();
  const inCycle = new Set<string>();
  const stack: string[] = [];
  const dfs = (id: string): void => {
    color.set(id, 1);
    stack.push(id);
    for (const n of adj.get(id) ?? []) {
      if (color.get(n) === 1) {
        for (let i = stack.indexOf(n); i < stack.length; i++) inCycle.add(stack[i]);
      } else if (!color.get(n)) dfs(n);
    }
    stack.pop();
    color.set(id, 2);
  };
  for (const s of steps) if (!color.get(s.id)) dfs(s.id);
  return inCycle;
}

/** Steps reachable from the trigger step(s) following `connections` (active steps only). */
export function reachableFromTriggers(steps: WorkflowStep[]): Set<string> {
  const map = new Map(steps.map(s => [s.id, s]));
  const seen = new Set<string>();
  const queue = steps.filter(s => s.type === 'trigger').map(s => s.id);
  while (queue.length) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const s = map.get(id);
    if (s && s.isActive !== false) queue.push(...(s.connections ?? []));
  }
  return seen;
}

export interface ValidateOptions {
  /** The workflow already has `triggers` outside trigger steps (legacy): a missing trigger step is only a warning. */
  legacyTriggers?: boolean;
}

export function validateWorkflow(steps: WorkflowStep[], opts: ValidateOptions = {}): ValidationResult {
  const issues: WorkflowIssue[] = [];
  const add = (i: WorkflowIssue) => issues.push(i);
  const ids = new Set(steps.map(s => s.id));
  const triggers = steps.filter(s => s.type === 'trigger');

  if (steps.length > 0 && triggers.length === 0) {
    add({ severity: opts.legacyTriggers ? 'warning' : 'error', code: 'missing_trigger', message: 'Add a trigger step so the workflow knows when to run.' });
  }
  if (triggers.length > 1) {
    for (const t of triggers) add({ severity: 'error', code: 'duplicate_trigger', stepId: t.id, message: 'A workflow can have only one trigger.' });
  }

  const reachable = reachableFromTriggers(steps);
  const hasEntry = triggers.length > 0;
  const cycle = findCycleSteps(steps);

  for (const s of steps) {
    if (s.type === 'trigger' && steps.some(o => (o.connections ?? []).includes(s.id))) {
      add({ severity: 'warning', code: 'trigger_has_input', stepId: s.id, message: 'A trigger should not have incoming connections.' });
    }
    for (const c of s.connections ?? []) {
      if (!ids.has(c)) add({ severity: 'error', code: 'dangling', stepId: s.id, message: `Connects to a missing step (${c}).` });
    }
    if (cycle.has(s.id)) add({ severity: 'error', code: 'cycle', stepId: s.id, message: 'This step is part of a loop. Use an Iterator instead of connecting back.' });
    if (hasEntry && s.type !== 'trigger' && !reachable.has(s.id)) {
      add({ severity: 'warning', code: 'unreachable', stepId: s.id, message: 'Not connected to the trigger, so it will never run.' });
    }

    if (s.type === 'trigger') {
      const entry = getTriggerEntry(s.trigger?.type);
      if (!entry) add({ severity: 'error', code: 'unknown_type', stepId: s.id, message: 'Choose a trigger type.' });
      else {
        for (const f of missingRequired(entry, s.trigger?.config as Record<string, any>)) {
          add({ severity: 'error', code: 'missing_config', stepId: s.id, message: `${f.label} is required.` });
        }
        if (!entry.engines.server) add({ severity: 'warning', code: 'engine_support', stepId: s.id, message: `${entry.label} triggers only fire from the browser, not the server runner.` });
      }
    } else if (s.type === 'action') {
      const entry = getActionEntry(s.action?.type);
      if (!entry) add({ severity: 'error', code: 'unknown_type', stepId: s.id, message: s.action?.type ? `Unknown action type "${s.action.type}".` : 'Choose an action type.' });
      else {
        for (const f of missingRequired(entry, s.action?.config as Record<string, any>)) {
          add({ severity: 'error', code: 'missing_config', stepId: s.id, message: `${f.label} is required.` });
        }
        if (!entry.engines.server) add({ severity: 'warning', code: 'engine_support', stepId: s.id, message: `${entry.label} runs only in the browser; the server runner will fail this step.` });
        if (entry.key === 'iterator') {
          const labels = s.connectionLabels ?? {};
          if (!(s.connections ?? []).some(c => labels[c] !== 'done')) {
            add({ severity: 'warning', code: 'iterator_branch', stepId: s.id, message: 'Connect something to the Item output.' });
          }
        }
      }
    } else if (s.type === 'condition') {
      if (!s.condition?.field) add({ severity: 'error', code: 'missing_config', stepId: s.id, message: 'Field is required.' });
      const labels = s.connectionLabels ?? {};
      const conns = s.connections ?? [];
      const hasTrue = conns.some(c => labels[c] === 'true' || labels[c] === undefined);
      const hasFalse = conns.some(c => labels[c] === 'false');
      if (!hasTrue || !hasFalse) {
        add({ severity: 'warning', code: 'condition_branch', stepId: s.id, message: `Connect the ${!hasTrue ? 'True' : 'False'} branch, otherwise nothing happens in that case.` });
      }
    } else if (s.type === 'delay') {
      if (!(Number(s.delay) > 0)) add({ severity: 'error', code: 'missing_config', stepId: s.id, message: 'Delay minutes must be greater than 0.' });
    }
  }

  const byStep: Record<string, WorkflowIssue[]> = {};
  for (const i of issues) if (i.stepId) (byStep[i.stepId] ??= []).push(i);
  const errors = issues.filter(i => i.severity === 'error');
  return { issues, errors, warnings: issues.filter(i => i.severity === 'warning'), byStep, hasErrors: errors.length > 0 };
}
