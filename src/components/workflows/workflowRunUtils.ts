import type { WorkflowStep } from '../../types/workflow';
import type { RunStatus } from './workflowGraph';

export interface RawRunStep {
  id?: string;
  stepId?: string;
  status?: string;
  duration?: number | null;
  output?: unknown;
  error?: string | null;
  startedAt?: string;
  completedAt?: string;
}

export interface StepRunInfo {
  status: RunStatus;
  durationMs: number | null;
  output?: unknown;
  error?: string | null;
  /** How many times the step executed in this run (iterators run branch steps once per item). */
  executions: number;
}

const RANK: Record<RunStatus, number> = { failed: 5, running: 4, waiting: 3, completed: 2, skipped: 1, pending: 0 };

const asStatus = (s: string | undefined): RunStatus =>
  s === 'completed' || s === 'failed' || s === 'skipped' || s === 'waiting' || s === 'running' ? s : s === 'pending' ? 'pending' : 'completed';

/**
 * Maps a run's `steps` jsonb (by stepId) onto the workflow's steps. Steps that never executed are `pending`
 * ("Not run"), except the frontier of a `running` run (`running`) and delay steps of a `waiting` run (`waiting`).
 */
export function mapRunSteps(runSteps: unknown, workflowSteps: WorkflowStep[], runStatus?: string): Record<string, StepRunInfo> {
  const rows: RawRunStep[] = Array.isArray(runSteps) ? (runSteps as RawRunStep[]) : [];
  const out: Record<string, StepRunInfo> = {};
  for (const r of rows) {
    const id = r.stepId;
    if (!id) continue;
    const status = asStatus(r.status);
    const prev = out[id];
    const duration = r.duration === undefined || r.duration === null ? null : Number(r.duration);
    if (!prev) {
      out[id] = { status, durationMs: duration, output: r.output, error: r.error ?? null, executions: 1 };
    } else {
      out[id] = {
        status: RANK[status] > RANK[prev.status] ? status : prev.status,
        durationMs: duration === null ? prev.durationMs : (prev.durationMs ?? 0) + duration,
        output: r.output ?? prev.output,
        error: r.error ?? prev.error,
        executions: prev.executions + 1
      };
    }
  }

  const byId = new Map(workflowSteps.map(s => [s.id, s]));
  if (runStatus === 'waiting') {
    for (const s of workflowSteps) {
      const info = out[s.id];
      const delayMinutes = Number((info?.output as { delayMinutes?: number } | undefined)?.delayMinutes);
      if (info && info.status === 'completed' && delayMinutes > 0) out[s.id] = { ...info, status: 'waiting' };
    }
  }
  if (runStatus === 'running') {
    for (const id of Object.keys(out)) {
      for (const next of byId.get(id)?.connections ?? []) {
        if (!out[next] && byId.has(next)) out[next] = { status: 'running', durationMs: null, executions: 0 };
      }
    }
  }
  for (const s of workflowSteps) if (!out[s.id]) out[s.id] = { status: 'pending', durationMs: null, executions: 0 };
  return out;
}
