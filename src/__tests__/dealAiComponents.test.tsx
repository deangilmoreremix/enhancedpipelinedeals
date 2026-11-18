import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const DEAL_ID = '11111111-1111-4111-8111-111111111111';
const mockUpdateDeal = jest.fn();
const storeState: any = { deals: { [DEAL_ID]: { id: DEAL_ID, title: 'Big deal', value: 1000, probability: 20, stage: 'lead', company: 'Acme' } }, updateDeal: (...a: any[]) => mockUpdateDeal(...a), stages: [] };
jest.mock('../store/dealStore', () => ({ useDealStore: (sel: any) => sel(storeState) }));
jest.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ allowed: () => true }) }));
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {} }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));

const mockCallAI = jest.fn();
class GwErr extends Error { constructor(m: string, public status?: number) { super(m); } }
jest.mock('../services/aiClient', () => ({ callAI: (...a: any[]) => mockCallAI(...a), AIGatewayError: GwErr, authedFetch: jest.fn() }));

import { DealAssistantPanel } from '../components/deals/ai/DealAssistantPanel';
import { DealInsightsTab } from '../components/deals/ai/DealInsightsTab';
import { DealAIAssist } from '../components/deals/DealAIAssist';
import { AIGoalsButton } from '../components/ui/CustomizableAIToolbar';

const reply = (suggestions: any[], text = 'Here is my view.') => ({ data: { reply: text, suggestions }, text: '' });
const editCard = { id: 'p1', kind: 'field_edit', title: 'Raise probability', rationale: 'Demo held', field: 'probability', value: '60' };
const stepCard = { id: 'n1', kind: 'next_step', title: 'Send proposal', rationale: 'They asked', field: null, value: null };

const ask = async (text: string) => {
  fireEvent.change(screen.getByLabelText('Message the deal assistant'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /Send/ }));
};

describe('DealAssistantPanel', () => {
  beforeEach(() => { mockCallAI.mockReset(); mockUpdateDeal.mockReset(); mockUpdateDeal.mockResolvedValue({}); });

  it('renders proposals as cards and never writes until Apply is clicked', async () => {
    mockCallAI.mockResolvedValue(reply([editCard, stepCard]));
    render(<DealAssistantPanel dealId={DEAL_ID} />);
    await ask('what next?');
    await screen.findByText('Raise probability');
    expect(screen.getByText('Send proposal')).toBeInTheDocument();
    expect(mockCallAI.mock.calls[0][0]).toBe('deal_assistant');
    expect(mockCallAI.mock.calls[0][1].dealId).toBe(DEAL_ID);
    expect(mockUpdateDeal).not.toHaveBeenCalled();
    // before -> after
    expect(screen.getByText(/20/, { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));
    await screen.findByText('Applied');
    expect(mockUpdateDeal).toHaveBeenCalledTimes(1);
    expect(mockUpdateDeal).toHaveBeenCalledWith(DEAL_ID, { probability: 60 });
  });

  it('Dismiss hides a card without writing', async () => {
    mockCallAI.mockResolvedValue(reply([editCard]));
    render(<DealAssistantPanel dealId={DEAL_ID} />);
    await ask('hi');
    await screen.findByText('Raise probability');
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(screen.queryByText('Raise probability')).toBeNull();
    expect(mockUpdateDeal).not.toHaveBeenCalled();
  });

  it('shows the apply error on the card and leaves it retryable', async () => {
    mockCallAI.mockResolvedValue(reply([editCard]));
    mockUpdateDeal.mockRejectedValue(new Error('Permission denied'));
    render(<DealAssistantPanel dealId={DEAL_ID} />);
    await ask('hi');
    fireEvent.click(await screen.findByRole('button', { name: /Apply/ }));
    expect(await screen.findByText('Permission denied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply/ })).toBeEnabled();
  });

  it('degrades gracefully when the gateway is unreachable', async () => {
    mockCallAI.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<DealAssistantPanel dealId={DEAL_ID} />);
    await ask('hi');
    expect(await screen.findByRole('alert')).toHaveTextContent(/unreachable/i);
    expect(screen.getByLabelText('Message the deal assistant')).toBeEnabled();
  });

  it('sends earlier turns as conversation history', async () => {
    mockCallAI.mockResolvedValue(reply([], 'First answer'));
    render(<DealAssistantPanel dealId={DEAL_ID} />);
    await ask('first q');
    await screen.findByText('First answer');
    await ask('second q');
    await waitFor(() => expect(mockCallAI).toHaveBeenCalledTimes(2));
    expect(mockCallAI.mock.calls[1][1].input).toMatch(/User: first q[\s\S]*Assistant: First answer[\s\S]*Latest user message: second q/);
  });
});

describe('DealInsightsTab', () => {
  beforeEach(() => { mockCallAI.mockReset(); localStorage.removeItem?.(`deal-insights:${DEAL_ID}`); (localStorage.getItem as any)?.mockReset?.(); });

  it('generates real insights via deal_analyze and caches them', async () => {
    const store: Record<string, string> = {};
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(k => store[k] ?? null);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => { store[k] = String(v); });
    mockCallAI.mockResolvedValue({ data: { insights: ['Strong champion'], risks: ['No budget owner'], suggestedNextSteps: ['Book exec call'], probability: 55 }, text: '' });
    const { unmount } = render(<DealInsightsTab dealId={DEAL_ID} />);
    expect(screen.getByText(/No insights generated/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Generate insights/ }));
    await screen.findByText('Strong champion');
    expect(screen.getByText('No budget owner')).toBeInTheDocument();
    expect(mockCallAI.mock.calls[0][0]).toBe('deal_analyze');
    unmount();
    render(<DealInsightsTab dealId={DEAL_ID} />);
    expect(screen.getByText('Strong champion')).toBeInTheDocument();
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Refresh/ })).toBeInTheDocument();
    jest.restoreAllMocks();
  });

  it('shows an error and keeps the page usable when the gateway fails', async () => {
    mockCallAI.mockRejectedValue(new GwErr('boom', 429));
    render(<DealInsightsTab dealId={DEAL_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /Generate insights/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/rate limited/i);
  });
});

describe('DealAIAssist (shared service)', () => {
  beforeEach(() => mockCallAI.mockReset());
  it('summarize and next best action both use deal_analyze', async () => {
    mockCallAI.mockResolvedValue({ data: { notes: 'A summary', insights: ['k1'], suggestedNextSteps: ['Call Bob'], recommendations: ['Because'] }, text: '' });
    render(<DealAIAssist dealId={DEAL_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /Summarize deal/ }));
    await screen.findByText('A summary');
    fireEvent.click(screen.getByRole('button', { name: /Next best action/ }));
    await screen.findByText('Call Bob');
    expect(mockCallAI.mock.calls.map(c => c[0])).toEqual(['deal_analyze', 'deal_analyze']);
  });
  it('shows a clear error', async () => {
    mockCallAI.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<DealAIAssist dealId={DEAL_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /Summarize deal/ }));
    expect(await screen.findByText(/unreachable/i)).toBeInTheDocument();
  });
});

describe('AIGoalsButton', () => {
  beforeEach(() => { mockCallAI.mockReset(); jest.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());
  it('calls deal_goals (no simulation) and lists the returned goals', async () => {
    mockCallAI.mockResolvedValue({ data: { goals: [{ title: 'Book demo by Friday', rationale: 'Champion engaged' }] }, text: '' });
    render(<AIGoalsButton entityType="deal" entityId={DEAL_ID} entityData={{ title: 'Big deal' }} />);
    fireEvent.click(screen.getByRole('button', { name: /AI Goals/ }));
    await screen.findByText(/Book demo by Friday - Champion engaged/);
    expect(mockCallAI.mock.calls[0][0]).toBe('deal_goals');
    expect(mockCallAI.mock.calls[0][1].dealId).toBe(DEAL_ID);
  });
  it('shows the failure instead of fake goals', async () => {
    mockCallAI.mockRejectedValue(new Error('gateway down'));
    render(<AIGoalsButton entityType="contact" entityId="c1" entityData={{ name: 'Ada' }} />);
    fireEvent.click(screen.getByRole('button', { name: /AI Goals/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('gateway down');
    expect(screen.queryByText(/Arrange a product demo/)).toBeNull();
  });
});
