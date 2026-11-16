// NOTE: imports supabaseService (not the client / dealRecordShared) so UI tests that mock it keep working
import { supabase, isSupabaseConfigured } from './supabaseService';
import { isDemoMode } from '../config/demoMode';
import { assertRowsAffected } from '../utils/rlsError';
import type { CustomFieldType, CustomFieldValue, DealFieldDefinition } from '../types/customFields';

export const DEFAULT_FIELD_GROUP = 'General';
export const RATING_MAX = 5;
const STORAGE_KEY = 'pipeline.dealFieldDefinitions.v1';

/** Real table calls vs in-memory/localStorage (demo mode or Supabase not configured). */
export const fieldsRemote = (): boolean => isSupabaseConfigured && !isDemoMode();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Whether per-deal data for this id lives in Supabase (vs demo / local deals). */
export const isRemoteDeal = (id: string): boolean => isSupabaseConfigured && !isDemoMode() && UUID_RE.test(id);
export const isUuidLike = (v: string | null | undefined): v is string => !!v && UUID_RE.test(v);
export const localId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
export const errMsg = (e: unknown, fallback = 'Something went wrong'): string =>
  e instanceof Error ? e.message : typeof (e as any)?.message === 'string' ? (e as any).message : fallback;
export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch { return null; }
}

// ---- row mapping ------------------------------------------------------------------------------

const toOptions = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(o => (typeof o === 'string' ? o : (o as any)?.label ?? (o as any)?.value ?? '')).map(String).filter(Boolean);
  if (v && typeof v === 'object' && Array.isArray((v as any).choices)) return toOptions((v as any).choices);
  return [];
};

export const definitionFromRow = (r: Record<string, any>): DealFieldDefinition => ({
  id: r.id,
  key: r.key,
  label: r.label ?? r.key,
  type: r.type,
  options: toOptions(r.options),
  position: Number(r.position ?? 0),
  groupName: r.group_name ?? null,
  isActive: r.is_active !== false,
  createdBy: r.created_by ?? null,
});

const sortDefs = (defs: DealFieldDefinition[]) => [...defs].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));

// ---- local store + cache ----------------------------------------------------------------------

let cache: DealFieldDefinition[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const setCache = (defs: DealFieldDefinition[]) => { cache = sortDefs(defs); emit(); };

const readLocal = (): DealFieldDefinition[] => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as DealFieldDefinition[]) : [];
  } catch { return []; }
};
const writeLocal = (defs: DealFieldDefinition[]) => {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(defs)); } catch { /* storage unavailable */ }
};

export const getCachedDefinitions = (): DealFieldDefinition[] => cache;
export const subscribeDefinitions = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
/** Test helper. */
export const __resetDefinitionCache = () => { cache = []; };

// ---- CRUD -------------------------------------------------------------------------------------

export async function listFieldDefinitions(): Promise<DealFieldDefinition[]> {
  if (!fieldsRemote()) {
    setCache(readLocal());
    return cache;
  }
  const { data, error } = await supabase.from('deal_field_definitions').select('*').order('position', { ascending: true });
  if (error) throw error;
  setCache((data ?? []).map(definitionFromRow));
  return cache;
}

export const slugKey = (label: string): string =>
  label.trim().toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';

export const uniqueKey = (label: string, existing: Iterable<string>): string => {
  const taken = new Set(existing);
  const base = slugKey(label);
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
  return key;
};

export interface FieldDefinitionInput {
  label: string;
  type: CustomFieldType;
  options?: string[];
  groupName?: string | null;
}

const cleanOptions = (type: CustomFieldType, options?: string[]): string[] =>
  type === 'select' || type === 'multi_select'
    ? [...new Set((options ?? []).map(o => o.trim()).filter(Boolean))]
    : [];

function validateInput(input: Pick<FieldDefinitionInput, 'label' | 'type' | 'options'>) {
  if (!input.label.trim()) throw new Error('Field name is required');
  if ((input.type === 'select' || input.type === 'multi_select') && cleanOptions(input.type, input.options).length === 0) {
    throw new Error('Add at least one option');
  }
}

export async function createFieldDefinition(input: FieldDefinitionInput): Promise<DealFieldDefinition> {
  validateInput(input);
  const current = fieldsRemote() ? (cache.length ? cache : await listFieldDefinitions()) : readLocal();
  const key = uniqueKey(input.label, current.map(d => d.key));
  const position = current.reduce((m, d) => Math.max(m, d.position), -1) + 1;
  const base = {
    key, label: input.label.trim(), type: input.type, options: cleanOptions(input.type, input.options),
    position, groupName: input.groupName?.trim() || null, isActive: true,
  };
  if (!fieldsRemote()) {
    const def: DealFieldDefinition = { ...base, id: localId('fielddef'), createdBy: null };
    const next = [...current, def];
    writeLocal(next);
    setCache(next);
    return def;
  }
  const { data, error } = await supabase.from('deal_field_definitions').insert({
    key: base.key, label: base.label, type: base.type, options: base.options, position: base.position,
    group_name: base.groupName, is_active: true, created_by: await currentUserId(),
  }).select().single();
  if (error) throw error;
  const def = definitionFromRow(data);
  setCache([...cache.filter(d => d.id !== def.id), def]);
  return def;
}

export type FieldDefinitionPatch = Partial<Pick<DealFieldDefinition, 'label' | 'options' | 'groupName' | 'isActive'>>;

export async function updateFieldDefinition(id: string, patch: FieldDefinitionPatch): Promise<DealFieldDefinition> {
  const existing = (cache.length ? cache : fieldsRemote() ? await listFieldDefinitions() : readLocal()).find(d => d.id === id);
  if (!existing) throw new Error('Field not found');
  const merged: DealFieldDefinition = { ...existing, ...patch };
  merged.options = cleanOptions(existing.type, merged.options);
  validateInput(merged);
  merged.label = merged.label.trim();
  merged.groupName = merged.groupName?.trim() || null;
  if (!fieldsRemote()) {
    const next = readLocal().map(d => (d.id === id ? merged : d));
    writeLocal(next);
    setCache(next);
    return merged;
  }
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = merged.label;
  if (patch.options !== undefined) row.options = merged.options;
  if (patch.groupName !== undefined) row.group_name = merged.groupName;
  if (patch.isActive !== undefined) row.is_active = merged.isActive;
  const { data, error } = await supabase.from('deal_field_definitions').update(row).eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data);
  setCache(cache.map(d => (d.id === id ? merged : d)));
  return merged;
}

export const setFieldActive = (id: string, isActive: boolean) => updateFieldDefinition(id, { isActive });

/** Persist a new order (positions 0..n-1 following `orderedIds`). */
export async function reorderFieldDefinitions(orderedIds: string[]): Promise<void> {
  const base = fieldsRemote() ? cache : readLocal();
  const pos = new Map(orderedIds.map((id, i) => [id, i]));
  const next = base.map(d => (pos.has(d.id) ? { ...d, position: pos.get(d.id)! } : d));
  if (!fieldsRemote()) {
    writeLocal(next);
    setCache(next);
    return;
  }
  const results = await Promise.all(orderedIds.map((id, i) =>
    supabase.from('deal_field_definitions').update({ position: i }).eq('id', id).select('id')));
  for (const r of results) {
    if (r.error) throw r.error;
    assertRowsAffected(r.data);
  }
  setCache(next);
}

// ---- values -----------------------------------------------------------------------------------

export const isEmptyValue = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()\-.]{5,}$/;

export type ValidateResult = { ok: true; value: CustomFieldValue } | { ok: false; error: string };

/** Normalise + validate an edited value for a definition. Empty clears (null). */
export function validateCustomValue(def: Pick<DealFieldDefinition, 'type' | 'label' | 'options'>, raw: unknown): ValidateResult {
  if (isEmptyValue(raw)) return { ok: true, value: null };
  switch (def.type) {
    case 'text': return { ok: true, value: String(raw).trim() };
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[,\s]/g, ''));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `${def.label} must be a number` };
    }
    case 'rating': {
      const n = Number(raw);
      return Number.isInteger(n) && n >= 0 && n <= RATING_MAX
        ? { ok: true, value: n === 0 ? null : n }
        : { ok: false, error: `${def.label} must be 0-${RATING_MAX}` };
    }
    case 'select': {
      const s = String(raw);
      return def.options.includes(s) ? { ok: true, value: s } : { ok: false, error: `${def.label}: unknown option` };
    }
    case 'multi_select': {
      const arr = (Array.isArray(raw) ? raw : [raw]).map(String);
      return arr.every(o => def.options.includes(o)) ? { ok: true, value: [...new Set(arr)] } : { ok: false, error: `${def.label}: unknown option` };
    }
    case 'email': {
      const s = String(raw).trim();
      return EMAIL_RE.test(s) ? { ok: true, value: s } : { ok: false, error: 'Enter a valid email address' };
    }
    case 'phone': {
      const s = String(raw).trim();
      return PHONE_RE.test(s) ? { ok: true, value: s } : { ok: false, error: 'Enter a valid phone number' };
    }
    case 'link': {
      const s = String(raw).trim();
      const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
      try {
        const u = new URL(withProto);
        if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error('bad');
        return { ok: true, value: withProto };
      } catch { return { ok: false, error: 'Enter a valid URL' }; }
    }
    case 'date': {
      const s = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw);
      return /^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(new Date(s).getTime()) ? { ok: true, value: s.slice(0, 10) } : { ok: false, error: 'Enter a valid date' };
    }
    default: return { ok: true, value: raw as CustomFieldValue };
  }
}

/** Human-readable value (timeline, merge picker, CSV). */
export function formatCustomValue(def: Pick<DealFieldDefinition, 'type'> | undefined, value: unknown): string {
  if (isEmptyValue(value)) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (def?.type === 'rating') return `${'★'.repeat(Number(value) || 0)} (${value}/${RATING_MAX})`;
  if (def?.type === 'date') {
    const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }
  if (def?.type === 'number' && typeof value === 'number') return value.toLocaleString('en-US');
  return String(value);
}

/** Copy of `current` with `key` set (or removed when the value is empty). */
export function withCustomValue(
  current: Record<string, CustomFieldValue> | undefined, key: string, value: CustomFieldValue,
): Record<string, CustomFieldValue> {
  const next = { ...(current ?? {}) };
  if (isEmptyValue(value)) delete next[key]; else next[key] = value;
  return next;
}

/** Active definitions grouped by group_name (default group first, then alphabetical). */
export function groupDefinitions(defs: DealFieldDefinition[]): Array<{ group: string; defs: DealFieldDefinition[] }> {
  const map = new Map<string, DealFieldDefinition[]>();
  for (const d of sortDefs(defs).filter(x => x.isActive)) {
    const g = d.groupName?.trim() || DEFAULT_FIELD_GROUP;
    map.set(g, [...(map.get(g) ?? []), d]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === DEFAULT_FIELD_GROUP ? -1 : b === DEFAULT_FIELD_GROUP ? 1 : a.localeCompare(b)))
    .map(([group, list]) => ({ group, defs: list }));
}

export const CustomFieldService = {
  listFieldDefinitions, createFieldDefinition, updateFieldDefinition, setFieldActive, reorderFieldDefinitions,
  validateCustomValue, formatCustomValue, withCustomValue, groupDefinitions,
};
