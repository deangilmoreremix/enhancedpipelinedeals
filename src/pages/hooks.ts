import { useEffect } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { useDealStore } from '../store/dealStore';

/** Loads deals from Supabase (via the deal store) once and returns the store slice. */
export function useDeals() {
  const deals = useDealStore(s => s.deals);
  const isLoading = useDealStore(s => s.isLoading);
  const error = useDealStore(s => s.error);
  const fetchDeals = useDealStore(s => s.fetchDeals);
  useEffect(() => {
    if (Object.keys(useDealStore.getState().deals).length === 0) void fetchDeals();
  }, [fetchDeals]);
  return { deals, isLoading, error, refetch: fetchDeals };
}

/** The signed-in user's id ('' when signed out). */
export function useCurrentUserId(): string {
  const { user } = useAuth();
  return user?.id ?? '';
}
