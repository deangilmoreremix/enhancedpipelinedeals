import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock, FileText, Paperclip, TrendingUp, Trash2, RotateCcw, Plus, CheckCircle2, ListChecks, Pencil,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { useDealStore } from '../../store/dealStore';
import {
  TimelineEvent, TimelineValueFormatter, defaultHistoryValue, formatDiff, getDealTimeline,
} from '../../services/dealTimelineService';

interface DealTimelineProps {
  dealId: string;
  isLoading?: boolean;
  maxItems?: number;
  showFilters?: boolean;
  /** Bump to force a reload (e.g. after editing a note elsewhere). */
  refreshKey?: number | string;
}

const iconFor = (e: TimelineEvent) => {
  if (e.kind === 'note') return <FileText className="h-4 w-4" />;
  if (e.kind === 'file') return <Paperclip className="h-4 w-4" />;
  if (e.kind === 'task') return e.type === 'task_done' ? <CheckCircle2 className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />;
  switch (e.type) {
    case 'created': return <Plus className="h-4 w-4" />;
    case 'stage_changed': return <TrendingUp className="h-4 w-4" />;
    case 'deleted': return <Trash2 className="h-4 w-4" />;
    case 'restored': return <RotateCcw className="h-4 w-4" />;
    case 'updated': return <Pencil className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
};

const colorFor = (e: TimelineEvent) => {
  if (e.kind === 'note') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
  if (e.kind === 'file') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  if (e.kind === 'task') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
  switch (e.type) {
    case 'created': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'stage_changed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'deleted': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'restored': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
};

const dayLabel = (d: Date) => (isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy'));

const FILTERS: Array<{ id: string; label: string; match: (e: TimelineEvent) => boolean }> = [
  { id: 'all', label: 'All activity', match: () => true },
  { id: 'changes', label: 'Deal changes', match: e => e.kind === 'activity' },
  { id: 'note', label: 'Notes', match: e => e.kind === 'note' },
  { id: 'task', label: 'Tasks', match: e => e.kind === 'task' },
  { id: 'file', label: 'Files', match: e => e.kind === 'file' },
];

const DealTimeline: React.FC<DealTimelineProps> = ({ dealId, isLoading = false, maxItems = 100, showFilters = false, refreshKey }) => {
  const stages = useDealStore(s => s.stages);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const formatValue = useMemo<TimelineValueFormatter>(() => (field, value) => {
    if (field === 'stage' && value) return stages.find(s => s.key === value)?.name ?? defaultHistoryValue(field, value);
    return defaultHistoryValue(field, value);
  }, [stages]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getDealTimeline(dealId, { limit: maxItems * 2, formatValue })
      .then(list => { if (alive) setEvents(list); })
      .catch(err => console.error('Error loading deal timeline:', err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [dealId, maxItems, formatValue, refreshKey]);

  const visible = useMemo(() => {
    const f = FILTERS.find(x => x.id === filter) ?? FILTERS[0];
    return events.filter(f.match).slice(0, maxItems);
  }, [events, filter, maxItems]);

  const groups = useMemo(() => {
    const out: Array<{ key: string; label: string; items: TimelineEvent[] }> = [];
    for (const e of visible) {
      const key = format(e.at, 'yyyy-MM-dd');
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(e);
      else out.push({ key, label: dayLabel(e.at), items: [e] });
    }
    return out;
  }, [visible]);

  if (loading || isLoading) {
    return (
      <div className="animate-pulse space-y-4" role="status" aria-label="Loading timeline">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex space-x-3">
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <h3 className="flex items-center font-semibold text-gray-900 dark:text-white">
          <Clock className="mr-2 h-5 w-5" />
          Deal Timeline
        </h3>
        {showFilters && (
          <select
            aria-label="Filter timeline"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {FILTERS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        )}
      </div>

      <div className="p-4">
        {groups.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No activity yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(g => (
              <section key={g.key} aria-label={g.label}>
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{g.label}</h4>
                <ol className="space-y-4">
                  {g.items.map(e => (
                    <li key={e.id} className="flex space-x-3">
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${colorFor(e)}`}>{iconFor(e)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h5 className="text-sm font-medium text-gray-900 dark:text-white">{e.title}</h5>
                          <time dateTime={e.at.toISOString()} className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">{format(e.at, 'p')}</time>
                        </div>
                        {e.description && <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{e.description}</p>}
                        {e.diffs && (
                          <ul className="mt-1 space-y-0.5">
                            {e.diffs.map((d, i) => <li key={i} className="text-sm text-gray-600 dark:text-gray-300">{formatDiff(d)}</li>)}
                          </ul>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DealTimeline;
