import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
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
import { PURGE_CONFIRM_WORD, isPurgeConfirmed } from '../../services/dealTrashService';

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
  const [selected, setSelected] = useState<string[]>([]);
  const [purgeIds, setPurgeIds] = useState<string[] | null>(null);
  const [typed, setTyped] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setRemote(await fetchDeletedDeals());
    setLoading(false);
  }, []);

  useEffect(() => { if (isOpen) void load(); }, [isOpen, load]);
  useEffect(() => { if (!isOpen) { setSelected([]); setPurgeIds(null); setTyped(''); } }, [isOpen]);

  const merged = new Map<string, Deal>();
  remote.forEach(d => merged.set(d.id, d));
  Object.values(trash).forEach(d => merged.set(d.id, d));
  const list = [...merged.values()].sort((a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0));

  const byId = new Map(list.map(d => [d.id, d]));
  const selectedDeals = selected.map(id => byId.get(id)).filter((d): d is Deal => !!d);
  const allSelected = list.length > 0 && selectedDeals.length === list.length;
  const toggle = (id: string) => setSelected(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const canRestore = (d: Deal) => perms.allowed('edit', 'deal', d);
  const canPurge = (d: Deal) => perms.allowed('delete', 'deal', d);

  const afterRemoval = (ids: string[]) => {
    setRemote(prev => prev.filter(x => !ids.includes(x.id)));
    setSelected(prev => prev.filter(x => !ids.includes(x)));
  };

  const restoreSelected = async () => {
    const ids = selectedDeals.filter(canRestore).map(d => d.id);
    if (ids.length === 0) return;
    setBusy('bulk');
    try {
      const n = await useDealStore.getState().restoreDeals(ids);
      afterRemoval(ids);
      pushToast('success', `Restored ${n} deal${n === 1 ? '' : 's'}`);
    } catch (e) {
      toastFailure(e, 'restore', 'deal', `Could not restore deals: ${errorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const purge = async () => {
    if (!purgeIds || !isPurgeConfirmed(typed)) return;
    const ids = purgeIds.filter(id => { const d = byId.get(id); return d && canPurge(d); });
    setBusy('purge');
    try {
      const n = await useDealStore.getState().purgeDeals(ids);
      afterRemoval(ids);
      pushToast('success', `Permanently deleted ${n} deal${n === 1 ? '' : 's'}`);
      setPurgeIds(null);
      setTyped('');
    } catch (e) {
      toastFailure(e, 'delete', 'deal', `Could not delete deals: ${errorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

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
        <>
        <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" aria-label="Select all deleted deals" checked={allSelected} onChange={() => setSelected(allSelected ? [] : list.map(d => d.id))} />
            Select all
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">{selectedDeals.length} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" disabled={busy !== null || !selectedDeals.some(canRestore)} onClick={() => void restoreSelected()}>
              <RotateCcw className="mr-1 h-4 w-4" />Restore selected
            </Button>
            <Button size="sm" variant="destructive" disabled={busy !== null || !selectedDeals.some(canPurge)} onClick={() => { setPurgeIds(selectedDeals.map(d => d.id)); setTyped(''); }}>
              <Trash2 className="mr-1 h-4 w-4" />Delete selected
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {list.map(d => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <input type="checkbox" aria-label={`Select ${d.title ?? d.company}`} checked={selected.includes(d.id)} onChange={() => toggle(d.id)} />
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
              <Button size="sm" variant="ghost" aria-label={`Delete ${d.title ?? d.company} permanently`} disabled={busy !== null || !canPurge(d)} title={canPurge(d) ? 'Delete permanently' : perms.can('delete', 'deal', d).reason} onClick={() => { setPurgeIds([d.id]); setTyped(''); }}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </li>
          ))}
        </ul>
        {purgeIds && (
          <div role="alertdialog" aria-label="Confirm permanent delete" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="flex items-center text-sm font-semibold text-red-800 dark:text-red-200">
              <AlertTriangle className="mr-1.5 h-4 w-4" />Permanently delete {purgeIds.length} deal{purgeIds.length === 1 ? '' : 's'}? This cannot be undone.
            </p>
            <label className="mt-2 block text-sm text-red-800 dark:text-red-200">
              Type {PURGE_CONFIRM_WORD} to confirm
              <input aria-label="Type DELETE to confirm" value={typed} onChange={e => setTyped(e.target.value)} className="mt-1 w-full rounded-lg border border-red-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:bg-gray-700 dark:text-white" />
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setPurgeIds(null); setTyped(''); }}>Cancel</Button>
              <Button size="sm" variant="destructive" disabled={!isPurgeConfirmed(typed) || busy !== null} onClick={() => void purge()}>Delete permanently</Button>
            </div>
          </div>
        )}
        </>
      )}
    </Modal>
  );
};

export default DealTrashPanel;
