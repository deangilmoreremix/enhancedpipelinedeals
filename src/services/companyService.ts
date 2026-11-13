import { supabase, isSupabaseConfigured } from './supabaseService';
import { isDemoMode } from '../config/demoMode';
import type { Company, Deal } from '../types';
import type { Contact } from '../types/contact';
import { useDealStore } from '../store/dealStore';
import { useContactStore } from '../store/contactStore';

/**
 * Companies: Supabase `companies` when connected, otherwise in-memory + localStorage (demo mode).
 * Local companies are seeded from the company names already on deals/contacts so the demo works.
 */

const LS_KEY = 'crm_companies_v1';

export type CompanyDraft = Partial<Omit<Company, 'id' | 'name' | 'createdAt' | 'updatedAt'>>;

export const normalizeName = (s: string | undefined | null): string => (s ?? '').trim().toLowerCase();

export const isRemote = (): boolean => isSupabaseConfigured && !isDemoMode();

export function companyFromRow(row: Record<string, any>): Company {
  const num = row.revenue === null || row.revenue === undefined || row.revenue === '' ? undefined : Number(row.revenue);
  const out: Company = {
    id: row.id,
    name: row.name ?? '',
    industry: row.industry ?? undefined,
    website: row.website ?? undefined,
    domain: row.domain ?? undefined,
    size: row.size ?? undefined,
    revenue: num !== undefined && Number.isFinite(num) ? num : undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    notes: row.notes ?? undefined,
    ownerId: row.owner_id ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
  return out;
}

export function companyToRow(c: Partial<Company>): Record<string, unknown> {
  const map: Array<[keyof Company, string]> = [
    ['name', 'name'], ['industry', 'industry'], ['website', 'website'], ['domain', 'domain'], ['size', 'size'],
    ['revenue', 'revenue'], ['phone', 'phone'], ['address', 'address'], ['logoUrl', 'logo_url'],
    ['notes', 'notes'], ['ownerId', 'owner_id'],
  ];
  const row: Record<string, unknown> = {};
  for (const [k, col] of map) if (c[k] !== undefined) row[col] = c[k];
  return row;
}

// ---- local store -----------------------------------------------------------
let memory: Company[] | null = null;

const reviveLocal = (raw: any): Company => ({
  ...raw,
  createdAt: new Date(raw.createdAt),
  updatedAt: new Date(raw.updatedAt),
});

function readLocal(): Company[] {
  if (memory) return memory;
  let list: Company[] = [];
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (raw) list = (JSON.parse(raw) as any[]).map(reviveLocal);
  } catch { /* ignore corrupt storage */ }
  memory = list;
  return memory;
}

function writeLocal(list: Company[]): void {
  memory = list;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch { /* storage unavailable */ }
}

const slug = (s: string) => normalizeName(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'company';

/** Test helper: reset the in-memory cache. */
export function __resetLocalCompanies(): void { memory = null; }

/** Local companies merged with names found on deals/contacts (derived entries get a stable `local-co-` id). */
export function listLocal(): Company[] {
  const list = [...readLocal()];
  const known = new Set(list.map(c => normalizeName(c.name)));
  const names = new Map<string, string>();
  const add = (n?: string) => { const k = normalizeName(n); if (k && !known.has(k) && !names.has(k)) names.set(k, (n as string).trim()); };
  try {
    Object.values(useDealStore.getState().deals).forEach(d => add(d.company));
    useContactStore.getState().contacts.forEach(c => add(c.company));
  } catch { /* stores unavailable */ }
  const now = new Date();
  names.forEach((name, key) => list.push({ id: `local-co-${slug(key)}`, name, createdAt: now, updatedAt: now }));
  return list;
}

// ---- API -------------------------------------------------------------------
export async function search(q: string, limit = 8): Promise<Company[]> {
  const needle = normalizeName(q);
  if (isRemote()) {
    try {
      let query = supabase.from('companies').select('*').is('deleted_at', null).order('name', { ascending: true }).limit(limit);
      if (needle) query = query.ilike('name', `%${needle.replace(/[%_,]/g, ' ')}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(companyFromRow);
    } catch (e) {
      console.warn('Company search failed, using local list:', e);
    }
  }
  return listLocal()
    .filter(c => !needle || normalizeName(c.name).includes(needle) || normalizeName(c.domain).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function getById(id: string): Promise<Company | null> {
  if (isRemote() && !id.startsWith('local-')) {
    try {
      const { data, error } = await supabase.from('companies').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (data) return companyFromRow(data);
    } catch (e) {
      console.warn('Company lookup failed:', e);
    }
  }
  return listLocal().find(c => c.id === id) ?? null;
}

export async function create(name: string, extra: CompanyDraft = {}): Promise<Company> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Company name is required');
  // Reuse an existing company with the same (case-insensitive) name
  const existing = (await search(trimmed, 50)).find(c => normalizeName(c.name) === normalizeName(trimmed));
  if (existing) {
    const patch = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined));
    return Object.keys(patch).length ? update(existing.id, patch) : existing;
  }
  if (isRemote()) {
    const { data, error } = await supabase.from('companies').insert({ name: trimmed, ...companyToRow(extra as Partial<Company>) }).select().single();
    if (error) throw error;
    return companyFromRow(data);
  }
  const now = new Date();
  const company: Company = { ...extra, id: `local-co-${slug(trimmed)}-${Date.now().toString(36)}`, name: trimmed, createdAt: now, updatedAt: now };
  writeLocal([...readLocal(), company]);
  return company;
}

export async function update(id: string, updates: Partial<Omit<Company, 'id'>>): Promise<Company> {
  if (isRemote() && !id.startsWith('local-')) {
    const { data, error } = await supabase
      .from('companies').update({ ...companyToRow(updates), updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return companyFromRow(data);
  }
  const list = readLocal();
  const idx = list.findIndex(c => c.id === id);
  const base = idx >= 0 ? list[idx] : listLocal().find(c => c.id === id);
  if (!base) throw new Error('Company not found');
  const next: Company = { ...base, ...updates, id, updatedAt: new Date() };
  writeLocal(idx >= 0 ? list.map(c => (c.id === id ? next : c)) : [...list, next]);
  return next;
}

/** Deals and contacts that belong to a company (by company id, falling back to the company name). */
export async function listRelated(companyId: string, companyName?: string): Promise<{ deals: Deal[]; contacts: Contact[] }> {
  const name = normalizeName(companyName ?? (await getById(companyId))?.name);
  const deals = Object.values(useDealStore.getState().deals).filter(
    d => !d.deletedAt && (d.companyId === companyId || (!d.companyId && !!name && normalizeName(d.company) === name)),
  );
  const contacts = useContactStore.getState().contacts.filter(
    c => (c as Contact & { companyId?: string }).companyId === companyId || (!!name && normalizeName(c.company) === name),
  );
  return { deals, contacts };
}

export interface CompanyTotals { deals: number; openValue: number; weightedValue: number; wonValue: number }

/** Roll-up of a company's deals. Won/lost come from the stage flags (isWon/isLost), never stage literals. */
export function companyTotals(deals: Deal[], stages: Array<{ key: string; isWon: boolean; isLost: boolean }>): CompanyTotals {
  const won = new Set(stages.filter(s => s.isWon).map(s => s.key));
  const lost = new Set(stages.filter(s => s.isLost).map(s => s.key));
  const t: CompanyTotals = { deals: deals.length, openValue: 0, weightedValue: 0, wonValue: 0 };
  for (const d of deals) {
    if (won.has(d.stage)) t.wonValue += d.value;
    else if (!lost.has(d.stage)) {
      t.openValue += d.value;
      t.weightedValue += d.value * ((d.probability ?? 0) / 100);
    }
  }
  return t;
}
