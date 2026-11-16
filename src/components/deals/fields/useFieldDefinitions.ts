import { useCallback, useEffect, useState } from 'react';
import type { DealFieldDefinition } from '../../../types/customFields';
import { getCachedDefinitions, listFieldDefinitions, subscribeDefinitions } from '../../../services/customFieldService';
import { pushToast } from '../../../store/dealRecordStore';
import { errorMessage } from '../../../services/dealRecordShared';

/** Field definitions (shared cache; loads once per mount, re-renders on any change). */
export function useFieldDefinitions() {
  const [defs, setDefs] = useState<DealFieldDefinition[]>(getCachedDefinitions());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { await listFieldDefinitions(); } catch (e) { pushToast('error', `Could not load custom fields: ${errorMessage(e)}`); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const unsub = subscribeDefinitions(() => setDefs(getCachedDefinitions()));
    void refresh();
    return unsub;
  }, [refresh]);

  return { definitions: defs, loading, refresh };
}
