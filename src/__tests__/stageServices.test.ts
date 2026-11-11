const mockUpdates: Array<Record<string, unknown>> = [];
const mockInserts: Array<Record<string, unknown>> = [];
let mockExisting: { id: string } | null = { id: 'row-1' };

jest.mock('../lib/core/supabaseClient', () => {
  const chain = (result: unknown) => {
    const o: Record<string, unknown> = {};
    ['select', 'eq', 'is', 'order'].forEach(m => { o[m] = () => o; });
    o.maybeSingle = async () => ({ data: mockExisting, error: null });
    o.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return o;
  };
  return {
    isSupabaseConfigured: true,
    supabase: {
      from: () => ({
        select: () => chain({ data: [], error: null }),
        update: (p: Record<string, unknown>) => { mockUpdates.push(p); return chain({ error: null }); },
        insert: (p: Record<string, unknown>) => { mockInserts.push(p); return chain({ error: null }); },
      }),
    },
  };
});
jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { upsertStages, getStages, DEFAULT_STAGES } from '../services/pipelineStageService';
import { PipelineColumnService, getCustomColumns } from '../services/pipelineColumnService';

beforeEach(() => { mockUpdates.length = 0; mockInserts.length = 0; mockExisting = { id: 'row-1' }; });

describe('pipelineStageService.upsertStages', () => {
  it('only writes the fields that were provided (never zeroes probability or drops won/lost)', async () => {
    await upsertStages([{ key: 'demo', name: 'Renamed', color: 'teal' }]);
    expect(mockUpdates).toHaveLength(1);
    expect(mockUpdates[0]).toMatchObject({ name: 'Renamed', color: 'teal' });
    expect(mockUpdates[0]).not.toHaveProperty('probability');
    expect(mockUpdates[0]).not.toHaveProperty('is_won');
    expect(mockUpdates[0]).not.toHaveProperty('is_lost');
    expect(mockInserts).toHaveLength(0);
  });

  it('inserts new stages with safe defaults for the omitted flags', async () => {
    mockExisting = null;
    await upsertStages([{ key: 'fresh', name: 'Fresh' }]);
    expect(mockInserts[0]).toMatchObject({ key: 'fresh', name: 'Fresh', probability: 0, is_won: false, is_lost: false, visible: true, pipeline_id: null });
  });

  it('writes explicit values when given (a stage can be marked won with 100%)', async () => {
    await upsertStages([{ key: 'signed', probability: 100, isWon: true, isLost: false }]);
    expect(mockUpdates[0]).toMatchObject({ probability: 100, is_won: true, is_lost: false });
  });
});

describe('pipelineColumnService (read fallback + compatibility writer)', () => {
  it('still reads columns in the legacy shape', async () => {
    const cols = await getCustomColumns();
    expect(cols.length).toBe(DEFAULT_STAGES.length);
    expect(cols[0]).toMatchObject({ id: DEFAULT_STAGES[0].key, name: DEFAULT_STAGES[0].name, is_active: true });
    expect(await getStages()).toEqual(DEFAULT_STAGES); // empty table -> defaults
  });

  it('saveCustomColumns keeps the probability and won/lost flags of existing stages', async () => {
    const ok = await PipelineColumnService.saveCustomColumns(
      DEFAULT_STAGES.map((s, i) => ({ id: s.key, name: `${s.name}!`, position: i + 1, config: { color: `border-${s.color}-500`, wipLimit: 3 }, is_active: true }))
    );
    expect(ok).toBe(true);
    expect(mockUpdates.length).toBe(DEFAULT_STAGES.length);
    mockUpdates.forEach(u => {
      expect(u).not.toHaveProperty('probability');
      expect(u).not.toHaveProperty('is_won');
      expect(u).not.toHaveProperty('is_lost');
    });
    expect(mockUpdates[3]).toMatchObject({ name: 'Closed Won!', position: 3, wip_limit: 3, color: 'green' });
  });
});
