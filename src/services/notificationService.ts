import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';
import { assertRowsAffected } from '../utils/rlsError';
import { getCurrentUserId, localId } from './dealRecordShared';

export interface UserNotification {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, any>;
  readAt: string | null;
  createdAt: string;
}

export type NotificationChange =
  | { event: 'INSERT' | 'UPDATE'; notification: UserNotification }
  | { event: 'DELETE'; id: string };

const TABLE = 'user_notifications';
export const NOTIFICATION_LIMIT = 30;

/** Remote notifications need Supabase and a non-demo session; otherwise they live in memory. */
export const isNotificationsRemote = (): boolean => isSupabaseConfigured && !isDemoMode();

export const notificationFromRow = (r: Record<string, any>): UserNotification => ({
  id: r.id,
  userId: r.user_id ?? null,
  type: r.type ?? 'info',
  title: r.title ?? '',
  body: r.body ?? null,
  link: r.link ?? null,
  data: r.data && typeof r.data === 'object' ? r.data : {},
  readAt: r.read_at ?? null,
  createdAt: r.created_at ?? new Date().toISOString(),
});

/** Where a click on the notification should go (explicit link, else the deal in `data`). */
export const notificationLink = (n: Pick<UserNotification, 'link' | 'data'>): string | null =>
  n.link || (n.data?.dealId ? `/deals/${n.data.dealId}` : null);

// ---- in-memory (demo) store -------------------------------------------------------------------
// Demo mode has a single viewer, so every local notification is shown to them.
let localNotifications: UserNotification[] = [];
const localListeners = new Set<(c: NotificationChange) => void>();

const emitLocal = (c: NotificationChange) => localListeners.forEach(l => l(c));

export function addLocalNotification(
  input: { userId?: string | null; type?: string; title: string; body?: string | null; link?: string | null; data?: Record<string, any> },
): UserNotification {
  const n: UserNotification = {
    id: localId('notif'),
    userId: input.userId ?? null,
    type: input.type ?? 'info',
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    data: input.data ?? {},
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  localNotifications = [n, ...localNotifications];
  emitLocal({ event: 'INSERT', notification: n });
  return n;
}

export const __resetLocalNotifications = (): void => { localNotifications = []; localListeners.clear(); };

// ---- API -------------------------------------------------------------------------------------
// Notifications created locally (demo mode, or mentions in locally created deals) are merged with
// the remote ones so the bell always shows both.
const isLocalId = (id: string) => localNotifications.some(n => n.id === id);
const byNewest = (a: UserNotification, b: UserNotification) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

export async function listNotifications(limit = NOTIFICATION_LIMIT): Promise<UserNotification[]> {
  if (!isNotificationsRemote()) return localNotifications.slice(0, limit);
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return [...(data ?? []).map(notificationFromRow), ...localNotifications].sort(byNewest).slice(0, limit);
}

export async function countUnread(): Promise<number> {
  const local = localNotifications.filter(n => !n.readAt).length;
  if (!isNotificationsRemote()) return local;
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw error;
  return (count ?? 0) + local;
}

export async function markRead(id: string): Promise<void> {
  const now = new Date().toISOString();
  if (!isNotificationsRemote() || isLocalId(id)) {
    const cur = localNotifications.find(n => n.id === id);
    if (!cur) return;
    const next = { ...cur, readAt: cur.readAt ?? now };
    localNotifications = localNotifications.map(n => (n.id === id ? next : n));
    emitLocal({ event: 'UPDATE', notification: next });
    return;
  }
  const { data, error } = await supabase.from(TABLE).update({ read_at: now }).eq('id', id).is('read_at', null).select('id');
  if (error) throw error;
  // Already-read rows match zero rows legitimately; only a row that is absent for the user is a denial.
  if (Array.isArray(data) && data.length === 0) {
    const { data: exists, error: e2 } = await supabase.from(TABLE).select('id').eq('id', id);
    if (e2) throw e2;
    assertRowsAffected(exists as unknown[]);
  }
}

export async function markAllRead(): Promise<void> {
  const now = new Date().toISOString();
  const unreadLocal = localNotifications.filter(n => !n.readAt);
  localNotifications = localNotifications.map(n => (n.readAt ? n : { ...n, readAt: now }));
  unreadLocal.forEach(n => emitLocal({ event: 'UPDATE', notification: { ...n, readAt: now } }));
  if (!isNotificationsRemote()) return;
  // Zero rows is a valid outcome here (nothing unread), so no assertRowsAffected.
  const { error } = await supabase.from(TABLE).update({ read_at: now }).is('read_at', null);
  if (error) throw error;
}

export type SubscriptionStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | string;

/**
 * Subscribe to changes of the signed-in user's notifications (plus local ones). Returns an
 * unsubscribe function. `onStatus` reports channel health so callers can fall back to polling.
 */
export async function subscribeToNotifications(
  onChange: (c: NotificationChange) => void,
  onStatus?: (s: SubscriptionStatus) => void,
): Promise<() => void> {
  localListeners.add(onChange);
  const stopLocal = () => { localListeners.delete(onChange); };
  if (!isNotificationsRemote()) {
    onStatus?.('SUBSCRIBED');
    return stopLocal;
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    onStatus?.('CLOSED');
    return stopLocal;
  }
  const channel = supabase
    .channel(`${TABLE}:${userId}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` },
      (payload: any) => {
        if (payload.eventType === 'DELETE') {
          if (payload.old?.id) onChange({ event: 'DELETE', id: payload.old.id });
        } else if (payload.new) {
          onChange({ event: payload.eventType, notification: notificationFromRow(payload.new) });
        }
      },
    )
    .subscribe((status: string) => onStatus?.(status));
  return () => { stopLocal(); try { void supabase.removeChannel(channel); } catch { /* ignore */ } };
}

export const NotificationService = { listNotifications, countUnread, markRead, markAllRead, subscribeToNotifications, addLocalNotification };
