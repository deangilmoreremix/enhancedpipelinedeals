import React from 'react';
import { X } from 'lucide-react';
import { useDealRecordStore } from '../../store/dealRecordStore';

const TONE = {
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200',
  success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-200',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
} as const;

/** Renders toasts raised by the record page (inline field errors, upload failures, ...). */
export const DealToasts: React.FC = () => {
  const toasts = useDealRecordStore(s => s.toasts);
  const dismiss = useDealRecordStore(s => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-2 rounded-xl border p-3 text-sm shadow-lg ${TONE[t.type]}`}>
          <span className="flex-1">{t.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)}><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
};

export default DealToasts;
