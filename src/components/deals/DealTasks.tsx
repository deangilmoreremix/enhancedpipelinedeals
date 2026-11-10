import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, ListChecks, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import {
  DealTask, createTask, deleteTask, isOverdue, isTasksLocalOnly, listTasks, sortTasks, updateTask,
} from '../../services/dealTasksService';
import { errorMessage } from '../../services/dealRecordShared';
import { pushToast } from '../../store/dealRecordStore';
import { DateField } from './fields/DateField';

export const DealTasks: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [adding, setAdding] = useState(false);
  const localOnly = isTasksLocalOnly(dealId);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try { setTasks(await listTasks(dealId)); } catch (e) { setLoadError(errorMessage(e, 'Failed to load tasks')); } finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || adding) return;
    setAdding(true);
    try {
      const t = await createTask(dealId, { title, dueDate: due ? new Date(`${due}T00:00:00`).toISOString() : null });
      setTasks(prev => sortTasks([t, ...prev]));
      setTitle(''); setDue('');
    } catch (err) {
      pushToast('error', `Could not add task: ${errorMessage(err)}`);
    } finally { setAdding(false); }
  };

  const patch = async (task: DealTask, updates: Partial<Pick<DealTask, 'status' | 'dueDate' | 'title'>>) => {
    const before = tasks;
    setTasks(prev => sortTasks(prev.map(t => (t.id === task.id ? { ...t, ...updates } : t))));
    try {
      const saved = await updateTask(dealId, task.id, updates);
      setTasks(prev => sortTasks(prev.map(t => (t.id === saved.id ? saved : t))));
    } catch (err) {
      setTasks(before);
      pushToast('error', `Could not update task: ${errorMessage(err)}`);
      throw err;
    }
  };

  const remove = async (task: DealTask) => {
    const before = tasks;
    setTasks(prev => prev.filter(t => t.id !== task.id));
    try { await deleteTask(dealId, task.id); } catch (err) {
      setTasks(before);
      pushToast('error', `Could not delete task: ${errorMessage(err)}`);
    }
  };

  const open = tasks.filter(t => t.status === 'open').length;

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

      <form onSubmit={add} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <input
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
        <Button type="submit" size="sm" disabled={!title.trim() || adding}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">No tasks yet</div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {tasks.map(t => {
            const done = t.status === 'done';
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  aria-label={done ? `Mark "${t.title}" open` : `Mark "${t.title}" done`}
                  onClick={() => void patch(t, { status: done ? 'open' : 'done' }).catch(() => undefined)}
                  className="flex-shrink-0 text-gray-400 hover:text-blue-600"
                >
                  {done ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5" />}
                </button>
                <span className={`min-w-0 flex-1 truncate text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{t.title}</span>
                {isOverdue(t) && <Badge variant="destructive">Overdue</Badge>}
                <DateField
                  className="w-40 flex-shrink-0"
                  value={t.dueDate}
                  placeholder="No due date"
                  onSave={d => patch(t, { dueDate: d ? d.toISOString() : null })}
                />
                <button type="button" aria-label={`Delete task "${t.title}"`} onClick={() => void remove(t)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default DealTasks;
