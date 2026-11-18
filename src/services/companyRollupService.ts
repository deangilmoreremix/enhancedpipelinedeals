import { supabase } from './supabaseService';
import { isRemote, companyTotals } from './companyService';
import type { Deal } from '../types';
import type { Contact } from '../types/contact';
import type { DealFieldDefinition, RollupMetric } from '../types/customFields';
import type { FormulaValue } from '../utils/formula';

export interface CompanyRollup {
  companyId: string;
  openDealCount: number;
  openDealValue: number;
  wonDealValue: number;
  contactCount: number;
  lastActivity: string | null;
}

export const ROLLUP_METRIC_LABELS: Record<RollupMetric, string> = {
  open_deal_count: 'Open deals',
  open_deal_value: 'Open deal value',
  won_deal_value: 'Won deal value',
  contact_count: 'Contacts',
  last_activity: 'Last activity',
};

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function rollupFromRow(r: Record<string, any>): CompanyRollup {
  return {
    companyId: String(r.company_id),
    openDealCount: num(r.open_deal_count),
    openDealValue: num(r.open_deal_value),
    wonDealValue: num(r.won_deal_value),
    contactCount: num(r.contact_count),
    lastActivity: r.last_activity ? String(r.last_activity) : null,
  };
}

/** company_rollups RPC (one round trip for any number of companies; `null` = all). */
export async function fetchCompanyRollups(companyIds: string[] | null): Promise<Map<string, CompanyRollup>> {
  const { data, error } = await supabase.rpc('company_rollups', { p_company_ids: companyIds });
  if (error) throw error;
  return new Map(((data ?? []) as Array<Record<string, any>>).map(r => { const x = rollupFromRow(r); return [x.companyId, x]; }));
}

/** Same numbers computed client-side (demo mode / local companies). */
export function localRollup(
  companyId: string, deals: Deal[], contacts: Array<Pick<Contact, 'id'>>,
  stages: Array<{ key: string; isWon: boolean; isLost: boolean }>,
): CompanyRollup {
  const won = new Set(stages.filter(s => s.isWon).map(s => s.key));
  const lost = new Set(stages.filter(s => s.isLost).map(s => s.key));
  const live = deals.filter(d => !d.deletedAt);
  const totals = companyTotals(live, stages);
  const last = live.reduce<number>((m, d) => Math.max(m, d.updatedAt ? new Date(d.updatedAt).getTime() : 0), 0);
  return {
    companyId,
    openDealCount: live.filter(d => !won.has(d.stage) && !lost.has(d.stage)).length,
    openDealValue: totals.openValue,
    wonDealValue: totals.wonValue,
    contactCount: contacts.length,
    lastActivity: last > 0 ? new Date(last).toISOString() : null,
  };
}

/** Rollup for one company: RPC when connected (falling back to `local` if it fails), otherwise `local`. */
export async function rollupForCompany(companyId: string, local: () => CompanyRollup, remote = isRemote()): Promise<CompanyRollup> {
  if (remote && !companyId.startsWith('local-')) {
    const map = await fetchCompanyRollups([companyId]);
    return map.get(companyId) ?? { ...local(), openDealCount: 0, openDealValue: 0, wonDealValue: 0, contactCount: 0, lastActivity: null };
  }
  return local();
}

export function metricValue(r: CompanyRollup | undefined, metric: RollupMetric): FormulaValue {
  if (!r) return null;
  switch (metric) {
    case 'open_deal_count': return r.openDealCount;
    case 'open_deal_value': return r.openDealValue;
    case 'won_deal_value': return r.wonDealValue;
    case 'contact_count': return r.contactCount;
    case 'last_activity': return r.lastActivity;
  }
}

/** Values of every rollup definition (by definition key) for one company's rollup row. */
export function rollupValuesForDefs(defs: Array<Pick<DealFieldDefinition, 'key' | 'type' | 'config'>>, r: CompanyRollup | undefined): Record<string, FormulaValue> {
  const out: Record<string, FormulaValue> = {};
  for (const d of defs) if (d.type === 'rollup') out[d.key] = metricValue(r, d.config?.metric ?? 'open_deal_value');
  return out;
}
