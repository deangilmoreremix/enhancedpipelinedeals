import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { DealTask, DealTaskStatus, TASK_STATUSES, TASK_STATUS_LABEL, TaskUpdate } from '../../services/dealTasksService';
import type { Deal, DirectoryUser } from '../../types';
import { CONTROL } from '../ui/buttonStyles';
import { DealChip, DueChip, LinkedCount, primaryDealId } from './TaskParts';

export type SortKey = 'title' | 'status' | 'due' | 'assignee' | 'deal';
export interface SortState { key: SortKey; dir: 'asc' | 'desc' }

const STATUS_ORDER: Record<DealTaskStatus, number> = { todo: 0, in_progress: 1, done: 2 };

/** Sorts a copy; empty values (no due date / assignee / deal) always sort last. */
export function sortTaskRows(
  tasks: DealTask[], sort: SortState, nameOf: (id: string | null) => string, dealName: (t: DealTask) => string,
): DealTask[] {
  const val = (t: DealTask): string | number | null => {
    switch (sort.key) {
      case 'title': return t.title.toLowerCase();
      case 'status': return STATUS_ORDER[t.status];
      case 'due': return t.dueDate ? Date.parse(t.dueDate) : null;
      case 'assignee': return t.assigneeId ? nameOf(t.assigneeId).toLowerCase() : null;
      case 'deal': { const n = dealName(t); return n ? n.toLowerCase() : null; }
    }
  };
  const m = sort.dir === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const av = val(a), bv = val(b);
    if (av === null && bv === null) return a.title.localeCompare(b.title);
    if (av === null) return 1;
    if (bv === null) return -1;
    return av < bv ? -m : av > bv ? m : a.title.localeCompare(b.title);
  });
}

const toDateInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Props {
  tasks: DealTask[];
  users: DirectoryUser[];
  deals: Record<string, Deal>;
  canEdit: (t: DealTask) => boolean;
  canDelete: (t: DealTask) => boolean;
  onPatch: (t: DealTask, u: TaskUpdate) => void;
  onDelete: (t: DealTask) => void;
  onOpenDeal: (dealId: string) => void;
}

export const TaskList: React.FC<Props> = ({ tasks, users, deals, canEdit, canDelete, onPatch, onDelete, onOpenDeal }) => {
  const [sort, setSort] = useState<SortState>({ key: 'due', dir: 'asc' });
  const nameOf = (id: string | null) => (id ? users.find(u => u.id === id)?.name ?? 'Unknown user' : '');
  const dealName = (t: DealTask) => { const id = primaryDealId(t); return id ? deals[id]?.title || deals[id]?.company || '' : ''; };
  const rows = useMemo(() => sortTaskRows(tasks, sort, nameOf, dealName), [tasks, sort, users, deals]); // eslint-disable-line react-hooks/exhaustive-deps

  const Th: React.FC<{ k: SortKey; label: string }> = ({ k, label }) => {
    const active = sort.key === k;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-3 py-2 text-left font-medium">
        <button type="button" onClick={() => setSort(s => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))}
          className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-white">
          {label}
          {active && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />)}
        </button>
      </th>
    );
  };

  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">No tasks match these filters.</p>;
  }

  const cell = `${CONTROL} !h-8 !px-2`;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm" data-testid="tasks-list">
        <caption className="sr-only">Tasks</caption>
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <tr>
            <Th k="title" label="Task" /><Th k="status" label="Status" /><Th k="due" label="Due" />
            <Th k="assignee" label="Assignee" /><Th k="deal" label="Deal" />
            <th scope="col" className="px-3 py-2 text-left font-medium">Links</th>
            <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-800/50">
          {rows.map(t => {
            const edit = canEdit(t);
            return (
              <tr key={t.id} data-task-id={t.id}>
                <td className={`px-3 py-2 font-medium text-gray-900 dark:text-white ${t.status === 'done' ? 'line-through opacity-70' : ''}`}>{t.title}</td>
                <td className="px-3 py-2">
                  <select aria-label={`Status of ${t.title}`} value={t.status} disabled={!edit} className={cell}
                    onChange={e => onPatch(t, { status: e.target.value as DealTaskStatus })}>
                    {TASK_STATUSES.map(s => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <input type="date" aria-label={`Due date of ${t.title}`} value={toDateInput(t.dueDate)} disabled={!edit} className={cell}
                      onChange={e => onPatch(t, { dueDate: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : null })} />
                    <DueChip task={t} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <select aria-label={`Assignee of ${t.title}`} value={t.assigneeId ?? ''} disabled={!edit} className={cell}
                    onChange={e => onPatch(t, { assigneeId: e.target.value || null })}>
                    <option value="">Unassigned</option>
                    {t.assigneeId && !users.some(u => u.id === t.assigneeId) && <option value={t.assigneeId}>Unknown user</option>}
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><DealChip task={t} deals={deals} onOpen={onOpenDeal} /></td>
                <td className="px-3 py-2"><LinkedCount task={t} /></td>
                <td className="px-3 py-2 text-right">
                  {canDelete(t) && (
                    <button type="button" aria-label={`Delete task ${t.title}`} onClick={() => onDelete(t)}
                      className="rounded p-1 text-gray-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
