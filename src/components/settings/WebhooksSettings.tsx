import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { BTN, BTN_ICON, BTN_PRIMARY, BTN_DANGER } from '../ui/buttonStyles';
import {
  TEST_SEND_UNAVAILABLE, WEBHOOK_EVENTS, deleteWebhook, listWebhooks, maskSecret, samplePayload, saveWebhook, validateWebhook,
  type OutboundWebhook, type OutboundWebhookInput,
} from '../../services/webhookAdminService';
import { pushToast } from '../../store/dealRecordStore';
import { CARD, CODE, ErrorLine, INPUT, SectionHeader, TD, TH, errText } from './settingsUi';
import { WorkflowWebhookTable } from './WorkflowWebhookTable';

const EMPTY: OutboundWebhookInput = { name: '', url: '', events: ['deal.updated'], secret: '', is_active: true };

/** Outbound webhooks (CRUD) + inbound workflow webhooks. */
export const WebhooksSettings: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
  const [hooks, setHooks] = useState<OutboundWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; value: OutboundWebhookInput } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<OutboundWebhook | null>(null);
  const [preview, setPreview] = useState<OutboundWebhook | null>(null);

  const load = useCallback(async () => {
    try { setHooks(await listWebhooks()); setError(null); } catch (e) { setError(errText(e, 'Could not load webhooks')); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const invalid = validateWebhook(editing.value);
    if (invalid) { setFormError(invalid); return; }
    setBusy(true);
    try {
      await saveWebhook(editing.value, editing.id);
      pushToast('success', editing.id ? 'Webhook updated' : 'Webhook created');
      setEditing(null);
      await load();
    } catch (err) { setFormError(errText(err, 'Could not save the webhook')); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try { await deleteWebhook(deleting.id); pushToast('success', 'Webhook deleted'); setDeleting(null); await load(); } catch (e) { pushToast('error', errText(e, 'Could not delete the webhook')); } finally { setBusy(false); }
  };

  const toggleActive = async (h: OutboundWebhook) => {
    try { await saveWebhook({ name: h.name, url: h.url, events: h.events, secret: h.secret, is_active: !h.is_active }, h.id); await load(); } catch (e) { pushToast('error', errText(e, 'Could not update the webhook')); }
  };

  const set = (patch: Partial<OutboundWebhookInput>) => setEditing(cur => (cur ? { ...cur, value: { ...cur.value, ...patch } } : cur));
  const toggleEvent = (ev: string) => editing && set({ events: editing.value.events.includes(ev) ? editing.value.events.filter(x => x !== ev) : [...editing.value.events, ev] });

  return (
    <section aria-label="Webhooks">
      <SectionHeader
        title="Webhooks"
        description="Outbound webhooks notify other systems about changes. Inbound workflow webhooks let other systems trigger a workflow."
        actions={canEdit && <button type="button" className={BTN_PRIMARY} onClick={() => { setEditing({ value: EMPTY }); setFormError(null); setShowSecret(false); }}><Plus className="h-4 w-4" />Add webhook</button>}
      />
      <ErrorLine message={error} />
      <div className={`${CARD} overflow-x-auto !p-0`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead><tr><th className={TH}>Name</th><th className={TH}>URL</th><th className={TH}>Events</th><th className={TH}>Secret</th><th className={TH}>Active</th><th className={TH}><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && <tr><td className={TD} colSpan={6}>Loading...</td></tr>}
            {!loading && hooks.length === 0 && <tr><td className={TD} colSpan={6}>No outbound webhooks yet.</td></tr>}
            {hooks.map(h => (
              <tr key={h.id}>
                <td className={TD}>{h.name}</td>
                <td className={`${TD} max-w-xs truncate font-mono text-xs`} title={h.url}>{h.url}</td>
                <td className={TD}>{h.events.join(', ')}</td>
                <td className={`${TD} font-mono`}>{maskSecret(h.secret)}</td>
                <td className={TD}><input type="checkbox" aria-label={`${h.name} active`} checked={h.is_active} disabled={!canEdit} onChange={() => void toggleActive(h)} /></td>
                <td className={`${TD} whitespace-nowrap text-right`}>
                  <button type="button" className={`${BTN_ICON} mr-1`} aria-label={`Test ${h.name}`} title="Test send" onClick={() => setPreview(h)}><Send className="h-4 w-4" /></button>
                  {canEdit && <>
                    <button type="button" className={`${BTN_ICON} mr-1`} aria-label={`Edit ${h.name}`} onClick={() => { setEditing({ id: h.id, value: { name: h.name, url: h.url, events: h.events, secret: h.secret, is_active: h.is_active } }); setFormError(null); setShowSecret(false); }}><Pencil className="h-4 w-4" /></button>
                    <button type="button" className={BTN_ICON} aria-label={`Delete ${h.name}`} onClick={() => setDeleting(h)}><Trash2 className="h-4 w-4" /></button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <WorkflowWebhookTable canEdit={canEdit} />

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit webhook' : 'Add webhook'}>
        {editing && (
          <form onSubmit={e => void save(e)} className="space-y-3">
            <div><label htmlFor="wh-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input id="wh-name" className={INPUT} value={editing.value.name} onChange={e => set({ name: e.target.value })} autoFocus /></div>
            <div><label htmlFor="wh-url" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">URL</label>
              <input id="wh-url" className={INPUT} value={editing.value.url} onChange={e => set({ url: e.target.value })} placeholder="https://example.com/hooks/crm" inputMode="url" /></div>
            <fieldset><legend className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Events</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">{WEBHOOK_EVENTS.map(ev => (
                <label key={ev} className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"><input type="checkbox" checked={editing.value.events.includes(ev)} onChange={() => toggleEvent(ev)} />{ev}</label>))}</div></fieldset>
            <div><label htmlFor="wh-secret" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Signing secret</label>
              <div className="flex gap-2"><input id="wh-secret" className={`${INPUT} font-mono`} type={showSecret ? 'text' : 'password'} autoComplete="off" value={editing.value.secret} onChange={e => set({ secret: e.target.value })} />
                <button type="button" className={BTN_ICON} aria-label={showSecret ? 'Hide secret' : 'Show secret'} onClick={() => setShowSecret(s => !s)}>{showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"><input type="checkbox" checked={editing.value.is_active} onChange={e => set({ is_active: e.target.checked })} />Active</label>
            <ErrorLine message={formError} />
            <div className="flex justify-end gap-2"><button type="button" className={BTN} onClick={() => setEditing(null)}>Cancel</button><button type="submit" className={BTN_PRIMARY} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button></div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title="Delete webhook?">
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">"{deleting?.name}" will stop receiving events.</p>
        <div className="flex justify-end gap-2"><button type="button" className={BTN} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className={BTN_DANGER} disabled={busy} onClick={() => void remove()}>Delete</button></div>
      </Modal>

      <Modal isOpen={!!preview} onClose={() => setPreview(null)} title="Test send">
        {preview && <div className="space-y-3"><p role="status" className="text-sm text-gray-700 dark:text-gray-300">{TEST_SEND_UNAVAILABLE}</p>
          <pre className={CODE}><code>{JSON.stringify(samplePayload(preview), null, 2)}</code></pre>
          <div className="flex justify-end"><button type="button" className={BTN} onClick={() => setPreview(null)}>Close</button></div></div>}
      </Modal>
    </section>
  );
};

export default WebhooksSettings;
