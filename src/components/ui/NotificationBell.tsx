import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../store/notificationStore';
import { UserNotification, notificationLink } from '../../services/notificationService';

export interface NotificationBellProps {
  /** Override navigation (defaults to react-router when mounted inside a Router, else location). */
  onNavigate?: (link: string, notification: UserNotification) => void;
  className?: string;
}

const timeAgo = (iso: string, now = Date.now()): string => {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const BellView: React.FC<NotificationBellProps & { navigate?: (link: string) => void }> = ({ onNavigate, navigate, className = '' }) => {
  const { items, unread, loading, error, start, markRead, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => start(), [start]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const go = (n: UserNotification) => {
    void markRead(n.id);
    const link = notificationLink(n);
    setOpen(false);
    if (!link) return;
    if (onNavigate) onNavigate(link, n);
    else if (navigate) navigate(link);
    else window.location.assign(link);
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span data-testid="notification-count" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</span>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unread === 0}
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline dark:text-blue-400"
            >
              <CheckCheck className="h-3.5 w-3.5" />Mark all read
            </button>
          </div>
          {error && <p role="alert" className="px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">{loading ? 'Loading...' : "You're all caught up"}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
              {items.map(n => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => go(n)}
                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 ${n.readAt ? '' : 'bg-blue-50/60 dark:bg-blue-900/20'}`}
                  >
                    <span aria-hidden className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-blue-600'}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.readAt ? 'text-gray-700 dark:text-gray-300' : 'font-medium text-gray-900 dark:text-white'}`}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-gray-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const RouterBell: React.FC<NotificationBellProps> = props => {
  const navigate = useNavigate();
  return <BellView {...props} navigate={link => navigate(link)} />;
};

/**
 * Bell with unread count + dropdown. Subscribes to user_notifications via realtime (polling
 * fallback); in demo mode it shows the in-memory notifications created by @mentions.
 * Mount once in the Pipeline header and the deal record page.
 */
export const NotificationBell: React.FC<NotificationBellProps> = props => {
  const inRouter = useInRouterContext();
  return inRouter ? <RouterBell {...props} /> : <BellView {...props} />;
};

export default NotificationBell;
