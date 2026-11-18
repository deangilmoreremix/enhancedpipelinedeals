import { useCallback, useEffect, useRef, useState } from 'react';
import type { CustomFieldEntityType, CustomFieldValue } from '../../../types/customFields';
import { recordCustomValues, saveRecordValues } from '../../../services/customFieldService';

type RecordLike = { customFields?: unknown; custom_fields?: unknown } | null | undefined;

/**
 * Custom values of a contact / company with optimistic saves: the new map shows immediately, is persisted through
 * `saveRecordValues`, mirrored into the owning store via `onPersisted`, and rolled back (error rethrown so the inline
 * field shows it + raises its toast) when the write fails.
 */
export function useRecordCustomValues(
  entityType: CustomFieldEntityType, id: string, record: RecordLike,
  onPersisted?: (values: Record<string, CustomFieldValue>) => void,
) {
  const [values, setValues] = useState<Record<string, CustomFieldValue>>(() => recordCustomValues(entityType, id, record));
  const latest = useRef(values);
  latest.current = values;
  const persisted = useRef(onPersisted);
  persisted.current = onPersisted;
  // compare by content: callers may hand over a fresh (equal) object on every render
  const signature = JSON.stringify(record?.customFields ?? record?.custom_fields ?? null);

  useEffect(() => { setValues(recordCustomValues(entityType, id, record)); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityType, id, signature]);

  const save = useCallback(async (next: Record<string, CustomFieldValue>) => {
    const prev = latest.current;
    setValues(next);
    try {
      await saveRecordValues(entityType, id, next);
      persisted.current?.(next);
    } catch (e) {
      setValues(prev);
      throw e;
    }
  }, [entityType, id]);

  return { values, save };
}
