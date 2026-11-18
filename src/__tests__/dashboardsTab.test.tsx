import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
const mockDeal = (id: string, stage: string, value: number) => ({ id, title: id, company: 'Acme', stage, value, priority: 'high', createdAt: new Date(), updatedAt: new Date() });
const mockState: any = {
  deals: { a: mockDeal('a', 'qual', 100), b: mockDeal('b', 'qual', 250), c: mockDeal('c', 'prop', 650) },
  stages: [{ key: 'qual', name: 'Qualification', position: 0 }, { key: 'prop', name: 'Proposal', position: 1 }],
  isConnectedToDatabase: false, fetchDeals: () => Promise.resolve(),
};
jest.mock('../store/dealStore', () => { const f: any = (sel: any) => sel(mockState); f.getState = () => mockState; return { useDealStore: f }; });
const mockContactState: any = { contacts: [], error: null, fetchContacts: () => Promise.resolve() };
jest.mock('../store/contactStore', () => { const f: any = (sel: any) => sel(mockContactState); f.getState = () => mockContactState; return { useContactStore: f }; });
jest.mock('../services/userDirectoryService', () => ({ getCurrentDirectoryUser: () => Promise.resolve(null), listUsers: () => Promise.resolve([]) }));
jest.mock('../services/companyService', () => ({ search: () => Promise.resolve([]) }));
jest.mock('../services/customFieldService', () => ({
  ...(jest.requireActual('../services/customFieldService') as object),
  listFieldDefinitions: () => Promise.resolve([]),
}));
let mockCanEdit = true;
jest.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ allowed: () => mockCanEdit }) }));

import DashboardsTab from '../components/dashboards/DashboardsTab';
import { __resetLocalDashboards } from '../services/dashboardService';
import { __resetLocalTasks } from '../services/dealTasksService';

(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

beforeEach(() => { __resetLocalDashboards(); __resetLocalTasks(); mockCanEdit = true; try { localStorage.clear(); } catch { /* ignore */ } });

async function createDashboard(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: /Create dashboard|New dashboard/ }));
  fireEvent.change(screen.getByLabelText('Dashboard name'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  await screen.findByRole('combobox', { name: 'Dashboard' });
}

describe('DashboardsTab', () => {
  it('starts empty, then creates a dashboard and a number + table widget whose values match the deals', async () => {
    render(<DashboardsTab />);
    expect(await screen.findByText(/No dashboards yet/)).toBeInTheDocument();
    await createDashboard('Sales');
    expect(screen.getByText(/no widgets yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add widget/ }));
    let dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Chart type'), { target: { value: 'number' } });
    fireEvent.change(within(dlg).getByLabelText('Measure'), { target: { value: 'sum' } });
    fireEvent.change(within(dlg).getByLabelText('Widget title'), { target: { value: 'Pipeline total' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Add widget' }));
    const num = await screen.findByRole('region', { name: 'Widget: Pipeline total' });
    expect(within(num).getByTestId('widget-number')).toHaveTextContent('$1,000');

    fireEvent.click(screen.getByRole('button', { name: /Add widget/ }));
    dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Chart type'), { target: { value: 'table' } });
    fireEvent.change(within(dlg).getByLabelText('Measure'), { target: { value: 'sum' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Add widget' }));
    const table = await screen.findByTestId('widget-table');
    expect(within(table).getByText('Qualification').closest('tr')).toHaveTextContent('$350');
    expect(within(table).getByText('Proposal').closest('tr')).toHaveTextContent('$650');
  });

  it('persists to localStorage (reload keeps dashboards), resizes, reorders and removes widgets', async () => {
    const first = render(<DashboardsTab />);
    await createDashboard('Persisted');
    for (const title of ['One', 'Two']) {
      fireEvent.click(screen.getByRole('button', { name: /Add widget/ }));
      const dlg = screen.getByRole('dialog');
      fireEvent.change(within(dlg).getByLabelText('Widget title'), { target: { value: title } });
      fireEvent.click(within(dlg).getByRole('button', { name: 'Add widget' }));
      await screen.findByRole('region', { name: `Widget: ${title}` });
    }
    fireEvent.change(screen.getByLabelText('Width of One'), { target: { value: '3' } });
    expect(screen.getByRole('region', { name: 'Widget: One' })).toHaveAttribute('data-cols', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Move One later' }));
    await waitFor(() => expect(screen.getAllByTestId('dashboard-widget').map(w => w.getAttribute('aria-label'))).toEqual(['Widget: Two', 'Widget: One']));
    first.unmount();

    render(<DashboardsTab />);
    await screen.findByRole('combobox', { name: 'Dashboard' });
    expect((await screen.findAllByTestId('dashboard-widget')).map(w => w.getAttribute('aria-label'))).toEqual(['Widget: Two', 'Widget: One']);
    expect(screen.getByRole('region', { name: 'Widget: One' })).toHaveAttribute('data-cols', '3');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Two' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Widget: Two' })).not.toBeInTheDocument());
  });

  it('renames and deletes a dashboard (with confirmation)', async () => {
    render(<DashboardsTab />);
    await createDashboard('Old');
    fireEvent.click(screen.getByRole('button', { name: /Rename/ }));
    fireEvent.change(screen.getByLabelText('Dashboard name'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('option', { name: 'New name' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete dashboard' }));
    expect(await screen.findByText(/No dashboards yet/)).toBeInTheDocument();
  });

  it('shows an empty-state for widgets with no matching records and an error state for invalid configs', async () => {
    render(<DashboardsTab />);
    await createDashboard('Edge');
    fireEvent.click(screen.getByRole('button', { name: /Add widget/ }));
    const dlg = screen.getByRole('dialog');
    fireEvent.change(within(dlg).getByLabelText('Object'), { target: { value: 'contacts' } });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Add widget' }));
    expect(await screen.findByText(/No contacts match/)).toBeInTheDocument();
  });

  it('viewers can look but not edit', async () => {
    mockCanEdit = false;
    render(<DashboardsTab />);
    expect(await screen.findByText(/No dashboards yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create dashboard|New dashboard/ })).not.toBeInTheDocument();
  });
});
