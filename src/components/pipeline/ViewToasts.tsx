import React, { useCallback, useEffect, useRef, useState } from 'react';

export type ViewToastType = 'info' | 'success' | 'warning' | 'error';
interface ViewToast { id: number; message: string; type: ViewToastType }

const TOAST_STYLES: Record<ViewToastType, string> = {
  info: 'bg-blue-600',
  success: 'bg-green-600',
  warning: 'bg-yellow-600',
  error: 'bg-red-600'
};

/** Minimal toast stack (same look as the kanban board's) for the table/list/calendar/timeline views. */
export function useViewToasts() {
  const [toasts, setToasts] = useState<ViewToast[]>([]);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);

  const notify = useCallback((message: string, type: ViewToastType = 'info') => {
    const id = ++seq.current;
    setToasts(t => [...t, { id, message, type }]);
    timers.current.push(window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000));
  }, []);

  const node = (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 space-y-2 pointer-events-none" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} role="status" className={`px-4 py-2 rounded-lg shadow-lg text-sm text-white pointer-events-auto ${TOAST_STYLES[t.type]}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
  return { notify, toastsNode: node };
}
