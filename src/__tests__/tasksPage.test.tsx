import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
const mockState: any = {
  deals: { 'deal-1': { id: 'deal-1', title: 'Big Deal', company: 'Acme' }, 'deal-2': { id: 'deal-2', title: 'Other', company: 'Beta' } },
  fetchDeals: () => Promise.resolve(),
};
jest.mock('../store/dealStore', () => { const f: any = (sel: any) => sel(mockState); f.getState = () => mockState; return { useDealStore: f }; });
jest.mock('../services/userDirectoryService', () => ({
  getCurrentDirectoryUser: () => Promise.resolve(null),
  listUsers: () => Promise.resolve([{ id: 'u-sam', name: 'Sam Rep' }]),
}));
let mockCanEdit = true;
jest.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ allowed: () => mockCanEdit, can: () => ({ allowed: mockCanEdit, reason: '' }) }) }));

import TasksPage from '../pages/TasksPage';
import { __resetLocalTasks } from '../services/dealTasksService';

const renderPage = () => render(
  <MemoryRouter initialEntries={['/tasks']}>
    <Routes><Route path="/tasks" element={<TasksPage />} /><Route path="/deals/:id" element={<h2>Deal record</h2>} /></Routes>
  </MemoryRouter>,
);
const column = (name: string) => screen.getByRole('region', { name: `${name} column` });

beforeEach(() => { __resetLocalTasks(); mockCanEdit = true; });

describe('TasksPage', () => {
  it('shows the board with seeded demo tasks in their status columns', async () => {
    renderPage();
    await screen.findByText('Send revised proposal');
    expect(within(column('To do')).getByText('Send revised proposal')).toBeInTheDocument();
    expect(within(column('In progress')).getByText('Follow up with procurement')).toBeInTheDocument();
    expect(within(column('Done')).getByText('Kickoff call notes')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Board', 'List', 'Calendar']);
  });

  it('flags overdue due dates and shows the linked deal', async () => {
    renderPage();
    const card = (await screen.findByText('Prepare contract redlines')).closest('[data-testid="task-card"]') as HTMLElement;
    expect(within(card).getByTestId('due-chip')).toHaveAttribute('data-overdue', 'true');
    expect(within(card).getByRole('button', { name: /Open deal/ })).toBeInTheDocument();
    expect(within(card).getByTestId('linked-count')).toHaveTextContent('1');
  });

  it('My tasks keeps only tasks assigned to the current user', async () => {
    renderPage();
    await screen.findByText('Send revised proposal');
    expect(screen.getByText('Schedule security review')).toBeInTheDocument();
    const mine = await screen.findByRole('button', { name: 'My tasks' });
    await waitFor(() => expect(mine).toBeEnabled());
    fireEvent.click(mine);
    expect(mine).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Schedule security review')).not.toBeInTheDocument();
    expect(screen.getByText('Send revised proposal')).toBeInTheDocument();
  });

  it('quick add creates a task at the bottom of the column', async () => {
    renderPage();
    await screen.findByText('Send revised proposal');
    fireEvent.click(screen.getByRole('button', { name: 'Add task to In progress' }));
    fireEvent.change(screen.getByLabelText('New task title (In progress)'), { target: { value: 'Brand new task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const added = await within(column('In progress')).findByText('Brand new task');
    const titles = within(column('In progress')).getAllByTestId('task-card').map(c => c.textContent);
    expect(titles[titles.length - 1]).toContain('Brand new task');
    expect(added).toBeInTheDocument();
  });

  it('list view sorts, edits inline and deleting removes the row', async () => {
    renderPage();
    await screen.findByText('Send revised proposal');
    fireEvent.click(screen.getByRole('tab', { name: 'List' }));
    const table = screen.getByTestId('tasks-list');
    fireEvent.click(within(table).getByRole('button', { name: 'Task' }));
    const first = () => within(table).getAllByRole('row')[1].textContent;
    expect(first()).toContain('Collect customer references');
    fireEvent.change(within(table).getByLabelText('Status of Collect customer references'), { target: { value: 'done' } });
    await waitFor(() => expect((within(table).getByLabelText('Status of Collect customer references') as HTMLSelectElement).value).toBe('done'));
    fireEvent.click(within(table).getByRole('button', { name: 'Delete task Collect customer references' }));
    await waitFor(() => expect(within(table).queryByText('Collect customer references')).not.toBeInTheDocument());
  });

  it('calendar shows tasks on their due day', async () => {
    renderPage();
    await screen.findByText('Send revised proposal');
    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
    expect(within(screen.getByTestId('tasks-calendar')).getAllByTestId('calendar-task').length).toBeGreaterThan(0);
  });

  it('clicking the deal chip opens the deal record', async () => {
    renderPage();
    const card = (await screen.findByText('Send revised proposal')).closest('[data-testid="task-card"]') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /Open deal Big Deal/ }));
    expect(await screen.findByRole('heading', { name: 'Deal record' })).toBeInTheDocument();
  });

  it('viewers get a read-only page: no quick add, no delete, no inline edits', async () => {
    mockCanEdit = false;
    renderPage();
    await screen.findByText('Send revised proposal');
    expect(screen.getByText(/Read-only/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add task to/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete task/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'List' }));
    expect(screen.getByLabelText('Status of Send revised proposal')).toBeDisabled();
  });
});
