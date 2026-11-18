import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Copy, KeyRound, Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { BTN, BTN_DANGER, BTN_PRIMARY } from '../ui/buttonStyles';
import {
  API_KEY_SCOPES, createApiKey, curlExamples, keyStatus, listApiKeys, revokeApiKey, validateKeyInput,
  type ApiKeyRow, type ApiKeyScope, type CreatedApiKey,
} from '../../services/apiKeyService';
import { pushToast } from '../../store/dealRecordStore';
import { CARD, CODE, ErrorLine, INPUT, SectionHeader, TD, TH, copyText, errText, fmtDate } from './settingsUi';

/** API keys: create (shown once), list, revoke, plus curl docs for /api/v1/deals. */
export const ApiKeysSettings: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['read']);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const load = useCallback(async () => {
    setError(null);
    try { setKeys(await listApiKeys()); } catch (e) { setError(errText(e, 'Could not load API keys')); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateKeyInput(name, scopes);
    if (invalid) { setFormError(invalid); return; }
    setBusy(true); setFormError(null);
    try {
      const k = await createApiKey(name, scopes);
      setCreating(false); setName(''); setScopes(['read']);
      setCreated(k);
      await load();
    } catch (err) { setFormError(errText(err, 'Could not create the key')); } finally { setBusy(false); }
  };

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await revokeApiKey(revoking.id);
      pushToast('success', `Revoked "${revoking.name}"`);
      setRevoking(null);
      await load();
    } catch (err) { pushToast('error', errText(err, 'Could not revoke the key')); } finally { setBusy(false); }
  };

  const toggleScope = (s: ApiKeyScope) => setScopes(cur => (cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]));

  return (
    <section aria-label="API keys">
      <SectionHeader
        title="API keys"
        description="Authenticate requests to the public REST API with a bearer key. Keys are shown once, when created."
        actions={canEdit && <button type="button" className={BTN_PRIMARY} onClick={() => { setCreating(true); setFormError(null); }}><Plus className="h-4 w-4" />Create key</button>}
      />
      <ErrorLine message={error} />

      <div className={`${CARD} overflow-x-auto !p-0`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead><tr><th className={TH}>Name</th><th className={TH}>Key</th><th className={TH}>Scopes</th><th className={TH}>Last used</th><th className={TH}>Status</th><th className={TH}><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && <tr><td className={TD} colSpan={6}>Loading...</td></tr>}
            {!loading && keys.length === 0 && <tr><td className={TD} colSpan={6}>No API keys yet.</td></tr>}
            {keys.map(k => (
              <tr key={k.id} data-testid="api-key-row">
                <td className={TD}>{k.name}</td>
                <td className={`${TD} font-mono`}>cb_live_{k.prefix}...</td>
                <td className={TD}>{k.scopes.join(', ')}</td>
                <td className={TD}>{fmtDate(k.last_used_at)}</td>
                <td className={TD}>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${keyStatus(k) === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {keyStatus(k) === 'active' ? 'Active' : `Revoked ${fmtDate(k.revoked_at)}`}
                  </span>
                </td>
                <td className={`${TD} text-right`}>
                  {canEdit && !k.revoked_at && <button type="button" className={BTN} aria-label={`Revoke ${k.name}`} onClick={() => setRevoking(k)}>Revoke</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`${CARD} mt-6`}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><KeyRound className="h-4 w-4" />Using the API</h3>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">Send the key as a bearer token. Responses use the envelope <code>{'{ data, error, next_offset }'}</code>. The <code>write</code> scope is required for POST, PATCH and DELETE.</p>
        <div className="space-y-3">
          {curlExamples(origin).map(ex => (
            <div key={ex.title}>
              <div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium text-gray-700 dark:text-gray-300">{ex.title}</span>
                <button type="button" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400" onClick={() => void copyText(ex.code, 'Example copied')}><Copy className="h-3 w-3" />Copy</button></div>
              <pre className={CODE}><code>{ex.code}</code></pre>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={creating} onClose={() => setCreating(false)} title="Create API key">
        <form onSubmit={e => void create(e)} className="space-y-4">
          <div>
            <label htmlFor="api-key-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input id="api-key-name" className={INPUT} value={name} maxLength={60} autoFocus onChange={e => setName(e.target.value)} placeholder="e.g. Zapier integration" />
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Scopes</legend>
            {API_KEY_SCOPES.map(s => (
              <label key={s} className="mr-4 inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />{s === 'read' ? 'read (GET)' : 'write (POST, PATCH, DELETE)'}
              </label>
            ))}
          </fieldset>
          <ErrorLine message={formError} />
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN} onClick={() => setCreating(false)}>Cancel</button>
            <button type="submit" className={BTN_PRIMARY} disabled={busy}>{busy ? 'Creating...' : 'Create key'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!created} onClose={() => setCreated(null)} title="Copy your API key">
        <div className="space-y-3">
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />This is the only time the key is shown. Store it somewhere safe; if you lose it, revoke it and create a new one.
          </p>
          <label htmlFor="api-key-secret" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Key for "{created?.name}"</label>
          <input id="api-key-secret" readOnly className={`${INPUT} font-mono`} value={created?.key ?? ''} onFocus={e => e.currentTarget.select()} />
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN} onClick={() => created && void copyText(created.key, 'API key copied')}><Copy className="h-4 w-4" />Copy key</button>
            <button type="button" className={BTN_PRIMARY} onClick={() => setCreated(null)}>I have saved it</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!revoking} onClose={() => setRevoking(null)} title="Revoke API key?">
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">Anything using "{revoking?.name}" will stop working immediately. This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN} onClick={() => setRevoking(null)}>Cancel</button>
          <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => void revoke()}>Revoke key</button>
        </div>
      </Modal>
    </section>
  );
};

export default ApiKeysSettings;
