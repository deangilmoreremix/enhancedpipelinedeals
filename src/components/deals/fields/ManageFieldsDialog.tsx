import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Check, EyeOff, Eye, Pencil, Plus, X } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { usePermissions } from '../../../hooks/usePermissions';
import { CUSTOM_FIELD_TYPES, type CustomFieldType, type DealFieldDefinition } from '../../../types/customFields';
import {
  createFieldDefinition, reorderFieldDefinitions, setFieldActive, updateFieldDefinition,
} from '../../../services/customFieldService';
import { errorMessage } from '../../../services/dealRecordShared';
import { pushToast } from '../../../store/dealRecordStore';
import { toastFailure } from '../../../utils/permissionToast';
import { useFieldDefinitions } from './useFieldDefinitions';

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text', number: 'Number', select: 'Select', multi_select: 'Multi-select', rating: 'Rating',
  link: 'Link', email: 'Email', phone: 'Phone', date: 'Date',
};

const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
const hasOptions = (t: CustomFieldType) => t === 'select' || t === 'multi_select';
const parseOptions = (s: string) => s.split(/[\n,]/).map(o => o.trim()).filter(Boolean);

export interface ManageFieldsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Add / edit / reorder / deactivate the deal custom-field definitions. */
export const ManageFieldsDialog: React.FC<ManageFieldsDialogProps> = ({ isOpen, onClose }) => {
  const perms = usePermissions();
  const canManage = perms.allowed('manage_stages', 'stage');
  const { definitions } = useFieldDefinitions();
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ label: '', group: '', options: '' });
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState('');
  const [group, setGroup] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try { await fn(); return true; }
    catch (e) { toastFailure(e, 'manage_stages', 'field', `${failure}: ${errorMessage(e)}`); return false; }
    finally { setBusy(false); }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!label.trim()) { setError('Enter a field name'); return; }
    if (hasOptions(type) && parseOptions(options).length === 0) { setError('Add at least one option'); return; }
    const ok = await run(() => createFieldDefinition({ label, type, options: parseOptions(options), groupName: group }), 'Could not add field');
    if (ok) { setLabel(''); setOptions(''); setGroup(''); setType('text'); pushToast('success', `Added field "${label.trim()}"`); }
  };

  const move = (idx: number, dir: -1 | 1) => {
    const ids = definitions.map(d => d.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    void run(() => reorderFieldDefinitions(ids), 'Could not reorder fields');
  };

  const startEdit = (d: DealFieldDefinition) => {
    setEditingId(d.id);
    setEdit({ label: d.label, group: d.groupName ?? '', options: d.options.join('\n') });
  };

  const saveEdit = async (d: DealFieldDefinition) => {
    const ok = await run(() => updateFieldDefinition(d.id, {
      label: edit.label, groupName: edit.group || null, ...(hasOptions(d.type) ? { options: parseOptions(edit.options) } : {}),
    }), 'Could not save field');
    if (ok) setEditingId(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage fields" className="!max-w-2xl">
      <div className="space-y-5">
        {!canManage && <p role="note" className="text-sm text-amber-700 dark:text-amber-300">You don't have permission to change custom fields.</p>}

        {definitions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No custom fields yet. Add one below.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700" aria-label="Custom fields">
            {definitions.map((d, i) => (
              <li key={d.id} className={`p-3 ${d.isActive ? '' : 'opacity-60'}`}>
                {editingId === d.id ? (
                  <div className="space-y-2">
                    <input aria-label="Field name" className={INPUT} value={edit.label} onChange={e => setEdit(s => ({ ...s, label: e.target.value }))} />
                    <input aria-label="Group" className={INPUT} placeholder="Group (optional)" value={edit.group} onChange={e => setEdit(s => ({ ...s, group: e.target.value }))} />
                    {hasOptions(d.type) && (
                      <textarea aria-label="Options" rows={3} className={INPUT} placeholder="One option per line" value={edit.options} onChange={e => setEdit(s => ({ ...s, options: e.target.value }))} />
                    )}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="mr-1 h-4 w-4" />Cancel</Button>
                      <Button size="sm" disabled={busy} onClick={() => void saveEdit(d)}><Check className="mr-1 h-4 w-4" />Save</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {d.label}
                        {!d.isActive && <span className="ml-2 text-xs font-normal text-gray-500">(inactive)</span>}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {FIELD_TYPE_LABELS[d.type]}{d.groupName ? ` - ${d.groupName}` : ''}{d.options.length ? ` - ${d.options.join(', ')}` : ''}
                      </p>
                    </div>
                    <button type="button" aria-label={`Move ${d.label} up`} disabled={!canManage || busy || i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Move ${d.label} down`} disabled={!canManage || busy || i === definitions.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Edit ${d.label}`} disabled={!canManage} onClick={() => startEdit(d)} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><Pencil className="h-4 w-4" /></button>
                    <button
                      type="button"
                      aria-label={d.isActive ? `Deactivate ${d.label}` : `Activate ${d.label}`}
                      disabled={!canManage || busy}
                      onClick={() => void run(() => setFieldActive(d.id, !d.isActive), 'Could not update field')}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
                    >
                      {d.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={e => void add(e)} className="space-y-2 rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-600">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add a field</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input aria-label="New field name" className={INPUT} placeholder="Field name" value={label} onChange={e => setLabel(e.target.value)} disabled={!canManage} />
            <select aria-label="Field type" className={INPUT} value={type} onChange={e => setType(e.target.value as CustomFieldType)} disabled={!canManage}>
              {CUSTOM_FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <input aria-label="New field group" className={INPUT} placeholder="Group (optional)" value={group} onChange={e => setGroup(e.target.value)} disabled={!canManage} />
          {hasOptions(type) && (
            <textarea aria-label="New field options" rows={3} className={INPUT} placeholder="One option per line" value={options} onChange={e => setOptions(e.target.value)} disabled={!canManage} />
          )}
          {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!canManage || busy}><Plus className="mr-1 h-4 w-4" />Add field</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ManageFieldsDialog;
