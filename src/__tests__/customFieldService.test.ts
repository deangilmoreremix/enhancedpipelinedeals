const mockFrom = jest.fn();
jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...a: unknown[]) => mockFrom(...a), auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) } },
}));
let demo = true;
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));

import { chain } from '../test-utils/chain';
import {
  __resetDefinitionCache, createFieldDefinition, groupDefinitions, listFieldDefinitions, reorderFieldDefinitions,
  setFieldActive, updateFieldDefinition, validateCustomValue, withCustomValue, uniqueKey, formatCustomValue,
} from '../services/customFieldService';

describe('customFieldService (demo / localStorage)', () => {
  beforeEach(() => { demo = true; localStorage.clear(); __resetDefinitionCache(); mockFrom.mockReset(); });

  it('creates, edits, reorders and deactivates definitions without touching supabase', async () => {
    const a = await createFieldDefinition({ label: 'Lead source', type: 'select', options: ['Web', 'Referral', 'Web'], groupName: 'Sales' });
    const b = await createFieldDefinition({ label: 'Lead source', type: 'text' });
    expect(a.options).toEqual(['Web', 'Referral']);
    expect(b.key).toBe('lead_source_2');
    await reorderFieldDefinitions([b.id, a.id]);
    expect((await listFieldDefinitions()).map(d => d.id)).toEqual([b.id, a.id]);
    await updateFieldDefinition(a.id, { label: 'Source' });
    await setFieldActive(b.id, false);
    const defs = await listFieldDefinitions();
    expect(defs.find(d => d.id === a.id)?.label).toBe('Source');
    expect(groupDefinitions(defs).map(g => g.group)).toEqual(['Sales']);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects empty names and select fields without options', async () => {
    await expect(createFieldDefinition({ label: ' ', type: 'text' })).rejects.toThrow('required');
    await expect(createFieldDefinition({ label: 'X', type: 'select', options: [] })).rejects.toThrow('option');
  });
});

describe('customFieldService (remote)', () => {
  beforeEach(() => { demo = false; __resetDefinitionCache(); mockFrom.mockReset(); });

  it('lists and inserts through deal_field_definitions', async () => {
    const row = { id: 'd1', key: 'k', label: 'K', type: 'text', options: [], position: 0, group_name: null, is_active: true };
    mockFrom.mockReturnValueOnce(chain({ data: [row], error: null }));
    expect(await listFieldDefinitions()).toHaveLength(1);
    const ins = chain({ data: { ...row, id: 'd2', key: 'n', label: 'N', position: 1 }, error: null });
    mockFrom.mockReturnValueOnce(ins);
    const created = await createFieldDefinition({ label: 'N', type: 'text' });
    expect(created.id).toBe('d2');
    expect(mockFrom).toHaveBeenLastCalledWith('deal_field_definitions');
    expect(ins.calls.find((c: any) => c[0] === 'insert')[1][0]).toMatchObject({ key: 'n', created_by: 'u1', position: 1 });
  });

  it('treats a zero-row update as a permission error', async () => {
    const row = { id: 'd1', key: 'k', label: 'K', type: 'text', options: [], position: 0, is_active: true };
    mockFrom.mockReturnValueOnce(chain({ data: [row], error: null }));
    await listFieldDefinitions();
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }));
    await expect(setFieldActive('d1', false)).rejects.toThrow(/No rows affected/);
  });
});

describe('value helpers', () => {
  it('validates per type', () => {
    const d = (type: any, options: string[] = []) => ({ type, label: 'F', options });
    expect(validateCustomValue(d('number'), '1,200')).toEqual({ ok: true, value: 1200 });
    expect(validateCustomValue(d('number'), 'abc').ok).toBe(false);
    expect(validateCustomValue(d('email'), 'a@b.co')).toEqual({ ok: true, value: 'a@b.co' });
    expect(validateCustomValue(d('email'), 'nope').ok).toBe(false);
    expect(validateCustomValue(d('link'), 'example.com')).toEqual({ ok: true, value: 'https://example.com' });
    expect(validateCustomValue(d('phone'), '+1 555 123 4567').ok).toBe(true);
    expect(validateCustomValue(d('rating'), 7).ok).toBe(false);
    expect(validateCustomValue(d('select', ['a']), 'b').ok).toBe(false);
    expect(validateCustomValue(d('multi_select', ['a', 'b']), ['a', 'b'])).toEqual({ ok: true, value: ['a', 'b'] });
    expect(validateCustomValue(d('date'), '2026-03-01')).toEqual({ ok: true, value: '2026-03-01' });
    expect(validateCustomValue(d('text'), '')).toEqual({ ok: true, value: null });
  });

  it('merges values and formats', () => {
    expect(withCustomValue({ a: 1, b: 2 }, 'a', null)).toEqual({ b: 2 });
    expect(withCustomValue(undefined, 'a', 'x')).toEqual({ a: 'x' });
    expect(uniqueKey('My Field!', ['my_field'])).toBe('my_field_2');
    expect(formatCustomValue({ type: 'multi_select' }, ['a', 'b'])).toBe('a, b');
  });
});
