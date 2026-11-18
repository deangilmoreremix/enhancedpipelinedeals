import React, { useState } from 'react';
import { DragDropContext, Draggable, DropResult, Droppable } from '@hello-pangea/dnd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DealTask } from '../../services/dealTasksService';
import { isOverdue } from '../../services/dealTasksService';
import { BTN, BTN_ICON } from '../ui/buttonStyles';
import { dayKey, monthGrid, taskDayKey } from './taskBoardLogic';

interface Props {
  tasks: DealTask[];
  canEdit: (t: DealTask) => boolean;
  /** Called with the task and the day it was dropped on. */
  onReschedule: (task: DealTask, day: Date) => void;
  now?: Date;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TaskCalendar: React.FC<Props> = ({ tasks, canEdit, onReschedule, now = new Date() }) => {
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const grid = monthGrid(cursor.getFullYear(), cursor.getMonth());
  const byDay = new Map<string, DealTask[]>();
  for (const t of tasks) {
    const k = taskDayKey(t);
    if (k) byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  const undated = tasks.filter(t => !t.dueDate).length;
  const todayKey = dayKey(now);
  const shift = (n: number) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const title = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    const task = tasks.find(t => t.id === r.draggableId);
    const [y, m, d] = r.destination.droppableId.replace('day-', '').split('-').map(Number);
    if (task) onReschedule(task, new Date(y, m - 1, d));
  };

  return (
    <div data-testid="tasks-calendar">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className={BTN_ICON}><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className={BTN_ICON}><ChevronRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))} className={BTN}>Today</button>
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white" aria-live="polite">{title}</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">{undated ? `${undated} without a due date` : ''}</span>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div role="grid" aria-label={`Tasks by due date, ${title}`} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <div role="row" className="grid grid-cols-7 bg-gray-50 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {WEEKDAYS.map(w => <div key={w} role="columnheader" className="px-2 py-1.5 text-center">{w}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {grid.map(day => {
              const key = dayKey(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const items = byDay.get(key) ?? [];
              return (
                <Droppable droppableId={`day-${key}`} key={key}>
                  {(drop, snap) => (
                    <div
                      ref={drop.innerRef}
                      {...drop.droppableProps}
                      role="gridcell"
                      data-day={key}
                      aria-label={`${day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${items.length} tasks`}
                      className={`min-h-[6.5rem] border-b border-r border-gray-100 p-1 dark:border-gray-700 ${inMonth ? 'bg-white dark:bg-gray-800/50' : 'bg-gray-50 dark:bg-gray-900/40'} ${snap.isDraggingOver ? '!bg-blue-50 dark:!bg-blue-900/20' : ''}`}
                    >
                      <div className={`mb-1 text-right text-xs ${key === todayKey ? 'font-bold text-blue-600 dark:text-blue-400' : inMonth ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>{day.getDate()}</div>
                      {items.map((t, i) => (
                        <Draggable key={t.id} draggableId={t.id} index={i} isDragDisabled={!canEdit(t)}>
                          {(drag, ds) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              data-task-id={t.id}
                              data-testid="calendar-task"
                              title={t.title}
                              className={`mb-1 truncate rounded px-1.5 py-0.5 text-xs ${isOverdue(t) ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' : t.status === 'done' ? 'bg-green-100 text-green-800 line-through dark:bg-green-900/30 dark:text-green-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'} ${ds.isDragging ? 'shadow-lg' : ''}`}
                            >
                              {t.title}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {drop.placeholder}
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};
