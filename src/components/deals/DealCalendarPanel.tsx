import React, { useCallback, useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Flag, Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { Deal } from '../../types';
import type { Contact } from '../../types/contact';
import { CalendarEvent, CalendarEventService } from '../../services/calendarEventService';
import { DealDeadline, DealDeadlineService } from '../../services/dealDeadlineService';
import { canUseRemote, errorMessage, getCurrentUserId } from '../../services/dealRecordShared';
import { pushToast } from '../../store/dealRecordStore';

interface DealCalendarPanelProps {
  deal: Deal;
  contact?: Contact | null;
}

/** Native calendar tab: the deal's calendar_events and deal_deadlines, plus "Schedule meeting". */
export const DealCalendarPanel: React.FC<DealCalendarPanelProps> = ({ deal, contact }) => {
  const remote = canUseRemote(deal.id);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [deadlines, setDeadlines] = useState<DealDeadline[]>([]);
  const [loading, setLoading] = useState(remote);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!remote) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const [ev, dl] = await Promise.allSettled([
      CalendarEventService.getEvents({ dealId: deal.id }),
      DealDeadlineService.getDeadlines({ dealId: deal.id }),
    ]);
    if (ev.status === 'fulfilled') setEvents(ev.value); else setError(errorMessage(ev.reason, 'Could not load events'));
    if (dl.status === 'fulfilled') setDeadlines(dl.value);
    setLoading(false);
  }, [deal.id, remote]);

  useEffect(() => { void load(); }, [load]);

  const schedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(when);
    if (!when || isNaN(start.getTime())) { setError('Pick a date and time'); return; }
    setSaving(true);
    setError(null);
    try {
      const userId = (await getCurrentUserId()) ?? 'anonymous';
      await CalendarEventService.scheduleMeetingFromDeal(deal.id, userId, {
        title: title.trim() || undefined, startTime: start, durationMinutes: duration, includeContact: !!contact?.email,
      });
      pushToast('success', 'Meeting scheduled');
      setShowForm(false); setTitle(''); setWhen('');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not schedule meeting'));
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
  const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
          <CalendarIcon className="mr-2 h-5 w-5 text-blue-500" aria-hidden />Calendar
        </h3>
        <button type="button" disabled={!remote} onClick={() => setShowForm(s => !s)}
          title={remote ? undefined : 'Available once the deal is saved to the database'}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          <Plus className="h-4 w-4" aria-hidden />Schedule meeting
        </button>
      </div>

      {showForm && (
        <form onSubmit={schedule} aria-label="Schedule meeting" className={`${card} space-y-3`}>
          <input aria-label="Meeting title" value={title} onChange={e => setTitle(e.target.value)} placeholder={`Meeting about ${contact?.name ?? deal.company}`} className={input} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input aria-label="Start" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className={input} />
            <select aria-label="Duration" value={duration} onChange={e => setDuration(Number(e.target.value))} className={input}>
              {[15, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </div>
          {contact?.email && <p className="text-xs text-gray-500 dark:text-gray-400">{contact.name} ({contact.email}) will be added as an attendee.</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Scheduling...' : 'Schedule'}</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!remote ? (
        <div className={`${card} py-8 text-center text-sm text-gray-500 dark:text-gray-400`}>
          Calendar events and deadlines are stored in the database; they are not available for demo or unsaved deals.
        </div>
      ) : loading ? (
        <div role="status" className="py-8 text-center text-sm text-gray-500">Loading calendar...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className={card} aria-label="Events">
            <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Events</h4>
            {events.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No events scheduled.</p> : (
              <ul className="space-y-3">
                {events.map(ev => (
                  <li key={ev.id} className="flex items-start gap-3">
                    <CalendarIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{ev.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{format(ev.startTime, 'PPp')}{ev.status === 'cancelled' ? ' · cancelled' : ''}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={card} aria-label="Deadlines">
            <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Deadlines</h4>
            {deadlines.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No deadlines.</p> : (
              <ul className="space-y-3">
                {deadlines.map(d => (
                  <li key={d.id} className="flex items-start gap-3">
                    <Flag className={`mt-0.5 h-4 w-4 flex-shrink-0 ${d.status === 'overdue' ? 'text-red-500' : d.status === 'completed' ? 'text-green-500' : 'text-orange-500'}`} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{d.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{format(d.deadlineAt, 'PP')} · {d.status}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default DealCalendarPanel;
