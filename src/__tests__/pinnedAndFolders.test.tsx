import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../store/dealRecordStore', () => ({ pushToast: jest.fn() }));
jest.mock('../store/dealStore', () => {
  const deals: Record<string, any> = {
    d1: { id: 'd1', title: 'Alpha', company: 'A', isFavorite: true },
    d2: { id: 'd2', title: '', company: 'Beta Co', isFavorite: true },
    d3: { id: 'd3', title: 'Gamma', company: 'G', isFavorite: false }
  };
  return { useDealStore: (sel: any) => sel({ deals }) };
});

import { PinnedDeals, PinDealButton } from '../components/pipeline/PinnedDeals';
import { FavoriteFolders } from '../components/pipeline/FavoriteFolders';
import { useDealViewPrefsStore } from '../store/dealViewPrefsStore';
import { useFavoriteFoldersStore } from '../store/favoriteFoldersStore';

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  useDealViewPrefsStore.getState().reset();
  useFavoriteFoldersStore.getState().reset();
});

describe('PinnedDeals', () => {
  it('renders nothing when empty, then shows pinned deals that open and unpin', async () => {
    const { container } = render(<><PinnedDeals /><PinDealButton dealId="d1" /></>);
    expect(screen.queryByRole('navigation', { name: 'Pinned deals' })).toBeNull();
    expect(container).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pin deal' })); });
    await act(async () => { await useDealViewPrefsStore.getState().pin('d2'); });
    const nav = screen.getByRole('navigation', { name: 'Pinned deals' });
    expect(within(nav).getByText('Alpha')).toBeInTheDocument();
    expect(within(nav).getByText('Beta Co')).toBeInTheDocument();
    fireEvent.click(within(nav).getByText('Alpha'));
    expect(mockNavigate).toHaveBeenCalledWith('/deals/d1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Unpin Alpha' })); });
    expect(within(screen.getByRole('navigation')).queryByText('Alpha')).toBeNull();
    expect(screen.getByRole('button', { name: 'Pin deal' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('uses a custom onOpenDeal', async () => {
    const onOpen = jest.fn();
    render(<PinnedDeals onOpenDeal={onOpen} />);
    await act(async () => { await useDealViewPrefsStore.getState().pin('d3'); });
    fireEvent.click(screen.getByText('Gamma'));
    expect(onOpen).toHaveBeenCalledWith('d3');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('FavoriteFolders', () => {
  const openPanel = async () => {
    render(<FavoriteFolders />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Favorite folders' })); });
  };

  it('lists favorite deals under the Favorites root and opens them', async () => {
    await openPanel();
    const root = screen.getByRole('list', { name: 'Favorites' });
    expect(within(root).getByText('Alpha')).toBeInTheDocument();
    expect(within(root).getByText('Beta Co')).toBeInTheDocument();
    expect(within(root).queryByText('Gamma')).toBeNull();
    fireEvent.click(within(root).getByText('Alpha'));
    expect(mockNavigate).toHaveBeenCalledWith('/deals/d1');
  });

  it('creates, renames, fills, and deletes a folder', async () => {
    await openPanel();
    fireEvent.change(screen.getByLabelText('New folder name'), { target: { value: 'Hot leads' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Add/ })); });
    const folder = await screen.findByRole('region', { name: 'Folder Hot leads' });

    await act(async () => { fireEvent.click(within(folder).getByRole('button', { name: 'Rename folder Hot leads' })); });
    fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'Warm' } });
    await act(async () => { fireEvent.submit(screen.getByLabelText('Folder name').closest('form')!); });
    await screen.findByRole('region', { name: 'Folder Warm' });

    const id = useFavoriteFoldersStore.getState().folders[0].id;
    await act(async () => { await useFavoriteFoldersStore.getState().addDeal(id, 'd1'); });
    const list = within(screen.getByRole('region', { name: 'Folder Warm' })).getByRole('list', { name: 'Deals in Warm' });
    expect(within(list).getByText('Alpha')).toBeInTheDocument();
    await act(async () => { fireEvent.click(within(list).getByRole('button', { name: 'Remove Alpha from folder' })); });
    expect(useFavoriteFoldersStore.getState().folders[0].dealIds).toEqual([]);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete folder Warm' })); });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Folder Warm' })).toBeNull());
  });

  it('closes on Escape', async () => {
    await openPanel();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
