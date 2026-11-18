import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DealTask, DealTaskStatus, TaskInput, TaskUpdate, createTask, deleteTask, listAllTasks, seedDemoTasks, tasksRemote, taskGateKey, updateTask,
} from '../../services/dealTasksService';
import { errorMessage } from '../../services/dealRecordShared';
import { getCurrentDirectoryUser } from '../../services/userDirectoryService';
import { useUserDirectoryStore } from '../../store/userDirectoryStore';
import { useDealStore } from '../../store/dealStore';
import { usePermissions } from '../../hooks/usePermissions';
import { toastFailure } from '../../utils/permissionToast';
import { pushToast } from '../../store/dealRecordStore';
import type { DirectoryUser } from '../../types';
import { TaskMove, applyMove, computeMove, nextPosition } from './taskBoardLogic';

/** Stand-in for the signed-in user when there is no session (demo mode). */
export const DEMO_ME: DirectoryUser = { id: 'local-user-you', name: 'You' };

export function useTasksData() {
  const perms = usePermissions();
  const dealsMap = useDealStore(s => s.deals);
  const fetchDeals = useDealStore(s => s.fetchDeals);
  const directory = useUserDirectoryStore(s => s.users);
  const loadUsers = useUserDirectoryStore(s => s.load);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const tasksRef = useRef<DealTask[]>([]);
  tasksRef.current = tasks;
  const set = useCallback((next: DealTask[] | ((p: DealTask[]) => DealTask[])) => {
    const v = typeof next === 'function' ? next(tasksRef.current) : next;
    tasksRef.current = v;
    setTasks(v);
  }, []);

  const remote = tasksRemote();
  useEffect(() => {
    void loadUsers();
    void getCurrentDirectoryUser().then(u => setMyId(u?.id ?? (remote ? null : DEMO_ME.id)));
    if (Object.keys(useDealStore.getState().deals).length === 0) void fetchDeals();
  }, [loadUsers, fetchDeals, remote]);

  const users = useMemo(() => {
    const list = [...directory];
    if (!remote && !list.some(u => u.id === DEMO_ME.id)) list.unshift(DEMO_ME);
    return list;
  }, [directory, remote]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (!tasksRemote()) {
        const dealList = Object.values(useDealStore.getState().deals);
        const others = useUserDirectoryStore.getState().users.filter(u => u.id !== DEMO_ME.id).map(u => u.id);
        seedDemoTasks(dealList, DEMO_ME.id, others);
      }
      set(await listAllTasks());
    } catch (e) { setError(errorMessage(e, 'Failed to load tasks')); } finally { setLoading(false); }
  }, [set]);

  // Demo tasks link to deals, so wait until the deal store has loaded before seeding.
  const dealCount = Object.keys(dealsMap).length;
  useEffect(() => { if (remote || dealCount > 0) void load(); }, [load, remote, dealCount]);

  const canCreate = perms.allowed('create', 'task');
  const canEdit = useCallback((t: DealTask) => {
    const deal = t.dealId ? useDealStore.getState().deals[t.dealId] : undefined;
    return perms.allowed('edit', 'task', { assignedToId: t.assigneeId }) || (!!deal && perms.allowed('edit', 'task', deal));
  }, [perms]);
  const canDelete = useCallback((t: DealTask) => {
    const deal = t.dealId ? useDealStore.getState().deals[t.dealId] : undefined;
    return perms.allowed('delete', 'task', { assignedToId: t.assigneeId }) || (!!deal && perms.allowed('delete', 'task', deal));
  }, [perms]);

  /** Optimistic edit; rolls back and toasts when the write fails (RLS zero-row updates throw in the service). */
  const patch = useCallback(async (task: DealTask, updates: TaskUpdate) => {
    const before = tasksRef.current;
    set(prev => prev.map(t => (t.id === task.id ? { ...t, ...updates, targets: updates.targets ?? t.targets } : t)));
    try {
      const saved = await updateTask(taskGateKey(task), task.id, updates);
      set(prev => prev.map(t => (t.id === saved.id ? { ...saved, boardPosition: saved.boardPosition ?? t.boardPosition } : t)));
      return true;
    } catch (err) {
      set(before);
      toastFailure(err, 'edit', 'task', `Could not update task: ${errorMessage(err)}`);
      return false;
    }
  }, [set]);

  /** Drag result: status + position (and neighbours when the column was renumbered), all-or-rollback. */
  const move = useCallback(async (taskId: string, status: DealTaskStatus, index: number) => {
    const current = tasksRef.current;
    const mv: TaskMove | null = computeMove(current, taskId, status, index);
    const task = current.find(t => t.id === taskId);
    if (!mv || !task || !mv.changed) return;
    set(applyMove(current, mv));
    try {
      const writes = [updateTask(taskGateKey(task), taskId, { status: mv.status, boardPosition: mv.boardPosition }),
        ...mv.renumber.map(r => {
          const t = current.find(x => x.id === r.id)!;
          return updateTask(taskGateKey(t), r.id, { boardPosition: r.boardPosition });
        })];
      await Promise.all(writes);
    } catch (err) {
      set(current);
      toastFailure(err, 'edit', 'task', `Could not move task: ${errorMessage(err)}`);
    }
  }, [set]);

  const add = useCallback(async (input: TaskInput & { status: DealTaskStatus }) => {
    try {
      const t = await createTask(null, { ...input, boardPosition: nextPosition(tasksRef.current, input.status) });
      set(prev => [t, ...prev]);
      return t;
    } catch (err) {
      toastFailure(err, 'create', 'task', `Could not add task: ${errorMessage(err)}`);
      return null;
    }
  }, [set]);

  const remove = useCallback(async (task: DealTask) => {
    const before = tasksRef.current;
    set(prev => prev.filter(t => t.id !== task.id));
    try { await deleteTask(taskGateKey(task), task.id); pushToast('info', 'Task deleted'); } catch (err) {
      set(before);
      toastFailure(err, 'delete', 'task', `Could not delete task: ${errorMessage(err)}`);
    }
  }, [set]);

  return { tasks, loading, error, reload: load, users, myId, dealsMap, canCreate, canEdit, canDelete, patch, move, add, remove };
}
