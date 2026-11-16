import { supabase } from '../lib/core/supabaseClient';
import type { Deal } from '../types';
import type { DealFieldDefinition, FieldChange } from '../types/customFields';
import type { TimelineEvent } from './dealTimelineService';
import { canUseRemote, getCurrentUserId, localId } from './dealRecordShared';
import { formatMoney } from '../utils/currencyMicros';
import { formatCustomValue, getCachedDefinitions } from './customFieldService';

/**
 * Field-level history: renders `deal_activities` rows of type 'field_changed' (metadata {field,from,to},
 * written by the DB audit trigger) as "Value: $40,000 -> $55,000" with actor and time. Demo/local deals
 * have no trigger, so field edits are recorded in memory here and merged into the same event shape.
 */

export const FIELD_CHANGED = 'field_changed';

export interface FieldTimelineEvent extends TimelineEvent {
  actor?: string;
  field?: string;
}

export interface RawFieldChangeRow {
  id: string;
  type?: string;
  title?: string | null;
  metadata?: Record<string, any> | null;
  created_by?: string | null;
  created_at: string;
}

export interface FieldFormatContext {
  stageName?: (key: string) => string;
  ownerName?: (id: string) => string | undefined;
  currencyCode?: string;
  definitions?: DealFieldDefinition[];
}

const LABELS: Record<string, string> = {
  stage: 'Stage', value: 'Value', amount_micros: 'Value', title: 'Title', company: 'Company', contact: 'Contact',
  priority: 'Priority', probability: 'Probability', close_date: 'Close date', due_date: 'Due date', owner_id: 'Owner',
  assigned_to: 'Owner', assigned_to_id: 'Owner', notes: 'Summary', currency_code: 'Currency',
};

export const CUSTOM_PREFIXES = ['custom_fields.', 'custom.', 'custom_fields:'];

export const customKeyOf = (field: string): string | null => {
  const p = CUSTOM_PREFIXES.find(x => field.startsWith(x));
  return p ? field.slice(p.length) : null;
};

const definitionFor = (field: string, defs: DealFieldDefinition[]) => {
  const key = customKeyOf(field);
  return key ? defs.find(d => d.key === key) : undefined;
};

export function formatFieldLabel(field: string, defs: DealFieldDefinition[] = getCachedDefinitions()): string {
  const key = customKeyOf(field);
  if (key) return defs.find(d => d.key === key)?.label ?? key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  return LABELS[field] ?? field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

const parseDay = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Currency / date / owner / stage aware value rendering. `label` (from metadata) wins when present. */
export function formatFieldValue(field: string, value: unknown, ctx: FieldFormatContext = {}, label?: string | null): string {
  if (label) return label;
  if (isEmpty(value)) return 'empty';
  const defs = ctx.definitions ?? getCachedDefinitions();
  const def = definitionFor(field, defs);
  if (customKeyOf(field)) return formatCustomValue(def, value) || String(value);
  switch (field) {
    case 'value':
    case 'amount_micros': {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      return formatMoney(field === 'amount_micros' ? n / 1e6 : n, ctx.currencyCode ?? 'USD');
    }
    case 'probability': return `${value}%`;
    case 'close_date':
    case 'due_date':
    case 'deleted_at': {
      const d = parseDay(value);
      return d ? d.toLocaleDateString() : String(value);
    }
    case 'stage': return ctx.stageName?.(String(value)) ?? String(value);
    case 'owner_id':
    case 'assigned_to_id': return ctx.ownerName?.(String(value)) ?? String(value);
    default: return Array.isArray(value) ? value.join(', ') : String(value);
  }
}

/** "Value: $40,000 -> $55,000" */
export const formatFieldChange = (
  c: FieldChange & { fromLabel?: string | null; toLabel?: string | null }, ctx: FieldFormatContext = {}, labelOverride?: string,
): string =>
  `${labelOverride || formatFieldLabel(c.field, ctx.definitions)}: ${formatFieldValue(c.field, c.from, ctx, c.fromLabel)} → ${formatFieldValue(c.field, c.to, ctx, c.toLabel)}`;

export function fieldChangeToEvent(
  row: RawFieldChangeRow, ctx: FieldFormatContext = {}, actorName?: (id: string | null | undefined) => string | undefined,
): FieldTimelineEvent {
  const m = row.metadata ?? {};
  // Custom-field rows carry the bare custom key + custom:true + the definition label
  const field = m.custom && m.field && !customKeyOf(String(m.field)) ? `custom_fields.${m.field}` : String(m.field ?? 'field');
  const title = formatFieldChange({ field, from: m.from, to: m.to, fromLabel: m.from_label, toLabel: m.to_label }, ctx, typeof m.label === 'string' ? m.label : undefined);
  return {
    id: `a-${row.id}`, kind: 'activity', type: FIELD_CHANGED, title, at: new Date(row.created_at), field,
    actor: (typeof m.actor === 'string' && m.actor) || actorName?.(row.created_by) || undefined,
  };
}

// ---- local (demo) recording -------------------------------------------------------------------

const localRows = new Map<string, RawFieldChangeRow[]>();
const listeners = new Set<() => void>();
export const subscribeLocalFieldChanges = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getLocalFieldChangeRows = (dealId: string): RawFieldChangeRow[] => localRows.get(dealId) ?? [];
export const __resetLocalFieldChanges = () => { localRows.clear(); };

const SIMPLE: Array<[keyof Deal, string]> = [
  ['title', 'title'], ['company', 'company'], ['contact', 'contact'], ['value', 'value'], ['priority', 'priority'],
  ['probability', 'probability'], ['closeDate', 'close_date'], ['dueDate', 'due_date'], ['ownerId', 'owner_id'],
  ['notes', 'notes'], ['currencyCode', 'currency_code'],
];

const norm = (v: unknown): string => {
  if (isEmpty(v)) return '';
  if (v instanceof Date) return String(v.getTime());
  return Array.isArray(v) || typeof v === 'object' ? JSON.stringify(v) : String(v);
};
const dateNorm = (v: unknown): string => {
  const d = v ? parseDay(v) : null;
  return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : '';
};

export type DiffChange = FieldChange & { fromLabel?: string; toLabel?: string };

/**
 * Field changes implied by applying `updates` over `before`. Stage is skipped (the store already
 * records local stage changes); custom fields are diffed per key as `custom_fields.<key>`.
 */
export function diffDealUpdates(before: Partial<Deal>, updates: Partial<Deal>): DiffChange[] {
  const out: DiffChange[] = [];
  for (const [prop, field] of SIMPLE) {
    if (!Object.prototype.hasOwnProperty.call(updates, prop)) continue;
    const a = before[prop];
    const b = updates[prop];
    const same = field.endsWith('_date') ? dateNorm(a) === dateNorm(b) : norm(a) === norm(b);
    if (same) continue;
    const change: DiffChange = {
      field,
      from: a instanceof Date ? a.toISOString() : a ?? null,
      to: b instanceof Date ? b.toISOString() : b ?? null,
    };
    if (prop === 'ownerId') {
      change.fromLabel = before.assignedTo || undefined;
      change.toLabel = updates.assignedTo || undefined;
    }
    out.push(change);
  }
  if (updates.customFields) {
    const prev = before.customFields ?? {};
    const next = updates.customFields;
    for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      if (norm(prev[key]) !== norm(next[key])) out.push({ field: `custom_fields.${key}`, from: prev[key] ?? null, to: next[key] ?? null });
    }
  }
  return out;
}

/** Keep field edits of demo/local deals in memory so the Timeline shows them. No-op for remote deals (DB trigger logs them). */
export async function recordLocalFieldChanges(dealId: string, changes: DiffChange[], actor?: string): Promise<void> {
  if (canUseRemote(dealId) || changes.length === 0) return;
  const created_by = await getCurrentUserId();
  const now = Date.now();
  const rows = changes.map((c, i): RawFieldChangeRow => ({
    id: localId('fc'), type: FIELD_CHANGED, created_by, created_at: new Date(now + i).toISOString(),
    metadata: { field: c.field, from: c.from, to: c.to, from_label: c.fromLabel, to_label: c.toLabel, actor, local: true },
  }));
  localRows.set(dealId, [...rows.reverse(), ...(localRows.get(dealId) ?? [])]);
  listeners.forEach(l => l());
}

// ---- loading ----------------------------------------------------------------------------------

const profileNames = new Map<string, string>();

async function resolveNames(ids: string[]): Promise<void> {
  const missing = [...new Set(ids)].filter(id => id && !profileNames.has(id));
  if (missing.length === 0) return;
  try {
    const { data } = await supabase.from('profiles').select('id,name').in('id', missing);
    for (const p of (data ?? []) as Array<{ id: string; name?: string | null }>) if (p.name) profileNames.set(p.id, p.name);
  } catch { /* names are best effort */ }
}

/** field_changed events for a deal: remote rows (with resolved actor/owner names) plus local demo edits. */
export async function loadFieldChangeEvents(dealId: string, ctx: FieldFormatContext = {}, limit = 200): Promise<FieldTimelineEvent[]> {
  let rows: RawFieldChangeRow[] = [];
  if (canUseRemote(dealId)) {
    try {
      const { data, error } = await supabase.from('deal_activities').select('*').eq('deal_id', dealId).eq('type', FIELD_CHANGED)
        .order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      rows = (data ?? []) as RawFieldChangeRow[];
    } catch (e) {
      console.warn('Field history unavailable:', e);
    }
    const ids = rows.flatMap(r => [
      r.created_by ?? '',
      ...(['owner_id', 'assigned_to_id'].includes(String(r.metadata?.field)) ? [r.metadata?.from, r.metadata?.to].filter(Boolean).map(String) : []),
    ]);
    await resolveNames(ids);
  }
  rows = [...rows, ...getLocalFieldChangeRows(dealId)];
  const me = await getCurrentUserId();
  const full: FieldFormatContext = { ...ctx, ownerName: id => ctx.ownerName?.(id) ?? profileNames.get(id) };
  const actor = (id?: string | null) => (id ? (id === me ? 'You' : profileNames.get(id)) : undefined);
  return rows.map(r => fieldChangeToEvent(r, full, actor)).filter(e => !isNaN(e.at.getTime()));
}

/** Replace generic 'field_changed' events from the base timeline with the formatted ones, newest first. */
export function mergeFieldChangeEvents(base: TimelineEvent[], fieldEvents: FieldTimelineEvent[]): TimelineEvent[] {
  // The audit trigger may also write a generic 'updated' row for the same edit: drop it when a field event is within the window
  const near = (e: TimelineEvent) => fieldEvents.some(f => Math.abs(f.at.getTime() - e.at.getTime()) <= 2000);
  const kept = base.filter(e => e.type !== FIELD_CHANGED && !(e.type === 'updated' && e.kind === 'activity' && !e.diffs && near(e)));
  return [...kept, ...fieldEvents].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export const TimelineAdapter = { formatFieldChange, formatFieldValue, diffDealUpdates, recordLocalFieldChanges, loadFieldChangeEvents, mergeFieldChangeEvents };
