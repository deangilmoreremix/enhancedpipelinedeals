import { chain } from '../../test-utils/chain';
const tables: string[] = [];
const updateDeal = jest.fn(async () => ({}));
const results: Record<string, any> = {};
jest.mock('../../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (t: string) => { tables.push(t); return chain(results[t] ?? { data: [], error: null }); } },
}));
jest.mock('../../config/demoMode', () => ({ isDemoMode: () => false }));
jest.mock('../../services/dealRecordShared', () => ({
  getCurrentUserId: async () => 'u', isUuid: () => true,
}));
jest.mock('../../store/dealStore', () => ({
  useDealStore: { getState: () => ({ deals: { d1: { id: 'd1', isFavorite: false } }, updateDeal }) },
}));

import { toggleFavorite } from '../../services/favoritesService';

it('single toggle updates deals.is_favorite (via store) and the favorites row', async () => {
  tables.length = 0;
  results.favorites = { data: null, error: null }; // no existing row -> insert
  const next = await toggleFavorite('deal', 'd1');
  expect(next).toBe(true);
  expect(updateDeal).toHaveBeenCalledWith('d1', { isFavorite: true });
  expect(tables).toContain('favorites');
});

it('un-favoriting removes the favorites row and clears deals.is_favorite', async () => {
  results.favorites = { data: [{ id: 'f' }], error: null };
  jest.requireMock('../../store/dealStore').useDealStore.getState = () => ({ deals: { d1: { id: 'd1', isFavorite: true } }, updateDeal });
  await expect(toggleFavorite('deal', 'd1')).resolves.toBe(false);
  expect(updateDeal).toHaveBeenLastCalledWith('d1', { isFavorite: false });
});
