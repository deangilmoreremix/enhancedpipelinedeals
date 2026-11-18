import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { chain } from '../test-utils/chain';

let mockResults: Record<string, { data?: any; error?: any }> = {};
let mockCalls: Array<{ table: string; c: any }> = [];
const mockFrom = (t: string) => { const c = chain(mockResults[t] ?? { data: [], error: null }); mockCalls.push({ table: t, c }); return c; };

jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t: string) => mockFrom(t),
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
  },
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));

import {
  DealTask, DEFAULT_TASK_FILTERS, createTask, deleteTask, filterTasks, isOverdue, listTasks, normalizeStatus, sortTasks,
  updateTask, setTaskTargets, __resetLocalTasks,
} from '../services/dealTasksService';

const DEAL = '11111111-1111-4111-8111-111111111111';
const CONTACT = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const ops = (table: string) => mockCalls.filter(x => x.table === table).flatMap(x => x.c.calls as Array<[string, any[]]>);
const row = (over: Record<string, unknown> = {}) => ({ id: 't1', deal_id: DEAL, title: 'Call', status: 'todo', due_date: null, created_at: '2026-01-01T00:00:00Z', ...over });

beforeEach(() => { mockResults = {}; mockCalls = []; __resetLocalTasks(); });

const mk = (over: Partial<DealTask>): DealTask => ({
  id: 'x', dealId: 'd', title: 't', dueDate: null, notes: null, status: 'todo', assigneeId: null,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', targets: [], ...over,
});

describe('status mapping', () => {
  it('maps new and legacy values', () => {
    expect(normalizeStatus({ status: 'in_progress' })).toBe('in_progress');
    expect(normalizeStatus({ status: 'In-Progress' })).toBe('in_progress');
    expect(normalizeStatus({ status: 'open' })).toBe('todo');
    expect(normalizeStatus({ status: null })).toBe('todo');
    expect(normalizeStatus({ status: 'completed' })).toBe('done');
    expect(normalizeStatus({ status: 'todo', completed: true })).toBe('done');
  });
});

describe('overdue / sort / filters', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0);
  const day = (offset: number) => new Date(2026, 5, 15 + offset).toISOString();

  it('a task due today is not overdue; yesterday is; done never is', () => {
    expect(isOverdue({ status: 'todo', dueDate: day(0) }, now)).toBe(false);
    expect(isOverdue({ status: 'in_progress', dueDate: day(-1) }, now)).toBe(true);
    expect(isOverdue({ status: 'done', dueDate: day(-5) }, now)).toBe(false);
  });

  it('sorts unfinished by due date, done last', () => {
    const list = sortTasks([mk({ id: 'a', status: 'done' }), mk({ id: 'b', dueDate: day(3) }), mk({ id: 'c', dueDate: day(1) })]);
    expect(list.map(t => t.id)).toEqual(['c', 'b', 'a']);
  });

  const tasks = [
    mk({ id: 'over', dueDate: day(-2), assigneeId: 'me' }),
    mk({ id: 'today', dueDate: day(0), status: 'in_progress', assigneeId: 'bob' }),
    mk({ id: 'week', dueDate: day(5) }),
    mk({ id: 'later', dueDate: day(20) }),
    mk({ id: 'done', dueDate: day(-2), status: 'done', assigneeId: 'me' }),
  ];
  const ids = (f: Partial<typeof DEFAULT_TASK_FILTERS>) => filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, ...f }, 'me', now).map(t => t.id);

  it('filters by status, assignee, due bucket and my tasks', () => {
    expect(ids({ status: 'in_progress' })).toEqual(['today']);
    expect(ids({ status: 'open' })).toEqual(['over', 'today', 'week', 'later']);
    expect(ids({ assignee: 'bob' })).toEqual(['today']);
    expect(ids({ assignee: 'unassigned' })).toEqual(['week', 'later']);
    expect(ids({ due: 'overdue' })).toEqual(['over']);
    expect(ids({ due: 'today' })).toEqual(['today']);
    expect(ids({ due: 'week' })).toEqual(['today', 'week']);
    expect(ids({ mine: true })).toEqual(['over', 'done']);
    expect(filterTasks(tasks, { ...DEFAULT_TASK_FILTERS, mine: true }, null, now)).toEqual([]);
  });
});

describe('dealTasksService (supabase)', () => {
  it('lists tasks on the deal or its contact and maps legacy rows', async () => {
    mockResults.task_targets = { data: [{ task_id: 't2', target_type: 'contact', target_id: CONTACT }], error: null };
    mockResults.tasks = { data: [row({ status: 'open' }), row({ id: 't2', deal_id: null, status: 'completed', assignee_id: USER })], error: null };
    const tasks = await listTasks(DEAL, { contactId: CONTACT });
    const or = ops('tasks').find(([o]) => o === 'or')![1][0] as string;
    expect(or).toContain(`deal_id.eq.${DEAL}`);
    expect(or).toContain('id.in.(t2)');
    expect(tasks.find(t => t.id === 't1')).toMatchObject({ status: 'todo', source: { type: 'deal', id: DEAL } });
    expect(tasks.find(t => t.id === 't2')).toMatchObject({ status: 'done', assigneeId: USER, source: { type: 'contact', id: CONTACT } });
  });

  it('creates with status todo (never "open"), assignee and deal target', async () => {
    mockResults.tasks = { data: row({ assignee_id: USER }), error: null };
    const t = await createTask(DEAL, { title: ' Call ', assigneeId: USER });
    const insert = ops('tasks').find(([o]) => o === 'insert')![1][0] as any;
    expect(insert).toMatchObject({ title: 'Call', status: 'todo', assignee_id: USER, deal_id: DEAL, user_id: 'user-1' });
    expect(ops('task_targets').find(([o]) => o === 'insert')![1][0]).toEqual([{ task_id: 't1', target_type: 'deal', target_id: DEAL }]);
    expect(t.assigneeId).toBe(USER);
  });

  it('omits assignee_id when unassigned', async () => {
    mockResults.tasks = { data: row(), error: null };
    await createTask(DEAL, { title: 'x' });
    expect('assignee_id' in (ops('tasks').find(([o]) => o === 'insert')![1][0] as any)).toBe(false);
  });

  it('rejects blank titles', async () => {
    await expect(createTask(DEAL, { title: '  ' })).rejects.toThrow('required');
  });

  it('updates status and assignee; zero rows is a permission denial', async () => {
    mockResults.tasks = { data: [row({ status: 'in_progress', assignee_id: USER })], error: null };
    const t = await updateTask(DEAL, 't1', { status: 'in_progress', assigneeId: USER });
    expect(ops('tasks').find(([o]) => o === 'update')![1][0]).toMatchObject({ status: 'in_progress', assignee_id: USER });
    expect(t.status).toBe('in_progress');
    mockResults.tasks = { data: [], error: null };
    await expect(updateTask(DEAL, 't1', { status: 'done' })).rejects.toMatchObject({ code: '42501' });
  });

  it('replaces targets via task_targets', async () => {
    mockResults.tasks = { data: [row()], error: null };
    mockResults.task_targets = { data: [{ task_id: 't1', target_type: 'deal', target_id: DEAL }], error: null };
    await setTaskTargets(DEAL, 't1', [{ type: 'deal', id: DEAL }, { type: 'contact', id: CONTACT }]);
    expect(ops('task_targets').find(([o]) => o === 'insert')![1][0]).toEqual([{ task_id: 't1', target_type: 'contact', target_id: CONTACT }]);
  });

  it('delete with zero affected rows is a permission denial', async () => {
    mockResults.tasks = { data: [], error: null };
    await expect(deleteTask(DEAL, 't1')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('dealTasksService (local)', () => {
  it('creates, updates, links to a contact and deletes in memory', async () => {
    const t = await createTask('deal-a', { title: 'Follow up', targets: [{ type: 'deal', id: 'deal-a' }, { type: 'contact', id: 'c1' }] });
    expect(t.status).toBe('todo');
    expect((await listTasks('deal-b', { contactId: 'c1' }))[0]).toMatchObject({ id: t.id, source: { type: 'contact', id: 'c1' } });
    await updateTask('deal-a', t.id, { status: 'done', assigneeId: 'local-user-sam' });
    expect((await listTasks('deal-a'))[0]).toMatchObject({ status: 'done', assigneeId: 'local-user-sam' });
    await deleteTask('deal-a', t.id);
    expect(await listTasks('deal-a')).toEqual([]);
    expect(mockCalls).toHaveLength(0);
  });
});
