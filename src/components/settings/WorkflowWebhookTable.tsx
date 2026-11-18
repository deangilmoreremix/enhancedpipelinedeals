import React, { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { BTN, BTN_DANGER } from '../ui/buttonStyles';
import { listWorkflowWebhooks, setWebhook, webhookUrl, type WorkflowWebhookRow } from '../../services/workflowVersionService';
import { pushToast } from '../../store/dealRecordStore';
import { CARD, ErrorLine, TD, TH, copyText, errText } from './settingsUi';

/** Inbound webhook trigger state for every workflow: enable / disable, copy URL, rotate token. */
export const WorkflowWebhookTable: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const [rows, setRows] = useState<WorkflowWebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rotate, setRotate] = useState<WorkflowWebhookRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const load = useCallback(async () => {
    try { setRows(await listWorkflowWebhooks()); setError(null); } catch (e) { setError(errText(e, 'Could not load workflows')); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const change = async (w: WorkflowWebhookRow, enable: boolean, msg: string) => {
    setBusy(w.id);
    try { await setWebhook(w.id, enable); pushToast('success', msg); await load(); } catch (e) { pushToast('error', errText(e, 'Could not update the webhook')); } finally { setBusy(null); setRotate(null); }
  };

  return (
    <div className={`${CARD} mt-6 overflow-x-auto`} data-testid="workflow-webhooks">
      <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Inbound workflow webhooks</h3>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">An enabled workflow can be triggered by POSTing JSON to its URL. Treat the URL like a password; rotate it if it leaks.</p>
      <ErrorLine message={error} />
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead><tr><th className={TH}>Workflow</th><th className={TH}>Inbound URL</th><th className={TH}><span className="sr-only">Actions</span></th></tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {loading && <tr><td className={TD} colSpan={3}>Loading...</td></tr>}
          {!loading && rows.length === 0 && <tr><td className={TD} colSpan={3}>No workflows to show. Create and save one on the Workflows page first.</td></tr>}
          {rows.map(w => {
            const url = w.webhook_enabled && w.webhook_token ? webhookUrl(origin, w.webhook_token) : null;
            return (
              <tr key={w.id}>
                <td className={TD}>{w.name}</td>
                <td className={`${TD} max-w-xs truncate font-mono text-xs`} title={url ?? undefined}>{url ?? 'Disabled'}</td>
                <td className={`${TD} whitespace-nowrap text-right`}>
                  {url && <button type="button" className={`${BTN} mr-2`} aria-label={`Copy URL for ${w.name}`} onClick={() => void copyText(url, 'Webhook URL copied')}><Copy className="h-4 w-4" />Copy URL</button>}
                  {canEdit && (url
                    ? <>
                        <button type="button" className={`${BTN} mr-2`} disabled={busy === w.id} aria-label={`Rotate token for ${w.name}`} onClick={() => setRotate(w)}><RefreshCw className="h-4 w-4" />Rotate</button>
                        <button type="button" className={BTN} disabled={busy === w.id} aria-label={`Disable webhook for ${w.name}`} onClick={() => void change(w, false, 'Inbound webhook disabled')}>Disable</button>
                      </>
                    : <button type="button" className={BTN} disabled={busy === w.id} aria-label={`Enable webhook for ${w.name}`} onClick={() => void change(w, true, 'Inbound webhook enabled')}>Enable</button>)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Modal isOpen={!!rotate} onClose={() => setRotate(null)} title="Rotate webhook token?">
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">The current URL for "{rotate?.name}" stops working immediately. Anything calling it must be updated to the new URL.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN} onClick={() => setRotate(null)}>Cancel</button>
          <button type="button" className={BTN_DANGER} onClick={() => rotate && void change(rotate, true, 'Webhook token rotated')}>Rotate token</button>
        </div>
      </Modal>
    </div>
  );
};
