import React from 'react';
import { pushToast } from '../../store/dealRecordStore';

export const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white';
export const CARD = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800';
export const TH = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400';
export const TD = 'px-3 py-2 text-sm text-gray-800 dark:text-gray-200';
export const CODE = 'overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100';

export const SectionHeader: React.FC<{ title: string; description?: string; actions?: React.ReactNode }> = ({ title, description, actions }) => (
  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{description}</p>}
    </div>
    {actions}
  </div>
);

export const ReadOnlyNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p role="note" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{children}</p>
);

export const ErrorLine: React.FC<{ message: string | null }> = ({ message }) =>
  message ? <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{message}</p> : null;

/** Clipboard write with a toast; falls back to a message when the clipboard is unavailable. */
export async function copyText(text: string, what = 'Copied'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    pushToast('success', `${what} to the clipboard`);
    return true;
  } catch {
    pushToast('error', 'Could not copy. Select the text and copy it manually.');
    return false;
  }
}

export const errText = (e: unknown, fallback = 'Something went wrong'): string => (e instanceof Error && e.message ? e.message : fallback);

export const fmtDate = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleString() : 'Never');
