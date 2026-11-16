import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import { CustomFieldsSection } from '../components/deals/fields/CustomFieldsSection';
import { SystemFieldsPanel } from '../components/deals/fields/SystemFieldsPanel';
import { ManageFieldsDialog } from '../components/deals/fields/ManageFieldsDialog';
import { CloneDealDialog } from '../components/deals/fields/CloneDealDialog';
import { DealDetailOverview } from '../components/DealDetailView/DealDetailOverview';
import { __resetDefinitionCache, createFieldDefinition } from '../services/customFieldService';
import { __resetLocalFieldChanges, getLocalFieldChangeRows } from '../services/timelineAdapter';
import { useDealStore } from '../store/dealStore';
import type { Deal } from '../types';

const deal = (o: Partial<Deal> = {}): Deal => ({
  id: 'deal-1', title: 'Acme', company: 'Acme', contact: '', value: 40000, stage: 'qualification', probability: 10, priority: 'low',
  createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 2), ...o,
});

beforeEach(() => { localStorage.clear(); __resetDefinitionCache(); __resetLocalFieldChanges(); });

describe('CustomFieldsSection', () => {
  it('shows fields grouped, hides groups and saves typed values into customFields', async () => {
    await createFieldDefinition({ label: 'Website', type: 'link', groupName: 'Web' });
    await createFieldDefinition({ label: 'Tier', type: 'select', options: ['Gold', 'Silver'] });
    await createFieldDefinition({ label: 'Fit', type: 'rating' });
    await createFieldDefinition({ label: 'Tags', type: 'multi_select', options: ['x', 'y'] });
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    const { rerender } = render(<CustomFieldsSection deal={deal({ customFields: { tier: 'Gold' } })} onUpdateDeal={onUpdate} />);
    await screen.findByRole('group', { name: 'Web' });
    expect(screen.getByRole('group', { name: 'General' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ customFields: { tier: 'Gold', fit: 4 } }));

    fireEvent.click(screen.getByText('Empty', { selector: 'button span' }));
    fireEvent.click(screen.getByLabelText('y'));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(onUpdate).toHaveBeenLastCalledWith({ customFields: { tier: 'Gold', tags: ['y'] } }));

    rerender(<CustomFieldsSection deal={deal()} onUpdateDeal={onUpdate} hiddenGroups={['Web']} />);
    expect(screen.queryByRole('group', { name: 'Web' })).toBeNull();
  });

  it('rejects an invalid link inline without saving', async () => {
    await createFieldDefinition({ label: 'Website', type: 'link' });
    const onUpdate = jest.fn();
    render(<CustomFieldsSection deal={deal()} onUpdateDeal={onUpdate} />);
    fireEvent.click(await screen.findByTitle('Click to edit'));
    const input = screen.getByLabelText('Website');
    fireEvent.change(input, { target: { value: 'not a url' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByRole('alert')).toHaveTextContent('valid URL');
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('ManageFieldsDialog', () => {
  it('adds, deactivates and reorders fields', async () => {
    render(<ManageFieldsDialog isOpen onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('New field name'), { target: { value: 'Budget' } });
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'number' } });
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }));
    await screen.findByText('Budget');
    fireEvent.change(screen.getByLabelText('New field name'), { target: { value: 'Region' } });
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }));
    await screen.findByText('Region');
    fireEvent.click(screen.getByRole('button', { name: 'Move Region up' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Region'));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Budget' }));
    await screen.findByText('(inactive)');
  });

  it('validates select options', async () => {
    render(<ManageFieldsDialog isOpen onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('New field name'), { target: { value: 'Tier' } });
    fireEvent.change(screen.getByLabelText('Field type'), { target: { value: 'select' } });
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at least one option');
  });
});

describe('SystemFieldsPanel', () => {
  it('shows read-only fields and copies the id', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SystemFieldsPanel deal={deal({ id: 'abc-123', createdBy: 'u9', workspaceId: 'w1' })} />);
    expect(screen.getByText('abc-123')).toBeInTheDocument();
    expect(screen.getByText('u9')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByLabelText('Copy deal ID'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('abc-123'));
  });
});

describe('CloneDealDialog', () => {
  it('clones with the include option and reports the new id', async () => {
    useDealStore.setState({ deals: { 'deal-1': deal() } });
    const spy = jest.spyOn(useDealStore.getState(), 'cloneDeal');
    const onCloned = jest.fn();
    const onClose = jest.fn();
    render(<CloneDealDialog dealId="deal-1" open onClose={onClose} onCloned={onCloned} />);
    fireEvent.click(screen.getByLabelText('Include notes and tasks'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Duplicate$/ })); });
    await waitFor(() => expect(onCloned).toHaveBeenCalledTimes(1));
    expect(Object.values(useDealStore.getState().deals).map(d => d.title)).toContain('Acme (copy)');
    expect(onClose).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('DealDetailOverview', () => {
  it('mounts the sections, hides groups via props and logs local field edits', async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    const toggle = jest.fn();
    const d = deal();
    const ui = (hidden: string[]) => <MemoryRouter><DealDetailOverview deal={d} editedDeal={d} linkedContact={null} onUpdateDeal={onUpdate} hiddenFieldGroups={hidden} onToggleFieldGroup={toggle} /></MemoryRouter>;
    const { rerender } = render(ui([]));
    expect(screen.getByRole('button', { name: /Manage fields/ })).toBeInTheDocument();
    expect(screen.getByLabelText('System fields', { selector: 'section' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Show\/hide groups/ }));
    fireEvent.click(screen.getByLabelText('System fields', { selector: 'input' }));
    expect(toggle).toHaveBeenCalledWith('System fields');
    rerender(ui(['System fields']));
    expect(screen.queryByLabelText('System fields', { selector: 'section' })).toBeNull();

    fireEvent.click(screen.getAllByTitle('Click to edit')[0]);
    const input = screen.getByLabelText('Title');
    fireEvent.change(input, { target: { value: 'Acme 2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ title: 'Acme 2' }));
    await waitFor(() => expect(getLocalFieldChangeRows('deal-1')).toHaveLength(1));
    expect(getLocalFieldChangeRows('deal-1')[0].metadata).toMatchObject({ field: 'title', from: 'Acme', to: 'Acme 2' });
  });
});
