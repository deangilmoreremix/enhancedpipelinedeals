import React from 'react';
import { Link2, CalendarDays, Briefcase } from 'lucide-react';
import type { DealTask } from '../../services/dealTasksService';
import { isOverdue } from '../../services/dealTasksService';
import type { Deal, DirectoryUser } from '../../types';

export const formatDue = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const Avatar: React.FC<{ user?: DirectoryUser | null; size?: number }> = ({ user, size = 24 }) => {
  if (!user) {
    return (
      <span aria-label="Unassigned" title="Unassigned" style={{ width: size, height: size }}
        className="inline-flex flex-shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-[10px] text-gray-400 dark:border-gray-600">
        ?
      </span>
    );
  }
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
  return user.avatar ? (
    <img src={user.avatar} alt={user.name} title={user.name} style={{ width: size, height: size }} className="flex-shrink-0 rounded-full object-cover" />
  ) : (
    <span role="img" aria-label={`Assigned to ${user.name}`} title={user.name} style={{ width: size, height: size }}
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
      {initials}
    </span>
  );
};

export const DueChip: React.FC<{ task: Pick<DealTask, 'status' | 'dueDate'> }> = ({ task }) => {
  if (!task.dueDate) return null;
  const over = isOverdue(task);
  return (
    <span
      data-testid="due-chip"
      data-overdue={over ? 'true' : 'false'}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${over
        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
    >
      <CalendarDays className="h-3 w-3" aria-hidden="true" />
      {over && <span className="sr-only">Overdue: </span>}
      {formatDue(task.dueDate)}
    </span>
  );
};

/** The deal a task hangs off (legacy deal_id, else its first deal target). */
export const primaryDealId = (t: DealTask): string | null => t.dealId ?? t.targets.find(x => x.type === 'deal')?.id ?? null;

export const DealChip: React.FC<{ task: DealTask; deals: Record<string, Deal>; onOpen: (dealId: string) => void }> = ({ task, deals, onOpen }) => {
  const id = primaryDealId(task);
  if (!id) return null;
  const deal = deals[id];
  const label = deal?.title || deal?.company || 'Deal';
  return (
    <button
      type="button"
      data-testid="task-deal-link"
      onClick={e => { e.stopPropagation(); onOpen(id); }}
      onMouseDown={e => e.stopPropagation()}
      aria-label={`Open deal ${label}`}
      className="inline-flex max-w-full items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
    >
      <Briefcase className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
};

export const LinkedCount: React.FC<{ task: DealTask }> = ({ task }) => {
  const n = task.targets.length;
  if (n === 0) return null;
  return (
    <span data-testid="linked-count" title={`${n} linked record${n === 1 ? '' : 's'}`} aria-label={`${n} linked record${n === 1 ? '' : 's'}`}
      className="inline-flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400">
      <Link2 className="h-3 w-3" aria-hidden="true" />{n}
    </span>
  );
};
