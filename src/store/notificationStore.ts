import { create } from 'zustand';
import {
  NOTIFICATION_LIMIT, NotificationChange, UserNotification, countUnread, listNotifications, markAllRead, markRead,
  subscribeToNotifications,
} from '../services/notificationService';
import { errorMessage } from '../services/dealRecordShared';
import { pushToast } from './dealRecordStore';

export const NOTIFICATION_POLL_MS = 30_000;

interface NotificationStore {
  items: UserNotification[];
  unread: number;
  loading: boolean;
  error: string | null;
  mode: 'idle' | 'realtime' | 'polling';
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Start realtime (poll fallback). Reference-counted; returns a stop function. */
  start: () => () => void;
}

const sortNewest = (list: UserNotification[]) =>
  [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)).slice(0, NOTIFICATION_LIMIT);

let users = 0;
/** Bumped on every realtime/local change so a refresh that raced with one re-reads instead of overwriting it. */
let changeSeq = 0;
let teardown: (() => void) | null = null;

export const useNotificationStore = create<NotificationStore>((set, get) => {
  const applyChange = (c: NotificationChange) => {
    changeSeq += 1;
    set(s => {
      if (c.event === 'DELETE') {
        const items = s.items.filter(n => n.id !== c.id);
        return { items, unread: items.filter(n => !n.readAt).length };
      }
      const exists = s.items.some(n => n.id === c.notification.id);
      const items = sortNewest(exists ? s.items.map(n => (n.id === c.notification.id ? c.notification : n)) : [c.notification, ...s.items]);
      // The list is capped, so keep the unread count from drifting: recompute from items when nothing was dropped.
      const unread = exists
        ? s.unread + (Number(!c.notification.readAt) - Number(!s.items.find(n => n.id === c.notification.id)!.readAt))
        : s.unread + (c.notification.readAt ? 0 : 1);
      return { items, unread: Math.max(0, unread) };
    });
  };

  return {
    items: [],
    unread: 0,
    loading: false,
    error: null,
    mode: 'idle',

    refresh: async () => {
      set({ loading: true });
      try {
        let items: UserNotification[] = [];
        let unread = 0;
        for (let attempt = 0; attempt < 3; attempt++) {
          const seq = changeSeq;
          [items, unread] = await Promise.all([listNotifications(), countUnread()]);
          if (seq === changeSeq) break; // nothing changed while we were reading
        }
        set({ items, unread, error: null, loading: false });
      } catch (e) {
        set({ loading: false, error: errorMessage(e, 'Failed to load notifications') });
      }
    },

    markRead: async (id) => {
      const before = get();
      const target = before.items.find(n => n.id === id);
      if (!target || target.readAt) return;
      set({
        items: before.items.map(n => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
        unread: Math.max(0, before.unread - 1),
      });
      try {
        await markRead(id);
      } catch (e) {
        set({ items: before.items, unread: before.unread });
        pushToast('error', `Could not mark notification as read: ${errorMessage(e)}`);
      }
    },

    markAllRead: async () => {
      const before = get();
      const now = new Date().toISOString();
      set({ items: before.items.map(n => (n.readAt ? n : { ...n, readAt: now })), unread: 0 });
      try {
        await markAllRead();
      } catch (e) {
        set({ items: before.items, unread: before.unread });
        pushToast('error', `Could not mark notifications as read: ${errorMessage(e)}`);
      }
    },

    start: () => {
      users += 1;
      if (users === 1) {
        let disposed = false;
        let poll: ReturnType<typeof setInterval> | null = null;
        const startPolling = () => {
          if (poll || disposed) return;
          set({ mode: 'polling' });
          poll = setInterval(() => { void get().refresh(); }, NOTIFICATION_POLL_MS);
        };
        const stopPolling = () => { if (poll) { clearInterval(poll); poll = null; } };
        let unsubscribe: () => void = () => undefined;

        void get().refresh();
        subscribeToNotifications(applyChange, status => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') { stopPolling(); set({ mode: 'realtime' }); void get().refresh(); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startPolling();
        }).then(un => { if (disposed) un(); else unsubscribe = un; }).catch(() => startPolling());
        // Until the channel confirms, keep the list fresh by polling.
        startPolling();

        teardown = () => { disposed = true; stopPolling(); unsubscribe(); set({ mode: 'idle' }); };
      }
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        users -= 1;
        if (users === 0 && teardown) { teardown(); teardown = null; }
      };
    },
  };
});
