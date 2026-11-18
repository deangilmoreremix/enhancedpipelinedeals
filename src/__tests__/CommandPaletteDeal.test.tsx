import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mockNavigate = jest.fn();
let mockAllowed = (_a: string) => true;
const mockBulkMove = jest.fn(async (ids: string[]) => ids);
const mockSoftDelete = jest.fn(async () => undefined);
const mockClone = jest.fn(async (_id: string, _o?: unknown) => 'new-1');
const mockToggleFav = jest.fn(async () => true);
const mockPush = jest.fn();
const deal = { id: 'd1', title: 'Big Deal', company: 'Acme', companyId: 'co1', contact: 'Al', contactId: 'ct1', stage: 'qualification', value: 5, isFavorite: false };
const stages = [
  { key: 'qualification', name: 'Qualification', visible: true },
  { key: 'proposal', name: 'Proposal', visible: true },
  { key: 'hidden', name: 'Hidden', visible: false }
];

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ toggleDarkMode: jest.fn() }) }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/dealSearchService', () => ({ searchDeals: async () => [] }));
jest.mock('../services/semanticSearchService', () => ({ searchContacts: async () => [] }));
jest.mock('../store/contactStore', () => ({ useContactStore: (sel: any) => sel({ contacts: [] }) }));
jest.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ allowed: (a: string) => mockAllowed(a) }) }));
jest.mock('../store/dealRecordStore', () => ({ pushToast: (...a: unknown[]) => mockPush(...a) }));
jest.mock('../services/favoritesService', () => ({ toggleFavorite: (...a: unknown[]) => (mockToggleFav as any)(...a) }));
jest.mock('../store/dealViewPrefsStore', () => {
  const state = { pinned: new Set<string>() };
  const api = {
    getPrefs: async () => ({}),
    isPinned: (id: string) => state.pinned.has(id),
    pin: async (id: string) => { state.pinned.add(id); },
    unpin: async (id: string) => { state.pinned.delete(id); }
  };
  return { useDealViewPrefsStore: { getState: () => api } };
});
jest.mock('../store/dealStore', () => {
  const store = {
    deals: { d1: deal },
    stages,
    error: null,
    bulkMoveDeals: (...a: unknown[]) => (mockBulkMove as any)(...a),
    softDeleteDeal: (...a: unknown[]) => (mockSoftDelete as any)(...a),
    cloneDeal: (...a: unknown[]) => (mockClone as any)(...a)
  };
  return { useDealStore: { getState: () => store, subscribe: () => () => undefined } };
});

import { CommandPalette, openCommandPalette, setCommandContext, onDealRecordAction, DealRecordActionDetail } from '../components/CommandPalette';

const openPalette = async () => { await act(async () => { openCommandPalette(); }); };
const labels = () => screen.getAllByRole('option').map(o => o.textContent ?? '');
const input = () => screen.getByRole('combobox');
const pick = async (name: RegExp) => { await act(async () => { fireEvent.click(screen.getByRole('option', { name })); }); };

describe('CommandPalette: record-aware group', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllowed = () => true;
    act(() => setCommandContext(null));
    window.history.pushState({}, '', '/');
  });

  it('shows no deal group without a current deal', async () => {
    render(<CommandPalette />);
    await openPalette();
    expect(screen.queryByRole('group', { name: 'This deal' })).toBeNull();
  });

  it('lists the "This deal" group first when a command context is set', async () => {
    act(() => setCommandContext({ dealId: 'd1' }));
    render(<CommandPalette />);
    await openPalette();
    await waitFor(() => expect(screen.getByRole('group', { name: 'This deal' })).toBeInTheDocument());
    const groups = screen.getAllByRole('group').map(g => g.getAttribute('aria-label'));
    expect(groups[0]).toBe('This deal');
    const inGroup = within(screen.getByRole('group', { name: 'This deal' })).getAllByRole('option').map(o => o.textContent);
    ['Change stage…', 'Add note', 'Add task', 'Toggle favorite', 'Duplicate deal', 'Merge duplicates', 'Find duplicates', 'Run workflow…', 'Open contact', 'Open company', 'Delete deal…', 'Copy link']
      .forEach(l => expect(inGroup.some(t => t!.startsWith(l))).toBe(true));
  });

  it('detects /deals/:id from the route when the palette opens', async () => {
    window.history.pushState({}, '', '/deals/d1');
    render(<CommandPalette />);
    await openPalette();
    await waitFor(() => expect(screen.getByRole('group', { name: 'This deal' })).toBeInTheDocument());
  });

  it('dispatches typed deal-record:action events', async () => {
    act(() => setCommandContext({ dealId: 'd1' }));
    const seen: DealRecordActionDetail[] = [];
    const off = onDealRecordAction(d => seen.push(d));
    render(<CommandPalette />);
    await openPalette();
    await pick(/^Add note/);
    expect(seen).toEqual([{ action: 'add-note', dealId: 'd1' }]);
    await openPalette();
    await pick(/^Run workflow/);
    expect(seen[1]).toEqual({ action: 'run-workflow', dealId: 'd1' });
    off();
  });

  it('changes stage through a data-driven sub-picker (Esc goes back first)', async () => {
    act(() => setCommandContext({ dealId: 'd1' }));
    render(<CommandPalette />);
    await openPalette();
    await pick(/^Change stage/);
    expect(labels().map(l => l.replace('Current stage', ''))).toEqual(['Qualification', 'Proposal']);
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument(); // back to root, still open
    await pick(/^Change stage/);
    await pick(/^Proposal/);
    expect(mockBulkMove).toHaveBeenCalledWith(['d1'], 'proposal');
    expect(mockPush).toHaveBeenCalledWith('success', 'Moved to Proposal');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('requires a confirm step to delete', async () => {
    act(() => setCommandContext({ dealId: 'd1' }));
    render(<CommandPalette />);
    await openPalette();
    await pick(/^Delete deal/);
    expect(mockSoftDelete).not.toHaveBeenCalled();
    await pick(/^Delete "Big Deal"/);
    expect(mockSoftDelete).toHaveBeenCalledWith('d1');
  });

  it('performs favorite / duplicate / contact / company directly', async () => {
    act(() => setCommandContext({ dealId: 'd1' }));
    render(<CommandPalette />);
    await openPalette(); await pick(/^Toggle favorite/);
    expect(mockToggleFav).toHaveBeenCalledWith('deal', 'd1');
    await openPalette(); await pick(/^Duplicate deal/);
    expect(mockClone).toHaveBeenCalledWith('d1', { includeRelated: true });
    expect(mockNavigate).toHaveBeenCalledWith('/deals/new-1');
    await openPalette(); await pick(/^Open contact/);
    expect(mockNavigate).toHaveBeenCalledWith('/contacts/ct1');
    await openPalette(); await pick(/^Open company/);
    expect(mockNavigate).toHaveBeenCalledWith('/companies/co1');
  });

  it('hides actions the user lacks permission for and filters by query', async () => {
    mockAllowed = a => a === 'view';
    act(() => setCommandContext({ dealId: 'd1' }));
    render(<CommandPalette />);
    await openPalette();
    await waitFor(() => expect(screen.getByRole('group', { name: 'This deal' })).toBeInTheDocument());
    const t = labels().join('|');
    expect(t).not.toMatch(/Delete deal/);
    expect(t).not.toMatch(/Add note/);
    expect(t).toMatch(/Find duplicates/);
    fireEvent.change(input(), { target: { value: 'copy link' } });
    expect(within(screen.getByRole('group', { name: 'This deal' })).getAllByRole('option')).toHaveLength(1);
  });
});
