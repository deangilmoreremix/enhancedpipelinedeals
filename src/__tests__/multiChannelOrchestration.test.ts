import { mockDb } from '../test-utils/mockSupabase';

let demo = false;
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: require('../test-utils/mockSupabase').mockDb.client }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));

import { MultiChannelOrchestrationService, CHANNEL_NOT_CONFIGURED_MESSAGE } from '../services/multiChannelOrchestrationService';

const svc = () => new MultiChannelOrchestrationService() as any; // private helpers are exercised directly
const ops = (table: string, name: string) => mockDb.calls.filter((c) => c.table === table).flatMap((c) => c.ops).filter((o) => o[0] === name);

describe('multiChannelOrchestrationService (supabase, no delivery provider)', () => {
  const fetchSpy = jest.fn();
  beforeEach(() => { mockDb.reset(); demo = false; fetchSpy.mockReset(); (global as any).fetch = fetchSpy; });
  afterEach(() => expect(fetchSpy).not.toHaveBeenCalled()); // no dead /api/* or function endpoints are called any more

  it('send = queue an outbound_messages row (status queued, created_by_agent) and report queued', async () => {
    mockDb.on('outbound_messages', { data: { id: 'm1' }, error: null });
    const s = svc();
    const channel = s.channels.get('twilio');
    const r = await s.sendThroughChannel(channel, { id: 'c1', phone: '+155501', email: 'a@b.co' }, 'hello', new Date('2099-01-01T00:00:00Z'));
    expect(r).toMatchObject({ queued: true, status: 'queued', messageId: 'm1' });
    expect(ops('outbound_messages', 'insert')[0][1]).toMatchObject({ contact_id: 'c1', channel: 'twilio', recipient: '+155501', body: 'hello', status: 'queued', created_by_agent: true });
  });

  it('send surfaces insert errors (step becomes failed)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockDb.on('outbound_messages', { data: null, error: { message: 'rls' } });
    const s = svc();
    await expect(s.sendThroughChannel(s.channels.get('whatsapp'), { id: 'c1', phone: '1' }, 'x', new Date())).rejects.toThrow('rls');
    const step = await s.executeStep({ id: 's1', channelId: 'whatsapp', delay: 0, template: 'whatsapp_nurture', conditions: [] }, 'c1', new Date(), {});
    expect(step.status).toBe('failed');
  });

  it('rate limit: computed from outbound_messages per contact + channel over per-minute / hour / day limits', async () => {
    const s = svc();
    const now = Date.now();
    const rows = (n: number, ageMs: number) => Array.from({ length: n }, () => ({ created_at: new Date(now - ageMs).toISOString() }));
    mockDb.on('outbound_messages', { data: rows(2, 5_000), error: null }); // linkedin perMinute = 5
    expect(await s.checkRateLimit('linkedin', 'c1')).toBe(true);
    mockDb.on('outbound_messages', { data: rows(5, 5_000), error: null });
    expect(await s.checkRateLimit('linkedin', 'c1')).toBe(false);
    mockDb.on('outbound_messages', { data: rows(50, 30 * 60_000), error: null }); // perHour = 50
    expect(await s.checkRateLimit('linkedin', 'c1')).toBe(false);
    mockDb.on('outbound_messages', { data: rows(100, 5 * 3_600_000), error: null }); // perDay = 100
    expect(await s.checkRateLimit('linkedin', 'c1')).toBe(false);
    const q = mockDb.withOp('outbound_messages', 'gte')[0].ops;
    expect(q.find((o) => o[0] === 'eq' && o[1] === 'contact_id')?.[2]).toBe('c1');
    expect(q.find((o) => o[0] === 'eq' && o[1] === 'channel')?.[2]).toBe('linkedin');
    expect(await s.checkRateLimit('nope', 'c1')).toBe(false);
  });

  it('rate limit fails open when the query errors', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockDb.on('outbound_messages', { data: null, error: { message: 'boom' } });
    expect(await svc().checkRateLimit('twilio', 'c1')).toBe(true);
  });

  it('contact details come from contacts; preferences live in contacts.custom_fields.channel_preferences', async () => {
    const s = svc();
    mockDb.on('contacts', { data: { id: 'c1', name: 'Ada' }, error: null });
    expect(await s.getContactDetails('c1')).toEqual({ id: 'c1', name: 'Ada' });

    mockDb.on('contacts', { data: { custom_fields: { channel_preferences: { preferredChannels: ['sms'], unsubscribed: ['linkedin'], timezone: 'Europe/Paris' } } }, error: null });
    const prefs = await s.getContactPreferences('c1');
    expect(prefs).toMatchObject({ preferredChannels: ['sms'], unsubscribed: ['linkedin'], timezone: 'Europe/Paris', quietHours: { start: '20:00', end: '08:00' } });

    mockDb.reset();
    mockDb.on('contacts', (c) => ({ data: c.ops.some((o) => o[0] === 'maybeSingle') ? { custom_fields: { other: true } } : null, error: null }));
    await s.updateContactPreferences('c2', { preferredChannels: ['email'] });
    const patch = ops('contacts', 'update')[0][1] as any;
    expect(patch.custom_fields.other).toBe(true);
    expect(patch.custom_fields.channel_preferences.preferredChannels).toEqual(['email']);
  });

  it('connectChannel reports "not configured" instead of pretending, and leaves the channel disconnected', async () => {
    const s = new MultiChannelOrchestrationService();
    const r = await s.connectChannel('twilio', { token: 'x' });
    expect(r).toEqual({ connected: false, configured: false, message: CHANNEL_NOT_CONFIGURED_MESSAGE });
    expect(s.getChannels().find((c) => c.id === 'twilio')?.connected).toBe(false);
    expect((await s.connectChannel('fax', {})).message).toContain('Unknown channel');
  });

  it('analytics aggregate outbound_messages by channel and status', async () => {
    mockDb.on('outbound_messages', { data: [
      { contact_id: 'c1', channel: 'twilio', status: 'queued' }, { contact_id: 'c1', channel: 'twilio', status: 'failed' },
      { contact_id: 'c2', channel: 'linkedin', status: 'sent' }, { contact_id: 'c2', channel: null, status: 'queued' },
    ], error: null });
    const a = await new MultiChannelOrchestrationService().getOrchestrationAnalytics({ start: '2099-01-01', end: '2099-12-31' });
    expect(a).toMatchObject({ totalSequences: 2, successRate: 75, engagementRates: {} });
    expect(a.channelPerformance.twilio).toEqual({ total: 2, queued: 1, sent: 0, failed: 1 });
    expect(a.channelPerformance.email).toEqual({ total: 1, queued: 1, sent: 0, failed: 0 });
    mockDb.on('outbound_messages', { data: null, error: { message: 'x' } });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await new MultiChannelOrchestrationService().getOrchestrationAnalytics({ start: 'a', end: 'b' })).totalSequences).toBe(0);
  });

  it('demo mode: in-memory queue + rate limit, defaults for contact data, no Supabase calls', async () => {
    demo = true;
    const s = svc();
    const ch = s.channels.get('linkedin');
    expect(await s.getContactDetails('c1')).toMatchObject({ id: 'c1', name: 'Contact' });
    for (let i = 0; i < 5; i++) await s.sendThroughChannel(ch, { id: 'c1' }, 'x', new Date());
    expect(await s.checkRateLimit('linkedin', 'c1')).toBe(false);
    expect(await s.checkRateLimit('linkedin', 'other')).toBe(true);
    expect((await s.getContactPreferences('c1')).preferredChannels).toEqual([]);
    await s.updateContactPreferences('c1', { timezone: 'UTC' });
    expect((await s.getOrchestrationAnalytics({ start: '2000-01-01', end: '2999-01-01' })).channelPerformance.linkedin.total).toBe(5);
    expect(mockDb.calls).toHaveLength(0);
  });
});
