import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { BTN, BTN_ICON } from '../ui/buttonStyles';
import { diffSnapshots, restoreVersion, summarizeDiff, type WorkflowSnapshot, type WorkflowVersion } from '../../services/workflowVersionService';

interface Props {
  open: boolean;
  onClose: () => void;
  workflowId: string;
  versions: WorkflowVersion[];
  publishedVersion: number | null;
  /** Saved live row, to show what "Restore as draft" would change. */
  liveSnapshot: WorkflowSnapshot | null;
  dirty: boolean;
  canManage: boolean;
  onRestored: (version: number) => void | Promise<void>;
}

const STATUS_CLASS: Record<string, string> = {
  published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  archived: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

/** Right-hand drawer listing workflow_versions (newest first) with a diff summary against the previous version. */
export const WorkflowVersionDrawer: React.FC<Props> = ({ open, onClose, workflowId, versions, publishedVersion, liveSnapshot, dirty, canManage, onRestored }) => {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useEffect(() => { if (!open) { setConfirm(null); setError(null); } }, [open]);

  if (!open) return null;
  const sorted = [...versions].sort((a, b) => b.version - a.version);

  const restore = async (version: number) => {
    setBusy(version); setError(null);
    try { await restoreVersion(workflowId, version); setConfirm(null); await onRestored(version); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Restore failed'); } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label="Version history" className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Version history</h2>
          <button type="button" className={BTN_ICON} aria-label="Close version history" onClick={onClose}><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">The runner always executes the saved workflow, not a version. Restoring copies a version onto the saved workflow as a draft; publish again to snapshot it.</p>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {sorted.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">No versions yet. Publish the workflow to create the first one.</p>}
          <ol className="space-y-3">
            {sorted.map((v, i) => {
              const prev = sorted[i + 1];
              const sinceLabel = prev ? `vs v${prev.version}` : 'first version';
              const diff = prev ? summarizeDiff(diffSnapshots(prev.snapshot, v.snapshot)) : `${v.snapshot.stages?.length ?? 0} steps`;
              const detail = prev ? diffSnapshots(prev.snapshot, v.snapshot) : null;
              const vsLive = diffSnapshots(v.snapshot, liveSnapshot);
              return (
                <li key={v.id} data-testid="version-row" className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">Version {v.version}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[v.version === publishedVersion ? 'published' : v.status] ?? STATUS_CLASS.archived}`}>{v.version === publishedVersion ? 'published' : v.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(v.created_at).toLocaleString()}</p>
                  {v.note && <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{v.note}</p>}
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Changes {sinceLabel}: {diff}</p>
                  {detail && (detail.added.length + detail.removed.length + detail.changed.length > 0) && (
                    <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {detail.added.map(n => <li key={`a${n}`}>+ {n}</li>)}
                      {detail.removed.map(n => <li key={`r${n}`}>- {n}</li>)}
                      {detail.changed.map(n => <li key={`c${n}`}>~ {n}</li>)}
                    </ul>
                  )}
                  {canManage && (
                    confirm === v.version ? (
                      <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200" role="alert">
                        This overwrites the saved workflow ({summarizeDiff(vsLive).toLowerCase()} compared with v{v.version}){dirty ? ' and discards your unsaved edits' : ''}.
                        <div className="mt-2 flex gap-2">
                          <button type="button" className={BTN} disabled={busy === v.version} onClick={() => void restore(v.version)}>{busy === v.version ? 'Restoring...' : 'Confirm restore'}</button>
                          <button type="button" className={BTN} onClick={() => setConfirm(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : <button type="button" className={`${BTN} mt-2`} aria-label={`Restore version ${v.version} as draft`} onClick={() => setConfirm(v.version)}><RotateCcw className="h-4 w-4" />Restore as draft</button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </div>
  );
};
