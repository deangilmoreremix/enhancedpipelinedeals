/**
 * Calendar AI panel data layer: upcoming meetings + scheduling, straight from Supabase (calendar_events / contacts).
 * Demo / unconfigured mode keeps meetings in memory + localStorage and never touches the network.
 */
import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';

export interface CalendarPanelEvent {
  id: string;
  contact_id: string;
  datetime: string;
  status: string;
  contacts?: { id: string; name: string | null; email: string | null };
}

const LS_KEY = 'calendar_ai_events';
const DEFAULT_DURATION_MS = 30 * 60 * 1000;
const isRemote = () => isSupabaseConfigured && !isDemoMode();

const readLocal = (): CalendarPanelEvent[] => {
  try { const v = localStorage.getItem(LS_KEY); return v ? (JSON.parse(v) as CalendarPanelEvent[]) : []; } catch { return []; }
};
const writeLocal = (events: CalendarPanelEvent[]) => { try { localStorage.setItem(LS_KEY, JSON.stringify(events)); } catch { /* storage unavailable */ } };

async function attachContacts(rows: any[]): Promise<CalendarPanelEvent[]> {
  const ids = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))];
  const byId = new Map<string, any>();
  if (ids.length) {
    const { data } = await supabase.from('contacts').select('id,name,email').in('id', ids);
    (data ?? []).forEach((c: any) => byId.set(c.id, c));
  }
  return rows.map((r) => ({
    id: r.id,
    contact_id: r.contact_id,
    datetime: r.start_time,
    status: r.status || 'confirmed',
    contacts: byId.get(r.contact_id),
  }));
}

/** Upcoming (not yet started) non-cancelled meetings, soonest first. */
export async function listUpcomingMeetings(limit = 50): Promise<CalendarPanelEvent[]> {
  if (!isRemote()) {
    return readLocal().filter((e) => new Date(e.datetime).getTime() >= Date.now()).sort((a, b) => a.datetime.localeCompare(b.datetime));
  }
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id,contact_id,start_time,status,title')
    .gte('start_time', new Date().toISOString())
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return attachContacts(data ?? []);
}

/** Books a 30-minute meeting with a contact. */
export async function scheduleMeeting(contactId: string, datetime: string): Promise<CalendarPanelEvent> {
  const start = new Date(datetime);
  if (!contactId.trim()) throw new Error('A contact ID is required.');
  if (Number.isNaN(start.getTime())) throw new Error('Datetime must be a valid ISO date, e.g. 2025-01-15T15:00:00Z.');
  const startIso = start.toISOString();

  if (!isRemote()) {
    const ev: CalendarPanelEvent = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      contact_id: contactId.trim(), datetime: startIso, status: 'confirmed',
    };
    writeLocal([ev, ...readLocal()]);
    return ev;
  }

  let userId: string | null = null;
  try { userId = (await supabase.auth.getSession()).data?.session?.user?.id ?? null; } catch { /* anonymous */ }
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      contact_id: contactId.trim(),
      title: 'Meeting',
      start_time: startIso,
      end_time: new Date(start.getTime() + DEFAULT_DURATION_MS).toISOString(),
      status: 'confirmed',
      event_type: 'meeting',
      metadata: { source: 'calendar_ai_panel' },
      created_by: userId,
    })
    .select('id,contact_id,start_time,status')
    .single();
  if (error) throw new Error(error.message);
  const [ev] = await attachContacts([data]);
  return ev;
}
