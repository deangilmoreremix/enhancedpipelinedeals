import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import DealTimeline from './DealTimeline';
import { logManualActivity } from '../../services/dealTimelineService';
import { pushToast } from '../../store/dealRecordStore';

export const ACTIVITY_TYPES: Array<{ value: string; label: string }> = [
  { value: 'note_added', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email_sent', label: 'Email' },
  { value: 'meeting_scheduled', label: 'Meeting' },
  { value: 'task_completed', label: 'Task completed' },
  { value: 'updated', label: 'Other update' },
];

interface DealActivityPanelProps {
  dealId: string;
  /** Bump to force a timeline reload. */
  refreshKey?: number | string;
}

/**
 * The deal's single activity view: the merged DealTimeline plus a manual "Log activity" form
 * (writes to deal_activities; legacy enhanced_activities rows are merged by the timeline service).
 */
export const DealActivityPanel: React.FC<DealActivityPanelProps> = ({ dealId, refreshKey }) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('note_added');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  const reset = () => { setTitle(''); setDescription(''); setType('note_added'); setError(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError(null);
    try {
      await logManualActivity(dealId, { type, title, description });
      pushToast('success', 'Activity logged');
      reset();
      setOpen(false);
      setBump(b => b + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log activity');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!open && (
          <button type="button" onClick={() => setOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" aria-hidden />Log activity
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} aria-label="Log activity" className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Log activity</h4>
            <button type="button" aria-label="Close form" onClick={() => { reset(); setOpen(false); }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select aria-label="Activity type" value={type} onChange={e => setType(e.target.value)} className={input}>
              {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input aria-label="Activity title" value={title} onChange={e => setTitle(e.target.value)} placeholder="What happened?" className={`${input} sm:col-span-2`} />
          </div>
          <textarea aria-label="Activity details" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Details (optional)" className={input} />
          {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { reset(); setOpen(false); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save activity'}
            </button>
          </div>
        </form>
      )}
      <DealTimeline dealId={dealId} showFilters maxItems={200} refreshKey={`${refreshKey ?? ''}-${bump}`} />
    </div>
  );
};

export default DealActivityPanel;
