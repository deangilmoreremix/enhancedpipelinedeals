import { supabase, isSupabaseConfigured } from './supabaseService';
import { isDemoMode } from '../config/demoMode';
import { assertRowsAffected } from '../utils/rlsError';

/** Outbound webhooks (table webhook_configurations). Demo mode keeps them in memory. */
export interface OutboundWebhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
}
export type OutboundWebhookInput = Omit<OutboundWebhook, 'id'>;

export const WEBHOOK_EVENTS = ['deal.created', 'deal.updated', 'deal.deleted', 'deal.stage_changed', 'contact.created', 'task.created'] as const;

export function validateWebhook(w: OutboundWebhookInput): string | null {
  if (!w.name.trim()) return 'Name is required.';
  try {
    const u = new URL(w.url.trim());
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) return 'URL must start with https://.';
  } catch { return 'Enter a valid URL.'; }
  if (w.events.length === 0) return 'Pick at least one event.';
  return null;
}

/** "abcd...wxyz" style mask; short secrets are fully hidden. */
export const maskSecret = (s: string): string => (!s ? 'not set' : s.length <= 8 ? '********' : `${s.slice(0, 2)}${'*'.repeat(6)}${s.slice(-2)}`);

let local: OutboundWebhook[] = [];
export const __resetLocalWebhooks = (): void => { local = []; };
const remote = (): boolean => isSupabaseConfigured && !isDemoMode();
const fromRow = (r: any): OutboundWebhook => ({ id: r.id, name: r.name ?? '', url: r.url ?? '', events: r.events ?? [], secret: r.secret ?? '', is_active: r.is_active !== false });

export async function listWebhooks(): Promise<OutboundWebhook[]> {
  if (!remote()) return local.map(w => ({ ...w }));
  const { data, error } = await supabase.from('webhook_configurations').select('id,name,url,events,secret,is_active').order('name');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function saveWebhook(input: OutboundWebhookInput, id?: string): Promise<OutboundWebhook> {
  const row = { name: input.name.trim(), url: input.url.trim(), events: input.events, secret: input.secret || null, is_active: input.is_active, updated_at: new Date().toISOString() };
  if (!remote()) {
    const saved: OutboundWebhook = { id: id ?? `demo-hook-${Date.now()}`, ...input, name: row.name, url: row.url };
    local = id ? local.map(w => (w.id === id ? saved : w)) : [...local, saved];
    return saved;
  }
  if (id) {
    const { data, error } = await supabase.from('webhook_configurations').update(row).eq('id', id).select('id,name,url,events,secret,is_active');
    if (error) throw error;
    assertRowsAffected(data);
    return fromRow(data![0]);
  }
  const { data, error } = await supabase.from('webhook_configurations').insert(row).select('id,name,url,events,secret,is_active').single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteWebhook(id: string): Promise<void> {
  if (!remote()) { local = local.filter(w => w.id !== id); return; }
  const { data, error } = await supabase.from('webhook_configurations').delete().eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

/** Payload shown in the "test" preview. The browser never calls third-party endpoints itself (CORS, secret exposure). */
export function samplePayload(w: Pick<OutboundWebhook, 'events'>): Record<string, unknown> {
  return { event: w.events[0] ?? 'deal.updated', occurred_at: new Date().toISOString(), data: { id: 'sample-deal-id', title: 'Sample deal', stage: 'qualified' }, test: true };
}

/** There is no server-side delivery endpoint to test against yet, so the UI shows the payload instead of faking a send. */
export const TEST_SEND_UNAVAILABLE = 'Test send is not available yet: outbound delivery has no server endpoint. The sample payload below is what a delivery contains.';
