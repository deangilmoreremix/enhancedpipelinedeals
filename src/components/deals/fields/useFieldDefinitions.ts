import { useCallback, useEffect, useState } from 'react';
import type { CustomFieldEntityType, DealFieldDefinition } from '../../../types/customFields';
import { errMsg, getCachedDefinitions, hasLoadedDefinitions, listFieldDefinitions, subscribeDefinitions } from '../../../services/customFieldService';
import { pushToast } from '../../../store/dealRecordStore';

/**
 * Field definitions of one entity type (shared cache; loads once per mount, re-renders on any change).
 * `lazy` only loads when nothing has been loaded yet (board / table consumers that just read the cache).
 */
export function useFieldDefinitions(entityType: CustomFieldEntityType = 'deal', opts: { lazy?: boolean } = {}) {
  const [defs, setDefs] = useState<DealFieldDefinition[]>(getCachedDefinitions(entityType));
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { await listFieldDefinitions(entityType); } catch (e) { pushToast('error', `Could not load custom fields: ${errMsg(e)}`); }
    finally { setLoading(false); }
  }, [entityType]);

  useEffect(() => {
    setDefs(getCachedDefinitions(entityType));
    const unsub = subscribeDefinitions(() => setDefs(getCachedDefinitions(entityType)));
    if (!(opts.lazy && hasLoadedDefinitions(entityType))) void refresh();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, entityType]);

  return { definitions: defs, loading, refresh };
}
