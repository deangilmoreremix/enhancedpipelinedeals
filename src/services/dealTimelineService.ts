import { supabase } from './supabaseService';
import { DealActivity } from '../types';
import { canUseRemote } from './dealRecordShared';
import { listNotes } from './dealNotesService';
import { listTasks } from './dealTasksService';
import { listFiles } from './dealFilesService';

/**
 * Service for managing deal timeline and activity tracking
 */
export class DealTimelineService {
  /**
   * Get all activities for a deal
   */
  static async getDealActivities(dealId: string, limit: number = 50): Promise<DealActivity[]> {
    try {
      const { data, error } = await supabase
        .from('deal_activities')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching deal activities:', error);
      return [];
    }
  }

  /**
   * Add a new activity to a deal's timeline
   */
  static async addActivity(
    dealId: string,
    type: DealActivity['type'],
    title: string,
    description: string,
    metadata?: Record<string, any>,
    createdBy?: string
  ): Promise<DealActivity | null> {
    try {
      const activity = {
        deal_id: dealId,
        type,
        title,
        description,
        metadata: metadata || {},
        created_by: createdBy,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('deal_activities')
        .insert(activity)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding deal activity:', error);
      return null;
    }
  }

  /**
   * Get activity summary for a deal
   */
  static async getActivitySummary(dealId: string): Promise<{
    totalActivities: number;
    activitiesByType: Record<string, number>;
    lastActivityDate: Date | null;
    recentActivityCount: number; // Last 7 days
  }> {
    try {
      const { data: activities, error } = await supabase
        .from('deal_activities')
        .select('type, created_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const activitiesByType: Record<string, number> = {};
      let lastActivityDate: Date | null = null;
      let recentActivityCount = 0;

      const sevenDaysAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);

      activities?.forEach(activity => {
        // Count by type
        activitiesByType[activity.type] = (activitiesByType[activity.type] || 0) + 1;

        // Track last activity
        if (!lastActivityDate || new Date(activity.created_at) > lastActivityDate) {
          lastActivityDate = new Date(activity.created_at);
        }

        // Count recent activities
        if (new Date(activity.created_at) > sevenDaysAgo) {
          recentActivityCount++;
        }
      });

      return {
        totalActivities: activities?.length || 0,
        activitiesByType,
        lastActivityDate,
        recentActivityCount
      };
    } catch (error) {
      console.error('Error getting activity summary:', error);
      return {
        totalActivities: 0,
        activitiesByType: {},
        lastActivityDate: null,
        recentActivityCount: 0
      };
    }
  }

  /**
   * Log common deal events automatically
   */
  static async logDealCreated(dealId: string, dealData: any, createdBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'created',
      'Deal Created',
      `New deal created for ${dealData.company} with value $${dealData.value?.toLocaleString() || 'N/A'}`,
      { company: dealData.company, value: dealData.value, stage: dealData.stage },
      createdBy
    );
  }

  static async logDealUpdated(dealId: string, oldData: any, newData: any, updatedBy?: string): Promise<void> {
    const changes: string[] = [];

    if (oldData.stage !== newData.stage) {
      changes.push(`Stage: ${oldData.stage} → ${newData.stage}`);
    }
    if (oldData.value !== newData.value) {
      changes.push(`Value: $${oldData.value?.toLocaleString()} → $${newData.value?.toLocaleString()}`);
    }
    if (oldData.probability !== newData.probability) {
      changes.push(`Probability: ${oldData.probability}% → ${newData.probability}%`);
    }
    if (oldData.assignedTo !== newData.assignedTo) {
      changes.push(`Assigned: ${oldData.assignedTo || 'Unassigned'} → ${newData.assignedTo || 'Unassigned'}`);
    }

    if (changes.length > 0) {
      await this.addActivity(
        dealId,
        'updated',
        'Deal Updated',
        `Deal updated: ${changes.join(', ')}`,
        { changes, oldData, newData },
        updatedBy
      );
    }
  }

  static async logStageChanged(dealId: string, oldStage: string, newStage: string, changedBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'stage_changed',
      'Stage Changed',
      `Deal moved from ${oldStage} to ${newStage}`,
      { oldStage, newStage },
      changedBy
    );
  }

  static async logContactAdded(dealId: string, contactName: string, addedBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'contact_added',
      'Contact Added',
      `Contact ${contactName} added to deal`,
      { contactName },
      addedBy
    );
  }

  static async logNoteAdded(dealId: string, notePreview: string, addedBy?: string): Promise<void> {
    const preview = notePreview.length > 50 ? notePreview.substring(0, 50) + '...' : notePreview;
    await this.addActivity(
      dealId,
      'note_added',
      'Note Added',
      `Note added: ${preview}`,
      { notePreview },
      addedBy
    );
  }

  static async logEmailSent(dealId: string, subject: string, recipient: string, sentBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'email_sent',
      'Email Sent',
      `Email sent to ${recipient}: ${subject}`,
      { subject, recipient },
      sentBy
    );
  }

  static async logMeetingScheduled(dealId: string, title: string, date: Date, attendees: string[], scheduledBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'meeting_scheduled',
      'Meeting Scheduled',
      `Meeting "${title}" scheduled for ${date.toLocaleDateString()} with ${attendees.length} attendees`,
      { title, date: date.toISOString(), attendees },
      scheduledBy
    );
  }

  static async logAttachmentAdded(dealId: string, filename: string, size: number, addedBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'attachment_added',
      'Attachment Added',
      `File "${filename}" (${(size / 1024).toFixed(1)} KB) added to deal`,
      { filename, size },
      addedBy
    );
  }

  static async logBulkAction(dealId: string, actionName: string, details: string, performedBy?: string): Promise<void> {
    await this.addActivity(
      dealId,
      'bulk_action',
      'Bulk Action Applied',
      `${actionName}: ${details}`,
      { actionName, details },
      performedBy
    );
  }

  /**
   * Clean up old activities (keep last 1000 per deal)
   */
  static async cleanupOldActivities(dealId: string): Promise<number> {
    try {
      // Get count of activities for this deal
      const { count } = await supabase
        .from('deal_activities')
        .select('*', { count: 'exact', head: true })
        .eq('deal_id', dealId);

      if (!count || count <= 1000) return 0;

      // Delete oldest activities beyond the limit
      const activitiesToDelete = count - 1000;

      const { data: oldestActivities } = await supabase
        .from('deal_activities')
        .select('id')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true })
        .limit(activitiesToDelete);

      if (oldestActivities && oldestActivities.length > 0) {
        const { error } = await supabase
          .from('deal_activities')
          .delete()
          .in('id', oldestActivities.map(a => a.id));

        if (error) throw error;
        return oldestActivities.length;
      }

      return 0;
    } catch (error) {
      console.error('Error cleaning up old activities:', error);
      return 0;
    }
  }
}

// Export convenience functions
export const getDealActivities = DealTimelineService.getDealActivities;
export const addActivity = DealTimelineService.addActivity;
export const getActivitySummary = DealTimelineService.getActivitySummary;
export const logDealCreated = DealTimelineService.logDealCreated;
export const logDealUpdated = DealTimelineService.logDealUpdated;
export const logStageChanged = DealTimelineService.logStageChanged;
export const logContactAdded = DealTimelineService.logContactAdded;
export const logNoteAdded = DealTimelineService.logNoteAdded;
export const logEmailSent = DealTimelineService.logEmailSent;
export const logMeetingScheduled = DealTimelineService.logMeetingScheduled;
export const logAttachmentAdded = DealTimelineService.logAttachmentAdded;
export const logBulkAction = DealTimelineService.logBulkAction;

// ---------------------------------------------------------------------------
// Merged record timeline: deal_activities + deal_history + notes + tasks + files
// ---------------------------------------------------------------------------

export type TimelineEventKind = 'activity' | 'note' | 'task' | 'file';

export interface TimelineDiff {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  /** deal_activities.type for activities; 'note' | 'task' | 'task_done' | 'file' otherwise. */
  type: string;
  title: string;
  description?: string;
  at: Date;
  diffs?: TimelineDiff[];
}

export interface RawActivityRow { id: string; type: string; title?: string | null; description?: string | null; metadata?: Record<string, any> | null; created_at: string }
export interface RawHistoryRow { id: string; field: string | null; old_value: string | null; new_value: string | null; changed_at: string }

const FIELD_LABELS: Record<string, string> = {
  stage: 'Stage', value: 'Value', title: 'Title', company: 'Company', priority: 'Priority',
  probability: 'Probability', close_date: 'Close date', owner_id: 'Owner', deleted_at: 'Deleted',
};

export type TimelineValueFormatter = (field: string, value: string | null) => string;

/** Default rendering of a raw history value (dates, empties). */
export const defaultHistoryValue: TimelineValueFormatter = (field, value) => {
  if (value === null || value === undefined || value === '') return 'empty';
  if (field === 'close_date' || field === 'deleted_at') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString();
  }
  if (field === 'value') {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : value;
  }
  if (field === 'probability') return `${value}%`;
  return value;
};

export const historyToDiff = (h: RawHistoryRow, fmt: TimelineValueFormatter = defaultHistoryValue): TimelineDiff => {
  const field = h.field ?? 'field';
  return {
    field,
    label: FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()),
    from: fmt(field, h.old_value),
    to: fmt(field, h.new_value),
  };
};

/** "Stage: Proposal → Negotiation" */
export const formatDiff = (d: TimelineDiff): string => `${d.label}: ${d.from} \u2192 ${d.to}`;

const ACTIVITY_TITLES: Record<string, string> = {
  created: 'Deal created', stage_changed: 'Stage changed', updated: 'Deal updated',
  deleted: 'Deal deleted', restored: 'Deal restored',
};

/**
 * Pure merge used by the Timeline tab. History rows written by the audit trigger in the same
 * statement as an activity row (within `windowMs`) are attached to that activity as diffs;
 * remaining history rows become their own events. Sorted newest first.
 */
export function buildTimelineEvents(input: {
  activities?: RawActivityRow[];
  history?: RawHistoryRow[];
  notes?: Array<{ id: string; title: string | null; bodyText: string; createdAt: string }>;
  tasks?: Array<{ id: string; title: string; status: string; createdAt: string; updatedAt: string }>;
  files?: Array<{ id: string; name: string; createdAt: string }>;
  formatValue?: TimelineValueFormatter;
  windowMs?: number;
}): TimelineEvent[] {
  const fmt = input.formatValue ?? defaultHistoryValue;
  const windowMs = input.windowMs ?? 2000;
  const events: TimelineEvent[] = [];
  const usedHistory = new Set<string>();

  for (const a of input.activities ?? []) {
    const at = new Date(a.created_at);
    let diffs: TimelineDiff[] | undefined;
    if (a.type === 'stage_changed' || a.type === 'updated') {
      const matched = (input.history ?? []).filter(h => Math.abs(new Date(h.changed_at).getTime() - at.getTime()) <= windowMs);
      matched.forEach(h => usedHistory.add(h.id));
      diffs = matched.map(h => historyToDiff(h, fmt));
    }
    events.push({
      id: `a-${a.id}`, kind: 'activity', type: a.type,
      title: a.title || ACTIVITY_TITLES[a.type] || a.type.replace(/_/g, ' '),
      description: a.description || undefined, at, diffs: diffs && diffs.length ? diffs : undefined,
    });
  }

  for (const h of input.history ?? []) {
    if (usedHistory.has(h.id)) continue;
    const diff = historyToDiff(h, fmt);
    events.push({ id: `h-${h.id}`, kind: 'activity', type: 'updated', title: 'Deal updated', at: new Date(h.changed_at), diffs: [diff] });
  }

  for (const n of input.notes ?? []) {
    events.push({
      id: `n-${n.id}`, kind: 'note', type: 'note', title: n.title ? `Note added: ${n.title}` : 'Note added',
      description: n.bodyText.length > 160 ? `${n.bodyText.slice(0, 160)}...` : n.bodyText, at: new Date(n.createdAt),
    });
  }

  for (const t of input.tasks ?? []) {
    events.push({ id: `t-${t.id}`, kind: 'task', type: 'task', title: `Task added: ${t.title}`, at: new Date(t.createdAt) });
    if (t.status === 'done') {
      events.push({ id: `td-${t.id}`, kind: 'task', type: 'task_done', title: `Task completed: ${t.title}`, at: new Date(t.updatedAt) });
    }
  }

  for (const f of input.files ?? []) {
    events.push({ id: `f-${f.id}`, kind: 'file', type: 'file', title: `File uploaded: ${f.name}`, at: new Date(f.createdAt) });
  }

  return events
    .filter(e => !isNaN(e.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

// ---------------------------------------------------------------------------
// enhanced_activities read adapter + manual "Log activity" + contact timeline
// ---------------------------------------------------------------------------

export interface RawEnhancedActivityRow {
  id: string; activity_type?: string | null; title?: string | null; description?: string | null;
  metadata?: Record<string, any> | null; created_at: string;
}

/**
 * Adapt legacy `enhanced_activities` rows to timeline activity rows, dropping rows already present
 * in `existing` (same id, or same title within `windowMs`) and duplicates among themselves.
 */
export function adaptEnhancedActivities(
  rows: RawEnhancedActivityRow[],
  existing: RawActivityRow[] = [],
  windowMs = 2000,
): RawActivityRow[] {
  const seenIds = new Set(existing.map(a => a.id));
  const kept: RawActivityRow[] = [...existing];
  const out: RawActivityRow[] = [];
  const near = (a: RawActivityRow, b: RawActivityRow) =>
    (a.title ?? '').trim().toLowerCase() === (b.title ?? '').trim().toLowerCase() &&
    Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) <= windowMs;
  for (const r of rows) {
    if (seenIds.has(r.id)) continue;
    const adapted: RawActivityRow = {
      id: r.id, type: r.activity_type || 'updated', title: r.title ?? null,
      description: r.description ?? null, metadata: { ...(r.metadata ?? {}), source: 'enhanced_activities' }, created_at: r.created_at,
    };
    if (kept.some(k => near(k, adapted))) continue;
    seenIds.add(r.id);
    kept.push(adapted);
    out.push(adapted);
  }
  return out;
}

// Demo / local deals keep manually logged activities in memory for the session.
const localActivities = new Map<string, RawActivityRow[]>();

/** Manual "Log activity" entry. Writes deal_activities when the deal is remote, otherwise keeps it in memory. */
export async function logManualActivity(
  dealId: string,
  input: { type: string; title: string; description?: string; metadata?: Record<string, any> },
): Promise<RawActivityRow> {
  const title = input.title.trim();
  if (!title) throw new Error('Title is required');
  const row: RawActivityRow = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: input.type, title,
    description: input.description?.trim() || null, metadata: { ...(input.metadata ?? {}), manual: true }, created_at: new Date().toISOString(),
  };
  if (canUseRemote(dealId)) {
    const { data, error } = await supabase.from('deal_activities').insert({
      deal_id: dealId, type: row.type, title: row.title, description: row.description, metadata: row.metadata, created_at: row.created_at,
    }).select().single();
    if (error) throw error;
    return data as RawActivityRow;
  }
  localActivities.set(dealId, [row, ...(localActivities.get(dealId) ?? [])]);
  return row;
}

/**
 * Demo / local deals have no audit trigger: record stage changes in memory so the Timeline still shows them.
 * No-op for remote deals (the database trigger writes deal_activities).
 */
export function recordLocalStageChange(dealId: string, fromName: string, toName: string): void {
  if (canUseRemote(dealId) || fromName === toName) return;
  const row: RawActivityRow = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: 'stage_changed', title: 'Stage changed',
    description: `Stage: ${fromName} \u2192 ${toName}`, metadata: { from: fromName, to: toName, local: true }, created_at: new Date().toISOString(),
  };
  localActivities.set(dealId, [row, ...(localActivities.get(dealId) ?? [])]);
}

/** Activity rows of several deals + communication records of a contact, as timeline events (newest first). */
export async function getContactTimeline(contactId: string, dealIds: string[], limit = 100): Promise<TimelineEvent[]> {
  const safe = async <T,>(p: PromiseLike<T>, fallback: T): Promise<T> => {
    try { return await p; } catch (e) { console.warn('Contact timeline source failed:', e); return fallback; }
  };
  const remoteDeals = dealIds.filter(canUseRemote);
  const [acts, comms] = await Promise.all([
    remoteDeals.length
      ? safe((async () => {
          const { data, error } = await supabase.from('deal_activities').select('*').in('deal_id', remoteDeals)
            .order('created_at', { ascending: false }).limit(limit);
          if (error) throw error;
          return (data ?? []) as Array<RawActivityRow & { deal_id?: string }>;
        })(), [] as Array<RawActivityRow & { deal_id?: string }>)
      : Promise.resolve([] as Array<RawActivityRow & { deal_id?: string }>),
    canUseRemote(contactId)
      ? safe((async () => {
          const { data, error } = await supabase.from('communication_records').select('*').eq('contact_id', contactId)
            .order('timestamp', { ascending: false }).limit(limit);
          if (error) throw error;
          return (data ?? []) as Array<Record<string, any>>;
        })(), [] as Array<Record<string, any>>)
      : Promise.resolve([] as Array<Record<string, any>>),
  ]);
  const local = dealIds.flatMap(id => localActivities.get(id) ?? []);
  const events = buildTimelineEvents({ activities: [...acts, ...local] });
  for (const c of comms) {
    const at = new Date(c.timestamp ?? c.created_at);
    const kind = String(c.type ?? 'communication');
    events.push({
      id: `c-${c.id}`, kind: 'activity', type: kind,
      title: c.subject || `${kind[0].toUpperCase()}${kind.slice(1)}${c.direction ? ` (${c.direction})` : ''}`,
      description: c.content ? String(c.content).slice(0, 240) : undefined, at,
    });
  }
  return events.filter(e => !isNaN(e.at.getTime())).sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** Load + merge every timeline source for a deal. Missing/denied sources degrade to empty. */
export async function getDealTimeline(
  dealId: string,
  opts: { limit?: number; formatValue?: TimelineValueFormatter } = {}
): Promise<TimelineEvent[]> {
  const limit = opts.limit ?? 200;
  const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
    try { return await p; } catch (e) { console.warn('Timeline source failed:', e); return fallback; }
  };

  let activities: RawActivityRow[] = [];
  let history: RawHistoryRow[] = [];
  if (canUseRemote(dealId)) {
    [activities, history] = await Promise.all([
      safe((async () => {
        const { data, error } = await supabase.from('deal_activities').select('*').eq('deal_id', dealId)
          .order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return (data ?? []) as RawActivityRow[];
      })(), [] as RawActivityRow[]),
      safe((async () => {
        const { data, error } = await supabase.from('deal_history').select('*').eq('deal_id', dealId)
          .order('changed_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return (data ?? []) as RawHistoryRow[];
      })(), [] as RawHistoryRow[]),
    ]);
  }
  if (canUseRemote(dealId)) {
    const legacy = await safe((async () => {
      const { data, error } = await supabase.from('enhanced_activities').select('*').eq('deal_id', dealId)
        .order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as RawEnhancedActivityRow[];
    })(), [] as RawEnhancedActivityRow[]);
    activities = [...activities, ...adaptEnhancedActivities(legacy, activities)];
  }
  activities = [...activities, ...(localActivities.get(dealId) ?? [])];
  const [notes, tasks, files] = await Promise.all([
    safe(listNotes(dealId), []), safe(listTasks(dealId), []), safe(listFiles(dealId), []),
  ]);
  return buildTimelineEvents({ activities, history, notes, tasks, files, formatValue: opts.formatValue }).slice(0, limit);
}
