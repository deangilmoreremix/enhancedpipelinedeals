import { describe, it, expect, jest } from '@jest/globals';
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
import type { DealTask } from '../services/dealTasksService';
import { filterTasks, DEFAULT_TASK_FILTERS } from '../services/dealTasksService';
import {
  POSITION_STEP, applyMove, columnTasks, computeMove, dayKey, groupByStatus, monthGrid, nextPosition, rescheduledDue, taskDayKey,
} from '../components/tasks/taskBoardLogic';
import { sortTaskRows } from '../components/tasks/TaskList';

const t = (id: string, status: DealTask['status'], pos: number, over: Partial<DealTask> = {}): DealTask => ({
  id, dealId: null, title: id, dueDate: null, notes: null, status, assigneeId: null, boardPosition: pos,
  createdAt: `2026-01-0${(id.charCodeAt(0) % 9) + 1}T00:00:00Z`, updatedAt: '2026-01-01T00:00:00Z', targets: [], ...over,
});
const ids = (list: DealTask[]) => list.map(x => x.id);

describe('board ordering', () => {
  it('orders columns by position then age and groups by status', () => {
    const tasks = [t('b', 'todo', 20), t('a', 'todo', 10), t('c', 'done', 5)];
    expect(ids(columnTasks(tasks, 'todo'))).toEqual(['a', 'b']);
    const g = groupByStatus(tasks);
    expect(ids(g.done)).toEqual(['c']);
    expect(g.in_progress).toEqual([]);
  });
  it('nextPosition goes after the last task of the column', () => {
    expect(nextPosition([t('a', 'todo', 40)], 'todo')).toBe(40 + POSITION_STEP);
    expect(nextPosition([], 'todo')).toBe(POSITION_STEP);
  });
});

describe('computeMove', () => {
  const tasks = [t('a', 'todo', 1000), t('b', 'todo', 2000), t('c', 'todo', 3000), t('x', 'done', 1000)];
  it('puts a task between two neighbours at the midpoint', () => {
    const m = computeMove(tasks, 'c', 'todo', 1)!;
    expect(m.status).toBe('todo'); expect(m.boardPosition).toBe(1500); expect(m.renumber).toEqual([]);
    expect(ids(columnTasks(applyMove(tasks, m), 'todo'))).toEqual(['a', 'c', 'b']);
  });
  it('moves across columns: top, bottom and into an empty column', () => {
    expect(computeMove(tasks, 'a', 'done', 0)!.boardPosition).toBe(1000 - POSITION_STEP);
    expect(computeMove(tasks, 'a', 'done', 1)!.boardPosition).toBe(2000);
    const m = computeMove(tasks, 'a', 'in_progress', 0)!;
    expect(m.status).toBe('in_progress'); expect(m.boardPosition).toBe(POSITION_STEP);
    expect(applyMove(tasks, m).find(x => x.id === 'a')!.status).toBe('in_progress');
  });
  it('reports no change when dropped where it was', () => {
    expect(computeMove(tasks, 'b', 'todo', 1)!.changed).toBe(false);
    expect(computeMove(tasks, 'b', 'done', 0)!.changed).toBe(true);
    expect(computeMove(tasks, 'nope', 'todo', 0)).toBeNull();
  });
  it('renumbers the column when positions collide (all zero)', () => {
    const zero = [t('a', 'todo', 0), t('b', 'todo', 0), t('c', 'todo', 0)];
    const m = computeMove(zero, 'c', 'todo', 1)!;
    const next = applyMove(zero, m);
    expect(ids(columnTasks(next, 'todo'))).toEqual(['a', 'c', 'b']);
    expect(new Set(columnTasks(next, 'todo').map(x => x.boardPosition)).size).toBe(3);
    expect(m.renumber.length).toBeGreaterThan(0);
  });
  it('clamps an out-of-range index', () => {
    expect(computeMove(tasks, 'a', 'todo', 99)!.boardPosition).toBe(3000 + POSITION_STEP);
  });
});

describe('calendar helpers', () => {
  it('builds a 6 week grid starting on Sunday that contains the month', () => {
    const g = monthGrid(2026, 10); // November 2026
    expect(g).toHaveLength(42);
    expect(g[0].getDay()).toBe(0);
    expect(g.some(d => dayKey(d) === '2026-11-30')).toBe(true);
  });
  it('reschedules onto another day keeping the time of day', () => {
    const due = new Date(2026, 10, 5, 14, 30).toISOString();
    const out = new Date(rescheduledDue({ dueDate: due }, new Date(2026, 10, 20)));
    expect([out.getFullYear(), out.getMonth(), out.getDate(), out.getHours(), out.getMinutes()]).toEqual([2026, 10, 20, 14, 30]);
    const fresh = new Date(rescheduledDue({ dueDate: null }, new Date(2026, 10, 20)));
    expect(dayKey(fresh)).toBe('2026-11-20');
    expect(taskDayKey({ dueDate: due })).toBe('2026-11-05');
    expect(taskDayKey({ dueDate: null })).toBeNull();
  });
});

describe('shared filters and list sort', () => {
  const now = new Date(2026, 10, 18, 12);
  const day = (n: number) => new Date(2026, 10, 18 + n, 9).toISOString();
  const tasks = [
    t('mine', 'todo', 0, { assigneeId: 'me', dueDate: day(-2), title: 'Send proposal' }),
    t('theirs', 'in_progress', 0, { assigneeId: 'sam', dueDate: day(0) }),
    t('free', 'done', 0, { dueDate: null, notes: 'call Acme' }),
  ];
  it('My tasks, assignee, due and search compose', () => {
    expect(ids(filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, mine: true }, 'me', now))).toEqual(['mine']);
    expect(ids(filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, assignee: 'unassigned' }, 'me', now))).toEqual(['free']);
    expect(ids(filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, due: 'overdue' }, 'me', now))).toEqual(['mine']);
    expect(ids(filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, due: 'today' }, 'me', now))).toEqual(['theirs']);
    expect(ids(filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, due: 'none' }, 'me', now))).toEqual(['free']);
    expect(ids(filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, search: 'ACME' }, 'me', now))).toEqual(['free']);
    expect(ids(filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, mine: true }, null, now))).toEqual([]);
  });
  it('sorts with empty values last in both directions', () => {
    const name = (id: string | null) => id ?? '';
    expect(ids(sortTaskRows(tasks, { key: 'due', dir: 'asc' }, name, () => ''))).toEqual(['mine', 'theirs', 'free']);
    expect(ids(sortTaskRows(tasks, { key: 'due', dir: 'desc' }, name, () => ''))).toEqual(['theirs', 'mine', 'free']);
    expect(ids(sortTaskRows(tasks, { key: 'status', dir: 'asc' }, name, () => ''))).toEqual(['mine', 'theirs', 'free']);
  });
});
