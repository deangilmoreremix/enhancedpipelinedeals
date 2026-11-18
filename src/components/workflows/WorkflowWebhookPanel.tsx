import React, { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, Webhook } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { BTN, BTN_DANGER } from '../ui/buttonStyles';
import { getLiveMeta, setWebhook, webhookCurl, webhookUrl } from '../../services/workflowVersionService';

/** Inbound webhook trigger for a SAVED workflow: enable toggle, copy URL, rotate token (confirm), sample curl. */
export const WorkflowWebhookPanel: React.FC<{ workflowId: string | undefined; canManage: boolean }> = ({ workflowId, canManage }) => {
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const load = useCallback(async () => {
    if (!workflowId) return;
    try { const m = await getLiveMeta(workflowId); setEnabled(m.webhook_enabled); setToken(m.webhook_token); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load webhook settings'); }
  }, [workflowId]);
  useEffect(() => { void load(); }, [load]);

  // Only meaningful once the workflow exists in the database
  if (!workflowId) return null;

  const change = async (enable: boolean, msg: string) => {
    setBusy(true); setError(null);
    try {
      const t = await setWebhook(workflowId, enable);
      setEnabled(enable);
      if (enable) setToken(t);
      setStatus(msg);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the webhook'); } finally { setBusy(false); setConfirmRotate(false); }
  };

  const url = enabled && token ? webhookUrl(origin, token) : null;
  const copy = async () => { if (!url) return; try { await navigator.clipboard.writeText(url); setStatus('Webhook URL copied to the clipboard'); } catch { setStatus('Could not copy. Select the URL and copy it manually.'); } };

  return (
    <section aria-label="Inbound webhook trigger" className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><Webhook className="h-4 w-4" />Inbound webhook trigger</h3>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" role="switch" checked={enabled} disabled={!canManage || busy} onChange={e => void change(e.target.checked, e.target.checked ? 'Inbound webhook enabled' : 'Inbound webhook disabled')} />
          Enabled
        </label>
        {url && <>
          <button type="button" className={BTN} onClick={() => void copy()}><Copy className="h-4 w-4" />Copy URL</button>
          {canManage && <button type="button" className={BTN} disabled={busy} onClick={() => setConfirmRotate(true)}><RefreshCw className="h-4 w-4" />Rotate token</button>}
        </>}
      </div>
      {status && !error && <p role="status" className="mt-2 text-sm text-green-700 dark:text-green-300">{status}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {url && (
        <div className="mt-2 space-y-2">
          <p className="break-all font-mono text-xs text-gray-800 dark:text-gray-200" data-testid="webhook-url">{url}</p>
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100"><code>{webhookCurl(url)}</code></pre>
          <p className="text-xs text-gray-600 dark:text-gray-400">Anyone with this URL can trigger the workflow. The workflow must also be active.</p>
        </div>
      )}
      <Modal isOpen={confirmRotate} onClose={() => setConfirmRotate(false)} title="Rotate webhook token?">
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">The current URL stops working immediately. Update every system that calls it.</p>
        <div className="flex justify-end gap-2"><button type="button" className={BTN} onClick={() => setConfirmRotate(false)}>Cancel</button><button type="button" className={BTN_DANGER} disabled={busy} onClick={() => void change(true, 'Webhook token rotated')}>Rotate token</button></div>
      </Modal>
    </section>
  );
};
