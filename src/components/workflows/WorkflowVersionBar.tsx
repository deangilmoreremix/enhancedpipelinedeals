import React, { useCallback, useEffect, useState } from 'react';
import { History, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { BTN, BTN_PRIMARY } from '../ui/buttonStyles';
import { badgeFor, getLiveMeta, listVersions, publishVersion, type WorkflowLiveMeta, type WorkflowVersion } from '../../services/workflowVersionService';
import { WorkflowVersionDrawer } from './WorkflowVersionDrawer';

export interface WorkflowVersionBarProps {
  workflowId: string | undefined;
  workflowName: string;
  /** Unsaved edits in the builder (publishing snapshots the SAVED row, so it is blocked while dirty). */
  dirty: boolean;
  canManage: boolean;
  /** Bump after every successful save so the badge re-reads the live row. */
  refreshKey: number;
  /** Called after a restore so the parent reloads the live workflow into the builder. */
  onRestored: (version: number) => void | Promise<void>;
  onNotice: (n: { ok: boolean; text: string }) => void;
}

/**
 * Version badge + Publish + Version history + inbound webhook panel for the workflow builder header.
 * The runner keeps executing the LIVE deal_workflows row; "Published vN" only marks the last snapshot taken.
 */
export const WorkflowVersionBar: React.FC<WorkflowVersionBarProps> = ({ workflowId, workflowName, dirty, canManage, refreshKey, onRestored, onNotice }) => {
  const [meta, setMeta] = useState<WorkflowLiveMeta | null>(null);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    if (!workflowId) { setMeta(null); setVersions([]); return; }
    try {
      const [m, v] = await Promise.all([getLiveMeta(workflowId), listVersions(workflowId)]);
      setMeta(m); setVersions(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load version information');
    }
  }, [workflowId]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const publishedSnap = versions.find(v => v.version === meta?.published_version)?.snapshot ?? null;
  const badge = !workflowId
    ? { label: 'Draft (not saved)', kind: 'draft' as const }
    : badgeFor(meta?.published_version ?? null, meta?.snapshot ?? null, publishedSnap, dirty);

  const publish = async () => {
    if (!workflowId) return;
    setBusy(true); setError(null);
    try {
      const v = await publishVersion(workflowId, note, meta?.snapshot ?? undefined);
      setPublishing(false); setNote('');
      onNotice({ ok: true, text: `Published version ${v}. Note: the runner executes the saved workflow, which is what was just published.` });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Publish failed'); } finally { setBusy(false); }
  };

  const publishBlocked = !workflowId ? 'Save the workflow first' : dirty ? 'Save your changes before publishing' : !canManage ? 'You do not have permission to publish workflows' : undefined;

  return (
    <>
      <span
        data-testid="workflow-version-badge"
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.kind === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}
      >{badge.label}</span>
      <button type="button" className={BTN_PRIMARY} disabled={!!publishBlocked} title={publishBlocked} onClick={() => { setPublishing(true); setError(null); }}><Upload className="h-4 w-4" />Publish</button>
      <button type="button" className={BTN} disabled={!workflowId} title={workflowId ? undefined : 'Save the workflow first'} onClick={() => setHistoryOpen(true)}><History className="h-4 w-4" />Version history</button>

      <Modal isOpen={publishing} onClose={() => setPublishing(false)} title={`Publish "${workflowName}"`}>
        <div className="space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">Snapshots the saved workflow as the next version. You can restore any version later.</p>
          <div>
            <label htmlFor="publish-note" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Note (optional)</label>
            <textarea id="publish-note" rows={3} maxLength={500} autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder="What changed?"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white" />
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN} onClick={() => setPublishing(false)}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void publish()}>{busy ? 'Publishing...' : 'Publish version'}</button>
          </div>
        </div>
      </Modal>

      {workflowId && (
        <WorkflowVersionDrawer
          open={historyOpen} onClose={() => setHistoryOpen(false)} workflowId={workflowId} versions={versions} publishedVersion={meta?.published_version ?? null}
          liveSnapshot={meta?.snapshot ?? null} dirty={dirty} canManage={canManage}
          onRestored={async v => { await onRestored(v); await load(); }}
        />
      )}
    </>
  );
};

