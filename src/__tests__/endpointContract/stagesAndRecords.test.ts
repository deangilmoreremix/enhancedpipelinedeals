const tables: Record<string, any[]> = {};
const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
const results: Record<string, { data: any; error: any }> = {};
import { chain } from '../../test-utils/chain';

jest.mock('../../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => {
      const base = (results as any)[table] ?? { data: [], error: null };
      const ch = chain(base);
      calls.push({ table, op: 'from', args: [] });
      return ch;
    },
  },
}));
jest.mock('../../config/demoMode', () => ({ isDemoMode: () => false }));

import { reorderStages, deleteStage } from '../../services/pipelineStageService';
import { restoreDealRemote } from '../../services/dealRecordService';

describe('silent no-op writes are surfaced as permission errors', () => {
  beforeEach(() => { Object.keys(results).forEach(k => delete results[k]); calls.length = 0; });

  it('reorderStages throws when RLS filtered every row', async () => {
    results.pipeline_stages = { data: [], error: null };
    await expect(reorderStages(['a', 'b'])).rejects.toMatchObject({ code: '42501' });
  });

  it('reorderStages resolves when rows were affected', async () => {
    results.pipeline_stages = { data: [{ id: '1' }], error: null };
    await expect(reorderStages(['a', 'b'])).resolves.toBeUndefined();
  });

  it('deleteStage throws when the stage delete matched nothing', async () => {
    results.deals = { data: [], error: null };
    results.pipeline_stages = { data: [], error: null };
    await expect(deleteStage('old', 'new')).rejects.toMatchObject({ code: '42501' });
  });

  it('deleteStage moves deals (with positions) before deleting', async () => {
    results.deals = { data: [{ id: 'd1', position: 0 }], error: null };
    results.pipeline_stages = { data: [{ id: 's' }], error: null };
    await expect(deleteStage('old', 'new')).resolves.toBeUndefined();
  });

  it('restoreDealRemote throws when 0 rows were restored', async () => {
    results.deals = { data: [], error: null };
    await expect(restoreDealRemote('x')).rejects.toMatchObject({ code: '42501' });
    results.deals = { data: [{ id: 'x' }], error: null };
    await expect(restoreDealRemote('x')).resolves.toBeUndefined();
  });
});
