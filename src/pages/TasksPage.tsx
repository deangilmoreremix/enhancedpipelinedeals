import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, PageHeader, Tabs } from './PageHeader';
import DealToasts from '../components/deals/DealToasts';
import { DEFAULT_TASK_FILTERS, TaskFilters, filterTasks } from '../services/dealTasksService';
import { TaskFiltersBar } from '../components/tasks/TaskFiltersBar';
import { TaskBoard } from '../components/tasks/TaskBoard';
import { TaskList } from '../components/tasks/TaskList';
import { TaskCalendar } from '../components/tasks/TaskCalendar';
import { rescheduledDue } from '../components/tasks/taskBoardLogic';
import { useTasksData } from '../components/tasks/useTasksData';

const TABS = [{ id: 'board', label: 'Board' }, { id: 'list', label: 'List' }, { id: 'calendar', label: 'Calendar' }];

/** Tasks across every deal: kanban board, sortable list and month calendar sharing one set of filters. */
const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const data = useTasksData();
  const [tab, setTab] = useState('board');
  const [filters, setFilters] = useState<TaskFilters>({ ...DEFAULT_TASK_FILTERS });
  const visible = useMemo(() => filterTasks(data.tasks, filters, data.myId), [data.tasks, filters, data.myId]);
  const openDeal = (id: string) => navigate(`/deals/${id}`);
  const readOnly = !data.canCreate;

  return (
    <PageContainer>
      <PageHeader
        title="Tasks"
        subtitle={readOnly ? 'Read-only: you can view tasks but not change them' : 'Plan work across every deal'}
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <TaskFiltersBar filters={filters} onChange={setFilters} users={data.users} myId={data.myId} />
      {data.error && (
        <div role="alert" className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          <span>{data.error}</span>
          <button type="button" onClick={() => void data.reload()} className="font-medium underline">Retry</button>
        </div>
      )}
      {data.loading && data.tasks.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400" role="status">Loading tasks…</p>
      ) : (
        <div role="tabpanel" aria-label={TABS.find(t => t.id === tab)?.label}>
          {tab === 'board' && (
            <TaskBoard
              tasks={visible} users={data.users} deals={data.dealsMap}
              canCreate={data.canCreate} canEdit={data.canEdit} canDelete={data.canDelete}
              onMove={(id, status, index) => { void data.move(id, status, index); }}
              onAdd={(title, status) => data.add({ title, status, assigneeId: filters.mine ? data.myId : null })}
              onDelete={t => { void data.remove(t); }}
              onOpenDeal={openDeal}
            />
          )}
          {tab === 'list' && (
            <TaskList
              tasks={visible} users={data.users} deals={data.dealsMap}
              canEdit={data.canEdit} canDelete={data.canDelete}
              onPatch={(t, u) => { void data.patch(t, u); }}
              onDelete={t => { void data.remove(t); }}
              onOpenDeal={openDeal}
            />
          )}
          {tab === 'calendar' && (
            <TaskCalendar tasks={visible} canEdit={data.canEdit}
              onReschedule={(t, day) => { void data.patch(t, { dueDate: rescheduledDue(t, day) }); }} />
          )}
        </div>
      )}
      <DealToasts />
    </PageContainer>
  );
};

export default TasksPage;
