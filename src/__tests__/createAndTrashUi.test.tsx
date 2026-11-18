import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import { NewDealDialog } from '../components/pipeline/NewDealDialog';
import { QuickCreateDeal } from '../components/pipeline/QuickCreateDeal';
import { DealTrashPanel } from '../components/deals/DealTrashPanel';
import { useDealStore } from '../store/dealStore';
import type { Deal, PipelineStage } from '../types';

const mk = (id: string, o: Partial<Deal> = {}): Deal => ({
  id, title: 'Acme renewal', company: 'Acme', contact: '', value: 100, stage: 'qualification', probability: 10, priority: 'low',
  createdAt: new Date(), updatedAt: new Date(), ...o,
});
const stages: PipelineStage[] = [{ id: 's', key: 'qualification', name: 'Qualification', color: 'blue', position: 0, visible: true, probability: 10 } as PipelineStage];

beforeEach(() => { useDealStore.setState({ deals: { existing: mk('existing') }, trash: {} }); });

describe('duplicate warning on create', () => {
  it('NewDealDialog lists duplicates and only creates after "Create anyway"', async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<NewDealDialog isOpen onClose={jest.fn()} stages={stages} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText('Deal title'), { target: { value: 'Acme renewal' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create deal' }));
    const region = await screen.findByRole('region', { name: 'Possible duplicates' });
    expect(region).toHaveTextContent('Same title and company');
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/deals/existing');
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create anyway' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
  });

  it('NewDealDialog creates straight away when nothing matches', async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<NewDealDialog isOpen onClose={jest.fn()} stages={stages} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText('Deal title'), { target: { value: 'Totally new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create deal' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
  });

  it('QuickCreateDeal warns then creates anyway', async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<QuickCreateDeal stageName="Qual" onCreate={onCreate} onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Deal title'), { target: { value: 'Acme renewal' } });
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    await screen.findByRole('region', { name: 'Possible duplicates' });
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create anyway' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Acme renewal', 0));
  });
});

describe('DealTrashPanel', () => {
  const trashed = () => ({
    a: mk('a', { title: 'Alpha', deletedAt: new Date() }),
    b: mk('b', { title: 'Beta', deletedAt: new Date() }),
  });

  it('select-all + bulk restore', async () => {
    useDealStore.setState({ trash: trashed() });
    render(<DealTrashPanel isOpen onClose={jest.fn()} />);
    fireEvent.click(await screen.findByLabelText('Select all deleted deals'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Restore selected/ }));
    await waitFor(() => expect(Object.keys(useDealStore.getState().trash)).toHaveLength(0));
    expect(useDealStore.getState().deals.a).toBeDefined();
    expect(useDealStore.getState().deals.b).toBeDefined();
  });

  it('permanent delete needs the typed confirmation', async () => {
    useDealStore.setState({ trash: trashed() });
    render(<DealTrashPanel isOpen onClose={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Alpha permanently' }));
    const confirm = screen.getByRole('button', { name: 'Delete permanently' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'DELETE' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(Object.keys(useDealStore.getState().trash)).toEqual(['b']));
    expect(useDealStore.getState().deals.a).toBeUndefined();
  });
});
