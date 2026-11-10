import React, { useEffect, useMemo, useState } from 'react';
import { GitMerge } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import type { Deal } from '../../types';
import { useDealStore } from '../../store/dealStore';
import {
  COMBINE_NOTES, MAX_MERGE, MERGE_FIELDS, MERGE_FIELD_LABELS, MIN_MERGE, MergeField,
  canMergeRemote, findDuplicatesOf, getConflicts, mergeDeals, resolveMergeUpdates,
} from '../../services/dealMergeService';
import { errorMessage } from '../../services/dealRecordShared';
import { formatMoney } from '../../utils/currencyMicros';

export interface MergeDealsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Candidate deals to pick from. */
  deals: Deal[];
  /** Pre-selected deal ids (e.g. the current record plus suggested duplicates). */
  initialIds?: string[];
  /** Called with the surviving deal id after a successful merge. */
  onMerged?: (survivorId: string) => void;
}

const display = (d: Deal, field: MergeField, stageName: (k: string) => string): string => {
  switch (field) {
    case 'value': return formatMoney(d.value, d.currencyCode ?? 'USD');
    case 'stage': return stageName(d.stage);
    case 'priority': return d.priority;
    case 'notes': return d.notes?.trim() ? (d.notes.length > 80 ? `${d.notes.slice(0, 80)}...` : d.notes) : '(empty)';
    default: return d.title ?? '(untitled)';
  }
};

export const MergeDealsModal: React.FC<MergeDealsModalProps> = ({ isOpen, onClose, deals, initialIds = [], onMerged }) => {
  const stages = useDealStore(s => s.stages);
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [survivorId, setSurvivorId] = useState<string>(initialIds[0] ?? '');
  const [choices, setChoices] = useState<Partial<Record<MergeField, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelected(initialIds);
      setSurvivorId(initialIds[0] ?? '');
      setChoices({});
      setError(null);
      setQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const stageName = (k: string) => stages.find(s => s.key === k)?.name ?? k;
  const picked = useMemo(() => selected.map(id => deals.find(d => d.id === id)).filter((d): d is Deal => !!d), [selected, deals]);
  const survivor = picked.find(d => d.id === survivorId) ?? picked[0];
  const conflicts = useMemo(() => getConflicts(picked), [picked]);

  const suggestions = useMemo(() => {
    const base = deals.find(d => d.id === initialIds[0]);
    return base ? findDuplicatesOf(base, deals).map(s => s.deal.id) : [];
  }, [deals, initialIds]);

  const q = query.trim().toLowerCase();
  const pool = deals
    .filter(d => !q || `${d.title ?? ''} ${d.company}`.toLowerCase().includes(q))
    .sort((a, b) => Number(suggestions.includes(b.id)) - Number(suggestions.includes(a.id)))
    .slice(0, 50);

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id);
        if (survivorId === id) setSurvivorId(next[0] ?? '');
        return next;
      }
      if (prev.length >= MAX_MERGE) return prev;
      if (!survivorId) setSurvivorId(id);
      return [...prev, id];
    });
  };

  const valid = picked.length >= MIN_MERGE && picked.length <= MAX_MERGE && !!survivor;

  const confirm = async () => {
    if (!valid || !survivor) return;
    setSubmitting(true);
    setError(null);
    try {
      const mergeIds = picked.filter(d => d.id !== survivor.id).map(d => d.id);
      const updates = resolveMergeUpdates(survivor, picked, choices);
      const store = useDealStore.getState();
      if (canMergeRemote([survivor.id, ...mergeIds])) {
        await mergeDeals({ keepId: survivor.id, mergeIds, updates });
        await store.fetchDeals();
      } else {
        // Local/demo deals: apply the same result in the in-memory store.
        if (Object.keys(updates).length) await store.updateDeal(survivor.id, updates);
        for (const id of mergeIds) await store.softDeleteDeal(id);
      }
      onMerged?.(survivor.id);
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Merge failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Merge deals" className="!max-w-3xl">
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Pick {MIN_MERGE}-{MAX_MERGE} deals. Notes, tasks, files and activity from the others move onto the surviving deal; the others are moved to Deleted deals.
        </p>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">1. Deals to merge <span className="font-normal text-gray-500">({picked.length} selected)</span></h3>
            <input
              aria-label="Search deals"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search deals"
              className="w-44 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <ul className="max-h-44 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {pool.map(d => (
              <li key={d.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} aria-label={`Select ${d.title ?? d.company}`} />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">{d.title ?? d.company}<span className="text-gray-500"> - {d.company}</span></span>
                  {suggestions.includes(d.id) && <Badge variant="warning">Possible duplicate</Badge>}
                </label>
              </li>
            ))}
            {pool.length === 0 && <li className="px-3 py-4 text-center text-sm text-gray-500">No deals match</li>}
          </ul>
        </section>

        {picked.length >= MIN_MERGE && survivor && (
          <>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">2. Surviving deal</h3>
              <div className="space-y-1" role="radiogroup" aria-label="Surviving deal">
                {picked.map(d => (
                  <label key={d.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                    <input type="radio" name="survivor" checked={survivor.id === d.id} onChange={() => { setSurvivorId(d.id); setChoices({}); }} aria-label={`Keep ${d.title ?? d.company}`} />
                    {d.title ?? d.company}
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">3. Resolve conflicts</h3>
              {conflicts.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No field conflicts.</p>
              ) : (
                <div className="space-y-3">
                  {MERGE_FIELDS.filter(f => conflicts.includes(f)).map(field => {
                    const chosen = choices[field] ?? survivor.id;
                    return (
                      <fieldset key={field} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{MERGE_FIELD_LABELS[field]}</legend>
                        <div className="space-y-1">
                          {picked.map(d => (
                            <label key={d.id} className="flex cursor-pointer items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                              <input
                                type="radio"
                                name={`conflict-${field}`}
                                checked={chosen === d.id}
                                onChange={() => setChoices(c => ({ ...c, [field]: d.id }))}
                                aria-label={`${MERGE_FIELD_LABELS[field]}: ${display(d, field, stageName)}`}
                              />
                              <span>{display(d, field, stageName)}</span>
                            </label>
                          ))}
                          {field === 'notes' && (
                            <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                              <input type="radio" name="conflict-notes" checked={chosen === COMBINE_NOTES} onChange={() => setChoices(c => ({ ...c, notes: COMBINE_NOTES }))} aria-label="Notes: combine all" />
                              <span>Combine all notes</span>
                            </label>
                          )}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {error && <Alert variant="error"><span className="text-sm">{error}</span></Alert>}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={() => void confirm()} disabled={!valid || submitting}>
            <GitMerge className="mr-1 h-4 w-4" />{submitting ? 'Merging...' : `Merge ${picked.length || ''} deals`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default MergeDealsModal;
