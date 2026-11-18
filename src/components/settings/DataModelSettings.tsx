import React, { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Pencil, Trash2, Undo2 } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { CUSTOM_FIELD_ENTITY_TYPES, type CustomFieldEntityType, type DealFieldDefinition } from '../../types/customFields';
import { createFieldDefinition, errMsg, reorderFieldDefinitions, setFieldActive, updateFieldDefinition } from '../../services/customFieldService';
import { useFieldDefinitions } from '../deals/fields/useFieldDefinitions';
import { FIELD_TYPE_LABELS, FieldForm } from '../deals/fields/FieldForm';
import { ROLLUP_METRIC_LABELS } from '../../utils/rollups';
import { pushToast } from '../../store/dealRecordStore';
import { toastFailure } from '../../utils/permissionToast';
import DealToasts from '../deals/DealToasts';

const TAB_LABELS: Record<CustomFieldEntityType, string> = { deal: 'Deals', contact: 'Contacts', company: 'Companies' };
const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400';
const iconBtn = 'rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700';

const detail = (d: DealFieldDefinition): string => {
  if (d.type === 'formula') return d.config?.formula ?? '';
  if (d.type === 'rollup') return ROLLUP_METRIC_LABELS[d.config?.metric ?? 'open_deal_value'];
  return d.options.join(', ');
};

/** Settings -> Data model: manage the custom field definitions of deals, contacts and companies. */
const DataModelSettings: React.FC = () => {
  const perms = usePermissions();
  const canManage = perms.allowed('manage_stages', 'stage');
  const [tab, setTab] = useState<CustomFieldEntityType>('deal');
  const { definitions, loading } = useFieldDefinitions(tab);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try { await fn(); return true; }
    catch (e) { toastFailure(e, 'manage_stages', 'field', `${failure}: ${errMsg(e)}`); return false; }
    finally { setBusy(false); }
  };

  const reorder = (ids: string[]) => run(() => reorderFieldDefinitions(ids, tab), 'Could not reorder fields');
  const move = (idx: number, dir: -1 | 1) => {
    const ids = definitions.map(d => d.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    void reorder(ids);
  };
  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ids = definitions.map(d => d.id).filter(id => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null);
    void reorder(ids);
  };

  const toggleActive = (d: DealFieldDefinition) =>
    run(() => setFieldActive(d.id, !d.isActive, tab), 'Could not update field');

  const deactivate = async (d: DealFieldDefinition) => {
    setConfirmId(null);
    if (await run(() => setFieldActive(d.id, false, tab), 'Could not delete field')) {
      pushToast('success', `Deleted "${d.label}" (hidden everywhere; stored values are kept and it can be restored)`);
    }
  };

  return (
    <section aria-label="Data model" className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Data model</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Custom fields for deals, contacts and companies. Deleting a field only deactivates it.</p>
      </div>

      <div role="tablist" aria-label="Record type" className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {CUSTOM_FIELD_ENTITY_TYPES.map(t => (
          <button
            key={t} type="button" role="tab" id={`dm-tab-${t}`} aria-selected={tab === t} aria-controls="dm-panel"
            onClick={() => { setTab(t); setEditingId(null); setConfirmId(null); }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div id="dm-panel" role="tabpanel" aria-labelledby={`dm-tab-${tab}`} className="space-y-4">
        {!canManage && <p role="note" className="text-sm text-amber-700 dark:text-amber-300">You don't have permission to change custom fields.</p>}

        {definitions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
            {loading ? 'Loading fields...' : `No ${TAB_LABELS[tab].toLowerCase()} custom fields yet. Add one below.`}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700" aria-label={`${TAB_LABELS[tab]} custom fields`}>
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className={`${th} w-8`}><span className="sr-only">Reorder</span></th>
                  <th className={th}>Label</th><th className={th}>Key</th><th className={th}>Type</th><th className={th}>Group</th>
                  <th className={th}>Active</th><th className={th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {definitions.map((d, i) => (
                  <React.Fragment key={d.id}>
                    <tr
                      data-testid={`field-row-${d.key}`}
                      draggable={canManage && !busy}
                      onDragStart={() => setDragId(d.id)}
                      onDragOver={e => { if (dragId) e.preventDefault(); }}
                      onDrop={e => { e.preventDefault(); drop(d.id); }}
                      onDragEnd={() => setDragId(null)}
                      className={`${d.isActive ? '' : 'opacity-60'} ${dragId === d.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <td className="px-3 py-2 text-gray-400"><GripVertical className="h-4 w-4 cursor-grab" aria-hidden /></td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                        {d.label}
                        {detail(d) && <span className="block max-w-xs truncate text-xs font-normal text-gray-500 dark:text-gray-400">{detail(d)}</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">{d.key}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{FIELD_TYPE_LABELS[d.type]}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{d.groupName ?? '-'}</td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox" role="switch" aria-label={`${d.label} active`} checked={d.isActive}
                          disabled={!canManage || busy} onChange={() => void toggleActive(d)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-700"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button type="button" aria-label={`Move ${d.label} up`} className={iconBtn} disabled={!canManage || busy || i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Move ${d.label} down`} className={iconBtn} disabled={!canManage || busy || i === definitions.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Edit ${d.label}`} className={iconBtn} disabled={!canManage} onClick={() => setEditingId(editingId === d.id ? null : d.id)}><Pencil className="h-4 w-4" /></button>
                        {confirmId === d.id ? (
                          <span className="ml-1 inline-flex items-center gap-1 text-xs">
                            <button type="button" className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700" onClick={() => void deactivate(d)}>Confirm delete</button>
                            <button type="button" className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" onClick={() => setConfirmId(null)}>Cancel</button>
                          </span>
                        ) : d.isActive ? (
                          <button type="button" aria-label={`Delete ${d.label}`} className={iconBtn} disabled={!canManage || busy} onClick={() => setConfirmId(d.id)}><Trash2 className="h-4 w-4" /></button>
                        ) : (
                          <button type="button" aria-label={`Restore ${d.label}`} className={iconBtn} disabled={!canManage || busy} onClick={() => void toggleActive(d)}><Undo2 className="h-4 w-4" /></button>
                        )}
                      </td>
                    </tr>
                    {editingId === d.id && (
                      <tr>
                        <td colSpan={7} className="bg-gray-50 px-4 py-3 dark:bg-gray-900/40">
                          <FieldForm
                            mode="edit" entityType={tab} definition={d} busy={busy} siblings={definitions}
                            onCancel={() => setEditingId(null)}
                            onSubmit={async input => {
                              const ok = await run(() => updateFieldDefinition(d.id, {
                                label: input.label, groupName: input.groupName ?? null, config: input.config,
                                ...(d.options.length || input.options?.length ? { options: input.options } : {}),
                              }, tab), 'Could not save field');
                              if (ok) { setEditingId(null); pushToast('success', `Saved "${input.label.trim()}"`); }
                              return ok;
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <FieldForm
          mode="add" entityType={tab} disabled={!canManage} busy={busy} siblings={definitions}
          onSubmit={async input => {
            const ok = await run(() => createFieldDefinition(input, tab), 'Could not add field');
            if (ok) pushToast('success', `Added ${TAB_LABELS[tab].toLowerCase()} field "${input.label.trim()}"`);
            return ok;
          }}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">Drag rows (or use the arrows) to change the order fields appear in.</p>
      </div>
      <DealToasts />
    </section>
  );
};

export default DataModelSettings;
