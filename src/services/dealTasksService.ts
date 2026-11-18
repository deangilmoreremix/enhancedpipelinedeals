import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';
import { assertRowsAffected } from '../utils/rlsError';
import { canUseRemote, getCurrentUserId, isUuid, localId } from './dealRecordShared';
import {
  RecordTarget, TargetScope, fetchTargets, findLinkedItemIds, isMissingRelation, matchSource, primaryColumns,
  replaceTargets, uniqueTargets,
} from './recordTargetsService';

export type DealTaskStatus = 'todo' | 'in_progress' | 'done';
export const TASK_STATUSES: DealTaskStatus[] = ['todo', 'in_progress', 'done'];
export const TASK_STATUS_LABEL: Record<DealTaskStatus, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' };

export interface DealTask {
  id: string;
  /** Primary deal (legacy tasks.deal_id); null for tasks created on a contact/company only. */
  dealId: string | null;
  title: string;
  dueDate: string | null;
  notes: string | null;
  status: DealTaskStatus;
  assigneeId: string | null;
  /** Order inside its status column on the Tasks board (tasks.board_position); lower first. */
  boardPosition?: number;
  createdAt: string;
  updatedAt: string;
  /** Every record this task is linked to (task_targets). */
  targets: RecordTarget[];
  /** Why this task shows on the viewed deal: linked to the deal itself, or to its contact/company. */
  source?: RecordTarget | null;
}

let localTasks: DealTask[] = [];
export const __resetLocalTasks = (): void => { localTasks = []; };

export const isTasksLocalOnly = (dealId: string): boolean => !canUseRemote(dealId);

/** Maps new (todo/in_progress/done) and legacy values (open/pending/completed, a `completed` boolean). */
export function normalizeStatus(r: { status?: unknown; completed?: unknown }): DealTaskStatus {
  const s = typeof r.status === 'string' ? r.status.toLowerCase().replace(/[\s-]+/g, '_') : '';
  if (s === 'done' || s === 'completed' || s === 'complete' || r.completed === true) return 'done';
  if (s === 'in_progress') return 'in_progress';
  return 'todo';
}

const fromRow = (r: Record<string, any>, targets: RecordTarget[] = []): DealTask => ({
  id: r.id,
  dealId: r.deal_id ?? null,
  title: r.title,
  dueDate: r.due_date ?? null,
  notes: r.notes ?? null,
  status: normalizeStatus(r),
  assigneeId: r.assignee_id ?? null,
  boardPosition: Number.isFinite(Number(r.board_position)) ? Number(r.board_position) : 0,
  createdAt: r.created_at ?? new Date().toISOString(),
  updatedAt: r.updated_at ?? r.created_at ?? new Date().toISOString(),
  targets,
});

/** Unfinished tasks first (soonest due first), done tasks last. */
export const sortTasks = (tasks: DealTask[]): DealTask[] =>
  [...tasks].sort((a, b) => {
    const ad = a.status === 'done' ? 1 : 0;
    const bd = b.status === 'done' ? 1 : 0;
    if (ad !== bd) return ad - bd;
    const at = a.dueDate ? Date.parse(a.dueDate) : Infinity;
    const bt = b.dueDate ? Date.parse(b.dueDate) : Infinity;
    if (at !== bt) return at < bt ? -1 : 1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Overdue = not done and due on a day before today (a task due today is not overdue yet). */
export const isOverdue = (t: Pick<DealTask, 'status' | 'dueDate'>, now: Date = new Date()): boolean =>
  t.status !== 'done' && !!t.dueDate && Date.parse(t.dueDate) < startOfDay(now).getTime();

export type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'none';
export interface TaskFilters {
  status: 'all' | 'open' | DealTaskStatus;
  /** 'all', 'unassigned' or a user id. */
  assignee: string;
  due: DueFilter;
  mine: boolean;
  /** Case-insensitive match on title / notes (Tasks page). */
  search?: string;
}
export const DEFAULT_TASK_FILTERS: TaskFilters = { status: 'all', assignee: 'all', due: 'all', mine: false };

export function filterTasks(tasks: DealTask[], f: TaskFilters, myId: string | null, now: Date = new Date()): DealTask[] {
  const today = startOfDay(now).getTime();
  const weekEnd = today + 8 * 86_400_000; // exclusive: today + 7 full days
  return tasks.filter(t => {
    if (f.status === 'open' ? t.status === 'done' : f.status !== 'all' && t.status !== f.status) return false;
    if (f.mine && (!myId || t.assigneeId !== myId)) return false;
    if (f.assignee === 'unassigned' ? !!t.assigneeId : f.assignee !== 'all' && t.assigneeId !== f.assignee) return false;
    if (f.search?.trim()) {
      const q = f.search.trim().toLowerCase();
      if (!`${t.title} ${t.notes ?? ''}`.toLowerCase().includes(q)) return false;
    }
    if (f.due === 'none') return !t.dueDate;
    if (f.due !== 'all') {
      if (!t.dueDate) return false;
      const due = Date.parse(t.dueDate);
      if (f.due === 'overdue' && !isOverdue(t, now)) return false;
      if (f.due === 'today' && !(due >= today && due < today + 86_400_000)) return false;
      if (f.due === 'week' && !(due >= today && due < weekEnd)) return false;
    }
    return true;
  });
}

const toScope = (dealId: string, scope: { contactId?: string; companyId?: string }): TargetScope => ({
  deal: dealId, contact: scope.contactId, company: scope.companyId,
});

/** Tasks linked to the deal, or to its contact / company (each labelled with its `source`). */
export async function listTasks(
  dealId: string,
  scope: { contactId?: string; companyId?: string } = {},
): Promise<DealTask[]> {
  const ts = toScope(dealId, scope);
  if (!canUseRemote(dealId)) {
    return sortTasks(localTasks.map(t => ({ ...t, source: matchSource(t.targets, ts) })).filter(t => t.source));
  }
  const linked = await findLinkedItemIds('task', ts);
  const filters = [`deal_id.eq.${dealId}`];
  if (scope.contactId) filters.push(`contact_id.eq.${scope.contactId}`);
  if (linked.size) filters.push(`id.in.(${[...linked.keys()].join(',')})`);
  const { data, error } = await supabase.from('tasks').select('*').or(filters.join(','));
  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, any>>;
  const all = await fetchTargets('task', rows.map(r => r.id)).catch(e => {
    if (isMissingRelation(e)) return {} as Record<string, RecordTarget[]>;
    throw e;
  });
  return sortTasks(rows.map(r => {
    const base = all[r.id] ?? [
      ...(r.deal_id ? [{ type: 'deal' as const, id: r.deal_id as string }] : []),
      ...(r.contact_id ? [{ type: 'contact' as const, id: r.contact_id as string }] : []),
    ];
    return { ...fromRow(r, base), source: matchSource(base, ts) };
  }));
}

export interface TaskInput {
  title: string;
  dueDate?: string | null;
  notes?: string | null;
  assigneeId?: string | null;
  status?: DealTaskStatus;
  boardPosition?: number;
  /** Defaults to the deal the task is created on. */
  targets?: RecordTarget[];
}

/** Whether tasks that are not tied to a deal hit Supabase (demo mode / unconfigured use the in-memory list). */
export const tasksRemote = (): boolean => isSupabaseConfigured && !isDemoMode();

/** Key for the remote/local gate of an existing task: its deal, else its own id (local ids are never uuids). */
export const taskGateKey = (t: Pick<DealTask, 'id' | 'dealId'>): string => t.dealId ?? t.id;

/** `dealId` null creates a task with no deal link (Tasks page quick add). */
export async function createTask(dealId: string | null, input: TaskInput): Promise<DealTask> {
  const title = input.title.trim();
  if (!title) throw new Error('Task title is required');
  const now = new Date().toISOString();
  const targets = uniqueTargets(input.targets?.length ? input.targets : dealId ? [{ type: 'deal', id: dealId }] : []);
  const status = input.status ?? 'todo';
  if (!(dealId ? canUseRemote(dealId) : tasksRemote())) {
    const task: DealTask = {
      id: localId('task'), dealId: targets.find(t => t.type === 'deal')?.id ?? null, title,
      dueDate: input.dueDate ?? null, notes: input.notes ?? null, status, assigneeId: input.assigneeId ?? null,
      boardPosition: input.boardPosition ?? 0, createdAt: now, updatedAt: now, targets,
    };
    localTasks = [task, ...localTasks];
    return task;
  }
  const cols = primaryColumns(targets);
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      deal_id: cols.deal_id, contact_id: cols.contact_id, title, due_date: input.dueDate ?? null,
      notes: input.notes ?? null, status, user_id: await getCurrentUserId(),
      // only sent when set so inserts keep working before the assignee_id column exists
      ...(isUuid(input.assigneeId) ? { assignee_id: input.assigneeId } : {}),
      ...(input.boardPosition !== undefined ? { board_position: input.boardPosition } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  let stored = targets;
  try {
    stored = await replaceTargets('task', data.id, targets, []);
  } catch (e) {
    if (!isMissingRelation(e)) throw e;
  }
  return fromRow(data, stored);
}

export type TaskUpdate = Partial<Pick<DealTask, 'title' | 'dueDate' | 'notes' | 'status' | 'assigneeId' | 'boardPosition'>> & { targets?: RecordTarget[] };

export async function updateTask(dealId: string, id: string, updates: TaskUpdate): Promise<DealTask> {
  const now = new Date().toISOString();
  if (!canUseRemote(dealId)) {
    const existing = localTasks.find(t => t.id === id);
    if (!existing) throw new Error('Task not found');
    const targets = updates.targets ? uniqueTargets(updates.targets) : existing.targets;
    const { targets: _t, ...rest } = updates;
    const updated: DealTask = {
      ...existing, ...rest, targets,
      dealId: updates.targets ? targets.find(t => t.type === 'deal')?.id ?? null : existing.dealId,
      updatedAt: now,
    };
    localTasks = localTasks.map(t => (t.id === id ? updated : t));
    return updated;
  }
  const patch: Record<string, unknown> = { updated_at: now };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.dueDate !== undefined) patch.due_date = updates.dueDate;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.assigneeId !== undefined) patch.assignee_id = isUuid(updates.assigneeId) ? updates.assigneeId : null;
  if (updates.boardPosition !== undefined) patch.board_position = updates.boardPosition;
  if (updates.targets) Object.assign(patch, primaryColumns(uniqueTargets(updates.targets)));
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select();
  if (error) throw error;
  assertRowsAffected(data); // RLS filters silently (0 rows)
  const targets = updates.targets
    ? await replaceTargets('task', id, updates.targets)
    : (await fetchTargets('task', [id]).catch(() => ({} as Record<string, RecordTarget[]>)))[id] ?? [];
  return fromRow(data[0], targets);
}

export async function setTaskTargets(dealId: string, id: string, targets: RecordTarget[]): Promise<DealTask> {
  if (targets.length === 0) throw new Error('A task must stay linked to at least one record');
  return updateTask(dealId, id, { targets });
}

export async function deleteTask(dealId: string, id: string): Promise<void> {
  if (!canUseRemote(dealId)) {
    localTasks = localTasks.filter(t => t.id !== id);
    return;
  }
  const { data, error } = await supabase.from('tasks').delete().eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data); // RLS filters silently (0 rows)
}

/** Every task the signed-in user can see (Tasks page). Remote: tasks + task_targets; local: the in-memory list. */
export async function listAllTasks(): Promise<DealTask[]> {
  if (!tasksRemote()) return [...localTasks];
  const { data, error } = await supabase.from('tasks').select('*').limit(2000);
  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, any>>;
  const all = await fetchTargets('task', rows.map(r => r.id)).catch(e => {
    if (isMissingRelation(e)) return {} as Record<string, RecordTarget[]>;
    throw e;
  });
  return rows.map(r => fromRow(r, all[r.id] ?? [
    ...(r.deal_id ? [{ type: 'deal' as const, id: r.deal_id as string }] : []),
    ...(r.contact_id ? [{ type: 'contact' as const, id: r.contact_id as string }] : []),
  ]));
}

/** Demo mode: give the Tasks page something to show (only when the local list is empty). */
export function seedDemoTasks(
  deals: Array<{ id: string; title?: string; company?: string }>,
  me: string,
  others: string[] = [],
  now: Date = new Date(),
): void {
  if (localTasks.length) return;
  const day = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, 9).toISOString();
  const ts = now.toISOString();
  const d = (i: number) => deals[i % Math.max(deals.length, 1)]?.id ?? null;
  const other = (i: number) => others[i % Math.max(others.length, 1)] ?? null;
  const rows: Array<[string, DealTaskStatus, number | null, string | null, string | null]> = [
    ['Send revised proposal', 'todo', 2, me, d(0)],
    ['Prepare contract redlines', 'todo', -2, me, d(1)],
    ['Schedule security review', 'todo', null, other(0), d(2)],
    ['Follow up with procurement', 'in_progress', 0, me, d(0)],
    ['Demo environment setup', 'in_progress', 5, other(1), d(3)],
    ['Collect customer references', 'in_progress', -1, other(0), null],
    ['Kickoff call notes', 'done', -4, me, d(1)],
    ['Intro email sent', 'done', -6, other(1), d(2)],
  ];
  localTasks = rows.map(([title, status, due, assignee, dealId], i) => ({
    id: localId('task'), dealId, title, dueDate: due === null ? null : day(due), notes: null, status,
    assigneeId: assignee, boardPosition: (i + 1) * 1000, createdAt: ts, updatedAt: ts,
    targets: dealId ? [{ type: 'deal' as const, id: dealId }] : [],
  }));
}

export const DealTasksService = { listTasks, createTask, updateTask, setTaskTargets, deleteTask, listAllTasks, sortTasks, isOverdue, filterTasks };
