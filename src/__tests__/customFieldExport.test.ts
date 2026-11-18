jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import type { Company, Deal } from '../types';
import type { Contact } from '../types/contact';
import type { DealFieldDefinition } from '../types/customFields';
import { exportService } from '../services/exportService';
import { customExportColumns } from '../services/customFieldExport';
import { buildColumnExport } from '../components/pipeline/exportDeals';
import { __resetDefinitionCache, createFieldDefinition, saveRecordValues } from '../services/customFieldService';
import { parseCsv } from '../utils/csv';

const def = (o: Partial<DealFieldDefinition> & Pick<DealFieldDefinition, 'key' | 'type'>, position = 0): DealFieldDefinition => ({
  id: `def-${o.key}`, label: o.key, options: [], position, groupName: null, isActive: true, entityType: 'deal', ...o,
});

const deal = (id: string, o: Partial<Deal> = {}): Deal => ({
  id, title: `Deal ${id}`, company: 'Acme', contact: 'Ada', value: 2000, stage: 'qualification', probability: 50, priority: 'low',
  createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z'), ...o,
});

const dealDefs = [
  def({ key: 'tier', label: 'Customer tier', type: 'select', options: ['Gold'] }, 0),
  def({ key: 'tags', label: 'Interest, tags', type: 'multi_select', options: ['a', 'b'] }, 1),
  def({ key: 'weighted', label: 'Weighted value', type: 'formula', config: { formula: '{value} * {probability} / 100' } }, 2),
  def({ key: 'broken', label: 'Broken', type: 'formula', config: { formula: '{value} / 0' } }, 3),
  def({ key: 'old', label: 'Old field', type: 'text', isActive: false }, 4),
];

describe('customExportColumns', () => {
  it('one column per ACTIVE definition in position order, label as header, computed values', () => {
    const cols = customExportColumns<Deal>('deal', [...dealDefs].reverse());
    expect(cols.headers).toEqual(['Customer tier', 'Interest, tags', 'Weighted value', 'Broken']);
    const row = cols.cells(deal('1', { customFields: { tier: 'Gold', tags: ['a', 'b'], old: 'hidden' } }));
    expect(row).toEqual(['Gold', 'a;b', '1000', '#ERR']);
  });

  it('computes company rollup columns from the rollup rows', () => {
    const defs = [
      def({ key: 'open', label: 'Open deals', type: 'rollup', config: { metric: 'open_deal_count' }, entityType: 'company' }, 0),
      def({ key: 'won', label: 'Won value', type: 'rollup', config: { metric: 'won_deal_value' }, entityType: 'company' }, 1),
      def({ key: 'double', label: 'Double won', type: 'formula', config: { formula: '{won} * 2' }, entityType: 'company' }, 2),
    ];
    const rollups = new Map([['c1', { companyId: 'c1', openDealCount: 3, openDealValue: 9000, wonDealValue: 500, contactCount: 2, lastActivity: null }]]);
    const cols = customExportColumns<Company>('company', defs, { rollups });
    expect(cols.cells({ id: 'c1' } as Company)).toEqual(['3', '500', '1000']);
    expect(cols.cells({ id: 'zzz' } as Company)).toEqual(['', '', '0']); // no rollup row: empty metrics, formula treats them as 0
  });
});

describe('exports include custom fields', () => {
  it('deals CSV (exportService) has a header per custom field and computed values', async () => {
    const csv = await exportService.exportDeals([deal('1', { customFields: { tier: 'Gold' } })], { format: 'csv', customFieldDefs: dealDefs });
    const [header, row] = parseCsv(csv);
    expect(header.slice(-4)).toEqual(['Customer tier', 'Interest, tags', 'Weighted value', 'Broken']);
    expect(row.slice(-4)).toEqual(['Gold', '', '1000', '#ERR']);
    expect(csv.split('\n')[0]).toContain('"Interest, tags"'); // quoted header
  });

  it('deals CSV picks up the cached definitions by default', async () => {
    localStorage.clear(); __resetDefinitionCache();
    await createFieldDefinition({ label: 'Region', type: 'text' });
    const csv = await exportService.exportDeals([deal('1', { customFields: { region: 'EMEA' } })], { format: 'csv' });
    const [header, row] = parseCsv(csv);
    expect(header[header.length - 1]).toBe('Region');
    expect(row[row.length - 1]).toBe('EMEA');
  });

  it('board column export (CSV/JSON) appends the custom columns', async () => {
    const csv = await buildColumnExport([deal('1', { customFields: { region: 'EMEA' } })], 'csv', ['title', 'value']);
    expect(csv).toContain('Title,Value,Region');
    expect(csv).toContain('Deal 1,2000,EMEA');
    const json = JSON.parse(await buildColumnExport([deal('1', { customFields: { region: 'EMEA' } })], 'json', ['title']) as string);
    expect(json[0]).toEqual({ title: 'Deal 1', 'cf:region': 'EMEA' });
  });

  it('contacts CSV includes contact custom fields (overlay values too)', async () => {
    localStorage.clear(); __resetDefinitionCache();
    const d = await createFieldDefinition({ label: 'Birthday', type: 'date' }, 'contact');
    await saveRecordValues('contact', 'c1', { [d.key]: '1990-05-06' });
    const contact = { id: 'c1', firstName: 'A', lastName: 'B', name: 'A B', email: 'a@b.co', company: 'X', title: 't', status: 'lead', interestLevel: 'hot', createdAt: new Date(), updatedAt: new Date() } as unknown as Contact;
    const csv = await exportService.exportContacts([contact], { format: 'csv' });
    const [header, row] = parseCsv(csv);
    expect(header[header.length - 1]).toBe('Birthday');
    expect(row[row.length - 1]).toBe('1990-05-06');
  });

  it('companies CSV / JSON include custom + rollup columns', async () => {
    const defs = [
      def({ key: 'tier', label: 'Tier', type: 'text', entityType: 'company' }, 0),
      def({ key: 'open', label: 'Open value', type: 'rollup', config: { metric: 'open_deal_value' }, entityType: 'company' }, 1),
    ];
    const company = { id: 'c1', name: 'Acme', customFields: { tier: 'A' }, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z') } as Company;
    const rollups = new Map([['c1', { companyId: 'c1', openDealCount: 1, openDealValue: 7500, wonDealValue: 0, contactCount: 0, lastActivity: null }]]);
    const csv = await exportService.exportCompanies([company], { format: 'csv', customFieldDefs: defs, rollups });
    const [header, row] = parseCsv(csv);
    expect(header.slice(-2)).toEqual(['Tier', 'Open value']);
    expect(row.slice(-2)).toEqual(['A', '7500']);
    const json = JSON.parse(await exportService.exportCompanies([company], { format: 'json', customFieldDefs: defs, rollups }));
    expect(json.companies[0]).toMatchObject({ name: 'Acme', Tier: 'A', 'Open value': '7500' });
  });
});
