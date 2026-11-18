import type { DealFieldDefinition, RollupMetric } from '../types/customFields';
import type { FormulaValue } from './formula';

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
