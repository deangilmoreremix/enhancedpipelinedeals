const mockFrom = jest.fn();
jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...a: unknown[]) => mockFrom(...a), auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) } },
}));
let demo = true;
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));

import { chain } from '../test-utils/chain';
import {
  __resetDefinitionCache, customFieldService, createFieldDefinition, definitionFromRow, getCachedDefinitions, listFieldDefinitions,
  recordCustomValues, saveRecordValues, updateFieldDefinition, validateCustomValue,
} from '../services/customFieldService';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('customFieldService per entity type (demo / localStorage)', () => {
  beforeEach(() => { demo = true; localStorage.clear(); __resetDefinitionCache(); mockFrom.mockReset(); });

  it('keeps deal, contact and company definitions apart (same label -> same key in each)', async () => {
    const d = await createFieldDefinition({ label: 'Tier', type: 'text' }, 'deal');
    const c = await createFieldDefinition({ label: 'Tier', type: 'select', options: ['A', 'B'] }, 'contact');
    const co = await customFieldService('company').create({ label: 'Tier', type: 'text' });
    expect([d.key, c.key, co.key]).toEqual(['tier', 'tier', 'tier']);
    expect([d.entityType, c.entityType, co.entityType]).toEqual(['deal', 'contact', 'company']);
    expect((await listFieldDefinitions('deal')).map(x => x.type)).toEqual(['text']);
    expect((await listFieldDefinitions('contact')).map(x => x.type)).toEqual(['select']);
    expect(getCachedDefinitions('company')).toHaveLength(1);
    expect(localStorage.getItem('pipeline.contactFieldDefinitions.v1')).toContain('"Tier"');
    expect(localStorage.getItem('pipeline.dealFieldDefinitions.v1')).not.toContain('"A"');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('lists, updates, reorders and deactivates through the bound service', async () => {
    const svc = customFieldService('contact');
    const a = await svc.create({ label: 'Source', type: 'text' });
    const b = await svc.create({ label: 'Region', type: 'text', groupName: 'Geo' });
    await svc.reorder([b.id, a.id]);
    expect((await svc.list()).map(x => x.id)).toEqual([b.id, a.id]);
    await svc.update(a.id, { label: 'Origin' });
    await svc.deactivate(b.id);
    const defs = await svc.list();
    expect(defs.find(x => x.id === a.id)?.label).toBe('Origin');
    expect(defs.find(x => x.id === b.id)?.isActive).toBe(false);
    // deals were never touched
    expect(await listFieldDefinitions('deal')).toEqual([]);
  });

  it('validates formula and rollup definitions', async () => {
    await expect(createFieldDefinition({ label: 'F', type: 'formula' }, 'deal')).rejects.toThrow('Enter a formula');
    await expect(createFieldDefinition({ label: 'F', type: 'formula', config: { formula: '1 +' } }, 'deal')).rejects.toThrow('Invalid formula');
    await expect(createFieldDefinition({ label: 'R', type: 'rollup', config: { metric: 'contact_count' } }, 'deal')).rejects.toThrow('only available on companies');
    const f = await createFieldDefinition({ label: 'Weighted', type: 'formula', config: { formula: '{value} * {probability} / 100' } }, 'deal');
    expect(f.config).toEqual({ formula: '{value} * {probability} / 100' });
    const r = await createFieldDefinition({ label: 'Open', type: 'rollup', config: { metric: 'open_deal_count' } }, 'company');
    expect(r.config).toEqual({ metric: 'open_deal_count' });
    await expect(updateFieldDefinition(f.id, { config: { formula: '{weighted}' } }, 'deal')).rejects.toThrow('cannot reference itself');
    const edited = await updateFieldDefinition(f.id, { config: { formula: '{value}' } }, 'deal');
    expect(edited.config?.formula).toBe('{value}');
  });

  it('computed types are read-only for value validation', () => {
    expect(validateCustomValue({ type: 'formula', label: 'F' }, 3)).toEqual({ ok: false, error: 'F is calculated and cannot be edited' });
    expect(validateCustomValue({ type: 'rollup', label: 'R' }, 3).ok).toBe(false);
    expect(validateCustomValue({ type: 'number', label: 'N' }, '1,200')).toEqual({ ok: true, value: 1200 });
  });

  it('reads and writes record values for local records through the overlay', async () => {
    expect(recordCustomValues('contact', 'mock-1', { customFields: { a: 1 } })).toEqual({ a: 1 });
    await saveRecordValues('contact', 'mock-1', { b: 'x' });
    expect(recordCustomValues('contact', 'mock-1', { customFields: { a: 1 } })).toEqual({ b: 'x' });
    expect(recordCustomValues('company', 'mock-1', null)).toEqual({}); // keyed per entity
    await saveRecordValues('contact', 'mock-1', {}); // clearing everything still wins over the record's own map
    expect(recordCustomValues('contact', 'mock-1', { customFields: { a: 1 } })).toEqual({});
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('customFieldService per entity type (remote)', () => {
  beforeEach(() => { demo = false; localStorage.clear(); __resetDefinitionCache(); mockFrom.mockReset(); });

  it('filters the list by entity_type and parses config from options', async () => {
    const rows = [
      { id: 'd1', key: 'open', label: 'Open', type: 'rollup', options: { metric: 'open_deal_value' }, position: 0, is_active: true, entity_type: 'company' },
      { id: 'd2', key: 'w', label: 'W', type: 'formula', options: { formula: '{revenue} / 2' }, position: 1, is_active: true, entity_type: 'company' },
      { id: 'd3', key: 's', label: 'S', type: 'select', options: ['x', 'y'], position: 2, is_active: true, entity_type: 'company' },
    ];
    const q = chain({ data: rows, error: null });
    mockFrom.mockReturnValueOnce(q);
    const defs = await listFieldDefinitions('company');
    expect(mockFrom).toHaveBeenCalledWith('deal_field_definitions');
    expect(q.calls.find((c: any) => c[0] === 'eq')[1]).toEqual(['entity_type', 'company']);
    expect(defs.map(d => [d.type, d.entityType])).toEqual([['rollup', 'company'], ['formula', 'company'], ['select', 'company']]);
    expect(defs[0].config).toEqual({ metric: 'open_deal_value' });
    expect(defs[1].config).toEqual({ formula: '{revenue} / 2' });
    expect(defs[2].options).toEqual(['x', 'y']);
  });

  it('inserts entity_type and stores formula / metric config in options', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })); // list
    const row = { id: 'n1', key: 'weighted', label: 'Weighted', type: 'formula', options: { formula: '{revenue} * 2' }, position: 0, is_active: true, entity_type: 'company' };
    const ins = chain({ data: row, error: null });
    mockFrom.mockReturnValueOnce(ins);
    const def = await createFieldDefinition({ label: 'Weighted', type: 'formula', config: { formula: '{revenue} * 2' } }, 'company');
    expect(def.entityType).toBe('company');
    expect(ins.calls.find((c: any) => c[0] === 'insert')[1][0]).toMatchObject({
      key: 'weighted', type: 'formula', entity_type: 'company', options: { formula: '{revenue} * 2' }, created_by: 'u1',
    });
  });

  it('definitionFromRow defaults to the deal entity', () => {
    expect(definitionFromRow({ id: 'x', key: 'k', type: 'text', options: [] }).entityType).toBe('deal');
  });

  it('writes contact / company values to custom_fields and treats zero rows as a permission error', async () => {
    const upd = chain({ data: [{ id: UUID }], error: null });
    mockFrom.mockReturnValueOnce(upd);
    await saveRecordValues('contact', UUID, { tier: 'Gold' });
    expect(mockFrom).toHaveBeenLastCalledWith('contacts');
    expect(upd.calls.find((c: any) => c[0] === 'update')[1][0]).toEqual({ custom_fields: { tier: 'Gold' } });

    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }));
    await expect(saveRecordValues('company', UUID, { a: 1 })).rejects.toThrow(/No rows affected/);
    expect(mockFrom).toHaveBeenLastCalledWith('companies');

    mockFrom.mockReturnValueOnce(chain({ data: null, error: new Error('boom') }));
    await expect(saveRecordValues('contact', UUID, {})).rejects.toThrow('boom');
  });

  it('remote records read their own map (snake_case rows too); non-uuid ids stay local', () => {
    expect(recordCustomValues('contact', UUID, { custom_fields: { a: 1 } })).toEqual({ a: 1 });
    expect(recordCustomValues('company', UUID, { customFields: { b: 2 } })).toEqual({ b: 2 });
    expect(recordCustomValues('company', 'local-co-acme', { customFields: { b: 2 } })).toEqual({ b: 2 });
  });
});
