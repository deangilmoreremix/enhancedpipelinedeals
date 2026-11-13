import { chain } from '../../test-utils/chain';
import { fetchWonDealsInPeriod } from '../../services/kpiService';

jest.mock('../../services/supabaseService', () => ({ getSupabaseService: () => ({}) }));
jest.mock('../../services/pipelineAnalyticsService', () => ({ getPipelineAnalyticsService: () => ({}) }));

describe('fetchWonDealsInPeriod', () => {
  it('uses close_date, falls back to deal_history, excludes soft-deleted via is(deleted_at,null)', async () => {
    const deals = chain({ data: [
      { id: 'a', value: 1, close_date: '2026-01-10T00:00:00Z' },
      { id: 'b', value: 2, close_date: null },
      { id: 'c', value: 3, close_date: null },
      { id: 'd', value: 4, close_date: '2025-01-01T00:00:00Z' },
    ], error: null });
    const hist = chain({ data: [{ deal_id: 'b', new_value: 'won', changed_at: '2026-01-20T00:00:00Z' }], error: null });
    const sb = { from: (t: string) => (t === 'deals' ? deals : hist) };
    const out = await fetchWonDealsInPeriod(sb, ['won'], new Date('2026-01-01'), new Date('2026-01-31'));
    expect(out.map(d => d.id)).toEqual(['a', 'b']);
    expect(deals.calls.some((c: any) => c[0] === 'is' && c[1][0] === 'deleted_at')).toBe(true);
  });
});
