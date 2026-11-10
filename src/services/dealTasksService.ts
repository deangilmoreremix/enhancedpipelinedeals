import { supabase } from '../lib/core/supabaseClient';
import { canUseRemote, getCurrentUserId, localId } from './dealRecordShared';

export type DealTaskStatus = 'open' | 'done';

export interface DealTask {
  id: string;
  dealId: string;
  title: string;
  dueDate: string | null;
  notes: string | null;
  status: DealTaskStatus;
  createdAt: string;
  updatedAt: string;
}

const localTasks = new Map<string, DealTask[]>();

export const isTasksLocalOnly = (dealId: string): boolean => !canUseRemote(dealId);

const fromRow = (r: Record<string, any>): DealTask => ({
  id: r.id,
  dealId: r.deal_id,
  title: r.title,
  dueDate: r.due_date ?? null,
  notes: r.notes ?? null,
  status: r.status === 'done' || r.status === 'completed' ? 'done' : 'open',
  createdAt: r.created_at ?? new Date().toISOString(),
  updatedAt: r.updated_at ?? r.created_at ?? new Date().toISOString(),
});

/** Open tasks first (soonest due first), done tasks last. */
export const sortTasks = (tasks: DealTask[]): DealTask[] =>
  [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    const ad = a.dueDate ? Date.parse(a.dueDate) : Infinity;
    const bd = b.dueDate ? Date.parse(b.dueDate) : Infinity;
    if (ad !== bd) return ad - bd;
    return a.createdAt < b.createdAt ? 1 : -1;
  });

export const isOverdue = (t: Pick<DealTask, 'status' | 'dueDate'>, now: Date = new Date()): boolean =>
  t.status === 'open' && !!t.dueDate && Date.parse(t.dueDate) < now.getTime();

export async function listTasks(dealId: string): Promise<DealTask[]> {
  if (!canUseRemote(dealId)) return sortTasks(localTasks.get(dealId) ?? []);
  const { data, error } = await supabase.from('tasks').select('*').eq('deal_id', dealId);
  if (error) throw error;
  return sortTasks((data ?? []).map(fromRow));
}

export interface TaskInput {
  title: string;
  dueDate?: string | null;
  notes?: string | null;
}

export async function createTask(dealId: string, input: TaskInput): Promise<DealTask> {
  const title = input.title.trim();
  if (!title) throw new Error('Task title is required');
  const now = new Date().toISOString();
  if (!canUseRemote(dealId)) {
    const task: DealTask = {
      id: localId('task'), dealId, title, dueDate: input.dueDate ?? null, notes: input.notes ?? null,
      status: 'open', createdAt: now, updatedAt: now,
    };
    localTasks.set(dealId, [task, ...(localTasks.get(dealId) ?? [])]);
    return task;
  }
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      deal_id: dealId, title, due_date: input.dueDate ?? null, notes: input.notes ?? null,
      status: 'open', user_id: await getCurrentUserId(),
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateTask(
  dealId: string,
  id: string,
  updates: Partial<Pick<DealTask, 'title' | 'dueDate' | 'notes' | 'status'>>
): Promise<DealTask> {
  const now = new Date().toISOString();
  if (!canUseRemote(dealId)) {
    const list = localTasks.get(dealId) ?? [];
    const existing = list.find(t => t.id === id);
    if (!existing) throw new Error('Task not found');
    const updated = { ...existing, ...updates, updatedAt: now };
    localTasks.set(dealId, list.map(t => (t.id === id ? updated : t)));
    return updated;
  }
  const patch: Record<string, unknown> = { updated_at: now };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.dueDate !== undefined) patch.due_date = updates.dueDate;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.status !== undefined) patch.status = updates.status;
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteTask(dealId: string, id: string): Promise<void> {
  if (!canUseRemote(dealId)) {
    localTasks.set(dealId, (localTasks.get(dealId) ?? []).filter(t => t.id !== id));
    return;
  }
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export const DealTasksService = { listTasks, createTask, updateTask, deleteTask, sortTasks, isOverdue };
