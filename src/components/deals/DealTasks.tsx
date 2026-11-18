import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListChecks, Plus, Trash2, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import {
  DEFAULT_TASK_FILTERS, DealTask, DealTaskStatus, DueFilter, TASK_STATUSES, TASK_STATUS_LABEL, TaskFilters, TaskUpdate,
  createTask, deleteTask, filterTasks, isOverdue, isTasksLocalOnly, listTasks, sortTasks, updateTask,
} from '../../services/dealTasksService';
import { errorMessage } from '../../services/dealRecordShared';
import { getCurrentDirectoryUser } from '../../services/userDirectoryService';
import type { RecordTarget } from '../../services/recordTargetsService';
import { useUserDirectoryStore } from '../../store/userDirectoryStore';
import { useDealStore } from '../../store/dealStore';
import { DateField } from './fields/DateField';
import { LinkedToRow, SourceBadge } from './collab/LinkedToRow';
import { useChildRecordPermissions } from '../../hooks/useChildRecordPermissions';
import { toastFailure } from '../../utils/permissionToast';

const STATUS_STYLE: Record<DealTaskStatus, string> = {
  todo: 'bg-gray-600 text-white',
  in_progress: 'bg-blue-600 text-white',
  done: 'bg-green-600 text-white',
};

const selectCls = 'rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

export const StatusControl: React.FC<{ task: DealTask; disabled?: boolean; onChange: (s: DealTaskStatus) => void }> = ({ task, disabled, onChange }) => (
  <div role="radiogroup" aria-label={`Status of "${task.title}"`} className="inline-flex flex-shrink-0 overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
    {TASK_STATUSES.map(s => (
      <button
        key={s}
        type="button"
        role="radio"
        aria-checked={task.status === s}
        disabled={disabled}
        onClick={() => task.status !== s && onChange(s)}
        className={`px-2 py-1 text-xs font-medium transition-colors ${task.status === s ? STATUS_STYLE[s] : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'} disabled:cursor-default`}
      >
        {TASK_STATUS_LABEL[s]}
      </button>
    ))}
  </div>
);

export const DealTasks: React.FC<{
  dealId: string;
  /** Bump (non-zero) to focus the new-task composer (palette "Add task", the T shortcut). */
  focusSignal?: number;
  onFocusHandled?: () => void;
}> = ({ dealId, focusSignal, onFocusHandled }) => {
  const titleRef = useRef<HTMLInputElement>(null);
  const { canCreate, canModify } = useChildRecordPermissions(dealId, 'task');
  const contactId = useDealStore(s => s.deals[dealId]?.contactId);
  const companyId = useDealStore(s => s.deals[dealId]?.companyId);
  const users = useUserDirectoryStore(s => s.users);
  const loadUsers = useUserDirectoryStore(s => s.load);
  const [myId, setMyId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [assignee, setAssignee] = useState('');
  const [newTargets, setNewTargets] = useState<RecordTarget[]>([{ type: 'deal', id: dealId }]);
  const [adding, setAdding] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_TASK_FILTERS);
  const localOnly = isTasksLocalOnly(dealId);

  useEffect(() => { void loadUsers(); void getCurrentDirectoryUser().then(u => setMyId(u?.id ?? null)); }, [loadUsers]);
  useEffect(() => { setNewTargets([{ type: 'deal', id: dealId }]); }, [dealId]);
  useEffect(() => {
    if (!focusSignal) return;
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView?.({ block: 'center' });
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try { setTasks(await listTasks(dealId, { contactId, companyId })); } catch (e) { setLoadError(errorMessage(e, 'Failed to load tasks')); } finally { setLoading(false); }
  }, [dealId, contactId, companyId]);

  useEffect(() => { void load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || adding) return;
    setAdding(true);
    try {
      const t = await createTask(dealId, {
        title, dueDate: due ? new Date(`${due}T00:00:00`).toISOString() : null, assigneeId: assignee || null, targets: newTargets,
      });
      setTasks(prev => sortTasks([{ ...t, source: t.targets.some(x => x.type === 'deal' && x.id === dealId) ? { type: 'deal', id: dealId } : null }, ...prev]));
      setTitle(''); setDue(''); setAssignee(''); setNewTargets([{ type: 'deal', id: dealId }]);
    } catch (err) {
      toastFailure(err, 'create', 'task', `Could not add task: ${errorMessage(err)}`);
    } finally { setAdding(false); }
  };

  const patch = async (task: DealTask, updates: TaskUpdate) => {
    const before = tasks;
    setTasks(prev => sortTasks(prev.map(t => (t.id === task.id ? { ...t, ...updates, targets: updates.targets ?? t.targets } : t))));
    try {
      const saved = await updateTask(dealId, task.id, updates);
      setTasks(prev => sortTasks(prev.map(t => (t.id === saved.id ? { ...saved, source: t.source } : t))));
      if (updates.targets) void load(); // links changed: the task may leave this tab or change source
    } catch (err) {
      setTasks(before);
      toastFailure(err, 'edit', 'task', `Could not update task: ${errorMessage(err)}`);
    }
  };

  const remove = async (task: DealTask) => {
    const before = tasks;
    setTasks(prev => prev.filter(t => t.id !== task.id));
    try { await deleteTask(dealId, task.id); } catch (err) {
      setTasks(before);
      toastFailure(err, 'delete', 'task', `Could not delete task: ${errorMessage(err)}`);
    }
  };

  const visible = useMemo(() => filterTasks(tasks, filters, myId), [tasks, filters, myId]);
  const open = tasks.filter(t => t.status !== 'done').length;
  const setF = (p: Partial<TaskFilters>) => setFilters(f => ({ ...f, ...p }));
  const filtered = filters.status !== 'all' || filters.assignee !== 'all' || filters.due !== 'all' || filters.mine;
  const nameOf = (id: string | null) => (id ? users.find(u => u.id === id)?.name ?? 'Unknown user' : null);

  const assigneeSelect = (value: string, onChange: (v: string) => void, label: string, disabled?: boolean) => (
    <select aria-label={label} value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={selectCls}>
      <option value="">Unassigned</option>
      {value && !users.some(u => u.id === value) && <option value={value}>Unknown user</option>}
      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
          <ListChecks className="mr-2 h-5 w-5 text-gray-500" />Tasks
          <Badge variant="secondary" className="ml-2">{open} open</Badge>
        </h4>
      </div>

      {localOnly && (
        <Alert variant="info"><span className="text-sm">Tasks are stored in this browser session only (Supabase is not connected or demo mode is on).</span></Alert>
      )}
      {loadError && <Alert variant="error"><span className="text-sm">{loadError}</span></Alert>}

      <form onSubmit={add} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={titleRef}
            aria-label="New task title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Add a task..."
            className="min-w-[12rem] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="date"
            aria-label="Due date"
            value={due}
            onChange={e => setDue(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          {assigneeSelect(assignee, setAssignee, 'New task assignee')}
          <Button type="submit" size="sm" disabled={!title.trim() || adding || !canCreate} title={canCreate ? undefined : "You don't have permission to add tasks"}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </div>
        <LinkedToRow targets={newTargets} onChange={setNewTargets} disabled={!canCreate} />
      </form>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Task filters">
        <button
          type="button"
          aria-pressed={filters.mine}
          onClick={() => setF({ mine: !filters.mine })}
          className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-sm ${filters.mine ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'}`}
        >
          <User className="mr-1 h-4 w-4" />My tasks
        </button>
        <select aria-label="Filter by status" value={filters.status} onChange={e => setF({ status: e.target.value as TaskFilters['status'] })} className={selectCls}>
          <option value="all">All statuses</option>
          <option value="open">Not done</option>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="Filter by assignee" value={filters.assignee} onChange={e => setF({ assignee: e.target.value })} className={selectCls}>
          <option value="all">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select aria-label="Filter by due date" value={filters.due} onChange={e => setF({ due: e.target.value as DueFilter })} className={selectCls}>
          <option value="all">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
        </select>
        {filtered && <button type="button" onClick={() => setFilters(DEFAULT_TASK_FILTERS)} className="text-sm text-blue-600 hover:underline dark:text-blue-400">Clear filters</button>}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading tasks...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          {tasks.length === 0 ? 'No tasks yet' : 'No tasks match these filters'}
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {visible.map(t => {
            const done = t.status === 'done';
            const overdue = isOverdue(t);
            const editable = canModify('edit');
            return (
              <li key={t.id} data-testid="task-row" data-overdue={overdue || undefined} className={`space-y-2 px-4 py-3 ${overdue ? 'border-l-4 border-red-500 bg-red-50/60 dark:bg-red-900/10' : ''}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusControl task={t} disabled={!editable} onChange={s => void patch(t, { status: s })} />
                  <span className={`min-w-0 flex-1 truncate text-sm ${done ? 'text-gray-400 line-through' : overdue ? 'font-medium text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>{t.title}</span>
                  <SourceBadge source={t.source} />
                  {overdue && <Badge variant="destructive">Overdue</Badge>}
                  {editable
                    ? assigneeSelect(t.assigneeId ?? '', v => void patch(t, { assigneeId: v || null }), `Assignee of "${t.title}"`)
                    : <span className="text-xs text-gray-500 dark:text-gray-400">{nameOf(t.assigneeId) ?? 'Unassigned'}</span>}
                  <DateField
                    className="w-40 flex-shrink-0"
                    value={t.dueDate}
                    placeholder="No due date"
                    disabled={!editable}
                    onSave={d => patch(t, { dueDate: d ? d.toISOString() : null })}
                  />
                  {canModify('delete') && <button type="button" aria-label={`Delete task "${t.title}"`} onClick={() => void remove(t)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">
                    <Trash2 className="h-4 w-4" />
                  </button>}
                </div>
                <LinkedToRow targets={t.targets} disabled={!editable} onChange={next => patch(t, { targets: next })} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default DealTasks;
