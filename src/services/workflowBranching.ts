/**
 * Pure branch-selection helpers shared by the browser engine and the Netlify runner.
 * No imports: must stay runtime-agnostic.
 *
 * `connectionLabels` maps a target step id to a branch label. Unlabelled connections keep the
 * legacy behaviour (condition: follow only when true; iterator: run per item).
 */
export type BranchLabel = 'true' | 'false' | 'item' | 'done';

export interface BranchStep {
  connections?: string[];
  connectionLabels?: Record<string, BranchLabel | string | undefined>;
}

/** Targets a condition should follow for the given outcome. */
export function conditionTargets(step: BranchStep, matched: boolean): string[] {
  const conns = step.connections ?? [];
  const labels = step.connectionLabels ?? {};
  return conns.filter(id => {
    const l = labels[id];
    if (l === 'true') return matched;
    if (l === 'false') return !matched;
    return matched; // unlabelled: legacy (follow when true, halt when false)
  });
}

/** Targets an iterator runs once per item (`item`/unlabelled) and once after the loop (`done`). */
export function iteratorTargets(step: BranchStep): { item: string[]; done: string[] } {
  const conns = step.connections ?? [];
  const labels = step.connectionLabels ?? {};
  return {
    item: conns.filter(id => labels[id] !== 'done'),
    done: conns.filter(id => labels[id] === 'done')
  };
}
