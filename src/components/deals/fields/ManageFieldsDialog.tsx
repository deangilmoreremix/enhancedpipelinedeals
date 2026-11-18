import React, { useState } from 'react';
import { ArrowDown, ArrowUp, EyeOff, Eye, Pencil } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { usePermissions } from '../../../hooks/usePermissions';
import type { CustomFieldEntityType } from '../../../types/customFields';
import {
  errMsg, createFieldDefinition, reorderFieldDefinitions, setFieldActive, updateFieldDefinition,
} from '../../../services/customFieldService';
import { pushToast } from '../../../store/dealRecordStore';
import { toastFailure } from '../../../utils/permissionToast';
import { useFieldDefinitions } from './useFieldDefinitions';
import { FIELD_TYPE_LABELS, FieldForm } from './FieldForm';

export { FIELD_TYPE_LABELS };

export interface ManageFieldsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which kind of record the fields belong to (default 'deal'). */
  entityType?: CustomFieldEntityType;
}

/** Add / edit / reorder / deactivate the custom-field definitions of one entity type. */
export const ManageFieldsDialog: React.FC<ManageFieldsDialogProps> = ({ isOpen, onClose, entityType = 'deal' }) => {
  const perms = usePermissions();
  const canManage = perms.allowed('manage_stages', 'stage');
  const { definitions } = useFieldDefinitions(entityType);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try { await fn(); return true; }
    catch (e) { toastFailure(e, 'manage_stages', 'field', `${failure}: ${errMsg(e)}`); return false; }
    finally { setBusy(false); }
  };

  const move = (idx: number, dir: -1 | 1) => {
    const ids = definitions.map(d => d.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    void run(() => reorderFieldDefinitions(ids, entityType), 'Could not reorder fields');
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
                  <FieldForm
                    mode="edit" entityType={entityType} definition={d} busy={busy} siblings={definitions}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async input => {
                      const ok = await run(() => updateFieldDefinition(d.id, {
                        label: input.label, groupName: input.groupName ?? null, config: input.config,
                        ...(d.options.length || input.options?.length ? { options: input.options } : {}),
                      }, entityType), 'Could not save field');
                      if (ok) setEditingId(null);
                      return ok;
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {d.label}
                        {!d.isActive && <span className="ml-2 text-xs font-normal text-gray-500">(inactive)</span>}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {FIELD_TYPE_LABELS[d.type]}{d.groupName ? ` - ${d.groupName}` : ''}{d.options.length ? ` - ${d.options.join(', ')}` : ''}{d.config?.formula ? ` - ${d.config.formula}` : ''}
                      </p>
                    </div>
                    <button type="button" aria-label={`Move ${d.label} up`} disabled={!canManage || busy || i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Move ${d.label} down`} disabled={!canManage || busy || i === definitions.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Edit ${d.label}`} disabled={!canManage} onClick={() => setEditingId(d.id)} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"><Pencil className="h-4 w-4" /></button>
                    <button
                      type="button"
                      aria-label={d.isActive ? `Deactivate ${d.label}` : `Activate ${d.label}`}
                      disabled={!canManage || busy}
                      onClick={() => void run(() => setFieldActive(d.id, !d.isActive, entityType), 'Could not update field')}
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

        <FieldForm
          mode="add" entityType={entityType} disabled={!canManage} busy={busy} siblings={definitions}
          onSubmit={async input => {
            const ok = await run(() => createFieldDefinition(input, entityType), 'Could not add field');
            if (ok) pushToast('success', `Added field "${input.label.trim()}"`);
            return ok;
          }}
        />
      </div>
    </Modal>
  );
};

export default ManageFieldsDialog;
