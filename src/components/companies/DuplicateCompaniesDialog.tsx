import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitMerge } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { BTN, BTN_DANGER } from '../ui/buttonStyles';
import { MergeError, mergeCompanies, scanDuplicateCompanies, type DuplicateGroup, type MergeResult } from '../../services/companyMergeService';
import { pushToast } from '../../store/dealRecordStore';
import { toastFailure } from '../../utils/permissionToast';

export interface DuplicateCompaniesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful merge (refresh lists / navigate away from a merged-away company). */
  onMerged?: (result: MergeResult) => void;
}

const REASON: Record<string, string> = { name: 'Same name', domain: 'Same website domain' };

/** Scan for duplicate companies, pick the survivor of each group and merge the rest into it (with a confirm step). */
export const DuplicateCompaniesDialog: React.FC<DuplicateCompaniesDialogProps> = ({ isOpen, onClose, onMerged }) => {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [survivors, setSurvivors] = useState<Record<string, string>>({});
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setGroups(null); setLoadError(null); setConfirmKey(null);
    try {
      const found = await scanDuplicateCompanies();
      setGroups(found);
      setSurvivors(Object.fromEntries(found.map(g => [g.key, g.ids[0]])));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not scan for duplicates');
      setGroups([]);
    }
  }, []);

  useEffect(() => { if (isOpen) void scan(); }, [isOpen, scan]);

  const merge = async (g: DuplicateGroup) => {
    const survivor = survivors[g.key] ?? g.ids[0];
    setBusyKey(g.key);
    try {
      const res = await mergeCompanies(survivor, g.ids.filter(id => id !== survivor));
      pushToast('success', `Merged ${res.mergedIds.length} compan${res.mergedIds.length === 1 ? 'y' : 'ies'} into ${g.names[g.ids.indexOf(survivor)] ?? 'the survivor'} (${res.relinkedDeals} deals, ${res.relinkedContacts} contacts moved)`);
      onMerged?.(res);
      await scan();
    } catch (e) {
      toastFailure(e, 'edit', 'company', e instanceof MergeError ? e.message : `Merge failed: ${e instanceof Error ? e.message : 'unknown error'}`);
      setConfirmKey(null);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Find duplicate companies" className="!max-w-2xl">
      <div className="space-y-4">
        {groups === null ? (
          <p role="status" className="text-sm text-gray-600 dark:text-gray-300">Scanning companies...</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        ) : groups.length === 0 ? (
          <p role="status" className="text-sm text-gray-600 dark:text-gray-300">No duplicate companies found.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {groups.length} group{groups.length === 1 ? '' : 's'} of possible duplicates. Pick the company to keep; the others are merged into it
              (deals and contacts move over, missing details are copied, the duplicates are deleted).
            </p>
            <ul className="space-y-3" aria-label="Duplicate company groups">
              {groups.map(g => {
                const survivor = survivors[g.key] ?? g.ids[0];
                const others = g.ids.filter(id => id !== survivor);
                return (
                  <li key={g.key} data-testid="duplicate-group" className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{REASON[g.reason] ?? g.reason}</p>
                    <div role="radiogroup" aria-label={`Company to keep (${g.names[0]})`} className="space-y-1">
                      {g.ids.map((id, i) => (
                        <label key={id} className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                          <input
                            type="radio" name={`survivor-${g.key}`} checked={survivor === id} disabled={busyKey !== null}
                            onChange={() => { setSurvivors(s => ({ ...s, [g.key]: id })); setConfirmKey(null); }}
                            aria-label={`Keep ${g.names[i]}`}
                            className="h-4 w-4 border-gray-300 text-blue-600 dark:border-gray-600"
                          />
                          <span>{g.names[i]}</span>
                          {!id.startsWith('local-') && <Link to={`/companies/${id}`} onClick={onClose} className="text-xs text-blue-600 hover:underline dark:text-blue-400">open</Link>}
                          {survivor === id && <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-900/40 dark:text-green-200">keeps</span>}
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      {confirmKey === g.key ? (
                        <>
                          <span className="mr-auto text-sm text-gray-700 dark:text-gray-200" role="alert">
                            Merge {others.length} duplicate{others.length === 1 ? '' : 's'} into {g.names[g.ids.indexOf(survivor)]}? This moves their deals and contacts and deletes them.
                          </span>
                          <button type="button" className={BTN} disabled={busyKey !== null} onClick={() => setConfirmKey(null)}>Cancel</button>
                          <button type="button" className={BTN_DANGER} disabled={busyKey !== null} onClick={() => void merge(g)}>
                            {busyKey === g.key ? 'Merging...' : 'Confirm merge'}
                          </button>
                        </>
                      ) : (
                        <button type="button" className={BTN} disabled={busyKey !== null || others.length === 0} onClick={() => setConfirmKey(g.key)}>
                          <GitMerge className="h-4 w-4" aria-hidden />Merge into selected
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <div className="flex justify-end">
          <button type="button" className={BTN} onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
};

export default DuplicateCompaniesDialog;
