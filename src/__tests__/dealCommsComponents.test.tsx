import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockLoad = jest.fn();
const mockQueue = jest.fn();
const mockCompose = jest.fn();
jest.mock('../services/dealCommunicationService', () => {
  const actual = jest.requireActual('../services/dealCommunicationService');
  return { ...actual, loadDealCommunications: (...a: any[]) => mockLoad(...a), queueEmail: (...a: any[]) => mockQueue(...a), composeEmailDraft: (...a: any[]) => mockCompose(...a) };
});
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {} }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));
jest.mock('../services/aiClient', () => ({ authedFetch: jest.fn(), callAI: jest.fn() }));

import { DealCommunicationHub } from '../components/DealCommunicationHub';
import { EmailComposer } from '../components/EmailComposer';

const deal: any = { id: '11111111-1111-4111-8111-111111111111', title: 'Big deal', company: 'Acme', contactId: 'c1' };
const contact: any = { id: 'c1', name: 'Ada Lovelace', firstName: 'Ada', email: 'ada@acme.com' };

const thread = {
  id: 'thread:t1', channel: 'email', direction: null, subject: 'Pricing', preview: 'Thanks', at: '2026-01-05T10:00:00Z', status: 'active',
  participants: ['ada@acme.com'], messageCount: 2, source: 'email_thread', threadId: 't1',
  messages: [{ id: 'm1', from: 'ada@acme.com', at: '2026-01-05T10:00:00Z', body: 'Can you send pricing?' }],
};
const call = { id: 'record:r1', channel: 'call', direction: 'outbound', subject: 'Discovery call', preview: 'Went well', at: '2026-01-04T10:00:00Z', status: 'completed', participants: [], messages: [], messageCount: 1, durationLabel: '15:32', source: 'communication_record' };
const queued = { id: 'outbound:o1', channel: 'email', direction: 'outbound', subject: 'Follow up', preview: 'Hi', at: '2026-01-06T10:00:00Z', status: 'queued', participants: ['ada@acme.com'], messages: [{ id: 'o1', at: '2026-01-06T10:00:00Z', body: 'Hi' }], messageCount: 1, source: 'outbound_message' };

describe('DealCommunicationHub', () => {
  beforeEach(() => { mockLoad.mockReset(); mockQueue.mockReset(); mockCompose.mockReset(); localStorage.clear?.(); });

  it('shows real entries, filters by channel and expands a thread', async () => {
    mockLoad.mockResolvedValue({ entries: [queued, thread, call], errors: [], sample: false });
    render(<DealCommunicationHub deal={deal} contact={contact} />);
    await screen.findByText('Pricing');
    expect(screen.getAllByTestId('comm-entry')).toHaveLength(3);
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ dealId: deal.id, contactId: 'c1' }));

    fireEvent.click(screen.getByRole('tab', { name: /Calls/ }));
    expect(screen.getAllByTestId('comm-entry')).toHaveLength(1);
    expect(screen.getByText('Discovery call')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Email/ }));
    fireEvent.click(screen.getByText('Pricing'));
    expect(screen.getByText('Can you send pricing?')).toBeInTheDocument();
  });

  it('shows per-channel empty states and no mock data', async () => {
    mockLoad.mockResolvedValue({ entries: [], errors: [], sample: false });
    render(<DealCommunicationHub deal={deal} contact={contact} />);
    await screen.findByText(/No communications recorded/);
    fireEvent.click(screen.getByRole('tab', { name: /Meetings/ }));
    expect(screen.getByText(/No meetings for this deal yet/)).toBeInTheDocument();
    expect(screen.queryByText(/John Doe|Sarah Johnson|Product Demo/)).toBeNull();
  });

  it('labels sample data in demo mode and surfaces source errors', async () => {
    mockLoad.mockResolvedValue({ entries: [{ ...call, sample: true }], errors: ['meetings: denied'], sample: true });
    render(<DealCommunicationHub deal={deal} contact={null} />);
    await screen.findByText('Discovery call');
    expect(screen.getByRole('note')).toHaveTextContent(/Sample/);
    expect(screen.getByRole('alert')).toHaveTextContent('meetings: denied');
    expect(screen.getByRole('button', { name: /New email/ })).toBeDisabled();
  });

  it('reply pre-fills the thread subject and quote; queueing reloads and shows Queued (not "sent")', async () => {
    mockLoad.mockResolvedValue({ entries: [thread], errors: [], sample: false });
    mockQueue.mockResolvedValue({ id: 'o9', status: 'queued', persisted: true });
    render(<DealCommunicationHub deal={deal} contact={contact} />);
    fireEvent.click(await screen.findByText('Pricing'));
    fireEvent.click(screen.getByRole('button', { name: /Reply/ }));
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe('Re: Pricing');
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toContain('> Can you send pricing?');
    fireEvent.click(screen.getByRole('button', { name: /Queue email/ }));
    const note = await screen.findByText(/not been delivered/);
    expect(note).toHaveTextContent(/Queued/);
    expect(mockQueue).toHaveBeenCalledWith(expect.objectContaining({ dealId: deal.id, to: 'ada@acme.com', subject: 'Re: Pricing', threadId: 't1' }));
    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(2));
  });
});

describe('EmailComposer', () => {
  beforeEach(() => { mockQueue.mockReset(); mockCompose.mockReset(); try { localStorage.removeItem(`email-draft:${deal.id}:new`); } catch { /* */ } });

  it('queues (not sends), clears the draft and calls onSend/onQueued', async () => {
    mockQueue.mockResolvedValue({ id: 'o1', status: 'queued', persisted: true });
    const onSend = jest.fn(); const onQueued = jest.fn();
    render(<EmailComposer contact={contact} deal={deal} isOpen onClose={() => undefined} onSend={onSend} onQueued={onQueued} />);
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /Queue email/ }));
    await screen.findByRole('status');
    expect(mockQueue).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@acme.com', body: 'Hello Ada', contactId: 'c1' }));
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('');
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@acme.com', body: 'Hello Ada' }));
    expect(onQueued).toHaveBeenCalled();
    expect(screen.queryByText(/email sent|was sent|delivered successfully/i)).toBeNull();
  });

  it('shows the queue error and keeps the draft', async () => {
    mockQueue.mockRejectedValue(new Error('RLS says no'));
    render(<EmailComposer contact={contact} deal={deal} isOpen onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByRole('button', { name: /Queue email/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('RLS says no');
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Keep me');
  });

  it('AI draft streams into the body and restores it on failure', async () => {
    mockCompose.mockImplementation(async ({ onText }: any) => { onText('AI text'); return 'AI text'; });
    render(<EmailComposer contact={contact} deal={deal} isOpen onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Draft with AI/ }));
    await waitFor(() => expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('AI text'));
    mockCompose.mockRejectedValue(new Error('AI draft failed (500)'));
    fireEvent.click(screen.getByRole('button', { name: /Draft with AI/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('AI draft failed');
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('AI text');
  });

  it('disables sending when the contact has no email', () => {
    render(<EmailComposer contact={{ ...contact, email: '' }} deal={deal} isOpen onClose={() => undefined} />);
    expect(screen.getByRole('button', { name: /Queue email/ })).toBeDisabled();
  });
});
