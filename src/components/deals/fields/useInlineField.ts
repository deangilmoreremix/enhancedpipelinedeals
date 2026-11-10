import { useCallback, useRef, useState } from 'react';
import { pushToast } from '../../../store/dealRecordStore';

/**
 * Click-to-edit state machine shared by the inline field editors.
 * - start()/cancel() toggle editing; commit(next) closes the editor right away and shows `next`
 *   optimistically (`pending`) until onSave resolves. On rejection the pending value is dropped,
 *   an inline error is exposed and an error toast is raised.
 */
export function useInlineField<T>(onSave: (next: T) => Promise<unknown> | unknown, label?: string) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ value: T } | null>(null);
  const cancelled = useRef(false);

  const start = useCallback(() => {
    cancelled.current = false;
    setError(null);
    setEditing(true);
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    setError(null);
    setEditing(false);
  }, []);

  const commit = useCallback(async (next: T) => {
    cancelled.current = true; // swallow the blur that fires as the editor unmounts
    setEditing(false);
    setPending({ value: next });
    try {
      await onSave(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      setError(msg);
      pushToast('error', `${label ? `${label}: ` : ''}${msg}`);
    } finally {
      setPending(null);
    }
  }, [onSave, label]);

  return { editing, error, pending, start, cancel, commit, cancelled, setError, setEditing };
}
