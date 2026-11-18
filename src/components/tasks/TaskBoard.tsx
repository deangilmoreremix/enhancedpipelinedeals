import React, { useState } from 'react';
import { DragDropContext, Draggable, DropResult, Droppable } from '@hello-pangea/dnd';
import { Plus, Trash2 } from 'lucide-react';
import { DealTask, DealTaskStatus, TASK_STATUSES, TASK_STATUS_LABEL } from '../../services/dealTasksService';
import type { Deal, DirectoryUser } from '../../types';
import { BTN, CONTROL } from '../ui/buttonStyles';
import { Avatar, DealChip, DueChip, LinkedCount } from './TaskParts';
import { groupByStatus } from './taskBoardLogic';

interface Props {
  tasks: DealTask[];
  users: DirectoryUser[];
  deals: Record<string, Deal>;
  canCreate: boolean;
  canEdit: (t: DealTask) => boolean;
  canDelete: (t: DealTask) => boolean;
  onMove: (taskId: string, status: DealTaskStatus, index: number) => void;
  onAdd: (title: string, status: DealTaskStatus) => Promise<unknown>;
  onDelete: (t: DealTask) => void;
  onOpenDeal: (dealId: string) => void;
}

const COLUMN_TONE: Record<DealTaskStatus, string> = {
  todo: 'bg-gray-500', in_progress: 'bg-blue-500', done: 'bg-green-500',
};

const QuickAdd: React.FC<{ status: DealTaskStatus; onAdd: Props['onAdd'] }> = ({ status, onAdd }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const label = TASK_STATUS_LABEL[status];
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={`Add task to ${label}`} className={`${BTN} w-full`}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Add task
      </button>
    );
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const t = await onAdd(title.trim(), status);
    setBusy(false);
    if (t) { setTitle(''); }
  };
  return (
    <form onSubmit={submit} aria-label={`New task in ${label}`} className="space-y-2">
      <input
        autoFocus
        aria-label={`New task title (${label})`}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setTitle(''); } }}
        placeholder="Task title"
        className={`${CONTROL} w-full`}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !title.trim()} className={BTN}>Add</button>
        <button type="button" onClick={() => { setOpen(false); setTitle(''); }} className={BTN}>Cancel</button>
      </div>
    </form>
  );
};

export const TaskBoard: React.FC<Props> = ({ tasks, users, deals, canCreate, canEdit, canDelete, onMove, onAdd, onDelete, onOpenDeal }) => {
  const cols = groupByStatus(tasks);
  const user = (id: string | null) => (id ? users.find(u => u.id === id) ?? { id, name: 'Unknown user' } : null);

  const onDragEnd = (r: DropResult) => {
    if (!r.destination) return;
    onMove(r.draggableId, r.destination.droppableId as DealTaskStatus, r.destination.index);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid gap-4 md:grid-cols-3" data-testid="tasks-board">
        {TASK_STATUSES.map(status => (
          <section key={status} aria-label={`${TASK_STATUS_LABEL[status]} column`} data-column-status={status}
            className="flex min-h-[16rem] flex-col rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <span className={`h-2 w-2 rounded-full ${COLUMN_TONE[status]}`} aria-hidden="true" />
                {TASK_STATUS_LABEL[status]}
              </h3>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200" aria-label={`${cols[status].length} tasks`}>
                {cols[status].length}
              </span>
            </header>
            <Droppable droppableId={status}>
              {(drop, snap) => (
                <ul
                  ref={drop.innerRef}
                  {...drop.droppableProps}
                  aria-label={`${TASK_STATUS_LABEL[status]} tasks`}
                  className={`flex-1 space-y-2 rounded-lg p-1 transition-colors ${snap.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  {cols[status].map((t, i) => (
                    <Draggable key={t.id} draggableId={t.id} index={i} isDragDisabled={!canEdit(t)}>
                      {(drag, ds) => (
                        <li
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          {...drag.dragHandleProps}
                          data-task-id={t.id}
                          data-testid="task-card"
                          className={`rounded-lg border bg-white p-3 text-sm shadow-sm dark:bg-gray-800 ${ds.isDragging ? 'border-blue-500 shadow-lg' : 'border-gray-200 dark:border-gray-700'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`font-medium text-gray-900 dark:text-white ${t.status === 'done' ? 'line-through opacity-70' : ''}`}>{t.title}</span>
                            {canDelete(t) && (
                              <button type="button" aria-label={`Delete task ${t.title}`} onMouseDown={e => e.stopPropagation()} onClick={() => onDelete(t)}
                                className="rounded p-1 text-gray-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <DueChip task={t} />
                            <DealChip task={t} deals={deals} onOpen={onOpenDeal} />
                            <span className="ml-auto flex items-center gap-2">
                              <LinkedCount task={t} />
                              <Avatar user={user(t.assigneeId)} />
                            </span>
                          </div>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {cols[status].length === 0 && !snap.isDraggingOver && (
                    <li className="list-none px-2 py-6 text-center text-xs text-gray-500 dark:text-gray-400">No tasks</li>
                  )}
                  {drop.placeholder}
                </ul>
              )}
            </Droppable>
            {canCreate && <div className="mt-3"><QuickAdd status={status} onAdd={(title, s) => onAdd(title, s)} /></div>}
          </section>
        ))}
      </div>
    </DragDropContext>
  );
};
