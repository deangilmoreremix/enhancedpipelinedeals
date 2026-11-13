import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));

import { CompanyPicker } from '../components/deals/fields/CompanyPicker';
import { OwnerPicker } from '../components/deals/fields/OwnerPicker';
import { CompanyField, OwnerField } from '../components/deals/fields';
import { useCompanyStore } from '../store/companyStore';
import { useUserDirectoryStore } from '../store/userDirectoryStore';
import { useDealStore } from '../store/dealStore';
import { useContactStore } from '../store/contactStore';
import { __resetLocalCompanies } from '../services/companyService';

describe('CompanyPicker', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetLocalCompanies();
    useCompanyStore.setState({ companies: {} });
    useContactStore.setState({ contacts: [] });
    useDealStore.setState({ deals: { d: { id: 'd', company: 'Acme', contact: '', value: 1, stage: 's', probability: 0, priority: 'low', createdAt: new Date(), updatedAt: new Date() } } });
  });

  it('is exported under the legacy CompanyField name too', () => {
    expect(CompanyField).toBe(CompanyPicker);
    expect(OwnerField).toBe(OwnerPicker);
  });

  it('selects an existing company by click and reports (id, name)', async () => {
    const onChange = jest.fn();
    render(<CompanyPicker value={undefined} label="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add company/i }));
    const option = await screen.findByRole('button', { name: 'Acme' });
    await act(async () => { fireEvent.click(option); });
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^local-co-acme/), 'Acme');
  });

  it('offers create-on-type and creates the company', async () => {
    const onChange = jest.fn();
    render(<CompanyPicker label="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add company/i }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search companies' }), { target: { value: 'Zeta Labs' } });
    const create = await screen.findByRole('button', { name: /Create .Zeta Labs./ }, { timeout: 2000 });
    await act(async () => { fireEvent.click(create); });
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const [id, name] = onChange.mock.calls[0] as [string, string];
    expect(name).toBe('Zeta Labs');
    expect(useCompanyStore.getState().companies[id].name).toBe('Zeta Labs');
  });

  it('supports keyboard selection and Escape, and the compact cell variant', async () => {
    const onChange = jest.fn();
    render(<CompanyPicker variant="cell" label="Acme" onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Company: Acme' });
    fireEvent.click(trigger);
    const input = await screen.findByRole('combobox', { name: 'Search companies' });
    await screen.findByRole('button', { name: 'Acme' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const input2 = await screen.findByRole('combobox', { name: 'Search companies' });
    await screen.findByRole('button', { name: 'Acme' });
    await act(async () => { fireEvent.keyDown(input2, { key: 'Enter' }); });
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^local-co-acme/), 'Acme');
  });

  it('clears the company via "No company"', async () => {
    const onChange = jest.fn();
    render(<CompanyPicker label="Acme" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Acme/ }));
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'No company' })); });
    expect(onChange).toHaveBeenCalledWith(undefined, '');
  });
});

describe('OwnerPicker', () => {
  beforeEach(() => {
    useUserDirectoryStore.setState({ users: [{ id: 'u1', name: 'Ann' }, { id: 'u2', name: 'Bob' }], loadedAt: Date.now() });
  });

  it('shows the directory name for the id and falls back to the label', () => {
    const { rerender } = render(<OwnerPicker value="u2" onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Bob/ })).toBeInTheDocument();
    rerender(<OwnerPicker value="unknown" label="Legacy Name" onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Legacy Name/ })).toBeInTheDocument();
    rerender(<OwnerPicker onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Unassigned/ })).toBeInTheDocument();
  });

  it('chooses a user, filters by search and can unassign', async () => {
    const onChange = jest.fn();
    render(<OwnerPicker value="u1" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Ann/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search people' }), { target: { value: 'bo' } });
    const list = within(screen.getByRole('listbox'));
    expect(list.queryByRole('button', { name: 'Ann' })).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(list.getByRole('button', { name: 'Bob' })); });
    expect(onChange).toHaveBeenCalledWith('u2', 'Bob');

    fireEvent.click(screen.getByRole('button', { name: /Ann|Bob/ }));
    await act(async () => { fireEvent.click(within(screen.getByRole('listbox')).getByRole('button', { name: 'Unassigned' })); });
    expect(onChange).toHaveBeenLastCalledWith(undefined, '');
  });

  it('cell variant is labelled and keyboard operable', async () => {
    const onChange = jest.fn();
    render(<OwnerPicker variant="cell" value="u1" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Owner: Ann' }));
    const input = screen.getByRole('combobox', { name: 'Search people' });
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // Unassigned -> Ann
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // -> Bob
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(onChange).toHaveBeenCalledWith('u2', 'Bob');
  });

  it('can omit the Unassigned option', () => {
    render(<OwnerPicker value="u1" includeUnassigned={false} onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Ann/ }));
    expect(within(screen.getByRole('listbox')).queryByRole('button', { name: 'Unassigned' })).not.toBeInTheDocument();
  });
});
