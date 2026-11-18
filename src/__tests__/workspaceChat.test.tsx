import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

class MockGatewayError extends Error { constructor(m: string, public status?: number) { super(m); } }
const mockCallAI = jest.fn() as jest.Mock<(...a: any[]) => Promise<any>>;
jest.mock('../services/aiClient', () => ({ callAI: (...a: unknown[]) => (mockCallAI as any)(...a), AIGatewayError: MockGatewayError }));

let allow = true;
jest.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => (allow ? { allowed: true, reason: '' } : { allowed: false, reason: 'Your viewer role cannot edit deals' }) }),
}));

import { WorkspaceChat } from '../components/ai/WorkspaceChat';
import { useWorkspaceChatStore } from '../store/workspaceChatStore';
import { useDealStore } from '../store/dealStore';
import { __resetUndo, __setUndoAutoHost, useUndoStore } from '../services/undoService';
import { chatErrorMessage, normalizeProposals, patchToUpdates } from '../services/workspaceChatService';
import type { Deal } from '../types';

const deal = (id: string, over: Partial<Deal> = {}): Deal => ({
  id, title: 'Acme Renewal', company: 'Acme', contact: 'X', value: 100, stage: 'proposal', probability: 10, priority: 'medium',
  createdAt: new Date(), updatedAt: new Date(), position: 1, ...over,
});

const reply = (proposals: unknown[]) => ({ ok: true, data: { reply: 'Here is **what** I found:\n- one\n- two', proposals }, text: '' });

describe('WorkspaceChat', () => {
  const moveDeal = jest.fn(async () => true);
  const updateDeal = jest.fn(async (id: string, u: Partial<Deal>) => ({ ...deal(id), ...u }));
  const bulkUpdateDeals = jest.fn(async (ids: string[]) => ids);

  beforeEach(() => {
    jest.clearAllMocks();
    allow = true;
    __setUndoAutoHost(false);
    __resetUndo();
    useWorkspaceChatStore.setState({ open: true, messages: [], pending: false, states: {} });
    useDealStore.setState({
      deals: { d1: deal('d1', { priority: 'low' }) },
      stages: [{ key: 'proposal', name: 'Proposal' }, { key: 'negotiation', name: 'Negotiation' }] as any,
      moveDeal, updateDeal, bulkUpdateDeals,
    } as any);
  });

  const ask = async (text = 'what is stuck?') => {
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: text } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send message' })); });
  };

  it('sends history through the workspace_chat task and renders markdown-lite plus proposal cards', async () => {
    mockCallAI.mockResolvedValueOnce(reply([{ id: 'p1', kind: 'move_deal', dealId: 'd1', stage: 'negotiation', reason: 'Quote accepted' }]));
    render(<WorkspaceChat />);
    await ask();
    expect(mockCallAI).toHaveBeenCalledWith('workspace_chat', expect.objectContaining({ messages: [{ role: 'user', content: 'what is stuck?' }] }));
    expect(await screen.findByText('what')).toBeInTheDocument(); // bold segment
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(2);
    expect(screen.getByText('Move Acme Renewal to Negotiation')).toBeInTheDocument();
    expect(screen.getByText('Quote accepted')).toBeInTheDocument();
    expect(moveDeal).not.toHaveBeenCalled(); // never auto-applies
  });

  it('Apply moves the deal and registers an Undo entry; the card cannot be applied twice', async () => {
    mockCallAI.mockResolvedValueOnce(reply([{ id: 'p1', kind: 'move_deal', dealId: 'd1', stage: 'negotiation', reason: 'r' }]));
    render(<WorkspaceChat />);
    await ask();
    await screen.findByText('Move Acme Renewal to Negotiation');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply' })); });
    expect(moveDeal).toHaveBeenCalledWith('d1', 'negotiation', expect.any(Number));
    await waitFor(() => expect(screen.getByText(/Moved Acme Renewal to Negotiation/)).toBeInTheDocument());
    expect(useUndoStore.getState().entries.some(e => e.undo)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('Apply of an update proposal captures the previous value for Undo', async () => {
    mockCallAI.mockResolvedValueOnce(reply([{ id: 'u1', kind: 'update_deal', dealId: 'd1', patch: { priority: 'high', value: null }, reason: 'Hot' }]));
    render(<WorkspaceChat />);
    await ask();
    await screen.findByText(/Update Acme Renewal: priority to high/);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply' })); });
    expect(updateDeal).toHaveBeenCalledWith('d1', { priority: 'high' });
    await act(async () => { await useUndoStore.getState().entries[0].undo!(); });
    expect(bulkUpdateDeals).toHaveBeenCalledWith(['d1'], { priority: 'low' });
  });

  it('Dismiss never applies', async () => {
    mockCallAI.mockResolvedValueOnce(reply([{ id: 'p1', kind: 'move_deal', dealId: 'd1', stage: 'negotiation', reason: 'r' }]));
    render(<WorkspaceChat />);
    await ask();
    await screen.findByText('Move Acme Renewal to Negotiation');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(moveDeal).not.toHaveBeenCalled();
    expect(useUndoStore.getState().entries).toHaveLength(0);
  });

  it('Apply all applies each pending proposal in order', async () => {
    useDealStore.setState({ deals: { d1: deal('d1'), d2: deal('d2', { title: 'Beta' }) } } as any);
    mockCallAI.mockResolvedValueOnce(reply([
      { id: 'a', kind: 'move_deal', dealId: 'd1', stage: 'negotiation', reason: 'r' },
      { id: 'b', kind: 'move_deal', dealId: 'd2', stage: 'negotiation', reason: 'r' },
    ]));
    render(<WorkspaceChat />);
    await ask();
    await screen.findByText('Move Beta to Negotiation');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply all' })); });
    expect(moveDeal).toHaveBeenCalledTimes(2);
  });

  it('respects permissions: a denied apply shows the reason and changes nothing', async () => {
    allow = false;
    mockCallAI.mockResolvedValueOnce(reply([{ id: 'p1', kind: 'move_deal', dealId: 'd1', stage: 'negotiation', reason: 'r' }]));
    render(<WorkspaceChat />);
    await ask();
    await screen.findByText('Move Acme Renewal to Negotiation');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply' })); });
    expect(await screen.findByText('Your viewer role cannot edit deals')).toBeInTheDocument();
    expect(moveDeal).not.toHaveBeenCalled();
  });

  it('shows explicit gateway-down and auth errors, and Clear empties the conversation', async () => {
    mockCallAI.mockRejectedValueOnce(new MockGatewayError('nope', 503));
    render(<WorkspaceChat />);
    await ask();
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i);
    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useWorkspaceChatStore.getState().messages).toHaveLength(0);
  });

  it('sets context.dealId when a deal route is open', async () => {
    window.history.pushState({}, '', '/deals/d1');
    mockCallAI.mockResolvedValueOnce(reply([]));
    render(<WorkspaceChat />);
    expect(await screen.findByText(/Context: Acme Renewal/)).toBeInTheDocument();
    await ask();
    expect(mockCallAI).toHaveBeenCalledWith('workspace_chat', expect.objectContaining({ context: { dealId: 'd1' } }));
    window.history.pushState({}, '', '/');
  });
});

describe('workspaceChatService helpers', () => {
  it('drops malformed proposals and de-duplicates ids', () => {
    const out = normalizeProposals([{ id: 'x', kind: 'move_deal', dealId: 'd' }, { id: 'x', kind: 'create_note', dealId: 'd' }, { kind: 'delete_everything', dealId: 'd' }, { kind: 'move_deal' }, null]);
    expect(out.map(p => p.id)).toEqual(['x', 'x_1']);
  });
  it('maps patches to deal updates and ignores invalid values', () => {
    const { updates, ignored } = patchToUpdates({ value: '5000', probability: 150, priority: 'urgent', due_date: '2026-05-01', title: null, bogus: 1 });
    expect(updates.value).toBe(5000);
    expect(updates.dueDate).toBeInstanceOf(Date);
    expect(ignored.sort()).toEqual(['bogus', 'priority', 'probability']);
  });
  it('maps gateway errors to explicit messages', () => {
    expect(chatErrorMessage(new MockGatewayError('x', 401))).toMatch(/sign/i);
    expect(chatErrorMessage(new MockGatewayError('x', 429))).toMatch(/rate/i);
    expect(chatErrorMessage(new TypeError('fetch failed'))).toMatch(/reach/i);
  });
});
