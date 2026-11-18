import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type Call = [string, ...unknown[]];
let calls: Call[] = [];
let tables: Record<string, { data: unknown; error: unknown }> = {};
let demo = false;

const builder = (table: string): any => {
  const b: any = {};
  ['select', 'insert', 'eq', 'or', 'in', 'order', 'limit', 'single'].forEach(m => {
    b[m] = (...args: unknown[]) => { calls.push([`${table}.${m}`, ...args]); return b; };
  });
  b.then = (res: any, rej: any) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(res, rej);
  return b;
};

jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t: string) => builder(t),
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
  },
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));
jest.mock('../services/aiClient', () => ({ authedFetch: (...a: unknown[]) => (globalThis as any).fetch(...a) }));

import {
  loadDealCommunications, queueEmail, buildReply, mapRowsToEntries, buildOwnerFilter, composeEmailDraft, __resetLocalComms,
} from '../services/dealCommunicationService';

const DEAL = '11111111-1111-4111-8111-111111111111';
const CONTACT = '22222222-2222-4222-8222-222222222222';

describe('dealCommunicationService', () => {
  beforeEach(() => { calls = []; tables = {}; demo = false; __resetLocalComms(); });

  it('builds an owner filter for deal + contacts', () => {
    expect(buildOwnerFilter(DEAL, [CONTACT])).toBe(`deal_id.eq.${DEAL},contact_id.in.(${CONTACT})`);
    expect(buildOwnerFilter(DEAL, [])).toBe(`deal_id.eq.${DEAL}`);
  });

  it('maps threads (with their emails), records, outbound messages and meetings, newest first', () => {
    const entries = mapRowsToEntries({
      threads: [{ id: 't1', subject: 'Pricing', last_message_at: '2026-01-05T10:00:00Z', message_count: 2, participants: ['a@x.com'], status: 'active' }],
      emails: [
        { id: 'e1', thread_id: 't1', from_email: 'me@x.com', to_emails: ['a@x.com'], sent_at: '2026-01-05T09:00:00Z', body_text: 'Hello' },
        { id: 'e2', thread_id: 't1', from_email: 'a@x.com', to_emails: ['me@x.com'], received_at: '2026-01-05T10:00:00Z', body_html: '<p>Thanks <b>a lot</b></p>' },
      ],
      records: [{ id: 'r1', type: 'phone_call', direction: 'outbound', timestamp: '2026-01-04T10:00:00Z', duration: '95', content: 'Went well' }],
      outbound: [{ id: 'o1', channel: 'email', recipient: 'a@x.com', subject: 'Follow up', body: 'Hi', status: 'queued', created_at: '2026-01-06T10:00:00Z' }],
      events: [{ id: 'ev1', title: 'Demo', event_type: 'meeting', start_time: '2026-01-03T10:00:00Z', end_time: '2026-01-03T11:00:00Z', attendees: [{ email: 'a@x.com' }] }],
    });
    expect(entries.map(e => e.id)).toEqual(['outbound:o1', 'thread:t1', 'record:r1', 'event:ev1']);
    const thread = entries.find(e => e.id === 'thread:t1')!;
    expect(thread.messages).toHaveLength(2);
    expect(thread.messages[1].body).toBe('Thanks a lot');
    expect(thread.messageCount).toBe(2);
    expect(entries[0]).toMatchObject({ channel: 'email', status: 'queued', direction: 'outbound' });
    expect(entries.find(e => e.id === 'record:r1')).toMatchObject({ channel: 'call', durationLabel: '1:35' });
    expect(entries.find(e => e.id === 'event:ev1')).toMatchObject({ channel: 'meeting', durationLabel: '1 h', participants: ['a@x.com'] });
  });

  it('loads from every source for the deal and its contact and tolerates a failing source', async () => {
    tables.email_threads = { data: [{ id: 't1', subject: 'S', last_message_at: '2026-01-01T00:00:00Z' }], error: null };
    tables.emails = { data: [], error: null };
    tables.communication_records = { data: null, error: { message: 'denied' } };
    tables.outbound_messages = { data: [], error: null };
    tables.calendar_events = { data: [], error: null };
    tables.contacts = { data: [{ id: CONTACT }], error: null };
    const r = await loadDealCommunications({ dealId: DEAL, contactId: CONTACT, companyId: '33333333-3333-4333-8333-333333333333' });
    expect(r.entries).toHaveLength(1);
    expect(r.errors).toEqual(['communication records: denied']);
    expect(r.sample).toBe(false);
    const orCall = calls.find(c => c[0] === 'email_threads.or')!;
    expect(orCall[1]).toBe(`deal_id.eq.${DEAL},contact_id.in.(${CONTACT})`);
    expect(calls.some(c => c[0] === 'emails.in' && JSON.stringify(c[2]) === JSON.stringify(['t1']))).toBe(true);
  });

  it('returns only a labelled sample set in demo mode (and never reads the database)', async () => {
    demo = true;
    const r = await loadDealCommunications({ dealId: 'demo-1' });
    expect(r.sample).toBe(true);
    expect(r.entries.length).toBeGreaterThan(0);
    expect(r.entries.every(e => e.sample)).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('returns nothing (no fake data) for a non-demo unsaved deal', async () => {
    const r = await loadDealCommunications({ dealId: 'local-1' });
    expect(r).toEqual({ entries: [], errors: [], sample: false });
  });

  it('queues an email: outbound_messages(status queued) + deal_activities timeline entry', async () => {
    tables.outbound_messages = { data: { id: 'o-9' }, error: null };
    tables.deal_activities = { data: null, error: null };
    const res = await queueEmail({ dealId: DEAL, contactId: CONTACT, to: 'a@x.com', subject: ' Hi ', body: ' Body ', threadId: 't1' });
    expect(res).toMatchObject({ id: 'o-9', status: 'queued', persisted: true });
    const ob = calls.find(c => c[0] === 'outbound_messages.insert')![1] as any;
    expect(ob).toMatchObject({ deal_id: DEAL, contact_id: CONTACT, channel: 'email', recipient: 'a@x.com', subject: 'Hi', body: 'Body', status: 'queued' });
    const act = calls.find(c => c[0] === 'deal_activities.insert')![1] as any;
    expect(act).toMatchObject({ deal_id: DEAL, type: 'email_queued', created_by: 'user-1' });
    expect(act.metadata).toMatchObject({ outbound_message_id: 'o-9', status: 'queued', thread_id: 't1' });
    expect(act.description).toMatch(/not been sent/i);
  });

  it('still reports queued when only the timeline write fails', async () => {
    tables.outbound_messages = { data: { id: 'o-9' }, error: null };
    tables.deal_activities = { data: null, error: { message: 'rls' } };
    const res = await queueEmail({ dealId: DEAL, to: 'a@x.com', subject: 's', body: 'b' });
    expect(res.timelineError).toBe('rls');
  });

  it('throws when the outbound insert fails and validates input', async () => {
    tables.outbound_messages = { data: null, error: { message: 'nope' } };
    await expect(queueEmail({ dealId: DEAL, to: 'a@x.com', subject: 's', body: 'b' })).rejects.toThrow('nope');
    await expect(queueEmail({ dealId: DEAL, to: '', subject: 's', body: 'b' })).rejects.toThrow(/recipient/i);
    await expect(queueEmail({ dealId: DEAL, to: 'a@x.com', subject: 's', body: ' ' })).rejects.toThrow(/body/i);
  });

  it('keeps unsaved-deal emails in memory and says so (persisted=false)', async () => {
    const res = await queueEmail({ dealId: 'local-1', to: 'a@x.com', subject: 's', body: 'b' });
    expect(res.persisted).toBe(false);
    expect(calls).toHaveLength(0);
    const r = await loadDealCommunications({ dealId: 'local-1' });
    expect(r.entries[0]).toMatchObject({ status: 'queued', source: 'local' });
  });

  it('builds a reply with Re: subject and a quoted last message', () => {
    const r = buildReply({ subject: 'Pricing', messages: [{ id: '1', at: '2026-01-01T00:00:00Z', from: 'a@x.com', body: 'Line1\nLine2' }] });
    expect(r.subject).toBe('Re: Pricing');
    expect(r.quote).toContain('a@x.com wrote:');
    expect(r.quote).toContain('> Line1\n> Line2');
    expect(buildReply({ subject: 'Re: Pricing', messages: [] })).toEqual({ subject: 'Re: Pricing', quote: '' });
  });

  it('streams an AI draft from /api/ai/compose-email', async () => {
    const enc = new TextEncoder();
    const frames = [`data: ${JSON.stringify({ content: 'Hel' })}\n\n`, `data: ${JSON.stringify({ content: 'lo' })}\n\n`, 'data: [DONE]\n\n'];
    let i = 0;
    const body = { getReader: () => ({ read: async () => (i < frames.length ? { done: false, value: enc.encode(frames[i++]) } : { done: true, value: undefined }) }) };
    (globalThis as any).fetch = jest.fn(async () => ({ ok: true, status: 200, body }));
    const seen: string[] = [];
    const out = await composeEmailDraft({ contactId: CONTACT, dealId: DEAL, input: 'x', onText: t => seen.push(t) });
    expect(out).toBe('Hello');
    expect(seen).toEqual(['Hel', 'Hello']);
    expect((globalThis as any).fetch.mock.calls[0][0]).toBe('/api/ai/compose-email');
  });

  it('maps compose errors (429)', async () => {
    (globalThis as any).fetch = jest.fn(async () => ({ ok: false, status: 429, body: null, json: async () => ({}) }));
    await expect(composeEmailDraft({ input: '', onText: () => undefined })).rejects.toThrow(/rate limited/i);
  });
});
