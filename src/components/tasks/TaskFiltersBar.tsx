import React from 'react';
import { Search } from 'lucide-react';
import type { TaskFilters } from '../../services/dealTasksService';
import { DEFAULT_TASK_FILTERS } from '../../services/dealTasksService';
import type { DirectoryUser } from '../../types';
import { BTN, CONTROL } from '../ui/buttonStyles';

interface Props {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
  users: DirectoryUser[];
  myId: string | null;
  /** The calendar groups by due date, so the status filter still applies but "due" does not. */
  hideStatus?: boolean;
}

export const TaskFiltersBar: React.FC<Props> = ({ filters, onChange, users, myId, hideStatus }) => {
  const set = (p: Partial<TaskFilters>) => onChange({ ...filters, ...p });
  const active = filters.mine || filters.assignee !== 'all' || filters.status !== 'all' || filters.due !== 'all' || !!filters.search?.trim();
  return (
    <div role="search" aria-label="Task filters" className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          aria-label="Search tasks"
          placeholder="Search tasks"
          value={filters.search ?? ''}
          onChange={e => set({ search: e.target.value })}
          className={`${CONTROL} w-48 pl-8`}
        />
      </div>
      <button
        type="button"
        aria-pressed={filters.mine}
        disabled={!myId}
        title={myId ? 'Only tasks assigned to me' : 'Sign in to filter by your tasks'}
        onClick={() => set({ mine: !filters.mine, ...(filters.mine ? {} : { assignee: 'all' }) })}
        className={`${BTN} ${filters.mine ? '!border-blue-600 !bg-blue-600 !text-white' : ''}`}
      >
        My tasks
      </button>
      <select aria-label="Assignee" value={filters.assignee} disabled={filters.mine} onChange={e => set({ assignee: e.target.value })} className={CONTROL}>
        <option value="all">All assignees</option>
        <option value="unassigned">Unassigned</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      {!hideStatus && (
        <select aria-label="Status" value={filters.status} onChange={e => set({ status: e.target.value as TaskFilters['status'] })} className={CONTROL}>
          <option value="all">Any status</option>
          <option value="open">Open</option>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
      )}
      <select aria-label="Due" value={filters.due} onChange={e => set({ due: e.target.value as TaskFilters['due'] })} className={CONTROL}>
        <option value="all">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="today">Due today</option>
        <option value="week">Due this week</option>
        <option value="none">No due date</option>
      </select>
      {active && <button type="button" onClick={() => onChange({ ...DEFAULT_TASK_FILTERS })} className={BTN}>Clear</button>}
    </div>
  );
};
