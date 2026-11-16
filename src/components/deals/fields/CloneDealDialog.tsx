import React, { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useDealStore } from '../../../store/dealStore';
import { usePermissions } from '../../../hooks/usePermissions';
import { errorMessage } from '../../../services/dealRecordShared';
import { pushToast } from '../../../store/dealRecordStore';
import { toastFailure } from '../../../utils/permissionToast';

export interface CloneDealDialogProps {
  dealId: string;
  open: boolean;
  onClose: () => void;
  onCloned: (newId: string) => void;
}

/** "Duplicate deal" confirmation with an "include notes and tasks" option. Mount from the deal actions menu. */
export const CloneDealDialog: React.FC<CloneDealDialogProps> = ({ dealId, open, onClose, onCloned }) => {
  const perms = usePermissions();
  const deal = useDealStore(s => s.deals[dealId]);
  const [includeRelated, setIncludeRelated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = perms.allowed('create', 'deal');

  useEffect(() => { if (open) { setIncludeRelated(false); setError(null); } }, [open]);

  const clone = async () => {
    setBusy(true);
    setError(null);
    try {
      const newId = await useDealStore.getState().cloneDeal(dealId, { includeRelated });
      pushToast('success', `Duplicated "${deal?.title ?? deal?.company ?? 'deal'}"`);
      onCloned(newId);
      onClose();
    } catch (e) {
      const msg = errorMessage(e, 'Could not duplicate the deal');
      setError(msg);
      toastFailure(e, 'create', 'deal', `Could not duplicate deal: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Duplicate deal">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Creates a copy of {deal ? <strong>{deal.title ?? deal.company}</strong> : 'this deal'} with its fields and custom fields.
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input type="checkbox" checked={includeRelated} onChange={e => setIncludeRelated(e.target.checked)} aria-label="Include notes and tasks" />
          Include notes and tasks
        </label>
        {!allowed && <p role="note" className="text-sm text-amber-700 dark:text-amber-300">You don't have permission to create deals.</p>}
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void clone()} disabled={busy || !allowed}><Copy className="mr-1 h-4 w-4" />{busy ? 'Duplicating...' : 'Duplicate'}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default CloneDealDialog;
