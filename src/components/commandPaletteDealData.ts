import { useEffect, useState } from 'react';
import type { Deal, PipelineStage } from '../types';

export interface DealRecordData {
  deal: Deal | undefined;
  stages: PipelineStage[];
}

const EMPTY: DealRecordData = { deal: undefined, stages: [] };

/**
 * Live deal + stage list for the "This deal" group. The deal store is imported lazily, only once a deal
 * is current, so the palette itself stays cheap to load (and independent of the data layer).
 */
export function useDealRecordData(dealId: string | null): DealRecordData {
  const [data, setData] = useState<DealRecordData>(EMPTY);
  useEffect(() => {
    if (!dealId) { setData(EMPTY); return; }
    let cancelled = false;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { useDealStore } = await import('../store/dealStore');
        if (cancelled) return;
        const read = () => {
          const s = useDealStore.getState();
          return { deal: s.deals[dealId], stages: s.stages };
        };
        setData(read());
        unsub = useDealStore.subscribe(() => {
          const next = read();
          setData(prev => (prev.deal === next.deal && prev.stages === next.stages ? prev : next));
        });
      } catch {
        if (!cancelled) setData(EMPTY);
      }
    })();
    return () => { cancelled = true; unsub?.(); };
  }, [dealId]);
  return data;
}
