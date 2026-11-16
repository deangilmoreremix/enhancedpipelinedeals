/**
 * Deal communications from real data.
 *
 * Reads email_threads (+ emails), communication_records (calls / messages / logged emails),
 * outbound_messages (queued outgoing email) and calendar_events (meetings) that belong to the deal
 * or to its contact / company contacts. Also queues outgoing email: email is NEVER sent from the browser.
 * `queueEmail` inserts an outbound_messages row with status 'queued' and a deal_activities timeline entry;
 * a server-side worker is responsible for delivery.
 */
import { supabase } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';
import { authedFetch } from './aiClient';
import { canUseRemote, getCurrentUserId, errorMessage, isUuid, localId } from './dealRecordShared';

export type CommChannel = 'email' | 'call' | 'meeting' | 'message';
export type CommDirection = 'inbound' | 'outbound';

export interface CommMessage {
  id: string;
  from?: string | null;
  to?: string[];
  at: string;
  subject?: string | null;
  body: string;
  direction?: CommDirection | null;
}

export interface CommEntry {
  id: string;
  channel: CommChannel;
  direction: CommDirection | null;
  subject: string;
  /** One-line preview. */
  preview: string;
  /** ISO timestamp used for sorting. */
  at: string;
  /** Delivery / record status (e.g. 'queued', 'completed', 'confirmed'); null when unknown. */
  status: string | null;
  participants: string[];
  /** Thread messages (email threads) or the single body (other records). */
  messages: CommMessage[];
  messageCount: number;
  durationLabel?: string | null;
  location?: string | null;
  source: 'email_thread' | 'communication_record' | 'outbound_message' | 'calendar_event' | 'demo' | 'local';
  threadId?: string | null;
  /** True for the clearly-labelled demo sample set. */
  sample?: boolean;
}

export interface DealCommsQuery {
  dealId: string;
  contactId?: string | null;
  companyId?: string | null;
  limit?: number;
}

export interface DealCommsResult {
  entries: CommEntry[];
  /** Sources that failed to load (the rest are still returned). */
  errors: string[];
  sample: boolean;
}

const clip = (s: string | null | undefined, n = 140): string => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const asStrings = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v
    .map(x => (typeof x === 'string' ? x : (x as any)?.email ?? (x as any)?.name ?? ''))
    .filter((x): x is string => typeof x === 'string' && x.length > 0);
};

const stripHtml = (html: string): string => html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function channelOfRecordType(type: string | null | undefined): CommChannel {
  const t = (type ?? '').toLowerCase();
  if (t.includes('call') || t.includes('phone') || t.includes('voice')) return 'call';
  if (t.includes('meeting') || t.includes('demo') || t.includes('video')) return 'meeting';
  if (t.includes('email') || t.includes('mail')) return 'email';
  return 'message';
}

const dirOf = (d: unknown): CommDirection | null => {
  const s = String(d ?? '').toLowerCase();
  if (s.startsWith('in')) return 'inbound';
  if (s.startsWith('out')) return 'outbound';
  return null;
};

export function formatDuration(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' || /^\d+$/.test(String(raw))) {
    const secs = Number(raw);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return String(raw);
}

/** `or` filter matching rows linked to the deal or any of the given contacts. */
export function buildOwnerFilter(dealId: string, contactIds: string[]): string {
  const parts = [`deal_id.eq.${dealId}`];
  if (contactIds.length) parts.push(`contact_id.in.(${contactIds.join(',')})`);
  return parts.join(',');
}

/** Contacts of the deal's company (so company-level conversations show up), plus the deal contact. */
async function resolveContactIds(q: DealCommsQuery): Promise<string[]> {
  const ids = new Set<string>();
  if (isUuid(q.contactId)) ids.add(q.contactId);
  if (isUuid(q.companyId)) {
    const { data, error } = await supabase.from('contacts').select('id').eq('company_id', q.companyId).limit(50);
    if (!error) (data ?? []).forEach((r: any) => { if (isUuid(r?.id)) ids.add(r.id); });
  }
  return [...ids];
}

export async function loadDealCommunications(q: DealCommsQuery): Promise<DealCommsResult> {
  if (!canUseRemote(q.dealId)) {
    // Demo / unsaved deals: nothing real to read. Demo mode shows a small, clearly labelled sample set.
    if (isDemoMode()) return { entries: demoSampleCommunications(q.dealId), errors: [], sample: true };
    const local = localEntries.get(q.dealId) ?? [];
    return { entries: [...local].sort(byRecent), errors: [], sample: false };
  }

  const limit = q.limit ?? 100;
  const errors: string[] = [];
  let contactIds: string[] = [];
  try { contactIds = await resolveContactIds(q); } catch { /* fall back to deal-only */ }
  const filter = buildOwnerFilter(q.dealId, contactIds);

  const safe = async <T,>(label: string, run: () => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> => {
    try {
      const { data, error } = await run();
      if (error) { errors.push(`${label}: ${error.message ?? 'failed'}`); return []; }
      return data ?? [];
    } catch (e) {
      errors.push(`${label}: ${errorMessage(e)}`);
      return [];
    }
  };

  const [threads, records, outbound, events] = await Promise.all([
    safe<any>('email threads', () => supabase.from('email_threads').select('*').or(filter).order('last_message_at', { ascending: false }).limit(limit)),
    safe<any>('communication records', () => supabase.from('communication_records').select('*').or(filter).order('timestamp', { ascending: false }).limit(limit)),
    safe<any>('outbound messages', () => supabase.from('outbound_messages').select('*').or(filter).order('created_at', { ascending: false }).limit(limit)),
    safe<any>('meetings', () => supabase.from('calendar_events').select('*').or(filter).order('start_time', { ascending: false }).limit(limit)),
  ]);

  const threadIds = threads.map((t: any) => t.id).filter(Boolean);
  const emails = threadIds.length
    ? await safe<any>('emails', () => supabase.from('emails').select('*').in('thread_id', threadIds).order('sent_at', { ascending: true }))
    : [];

  const entries = mapRowsToEntries({ threads, emails, records, outbound, events });
  return { entries, errors, sample: false };
}

const byRecent = (a: CommEntry, b: CommEntry) => new Date(b.at).getTime() - new Date(a.at).getTime();

/** Pure mapping of raw rows to display entries (exported for tests). */
export function mapRowsToEntries(rows: { threads?: any[]; emails?: any[]; records?: any[]; outbound?: any[]; events?: any[] }): CommEntry[] {
  const out: CommEntry[] = [];
  const emailsByThread = new Map<string, any[]>();
  (rows.emails ?? []).forEach(e => {
    const k = String(e.thread_id ?? '');
    emailsByThread.set(k, [...(emailsByThread.get(k) ?? []), e]);
  });

  for (const t of rows.threads ?? []) {
    const msgs: CommMessage[] = (emailsByThread.get(String(t.id)) ?? []).map((e: any) => ({
      id: String(e.id),
      from: e.from_email ?? null,
      to: asStrings(e.to_emails),
      at: e.sent_at ?? e.received_at ?? e.created_at ?? t.last_message_at ?? t.created_at,
      subject: e.subject ?? null,
      body: e.body_text || (e.body_html ? stripHtml(e.body_html) : '') || '',
      direction: e.received_at && !e.sent_at ? 'inbound' : null,
    }));
    const last = msgs[msgs.length - 1];
    out.push({
      id: `thread:${t.id}`,
      channel: 'email',
      direction: null,
      subject: t.subject || '(no subject)',
      preview: clip(last?.body) || `${t.message_count ?? msgs.length} message(s)`,
      at: t.last_message_at ?? t.updated_at ?? t.created_at ?? new Date(0).toISOString(),
      status: t.status ?? null,
      participants: asStrings(t.participants),
      messages: msgs,
      messageCount: Math.max(Number(t.message_count ?? 0), msgs.length),
      source: 'email_thread',
      threadId: t.id,
    });
  }

  for (const r of rows.records ?? []) {
    const channel = channelOfRecordType(r.type);
    const at = r.timestamp ?? r.created_at ?? new Date(0).toISOString();
    out.push({
      id: `record:${r.id}`,
      channel,
      direction: dirOf(r.direction),
      subject: r.subject || (channel === 'call' ? 'Call' : channel === 'meeting' ? 'Meeting' : channel === 'email' ? '(no subject)' : 'Message'),
      preview: clip(r.content),
      at,
      status: r.status ?? null,
      participants: [],
      messages: r.content ? [{ id: String(r.id), at, body: String(r.content), direction: dirOf(r.direction), subject: r.subject ?? null }] : [],
      messageCount: 1,
      durationLabel: formatDuration(r.duration),
      source: 'communication_record',
    });
  }

  for (const m of rows.outbound ?? []) {
    const channel = channelOfRecordType(m.channel);
    const at = m.sent_at ?? m.created_at ?? new Date(0).toISOString();
    out.push({
      id: `outbound:${m.id}`,
      channel,
      direction: 'outbound',
      subject: m.subject || (channel === 'email' ? '(no subject)' : 'Message'),
      preview: clip(m.body),
      at,
      status: m.status ?? 'queued',
      participants: m.recipient ? [String(m.recipient)] : [],
      messages: [{ id: String(m.id), to: m.recipient ? [String(m.recipient)] : [], at, subject: m.subject ?? null, body: String(m.body ?? ''), direction: 'outbound' }],
      messageCount: 1,
      source: 'outbound_message',
    });
  }

  for (const ev of rows.events ?? []) {
    const type = String(ev.event_type ?? '').toLowerCase();
    const channel: CommChannel = type.includes('call') ? 'call' : 'meeting';
    const start = ev.start_time;
    const end = ev.end_time;
    const mins = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000) : null;
    out.push({
      id: `event:${ev.id}`,
      channel,
      direction: null,
      subject: ev.title || 'Meeting',
      preview: clip(ev.description) || (ev.location ? `At ${ev.location}` : ''),
      at: start ?? ev.created_at ?? new Date(0).toISOString(),
      status: ev.status ?? null,
      participants: asStrings(ev.attendees),
      messages: ev.description ? [{ id: String(ev.id), at: start ?? ev.created_at, body: String(ev.description) }] : [],
      messageCount: 1,
      durationLabel: mins && mins > 0 ? (mins >= 60 ? `${Math.round((mins / 60) * 10) / 10} h` : `${mins} min`) : null,
      location: ev.location ?? ev.meeting_url ?? null,
      source: 'calendar_event',
    });
  }

  return out.sort(byRecent);
}

// ---------------------------------------------------------------------------
// Demo sample set (only when isDemoMode()); every entry is flagged `sample`.
// ---------------------------------------------------------------------------

export function demoSampleCommunications(dealId: string): CommEntry[] {
  const now = Date.now();
  const iso = (ms: number) => new Date(now + ms).toISOString();
  const local = localEntries.get(dealId) ?? [];
  const sample: CommEntry[] = [
    {
      id: 'sample-thread', channel: 'email', direction: null, subject: 'Sample: Proposal follow-up', preview: 'Sample data only.',
      at: iso(-3 * 864e5), status: 'active', participants: ['sample@example.com'], messageCount: 2, source: 'demo', sample: true,
      messages: [
        { id: 's1', from: 'you@example.com', to: ['sample@example.com'], at: iso(-3 * 864e5), body: 'Sample message: sharing the proposal.', direction: 'outbound' },
        { id: 's2', from: 'sample@example.com', to: ['you@example.com'], at: iso(-2.5 * 864e5), body: 'Sample reply: thanks, reviewing it.', direction: 'inbound' },
      ],
    },
    { id: 'sample-call', channel: 'call', direction: 'outbound', subject: 'Sample: Discovery call', preview: 'Sample data only.', at: iso(-864e5), status: 'completed', participants: [], messages: [], messageCount: 1, durationLabel: '15:32', source: 'demo', sample: true },
    { id: 'sample-meeting', channel: 'meeting', direction: null, subject: 'Sample: Product demo', preview: 'Sample data only.', at: iso(2 * 864e5), status: 'scheduled', participants: [], messages: [], messageCount: 1, durationLabel: '1 h', source: 'demo', sample: true },
  ];
  return [...local, ...sample].sort(byRecent);
}

// ---------------------------------------------------------------------------
// Queue outgoing email
// ---------------------------------------------------------------------------

const localEntries = new Map<string, CommEntry[]>();

export interface QueueEmailInput {
  dealId: string;
  contactId?: string | null;
  to: string;
  subject: string;
  body: string;
  /** When replying: the thread the reply belongs to (recorded in the timeline metadata). */
  threadId?: string | null;
}

export interface QueueEmailResult {
  id: string;
  status: 'queued';
  /** true when persisted to outbound_messages; false for demo / unsaved deals (kept in memory only). */
  persisted: boolean;
  /** Timeline entry could not be written (the message is still queued). */
  timelineError?: string;
}

/** Queue (never send) an email: outbound_messages(status 'queued') + deal_activities timeline entry. */
export async function queueEmail(input: QueueEmailInput): Promise<QueueEmailResult> {
  const to = input.to.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!to) throw new Error('Recipient email is required');
  if (!subject) throw new Error('Subject is required');
  if (!body) throw new Error('Message body is required');
  const nowIso = new Date().toISOString();

  if (!canUseRemote(input.dealId)) {
    const id = localId('queued');
    const entry: CommEntry = {
      id: `outbound:${id}`, channel: 'email', direction: 'outbound', subject, preview: clip(body), at: nowIso, status: 'queued',
      participants: [to], messages: [{ id, to: [to], at: nowIso, subject, body, direction: 'outbound' }], messageCount: 1, source: 'local',
    };
    localEntries.set(input.dealId, [entry, ...(localEntries.get(input.dealId) ?? [])]);
    return { id, status: 'queued', persisted: false };
  }

  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from('outbound_messages').insert({
    deal_id: input.dealId,
    contact_id: isUuid(input.contactId) ? input.contactId : null,
    channel: 'email',
    recipient: to,
    subject,
    body,
    status: 'queued',
    created_by_agent: false,
  }).select().single();
  if (error) throw new Error(error.message || 'Could not queue the email');
  const id = String((data as any)?.id ?? localId('queued'));

  let timelineError: string | undefined;
  try {
    const { error: aErr } = await supabase.from('deal_activities').insert({
      deal_id: input.dealId,
      type: 'email_queued',
      title: `Email queued: ${subject}`,
      description: `Queued for delivery to ${to}. It has not been sent yet.`,
      metadata: { outbound_message_id: id, recipient: to, status: 'queued', thread_id: input.threadId ?? null },
      created_by: userId,
      created_at: nowIso,
    });
    if (aErr) timelineError = aErr.message;
  } catch (e) {
    timelineError = errorMessage(e);
  }
  return { id, status: 'queued', persisted: true, timelineError };
}

/** Subject + quoted body for a reply to an entry (pure; used by the composer). */
export function buildReply(entry: Pick<CommEntry, 'subject' | 'messages'>): { subject: string; quote: string } {
  const subject = /^re:/i.test(entry.subject) ? entry.subject : `Re: ${entry.subject}`;
  const last = entry.messages[entry.messages.length - 1];
  if (!last || !last.body) return { subject, quote: '' };
  const when = last.at ? new Date(last.at).toLocaleString() : '';
  const header = `On ${when}${last.from ? `, ${last.from}` : ''} wrote:`;
  const quoted = last.body.split('\n').map(l => `> ${l}`).join('\n');
  return { subject, quote: `\n\n${header}\n${quoted}` };
}

/** Test helper. */
export function __resetLocalComms(): void { localEntries.clear(); }

// ---------------------------------------------------------------------------
// AI compose (existing /api/ai/compose-email SSE endpoint: frames `data: {"content": "..."}`)
// ---------------------------------------------------------------------------

export const COMPOSE_EMAIL_URL = '/api/ai/compose-email';

/** Streams an AI-drafted email body; calls onText with the accumulated text. Throws with a readable message. */
export async function composeEmailDraft(args: {
  contactId?: string | null;
  dealId?: string | null;
  input: string;
  onText: (accumulated: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const res = await authedFetch(COMPOSE_EMAIL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactId: args.contactId ?? undefined, dealId: args.dealId ?? undefined, input: args.input }),
    signal: args.signal,
  });
  if (!res.ok || !res.body) {
    let detail = '';
    try { const b = await res.json(); detail = typeof b?.error === 'string' ? b.error : ''; } catch { /* not JSON */ }
    if (res.status === 401) throw new Error('Please sign in again to use AI drafting.');
    if (res.status === 429) throw new Error('AI drafting is rate limited. Please wait a moment.');
    throw new Error(detail || `AI draft failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let acc = '';
  let buffer = '';
  const handle = (line: string) => {
    if (!line.startsWith('data: ')) return;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') return;
    let d: any;
    try { d = JSON.parse(payload); } catch { return; }
    if (d?.error) throw new Error(typeof d.error === 'string' ? d.error : 'AI draft failed');
    if (d?.content) { acc += d.content; args.onText(acc); }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(handle);
  }
  if (buffer) handle(buffer);
  return acc;
}
