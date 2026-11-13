import React, { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useDealStore } from '../../store/dealStore';
import type { Deal } from '../../types';
import { fetchDeletedDeals, restoreDealRemote } from '../../services/dealRecordService';
import { errorMessage, isUuid } from '../../services/dealRecordShared';
import { pushToast } from '../../store/dealRecordStore';
import { formatMoney } from '../../utils/currencyMicros';
import { usePermissions } from '../../hooks/usePermissions';
import { toastFailure } from '../../utils/permissionToast';

interface DealTrashPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a deal is restored (e.g. navigate to it). */
  onRestored?: (dealId: string) => void;
}

/** "Deleted deals" list: store.trash (this session) merged with soft-deleted rows from Supabase. */
export const DealTrashPanel: React.FC<DealTrashPanelProps> = ({ isOpen, onClose, onRestored }) => {
  const perms = usePermissions();
  const trash = useDealStore(s => s.trash);
  const [remote, setRemote] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRemote(await fetchDeletedDeals());
    setLoading(false);
  }, []);

  useEffect(() => { if (isOpen) void load(); }, [isOpen, load]);

  const merged = new Map<string, Deal>();
  remote.forEach(d => merged.set(d.id, d));
  Object.values(trash).forEach(d => merged.set(d.id, d));
  const list = [...merged.values()].sort((a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0));

  const restore = async (d: Deal) => {
    setBusy(d.id);
    try {
      if (trash[d.id]) {
        await useDealStore.getState().restoreDeal(d.id);
      } else if (isUuid(d.id)) {
        await restoreDealRemote(d.id);
        await useDealStore.getState().fetchDeals();
      }
      setRemote(prev => prev.filter(x => x.id !== d.id));
      pushToast('success', `Restored "${d.title ?? d.company}"`);
      onRestored?.(d.id);
    } catch (e) {
      toastFailure(e, 'restore', 'deal', `Could not restore deal: ${errorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deleted deals" className="!max-w-2xl">
      {loading && list.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : list.length === 0 ? (
        <div className="py-8 text-center">
          <Trash2 className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No deleted deals</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {list.map(d => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{d.title ?? d.company}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {d.company} - {formatMoney(d.value, d.currencyCode ?? 'USD')}
                  {d.deletedAt && ` - deleted ${d.deletedAt.toLocaleDateString()}`}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={busy === d.id || !perms.allowed('edit', 'deal', d)} title={perms.allowed('edit', 'deal', d) ? undefined : perms.can('edit', 'deal', d).reason} onClick={() => void restore(d)}>
                <RotateCcw className="mr-1 h-4 w-4" />Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

export default DealTrashPanel;
