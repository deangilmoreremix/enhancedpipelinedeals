import { mockDb } from '../test-utils/mockSupabase';

let demo = false;
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: require('../test-utils/mockSupabase').mockDb.client }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));

import { listUpcomingMeetings, scheduleMeeting } from '../services/calendarAIService';

const ops = (table: string, name: string) => mockDb.calls.filter((c) => c.table === table).flatMap((c) => c.ops).filter((o) => o[0] === name);

describe('calendarAIService', () => {
  const fetchSpy = jest.fn();
  beforeEach(() => { mockDb.reset(); demo = false; localStorage.clear(); fetchSpy.mockReset(); (global as any).fetch = fetchSpy; });

  it('lists upcoming non-cancelled events from calendar_events and attaches contacts', async () => {
    mockDb.on('calendar_events', { data: [{ id: 'e1', contact_id: 'c1', start_time: '2099-01-01T10:00:00Z', status: 'confirmed' }], error: null });
    mockDb.on('contacts', { data: [{ id: 'c1', name: 'Ada', email: 'ada@x.co' }], error: null });
    const events = await listUpcomingMeetings();
    expect(events).toEqual([{ id: 'e1', contact_id: 'c1', datetime: '2099-01-01T10:00:00Z', status: 'confirmed', contacts: { id: 'c1', name: 'Ada', email: 'ada@x.co' } }]);
    expect(ops('calendar_events', 'gte')[0][1]).toBe('start_time');
    expect(ops('calendar_events', 'neq')[0].slice(1)).toEqual(['status', 'cancelled']);
    expect(ops('calendar_events', 'order')[0].slice(1)).toEqual(['start_time', { ascending: true }]);
    expect(ops('contacts', 'in')[0].slice(1)).toEqual(['id', ['c1']]);
  });

  it('propagates query errors', async () => {
    mockDb.on('calendar_events', { data: null, error: { message: 'permission denied' } });
    await expect(listUpcomingMeetings()).rejects.toThrow('permission denied');
  });

  it('schedules a 30 minute confirmed meeting created by the signed-in user', async () => {
    mockDb.on('calendar_events', { data: { id: 'new', contact_id: 'c1', start_time: '2099-01-01T10:00:00.000Z', status: 'confirmed' }, error: null });
    mockDb.on('contacts', { data: [{ id: 'c1', name: 'Ada', email: null }], error: null });
    const ev = await scheduleMeeting(' c1 ', '2099-01-01T10:00:00Z');
    const row = ops('calendar_events', 'insert')[0][1] as any;
    expect(row).toMatchObject({ contact_id: 'c1', start_time: '2099-01-01T10:00:00.000Z', end_time: '2099-01-01T10:30:00.000Z', status: 'confirmed', event_type: 'meeting', created_by: 'user-1' });
    expect(ev.contacts?.name).toBe('Ada');
  });

  it('validates input before touching the database', async () => {
    await expect(scheduleMeeting('c1', 'garbage')).rejects.toThrow('valid ISO date');
    await expect(scheduleMeeting('', '2099-01-01T10:00:00Z')).rejects.toThrow('contact ID');
    expect(mockDb.calls).toHaveLength(0);
  });

  it('demo mode keeps meetings locally and never queries Supabase or the network', async () => {
    demo = true;
    const ev = await scheduleMeeting('c9', '2099-02-01T09:00:00Z');
    expect(ev.id).toMatch(/^local-/);
    expect((await listUpcomingMeetings()).map((e) => e.id)).toEqual([ev.id]);
    expect(mockDb.calls).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
