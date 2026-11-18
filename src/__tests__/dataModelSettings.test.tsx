import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import DataModelSettings from '../components/settings/DataModelSettings';
import { __resetDefinitionCache, createFieldDefinition, getCachedDefinitions, listFieldDefinitions } from '../services/customFieldService';

beforeEach(() => { localStorage.clear(); __resetDefinitionCache(); });

const add = async (name: string, type?: string, extra?: (s: typeof screen) => void) => {
  fireEvent.change(screen.getByLabelText('New field name'), { target: { value: name } });
  if (type) fireEvent.change(screen.getByLabelText('Field type'), { target: { value: type } });
  extra?.(screen);
  fireEvent.click(screen.getByRole('button', { name: /Add field/ }));
  await screen.findByRole('row', { name: new RegExp(name) });
};

describe('DataModelSettings', () => {
  it('has Deals | Contacts | Companies tabs, each with its own field list', async () => {
    await createFieldDefinition({ label: 'Deal only', type: 'text' }, 'deal');
    await createFieldDefinition({ label: 'Contact only', type: 'text' }, 'contact');
    render(<DataModelSettings />);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Deals', 'Contacts', 'Companies']);
    await screen.findByText('Deal only');
    expect(screen.queryByText('Contact only')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Contacts' }));
    await screen.findByText('Contact only');
    expect(screen.queryByText('Deal only')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Companies' }));
    await screen.findByText(/No companies custom fields yet/);
  });

  it('adds a contact field with label, key, type and group in the table', async () => {
    render(<DataModelSettings />);
    fireEvent.click(screen.getByRole('tab', { name: 'Contacts' }));
    fireEvent.change(screen.getByLabelText('New field group'), { target: { value: 'Personal' } });
    await add('Favourite colour', 'text');
    const row = screen.getByTestId('field-row-favourite_colour');
    expect(within(row).getByText('Favourite colour')).toBeInTheDocument();
    expect(within(row).getByText('favourite_colour')).toBeInTheDocument();
    expect(within(row).getByText('Text')).toBeInTheDocument();
    expect(within(row).getByText('Personal')).toBeInTheDocument();
    expect(getCachedDefinitions('contact')).toHaveLength(1);
    expect(getCachedDefinitions('deal')).toHaveLength(0);
  });

  it('edits select options, toggles active, reorders and soft-deletes (with confirm) and restores', async () => {
    render(<DataModelSettings />);
    fireEvent.change(screen.getByLabelText('New field name'), { target: { value: 'Tier' } });
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'select' } });
    fireEvent.change(screen.getByLabelText('New field options'), { target: { value: 'Gold\nSilver' } });
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }));
    await screen.findByTestId('field-row-tier');
    await add('Budget', 'number');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Tier' }));
    fireEvent.change(screen.getByLabelText('Options'), { target: { value: 'Gold\nSilver\nBronze' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(getCachedDefinitions('deal').find(d => d.key === 'tier')?.options).toEqual(['Gold', 'Silver', 'Bronze']));

    fireEvent.click(screen.getByRole('button', { name: 'Move Budget up' }));
    await waitFor(() => expect(screen.getAllByTestId(/field-row-/)[0]).toHaveAttribute('data-testid', 'field-row-budget'));

    fireEvent.click(screen.getByRole('switch', { name: 'Budget active' }));
    await waitFor(() => expect(getCachedDefinitions('deal').find(d => d.key === 'budget')?.isActive).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Restore Budget' }));
    await waitFor(() => expect(getCachedDefinitions('deal').find(d => d.key === 'budget')?.isActive).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Delete Tier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(getCachedDefinitions('deal').find(d => d.key === 'tier')?.isActive).toBe(false));
    expect(getCachedDefinitions('deal')).toHaveLength(2); // soft delete keeps the definition
  });

  it('supports drag reorder', async () => {
    await createFieldDefinition({ label: 'One', type: 'text' });
    await createFieldDefinition({ label: 'Two', type: 'text' });
    render(<DataModelSettings />);
    const rows = await screen.findAllByTestId(/field-row-/);
    fireEvent.dragStart(rows[1]);
    fireEvent.dragOver(rows[0]);
    fireEvent.drop(rows[0]);
    await waitFor(() => expect(screen.getAllByTestId(/field-row-/)[0]).toHaveAttribute('data-testid', 'field-row-two'));
  });

  it('configures a formula (validated) and a rollup (companies only)', async () => {
    render(<DataModelSettings />);
    fireEvent.change(screen.getByLabelText('New field name'), { target: { value: 'Weighted' } });
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'formula' } });
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a formula');
    fireEvent.change(screen.getByLabelText('Formula'), { target: { value: '{value} *' } });
    expect(await screen.findByText(/Unexpected end of formula/)).toBeInTheDocument(); // live syntax hint
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid formula');
    fireEvent.change(screen.getByLabelText('Formula'), { target: { value: '{value} * {probability} / 100' } });
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }));
    await screen.findByTestId('field-row-weighted');
    expect(getCachedDefinitions('deal')[0].config?.formula).toBe('{value} * {probability} / 100');

    // rollup is not offered for deals / contacts
    expect(within(screen.getByLabelText('Field type')).queryByRole('option', { name: 'Rollup' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Companies' }));
    expect(within(screen.getByLabelText('Field type')).getByRole('option', { name: 'Rollup' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New field name'), { target: { value: 'Open pipeline' } });
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'rollup' } });
    fireEvent.change(screen.getByLabelText('Rollup metric'), { target: { value: 'open_deal_value' } });
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }));
    await screen.findByTestId('field-row-open_pipeline');
    expect((await listFieldDefinitions('company'))[0].config).toEqual({ metric: 'open_deal_value' });
    expect(screen.getByTestId('field-row-open_pipeline')).toHaveTextContent('Open deal value');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Open pipeline' }));
    fireEvent.change(screen.getByLabelText('Rollup metric'), { target: { value: 'contact_count' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
    await waitFor(() => expect(getCachedDefinitions('company')[0].config).toEqual({ metric: 'contact_count' }));
  });
});
