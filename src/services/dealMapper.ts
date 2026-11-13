import type { Deal } from '../types';

/**
 * Row <-> Deal mapping. The single place where deals cross the Supabase boundary.
 * DB columns are snake_case; the app model is camelCase with Date objects.
 */
export type DealRow = Record<string, any>;

const toDate = (v: unknown): Date | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? undefined : d;
};

const toIso = (v: unknown): string | null => {
  const d = toDate(v);
  return d ? d.toISOString() : null;
};

const toNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Drop null/undefined so optional fields stay absent on the Deal. */
const defined = <T extends object>(o: T): T => {
  const out: Record<string, unknown> = {};
  Object.entries(o).forEach(([k, v]) => {
    if (v !== null && v !== undefined) out[k] = v;
  });
  return out as T;
};

export function dealFromRow(row: DealRow): Deal {
  const value = toNum(row.value) ?? (row.amount_micros != null ? Number(row.amount_micros) / 1e6 : 0);
  const now = new Date();
  const deal = {
    id: row.id,
    title: row.title ?? undefined,
    company: row.company ?? '',
    companyId: row.company_id ?? undefined,
    contact: row.contact ?? '',
    contactId: row.contact_id ?? undefined,
    assignedToId: row.assigned_to_id ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    value,
    stage: row.stage ?? 'qualification',
    probability: toNum(row.probability) ?? 0,
    priority: (row.priority ?? 'medium') as Deal['priority'],
    dueDate: toDate(row.due_date),
    notes: row.notes ?? undefined,
    createdAt: toDate(row.created_at) ?? now,
    updatedAt: toDate(row.updated_at) ?? toDate(row.created_at) ?? now,
    contactAvatar: row.contact_avatar ?? undefined,
    companyAvatar: row.company_avatar ?? undefined,
    lastActivity: row.last_activity ?? undefined,
    tags: row.tags ?? undefined,
    isFavorite: row.is_favorite ?? undefined,
    customFields: row.custom_fields ?? undefined,
    socialProfiles: row.social_profiles ?? undefined,
    lastEnrichment: row.last_enrichment ?? undefined,
    attachments: row.attachments ?? undefined,
    links: row.links ?? undefined,
    nextFollowUp: row.next_follow_up ?? undefined,
    aiScore: toNum(row.ai_score),
    healthScore: toNum(row.health_score),
    healthFactors: row.health_factors ?? undefined,
    winProbability: toNum(row.win_probability),
    probabilityFactors: row.probability_factors ?? undefined,
    templateId: row.template_id ?? undefined,
    timeline: row.timeline ?? undefined,
    lastHealthUpdate: toDate(row.last_health_update),
    lastProbabilityUpdate: toDate(row.last_probability_update),
    position: toNum(row.position),
    deletedAt: toDate(row.deleted_at), // absent => active deal
    // Canonical owner = owner_id; legacy rows only carried assigned_to_id
    ownerId: row.owner_id ?? row.assigned_to_id ?? undefined,
    closeDate: toDate(row.close_date),
    currencyCode: row.currency_code ?? undefined,
    // Read-only, set by the database (RLS ownership/workspace checks use these)
    createdBy: row.created_by ?? undefined,
    workspaceId: row.workspace_id ?? undefined,
  };
  return defined(deal) as Deal;
}

export interface DealToRowOptions {
  /** Only emit keys present on the input (for updates); full writes also stamp created_at/updated_at. */
  partial?: boolean;
}

type Entry = [keyof Deal, string, (v: any) => unknown];
const id = (v: unknown) => v;

// Deal key -> row column(s). `value` is handled specially (also emits amount_micros).
const FIELDS: Entry[] = [
  ['title', 'title', id],
  ['company', 'company', id],
  ['companyId', 'company_id', id],
  ['contact', 'contact', id],
  ['contactId', 'contact_id', id],
  ['assignedToId', 'assigned_to_id', id],
  ['assignedTo', 'assigned_to', id],
  ['stage', 'stage', id],
  ['probability', 'probability', id],
  ['priority', 'priority', id],
  ['dueDate', 'due_date', toIso],
  ['notes', 'notes', id],
  ['contactAvatar', 'contact_avatar', id],
  ['companyAvatar', 'company_avatar', id],
  ['lastActivity', 'last_activity', id],
  ['tags', 'tags', id],
  ['isFavorite', 'is_favorite', id],
  ['customFields', 'custom_fields', id],
  ['socialProfiles', 'social_profiles', id],
  ['lastEnrichment', 'last_enrichment', id],
  ['attachments', 'attachments', id],
  ['links', 'links', id],
  ['nextFollowUp', 'next_follow_up', id],
  ['aiScore', 'ai_score', id],
  ['healthScore', 'health_score', id],
  ['healthFactors', 'health_factors', id],
  ['winProbability', 'win_probability', id],
  ['probabilityFactors', 'probability_factors', id],
  ['templateId', 'template_id', id],
  ['timeline', 'timeline', id],
  ['lastHealthUpdate', 'last_health_update', toIso],
  ['lastProbabilityUpdate', 'last_probability_update', toIso],
  ['position', 'position', id],
  ['deletedAt', 'deleted_at', toIso],
  ['ownerId', 'owner_id', id],
  ['closeDate', 'close_date', toIso],
  ['currencyCode', 'currency_code', id],
];

export function dealToRow(deal: Partial<Deal>, opts: DealToRowOptions = {}): DealRow {
  const row: DealRow = {};
  const has = (k: keyof Deal) => Object.prototype.hasOwnProperty.call(deal, k) && deal[k] !== undefined;

  if (has('id')) row.id = deal.id;
  if (has('value')) {
    row.value = deal.value;
    row.amount_micros = Math.round((deal.value as number) * 1e6);
  }
  if (has('createdAt')) row.created_at = toIso(deal.createdAt);
  if (has('updatedAt')) row.updated_at = toIso(deal.updatedAt);

  for (const [key, col, conv] of FIELDS) {
    if (has(key)) row[col] = conv(deal[key]);
  }
  if (!opts.partial) {
    // Full (insert) writes stamp timestamps; partial updates only emit what was provided.
    const nowIso = new Date().toISOString();
    if (row.created_at === undefined) row.created_at = nowIso;
    if (row.updated_at === undefined) row.updated_at = nowIso;
  }
  // Explicit null clears (e.g. restoring a soft-deleted deal)
  if (Object.prototype.hasOwnProperty.call(deal, 'deletedAt') && deal.deletedAt === null) {
    row.deleted_at = null;
  }
  return row;
}
