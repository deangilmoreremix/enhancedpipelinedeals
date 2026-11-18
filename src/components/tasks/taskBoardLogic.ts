import type { DealTask, DealTaskStatus } from '../../services/dealTasksService';
import { TASK_STATUSES } from '../../services/dealTasksService';

/** Gap between neighbouring board positions; renumbering restores it when two positions collide. */
export const POSITION_STEP = 1000;
const MIN_GAP = 1e-6;

type Positioned = Pick<DealTask, 'id' | 'status' | 'boardPosition' | 'createdAt'>;

/** Tasks of one status column in board order (position, then oldest first). */
export function columnTasks<T extends Positioned>(tasks: T[], status: DealTaskStatus): T[] {
  return tasks
    .filter(t => t.status === status)
    .sort((a, b) => (a.boardPosition ?? 0) - (b.boardPosition ?? 0) || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) || (a.id < b.id ? -1 : 1));
}

export function groupByStatus<T extends Positioned>(tasks: T[]): Record<DealTaskStatus, T[]> {
  return Object.fromEntries(TASK_STATUSES.map(s => [s, columnTasks(tasks, s)])) as Record<DealTaskStatus, T[]>;
}

/** Position that puts a new task at the bottom of `status`. */
export function nextPosition<T extends Positioned>(tasks: T[], status: DealTaskStatus): number {
  const col = columnTasks(tasks, status);
  return col.length ? (col[col.length - 1].boardPosition ?? 0) + POSITION_STEP : POSITION_STEP;
}

export interface TaskMove {
  id: string;
  status: DealTaskStatus;
  boardPosition: number;
  /** Other tasks whose positions must change too (the column was renumbered because positions collided). */
  renumber: Array<{ id: string; boardPosition: number }>;
  /** False when the task would land where it already is. */
  changed: boolean;
}

/**
 * Where a dragged task ends up. `destIndex` is the index inside the destination column AFTER the task is
 * taken out of it (what @hello-pangea/dnd reports as destination.index). Uses the midpoint of the two
 * neighbours; when they collide (all-zero columns, repeated drags) the whole column is renumbered.
 */
export function computeMove<T extends Positioned>(tasks: T[], taskId: string, destStatus: DealTaskStatus, destIndex: number): TaskMove | null {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;
  const col = columnTasks(tasks, destStatus).filter(t => t.id !== taskId);
  const idx = Math.max(0, Math.min(destIndex, col.length));
  const prev = col[idx - 1];
  const next = col[idx];
  const before = columnTasks(tasks, task.status);
  const sameSpot = task.status === destStatus && before.findIndex(t => t.id === taskId) === idx;

  let pos: number;
  if (!prev && !next) pos = POSITION_STEP;
  else if (!prev) pos = (next.boardPosition ?? 0) - POSITION_STEP;
  else if (!next) pos = (prev.boardPosition ?? 0) + POSITION_STEP;
  else pos = ((prev.boardPosition ?? 0) + (next.boardPosition ?? 0)) / 2;

  const collides = prev && next && Math.abs((next.boardPosition ?? 0) - (prev.boardPosition ?? 0)) < MIN_GAP * 2;
  if (collides) {
    const ordered = [...col.slice(0, idx), task, ...col.slice(idx)];
    const renumbered = ordered.map((t, i) => ({ id: t.id, boardPosition: (i + 1) * POSITION_STEP }));
    const mine = renumbered.find(r => r.id === taskId)!;
    return {
      id: taskId, status: destStatus, boardPosition: mine.boardPosition,
      renumber: renumbered.filter(r => r.id !== taskId && (col.find(t => t.id === r.id)?.boardPosition ?? NaN) !== r.boardPosition),
      changed: !sameSpot,
    };
  }
  return { id: taskId, status: destStatus, boardPosition: pos, renumber: [], changed: !sameSpot };
}

export function applyMove<T extends Positioned>(tasks: T[], move: TaskMove): T[] {
  const re = new Map(move.renumber.map(r => [r.id, r.boardPosition]));
  return tasks.map(t =>
    t.id === move.id ? { ...t, status: move.status, boardPosition: move.boardPosition }
      : re.has(t.id) ? { ...t, boardPosition: re.get(t.id) } : t);
}

// ---- calendar ---------------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const taskDayKey = (t: Pick<DealTask, 'dueDate'>): string | null => (t.dueDate ? dayKey(new Date(t.dueDate)) : null);

/** 6 weeks (Sunday first) covering the month. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** ISO due date for moving a task onto `day`, keeping its time of day (local midnight when it had none). */
export function rescheduledDue(task: Pick<DealTask, 'dueDate'>, day: Date): string {
  const base = task.dueDate ? new Date(task.dueDate) : new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const out = new Date(base);
  out.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
  return out.toISOString();
}
