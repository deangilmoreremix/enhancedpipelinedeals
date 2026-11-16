import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

let mockCanCreate = true;
let mockCanModify = true;
jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: false,
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } },
}));
jest.mock('../services/supabaseService', () => ({
  isSupabaseConfigured: false,
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } },
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../hooks/useChildRecordPermissions', () => ({
  useChildRecordPermissions: () => ({ canCreate: mockCanCreate, canModify: () => mockCanModify, reason: '' }),
}));

import { DealTasks } from '../components/deals/DealTasks';
import { DealFiles } from '../components/deals/DealFiles';
import { DealNotes } from '../components/deals/DealNotes';
import { LinkedToRow } from '../components/deals/collab/LinkedToRow';
import { NotificationBell } from '../components/ui/NotificationBell';
import { createTask, __resetLocalTasks } from '../services/dealTasksService';
import { createNote, __resetLocalNotes } from '../services/dealNotesService';
import { uploadFile } from '../services/dealFilesService';
import { addLocalNotification, __resetLocalNotifications } from '../services/notificationService';
import { useNotificationStore } from '../store/notificationStore';
import { useUserDirectoryStore } from '../store/userDirectoryStore';
import { useDealRecordStore } from '../store/dealRecordStore';
import { useDealStore } from '../store/dealStore';
import { useContactStore } from '../store/contactStore';

const DAY = 86_400_000;

beforeEach(() => {
  mockCanCreate = true; mockCanModify = true;
  __resetLocalTasks(); __resetLocalNotes(); __resetLocalNotifications();
  useDealRecordStore.setState({ toasts: [] });
  useNotificationStore.setState({ items: [], unread: 0, error: null, mode: 'idle' });
  useUserDirectoryStore.setState({
    users: [{ id: 'local-user-ann', name: 'Ann' }, { id: 'local-user-bob', name: 'Bob' }],
    loadedAt: Date.now(), isLoading: false, error: null,
  });
});

describe('DealTasks', () => {
  it('changes status with the segmented control and shows overdue styling', async () => {
    await createTask('deal-t', { title: 'Send quote', dueDate: new Date(Date.now() - 3 * DAY).toISOString() });
    render(<DealTasks dealId="deal-t" />);
    const row = await screen.findByTestId('task-row');
    expect(row).toHaveAttribute('data-overdue', 'true');
    expect(within(row).getByText('Overdue')).toBeInTheDocument();
    const group = within(row).getByRole('radiogroup');
    expect(within(group).getByRole('radio', { name: 'To do' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(group).getByRole('radio', { name: 'In progress' }));
    await waitFor(() => expect(within(screen.getByTestId('task-row')).getByRole('radio', { name: 'In progress' })).toHaveAttribute('aria-checked', 'true'));
    fireEvent.click(within(screen.getByTestId('task-row')).getByRole('radio', { name: 'Done' }));
    await waitFor(() => expect(screen.getByTestId('task-row')).not.toHaveAttribute('data-overdue'));
  });

  it('adds a task with an assignee and filters by assignee and status', async () => {
    await createTask('deal-t2', { title: 'Existing', assigneeId: 'local-user-bob' });
    render(<DealTasks dealId="deal-t2" />);
    await screen.findByText('Existing');
    fireEvent.change(screen.getByLabelText('New task title'), { target: { value: 'Draft contract' } });
    fireEvent.change(screen.getByLabelText('New task assignee'), { target: { value: 'local-user-ann' } });
    fireEvent.click(screen.getByRole('button', { name: /add$/i }));
    await screen.findByText('Draft contract');
    expect(screen.getAllByTestId('task-row')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Filter by assignee'), { target: { value: 'local-user-ann' } });
    expect(screen.getAllByTestId('task-row')).toHaveLength(1);
    expect(screen.getByText('Draft contract')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Clear filters'));
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'done' } });
    expect(screen.getByText('No tasks match these filters')).toBeInTheDocument();
  });

  it('shows tasks linked to the deal contact, labelled with their source', async () => {
    useDealStore.setState({ deals: { 'deal-c': { id: 'deal-c', company: 'Acme', contact: 'Jane', contactId: 'c-9' } as any } } as any);
    useContactStore.setState({ contacts: [{ id: 'c-9', name: 'Jane Doe', email: '', company: 'Acme' } as any] });
    await createTask('other-deal', { title: 'Call Jane', targets: [{ type: 'deal', id: 'other-deal' }, { type: 'contact', id: 'c-9' }] });
    render(<DealTasks dealId="deal-c" />);
    await screen.findByText('Call Jane');
    expect(screen.getByTestId('source-badge')).toHaveTextContent('From contact: Jane Doe');
  });

  it('disables status changes without edit permission', async () => {
    await createTask('deal-p', { title: 'Locked' });
    mockCanModify = false;
    render(<DealTasks dealId="deal-p" />);
    const row = await screen.findByTestId('task-row');
    expect(within(row).getByRole('radio', { name: 'Done' })).toBeDisabled();
  });

  it('My tasks only shows tasks assigned to the current user', async () => {
    // no signed-in user in this test -> nothing is "mine"
    await createTask('deal-m', { title: 'Someone elses', assigneeId: 'local-user-bob' });
    render(<DealTasks dealId="deal-m" />);
    await screen.findByText('Someone elses');
    fireEvent.click(screen.getByRole('button', { name: /my tasks/i }));
    expect(screen.getByText('No tasks match these filters')).toBeInTheDocument();
  });
});

describe('DealFiles', () => {
  beforeEach(() => { (URL as any).createObjectURL = () => 'blob:mock'; (URL as any).revokeObjectURL = () => undefined; });

  it('renames a file in place', async () => {
    await uploadFile('deal-f', new File(['x'], 'old.txt', { type: 'text/plain' }));
    render(<DealFiles dealId="deal-f" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rename old.txt' }));
    const input = screen.getByLabelText('New name for old.txt');
    fireEvent.change(input, { target: { value: 'new.txt' } });
    fireEvent.submit(input.closest('form')!);
    await screen.findByText('new.txt');
    expect(screen.queryByText('old.txt')).toBeNull();
  });

  it('previews text files with their first lines and offers download for unknown types', async () => {
    (globalThis as any).fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => 'a,b\n1,2\n3,4' }));
    await uploadFile('deal-f2', new File(['x'], 'data.csv', { type: 'text/csv' }));
    await uploadFile('deal-f2', new File(['x'], 'pack.zip', { type: 'application/zip' }));
    render(<DealFiles dealId="deal-f2" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Preview data.csv' }));
    const pre = await screen.findByTestId('text-preview');
    expect(pre).toHaveTextContent('a,b');
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview pack.zip' }));
    expect(await screen.findByText(/No preview is available/)).toBeInTheDocument();
  });

  it('hides rename without edit permission', async () => {
    await uploadFile('deal-f3', new File(['x'], 'r.txt', { type: 'text/plain' }));
    mockCanModify = false;
    render(<DealFiles dealId="deal-f3" />);
    await screen.findByText('r.txt');
    expect(screen.queryByRole('button', { name: 'Rename r.txt' })).toBeNull();
  });
});

describe('LinkedToRow', () => {
  it('adds a contact link and removes one, keeping at least one', async () => {
    useContactStore.setState({ contacts: [{ id: 'c1', name: 'Jane Doe', email: 'j@x.com', company: 'Acme' } as any] });
    const onChange = jest.fn();
    const { rerender } = render(<LinkedToRow targets={[{ type: 'deal', id: 'd1', label: 'Big deal' }]} onChange={onChange} />);
    expect(screen.queryByLabelText(/Remove link/)).toBeNull(); // only one link left
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Contact' }));
    fireEvent.click(screen.getByText('Jane Doe'));
    expect(onChange).toHaveBeenCalledWith([{ type: 'deal', id: 'd1', label: 'Big deal' }, { type: 'contact', id: 'c1', label: 'Jane Doe' }]);

    onChange.mockClear();
    rerender(<LinkedToRow targets={[{ type: 'deal', id: 'd1', label: 'Big deal' }, { type: 'contact', id: 'c1', label: 'Jane Doe' }]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Remove link to Jane Doe'));
    expect(onChange).toHaveBeenCalledWith([{ type: 'deal', id: 'd1', label: 'Big deal' }]);
  });
});

describe('DealNotes', () => {
  it('lists notes with mention chips and source labels, and blocks creation without permission', async () => {
    useDealStore.setState({ deals: { 'deal-n': { id: 'deal-n', company: 'Acme', contact: 'J', contactId: 'c-1' } as any } } as any);
    useContactStore.setState({ contacts: [{ id: 'c-1', name: 'Jane Doe', email: '', company: 'Acme' } as any] });
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hey ' }, { type: 'mention', attrs: { id: 'local-user-ann', label: 'Ann' } }] }] };
    await createNote('other', { body, bodyText: 'hey @Ann', targets: [{ type: 'deal', id: 'other' }, { type: 'contact', id: 'c-1' }] });
    mockCanCreate = false;
    render(<DealNotes dealId="deal-n" />);
    expect(await screen.findByTestId('mention-chip')).toHaveTextContent('@Ann');
    expect(screen.getByTestId('source-badge')).toHaveTextContent('From contact: Jane Doe');
    expect(screen.getByRole('button', { name: /new note/i })).toBeDisabled();
  });
});

describe('NotificationBell', () => {
  it('shows the unread count, navigates on click and marks read', async () => {
    const onNavigate = jest.fn();
    render(<NotificationBell onNavigate={onNavigate} />);
    await act(async () => { addLocalNotification({ title: 'Ann mentioned you', body: 'hi', link: '/deals/d1' }); });
    const badge = await screen.findByTestId('notification-count');
    expect(badge).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: /Notifications, 1 unread/ }));
    fireEvent.click(await screen.findByText('Ann mentioned you'));
    expect(onNavigate).toHaveBeenCalledWith('/deals/d1', expect.objectContaining({ title: 'Ann mentioned you' }));
    await waitFor(() => expect(screen.queryByTestId('notification-count')).toBeNull());
  });

  it('marks all as read', async () => {
    render(<NotificationBell onNavigate={() => undefined} />);
    await act(async () => { addLocalNotification({ title: 'A' }); addLocalNotification({ title: 'B' }); });
    await screen.findByTestId('notification-count');
    fireEvent.click(screen.getByRole('button', { name: /Notifications, 2 unread/ }));
    fireEvent.click(screen.getByText('Mark all read'));
    await waitFor(() => expect(screen.queryByTestId('notification-count')).toBeNull());
  });
});
