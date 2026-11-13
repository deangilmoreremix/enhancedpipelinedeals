import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockFetchDeals = jest.fn();

jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({ update: (row: unknown) => { mockUpdate(row); return { eq: (...a: unknown[]) => mockEq(...a) }; } }),
  },
}));
jest.mock('../services/dealRecordShared', () => ({
  canUseRemote: () => true,
  isUuid: () => true,
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
}));
jest.mock('../store/dealStore', () => {
  const state = {
    stages: [
      { key: 'qualification', name: 'Qualification', color: 'blue', position: 0, visible: true },
      { key: 'proposal', name: 'Proposal', color: 'indigo', position: 1, visible: true },
    ],
    fetchDeals: (...a: unknown[]) => mockFetchDeals(...a),
    updateDeal: jest.fn(),
    softDeleteDeal: jest.fn(),
  };
  const useDealStore: any = (sel: (s: typeof state) => unknown) => sel(state);
  useDealStore.getState = () => state;
  return { useDealStore };
});

import { MergeDealsModal } from '../components/deals/MergeDealsModal';
import type { Deal } from '../types';

const mk = (id: string, over: Partial<Deal>): Deal => ({
  id, title: 'Acme renewal', company: 'Acme', contact: 'Jane', value: 1000, stage: 'qualification',
  probability: 10, priority: 'low', createdAt: new Date(), updatedAt: new Date(), ...over,
});
const a = mk('a', { value: 1000, stage: 'qualification', priority: 'low', notes: 'note A' });
const b = mk('b', { title: 'ACME renewal', value: 5000, stage: 'proposal', priority: 'high', notes: 'note B' });

describe('MergeDealsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    mockEq.mockResolvedValue({ error: null });
  });

  it('flags the duplicate, shows conflicts and requires 2+ deals', () => {
    render(<MergeDealsModal isOpen onClose={jest.fn()} deals={[a, b]} initialIds={['a']} />);
    expect(screen.getByText('Possible duplicate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Merge/ })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Select ACME renewal'));
    expect(screen.getByRole('button', { name: /Merge 2 deals/ })).toBeEnabled();
  });

  it('applies the chosen field values to the survivor and calls merge_deals', async () => {
    const onMerged = jest.fn();
    const onClose = jest.fn();
    render(<MergeDealsModal isOpen onClose={onClose} deals={[a, b]} initialIds={['a', 'b']} onMerged={onMerged} />);

    // Conflicts: title (case/spacing), value, stage, priority, notes
    expect(screen.getByText('Title', { selector: 'legend' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Value: $5,000'));
    fireEvent.click(screen.getByLabelText('Priority: high'));
    fireEvent.click(screen.getByLabelText('Notes: combine all'));

    fireEvent.click(screen.getByRole('button', { name: /Merge 2 deals/ }));

    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('merge_deals', expect.objectContaining({ keep: 'a', merge_ids: ['b'] })));
    // Survivor fields travel inside the RPC (atomic) - no separate deals.update
    expect(mockUpdate).not.toHaveBeenCalled();
    const row = (mockRpc.mock.calls[0][1] as { p_fields: Record<string, unknown> }).p_fields;
    expect(row).toMatchObject({ value: 5000, amount_micros: 5_000_000_000, priority: 'high' });
    expect(row.notes).toBe('note A\n\n---\n\nnote B');
    expect(row).not.toHaveProperty('stage'); // survivor's stage kept (no choice made)
    await waitFor(() => expect(mockFetchDeals).toHaveBeenCalled());
    expect(onMerged).toHaveBeenCalledWith('a');
    expect(onClose).toHaveBeenCalled();
  });

  it('lets the user pick a different survivor', async () => {
    render(<MergeDealsModal isOpen onClose={jest.fn()} deals={[a, b]} initialIds={['a', 'b']} />);
    fireEvent.click(screen.getByLabelText('Keep ACME renewal'));
    fireEvent.click(screen.getByLabelText('Value: $1,000'));
    fireEvent.click(screen.getByRole('button', { name: /Merge 2 deals/ }));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('merge_deals', expect.objectContaining({ keep: 'b', merge_ids: ['a'] })));
    expect((mockRpc.mock.calls[0][1] as { p_fields: unknown }).p_fields).toMatchObject({ value: 1000, amount_micros: 1_000_000_000 });
  });

  it('shows an error and stays open when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: new Error('rpc failed') });
    const onClose = jest.fn();
    render(<MergeDealsModal isOpen onClose={onClose} deals={[a, b]} initialIds={['a', 'b']} />);
    fireEvent.click(screen.getByRole('button', { name: /Merge 2 deals/ }));
    expect(await screen.findByText('rpc failed')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
