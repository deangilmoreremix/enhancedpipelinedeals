import { useCallback, useEffect, useState } from 'react';
import type { Deal } from '../../types';
import { useDealStore } from '../../store/dealStore';
import { useContactStore } from '../../store/contactStore';
import { fetchDealById, restoreDealRemote } from '../../services/dealRecordService';

export type DealRecordStatus = 'loading' | 'ready' | 'not_found' | 'deleted';

/**
 * Loads a deal for the record page / modal: store first, then (if the store is empty) a full fetch,
 * then a direct Supabase lookup so soft-deleted deals can be recognised and restored.
 */
export function useDealRecord(dealId: string) {
  const deal = useDealStore(s => s.deals[dealId]);
  const trashed = useDealStore(s => s.trash[dealId]);
  const [status, setStatus] = useState<DealRecordStatus>(deal ? 'ready' : 'loading');
  const [deletedDeal, setDeletedDeal] = useState<Deal | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (deal) { setStatus('ready'); return; }
    if (trashed) { setDeletedDeal(trashed); setStatus('deleted'); return; }
    let alive = true;
    setStatus('loading');
    (async () => {
      const store = useDealStore.getState();
      if (Object.keys(store.deals).length === 0 && !store.isLoading) await store.fetchDeals();
      if (!alive) return;
      if (useDealStore.getState().deals[dealId]) return; // effect re-runs through the subscription
      try {
        const remote = await fetchDealById(dealId);
        if (!alive) return;
        if (remote?.deletedAt) { setDeletedDeal(remote); setStatus('deleted'); }
        else setStatus('not_found');
      } catch (e) {
        console.warn('Failed to load deal:', e);
        if (alive) setStatus('not_found');
      }
    })();
    return () => { alive = false; };
  }, [dealId, deal, trashed, attempt]);

  // Ensure contacts are available for the contact picker / linked contact card.
  useEffect(() => {
    const cs = useContactStore.getState();
    if (cs.contacts.length === 0 && !cs.isLoading) void cs.fetchContacts();
  }, []);

  const update = useCallback((updates: Partial<Deal>) => useDealStore.getState().updateDeal(dealId, updates), [dealId]);

  const restore = useCallback(async () => {
    const store = useDealStore.getState();
    if (store.trash[dealId]) await store.restoreDeal(dealId);
    else { await restoreDealRemote(dealId); await store.fetchDeals(); }
    setAttempt(a => a + 1);
  }, [dealId]);

  return { deal, status, deletedDeal, update, restore, reload: () => setAttempt(a => a + 1) };
}
