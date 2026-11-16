import { useCallback, useState } from 'react';
import { findDuplicateDeals, type DuplicateCandidate, type DuplicateQuery } from '../../../services/dealDuplicateService';
import { pushToast } from '../../../store/dealRecordStore';

/** Duplicate lookup for create flows. A failed lookup never blocks creation (it only toasts). */
export function useDuplicateCheck() {
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (q: DuplicateQuery): Promise<DuplicateCandidate[]> => {
    setChecking(true);
    try {
      const found = await findDuplicateDeals(q);
      setDuplicates(found);
      return found;
    } catch {
      pushToast('info', 'Could not check for duplicate deals; continuing');
      setDuplicates([]);
      return [];
    } finally {
      setChecking(false);
    }
  }, []);

  const clear = useCallback(() => setDuplicates([]), []);
  return { duplicates, checking, check, clear };
}
