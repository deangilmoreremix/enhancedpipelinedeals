import React from 'react';
import { Mail, Phone, Calendar, MessageSquare, ChevronDown, ChevronRight, Reply } from 'lucide-react';
import type { CommEntry, CommChannel } from '../../../services/dealCommunicationService';

export const CHANNEL_META: Record<CommChannel, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }> = {
  email: { label: 'Email', Icon: Mail, color: 'text-blue-600 dark:text-blue-400' },
  call: { label: 'Calls', Icon: Phone, color: 'text-green-600 dark:text-green-400' },
  meeting: { label: 'Meetings', Icon: Calendar, color: 'text-purple-600 dark:text-purple-400' },
  message: { label: 'Messages', Icon: MessageSquare, color: 'text-amber-600 dark:text-amber-400' },
};

const statusClass = (s: string) =>
  s === 'queued' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    : s === 'failed' || s === 'error' || s === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};

export const CommEntryCard: React.FC<{
  entry: CommEntry;
  expanded: boolean;
  onToggle: () => void;
  onReply?: (entry: CommEntry) => void;
}> = ({ entry, expanded, onToggle, onReply }) => {
  const meta = CHANNEL_META[entry.channel];
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const expandable = entry.messages.length > 0 || entry.participants.length > 0 || !!entry.location;
  return (
    <li className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800" data-testid="comm-entry">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        disabled={!expandable}
        className="flex w-full items-start gap-3 p-3 text-left disabled:cursor-default"
      >
        <meta.Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${meta.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-gray-900 dark:text-white">{entry.subject}</span>
            {entry.sample && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-700 dark:bg-gray-600 dark:text-gray-100">Sample</span>}
            {entry.status && <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(entry.status)}`}>{entry.status === 'queued' ? 'Queued' : entry.status}</span>}
            {entry.channel === 'email' && entry.messageCount > 1 && <span className="text-xs text-gray-500 dark:text-gray-400">{entry.messageCount} messages</span>}
            {entry.durationLabel && <span className="text-xs text-gray-500 dark:text-gray-400">{entry.durationLabel}</span>}
          </div>
          {!expanded && entry.preview && <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-300">{entry.preview}</p>}
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {fmt(entry.at)}{entry.direction ? ` · ${entry.direction}` : ''}
          </p>
        </div>
        {expandable && <Chevron className="mt-1 h-4 w-4 flex-shrink-0 text-gray-400" />}
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-gray-100 p-3 dark:border-gray-700">
          {entry.participants.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">With: {entry.participants.join(', ')}</p>
          )}
          {entry.location && <p className="text-xs text-gray-500 dark:text-gray-400">Where: {entry.location}</p>}
          {entry.messages.map(m => (
            <div key={m.id} className="rounded-md bg-gray-50 p-2 text-sm dark:bg-gray-900/40">
              <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{m.from ?? (m.direction === 'outbound' ? 'You' : '')}{m.to && m.to.length ? ` → ${m.to.join(', ')}` : ''}</span>
                <span>{fmt(m.at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{m.body || '(no content)'}</p>
            </div>
          ))}
          {entry.messages.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No further details recorded.</p>}
          {entry.channel === 'email' && onReply && !entry.sample && (
            <button type="button" onClick={() => onReply(entry)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
              <Reply className="h-4 w-4" />Reply
            </button>
          )}
        </div>
      )}
    </li>
  );
};
