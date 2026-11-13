import React, { useEffect, useRef, useState } from 'react';
import { Download, Heart, HeartOff, Tag, Trash2, X } from 'lucide-react';
import { useBoardSelectionStore } from '../../store/boardSelectionStore';
import { useDealStore } from '../../store/dealStore';
import { Deal } from '../../types';
import { BoardExportFormat, downloadDeals } from './exportDeals';
import { OwnerPicker } from '../deals/fields/OwnerPicker';
import { usePermissions } from '../../hooks/usePermissions';
import { BTN, BTN_ICON, BTN_DANGER, CONTROL } from '../ui/buttonStyles';

interface BulkActionBarProps {
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const PRIORITIES: Array<Deal['priority']> = ['high', 'medium', 'low'];

/** Floating bulk action bar, visible while at least one card is selected. */
export const BulkActionBar: React.FC<BulkActionBarProps> = ({ onNotify }) => {
  const selectedIds = useBoardSelectionStore(s => s.selectedIds);
  const clearSelection = useBoardSelectionStore(s => s.clearSelection);
  const stages = useDealStore(s => s.stages);
  const deals = useDealStore(s => s.deals);
  const bulkMoveDeals = useDealStore(s => s.bulkMoveDeals);
  const bulkUpdateDeals = useDealStore(s => s.bulkUpdateDeals);
  const bulkSoftDelete = useDealStore(s => s.bulkSoftDelete);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagText, setTagText] = useState('');
  const updateDeal = useDealStore(s => s.updateDeal);
  const [busy, setBusy] = useState(false);
  const shiftRef = useRef(false);

  useEffect(() => {
    const track = (e: KeyboardEvent) => { shiftRef.current = e.shiftKey; };
    window.addEventListener('keydown', track);
    window.addEventListener('keyup', track);
    return () => { window.removeEventListener('keydown', track); window.removeEventListener('keyup', track); };
  }, []);

  // Selected ids that no longer exist (deleted elsewhere) are ignored
  const ids = selectedIds.filter(id => deals[id]);
  const perms = usePermissions();
  const selectedDeals = ids.map(id => deals[id]);
  const editCheck = perms.canAll('edit', 'deal', selectedDeals);
  const deleteCheck = perms.canAll('delete', 'deal', selectedDeals);
  const assignCheck = perms.canAll('assign', 'deal', selectedDeals);
  const exportCheck = perms.can('export', 'deal');
  const canEdit = editCheck.allowed;
  const canDelete = deleteCheck.allowed;
  const canAssign = canEdit && assignCheck.allowed;
  const editTip = canEdit ? undefined : `${editCheck.reason} (applies to all selected deals)`;
  useEffect(() => {
    if (selectedIds.length > 0 && ids.length === 0) clearSelection();
  }, [selectedIds.length, ids.length, clearSelection]);
  if (ids.length === 0) return null;

  const notify = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => onNotify?.(msg, type);
  const noun = `${ids.length} deal${ids.length === 1 ? '' : 's'}`;

  const run = async (label: string, fn: () => Promise<string[]>) => {
    setBusy(true);
    try {
      const done = await fn();
      if (done.length === ids.length) notify(`${label}: ${noun}`, 'success');
      else notify(`${label}: ${done.length} of ${ids.length} succeeded`, 'warning');
      return done;
    } catch (e) {
      notify(`${label} failed`, 'error');
      return [];
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (stageKey: string) => {
    if (!stageKey) return;
    const stage = stages.find(s => s.key === stageKey);
    if (stage?.wipLimit) {
      const staying = Object.values(deals).filter(d => d.stage === stageKey && !ids.includes(d.id)).length;
      if (staying + ids.length > stage.wipLimit && !shiftRef.current) {
        notify(`${stage.name} has a WIP limit of ${stage.wipLimit} (would reach ${staying + ids.length}). Hold Shift while choosing to override.`, 'warning');
        return;
      }
    }
    await run(`Moved to ${stage?.name ?? stageKey}`, () => bulkMoveDeals(ids, stageKey));
  };

  const handlePriority = async (priority: string) => {
    if (!priority) return;
    await run(`Priority set to ${priority}`, () => bulkUpdateDeals(ids, { priority: priority as Deal['priority'] }));
  };

  const handleOwner = async (ownerId: string | undefined, name: string) => {
    // null clears the columns (dealMapper writes explicit nulls)
    const nul = null as unknown as undefined;
    await run(ownerId ? `Owner set to ${name}` : 'Owner cleared', () =>
      bulkUpdateDeals(ids, { ownerId: ownerId ?? nul, assignedToId: ownerId ?? nul, assignedTo: name || nul }));
  };

  // Tags (folded in from the legacy BulkDealActions): per-deal because each deal keeps its other tags
  const handleTags = async (mode: 'add' | 'remove') => {
    const tag = tagText.trim();
    if (!tag) return;
    setTagsOpen(false);
    setTagText('');
    await run(mode === 'add' ? `Tag "${tag}" added` : `Tag "${tag}" removed`, async () => {
      const results = await Promise.all(ids.map(id => {
        const current = deals[id]?.tags ?? [];
        const next = mode === 'add' ? Array.from(new Set([...current, tag])) : current.filter(t => t !== tag);
        return updateDeal(id, { tags: next }).then(() => id, () => null);
      }));
      return results.filter((x): x is string => x !== null);
    });
  };

  const handleFollowUp = async (value: string) => {
    if (!value) return;
    await run('Follow-up scheduled', () => bulkUpdateDeals(ids, { nextFollowUp: value }));
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    const done = await run('Deleted', () => bulkSoftDelete(ids));
    if (done.length > 0) clearSelection();
  };

  const handleExport = async (format: BoardExportFormat) => {
    setExportOpen(false);
    setBusy(true);
    try {
      const file = await downloadDeals(ids.map(id => deals[id]), format);
      notify(`Exported ${noun} to ${file}`, 'success');
    } catch (e) {
      notify('Export failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectClass = CONTROL;
  const btnClass = BTN;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] flex flex-wrap items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl"
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-white pr-1">{ids.length} selected</span>

      <select
        aria-label="Move to stage"
        title={editTip}
        value=""
        disabled={busy || !canEdit}
        onChange={(e) => void handleMove(e.target.value)}
        className={selectClass}
      >
        <option value="">Move to stage...</option>
        {stages.filter(s => s.visible).map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
      </select>

      <select
        aria-label="Set priority"
        title={editTip}
        value=""
        disabled={busy || !canEdit}
        onChange={(e) => void handlePriority(e.target.value)}
        className={selectClass}
      >
        <option value="">Set priority...</option>
        {PRIORITIES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
      </select>

      <OwnerPicker
        variant="button"
        buttonLabel="Set owner…"
        placement="top"
        disabled={busy || !canAssign}
        onChange={handleOwner}
        buttonClassName={btnClass}
      />

      <div className="relative">
        <button type="button" title={editTip} disabled={busy || !canEdit} className={btnClass} aria-haspopup="true" aria-expanded={tagsOpen} onClick={() => setTagsOpen(o => !o)}>
          <Tag className="w-4 h-4" /><span>Tags</span>
        </button>
        {tagsOpen && (
          <div className="absolute bottom-full mb-2 left-0 w-56 p-2 space-y-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            <input
              autoFocus
              aria-label="Tag"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleTags('add'); } if (e.key === 'Escape') setTagsOpen(false); }}
              placeholder="Tag name"
              className={`${selectClass} w-full`}
            />
            <div className="flex space-x-2">
              <button type="button" disabled={!tagText.trim()} onClick={() => void handleTags('add')} className="flex-1 px-2 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">Add</button>
              <button type="button" disabled={!tagText.trim()} onClick={() => void handleTags('remove')} className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">Remove</button>
            </div>
          </div>
        )}
      </div>

      <input
        type="date"
        aria-label="Schedule follow-up"
        title={editTip ?? 'Schedule follow-up'}
        disabled={busy || !canEdit}
        value=""
        onChange={(e) => void handleFollowUp(e.target.value)}
        className={selectClass}
      />

      <button type="button" title={editTip} disabled={busy || !canEdit} className={btnClass} onClick={() => void run('Favorited', () => bulkUpdateDeals(ids, { isFavorite: true }))}>
        <Heart className="w-4 h-4" /><span>Favorite</span>
      </button>
      <button type="button" title={editTip} disabled={busy || !canEdit} className={btnClass} onClick={() => void run('Unfavorited', () => bulkUpdateDeals(ids, { isFavorite: false }))}>
        <HeartOff className="w-4 h-4" /><span>Unfavorite</span>
      </button>

      <div className="relative">
        <button type="button" title={exportCheck.allowed ? undefined : exportCheck.reason} disabled={busy || !exportCheck.allowed} className={btnClass} aria-haspopup="true" aria-expanded={exportOpen} onClick={() => setExportOpen(o => !o)}>
          <Download className="w-4 h-4" /><span>Export</span>
        </button>
        {exportOpen && (
          <div className="absolute bottom-full mb-2 left-0 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
            {(['csv', 'xlsx', 'json'] as BoardExportFormat[]).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => void handleExport(f)}
                className="w-full px-3 py-1.5 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {confirmDelete ? (
        <div className="flex items-center space-x-2 pl-1">
          <span className="text-sm text-red-600 dark:text-red-400">Delete {noun}?</span>
          <button type="button" onClick={() => setConfirmDelete(false)} className={btnClass}>Cancel</button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className={BTN_DANGER}
          >
            Delete
          </button>
        </div>
      ) : (
        <button
          type="button"
          title={canDelete ? undefined : `${deleteCheck.reason} (applies to all selected deals)`}
          disabled={busy || !canDelete}
          onClick={() => setConfirmDelete(true)}
          className={BTN}
        >
          <Trash2 className="w-4 h-4" /><span>Delete</span>
        </button>
      )}

      <button
        type="button"
        onClick={clearSelection}
        className={BTN_ICON}
        aria-label="Clear selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
