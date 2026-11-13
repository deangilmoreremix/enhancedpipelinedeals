import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mockNavigate = jest.fn();
const mockToggleDark = jest.fn();
const mockSearchDeals = jest.fn();
const mockSearchContacts = jest.fn();
let mockDemo = true;

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ toggleDarkMode: mockToggleDark }) }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => mockDemo }));
jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/dealSearchService', () => ({ searchDeals: (...a: unknown[]) => mockSearchDeals(...a) }));
jest.mock('../services/semanticSearchService', () => ({ searchContacts: (...a: unknown[]) => mockSearchContacts(...a) }));
jest.mock('../store/contactStore', () => {
  const contacts = [
    { id: 'c1', name: 'Alice Johnson', email: 'alice@example.com', company: 'Initech', title: 'CTO' },
    { id: 'c2', name: 'Bob Stone', email: 'bob@acme.io', company: 'Acme', title: 'CEO' }
  ];
  return { useContactStore: (sel: (s: { contacts: typeof contacts }) => unknown) => sel({ contacts }) };
});

import { CommandPalette, openCommandPalette } from '../components/CommandPalette';
import { useBoardViewStore } from '../store/boardViewStore';

const openPalette = () => act(() => { openCommandPalette(); });
const input = () => screen.getByRole('combobox');
const options = () => screen.getAllByRole('option');
const selected = () => options().find(o => o.getAttribute('aria-selected') === 'true');

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDemo = true;
    mockSearchDeals.mockResolvedValue([]);
    mockSearchContacts.mockResolvedValue([]);
    useBoardViewStore.getState().reset();
  });

  it('is hidden until the shortcut event fires, then shows an accessible combobox + listbox', () => {
    render(<CommandPalette />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openPalette();
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toHaveAttribute('aria-modal', 'true');
    expect(input()).toHaveFocus();
    expect(input()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
    expect(within(screen.getByRole('listbox')).getByRole('group', { name: 'Actions' })).toBeInTheDocument();
    expect(options().length).toBeGreaterThan(5);
    expect(input().getAttribute('aria-activedescendant')).toBe(selected()!.id);
  });

  it('moves the highlight with ArrowDown / ArrowUp (wrapping) and Home / End', () => {
    render(<CommandPalette />);
    openPalette();
    const count = options().length;
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(options()[count - 1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input(), { key: 'End' });
    expect(options()[count - 1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input(), { key: 'Home' });
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('filters actions as you type and runs the highlighted one on Enter', () => {
    render(<CommandPalette />);
    openPalette();
    fireEvent.change(input(), { target: { value: 'new deal' } });
    expect(options().map(o => o.textContent)).toEqual([expect.stringContaining('New deal')]);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(useBoardViewStore.getState().pendingAction).toBe('new-deal');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates, toggles dark mode and clears filters from actions', () => {
    render(<CommandPalette />);
    openPalette();
    fireEvent.change(input(), { target: { value: 'analytics' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/analytics');

    openPalette();
    fireEvent.change(input(), { target: { value: 'dark mode' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(mockToggleDark).toHaveBeenCalledTimes(1);

    useBoardViewStore.getState().setFavoritesOnly(true);
    openPalette();
    fireEvent.change(input(), { target: { value: 'clear filters' } });
    fireEvent.click(options()[0]);
    expect(useBoardViewStore.getState().favoritesOnly).toBe(false);
  });

  it('closes on Escape and returns focus to the previously focused element', async () => {
    render(<><button>before</button><CommandPalette /></>);
    const before = screen.getByText('before');
    before.focus();
    openPalette();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(before).toHaveFocus());
  });

  it('keeps focus inside the dialog on Tab', () => {
    render(<CommandPalette />);
    openPalette();
    const tab = fireEvent.keyDown(input(), { key: 'Tab' });
    expect(tab).toBe(false); // default prevented
    expect(input()).toHaveFocus();
  });

  it('shows deal search results and opens the deal record', async () => {
    mockSearchDeals.mockResolvedValue([{ id: 'd1', title: 'Acme renewal', company: 'Acme', contact: 'Bob', value: 12000 }]);
    render(<CommandPalette />);
    openPalette();
    fireEvent.change(input(), { target: { value: 'acme' } });
    const deal = await screen.findByRole('option', { name: /Acme renewal/ });
    expect(within(screen.getByRole('listbox')).getByRole('group', { name: 'Deals' })).toContainElement(deal);
    expect(mockSearchDeals).toHaveBeenCalledWith('acme', 6);
    // deals come first, so the first row is selected
    expect(deal).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/deals/d1');
  });

  it('lists matching contacts and goes to /contacts', async () => {
    render(<CommandPalette />);
    openPalette();
    fireEvent.change(input(), { target: { value: 'alice' } });
    const contact = await screen.findByRole('option', { name: /Alice Johnson/ });
    expect(within(screen.getByRole('listbox')).getByRole('group', { name: 'Contacts' })).toContainElement(contact);
    expect(screen.queryByRole('option', { name: /Bob Stone/ })).not.toBeInTheDocument();
    fireEvent.click(contact);
    expect(mockNavigate).toHaveBeenCalledWith('/contacts');
    expect(mockSearchContacts).not.toHaveBeenCalled(); // demo mode: no semantic gateway
  });

  it('adds semantic contact matches when not in demo mode', async () => {
    mockDemo = false;
    mockSearchContacts.mockResolvedValue([{ contact_id: 'c2', content: '', similarity: 0.9 }]);
    render(<CommandPalette />);
    openPalette();
    fireEvent.change(input(), { target: { value: 'chief executive' } });
    expect(await screen.findByRole('option', { name: /Bob Stone/ })).toBeInTheDocument();
    expect(mockSearchContacts).toHaveBeenCalledWith('chief executive', 5);
  });

  it('shows an empty state when nothing matches', () => {
    render(<CommandPalette />);
    openPalette();
    fireEvent.change(input(), { target: { value: 'qqqqzzzz' } });
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    fireEvent.keyDown(input(), { key: 'Enter' }); // no-op, must not throw
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
