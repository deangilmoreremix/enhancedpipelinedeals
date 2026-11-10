import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, SaveAll, ArrowUpDown, X } from 'lucide-react';
import type { ViewSort } from '../../types';
import { BOARD_GROUP_OPTIONS, BoardGroupBy, useBoardViewStore } from '../../store/boardViewStore';
import { useSavedBoardViews } from '../../hooks/useSavedBoardViews';
import { SavedPipelineView } from '../../services/savedPipelineViewService';
import { ViewPickerDropdown } from '../views/ViewPickerDropdown';
import { SavedViewsPanel } from './SavedViewsPanel';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export const SORT_FIELDS: Array<{ id: string; label: string }> = [
  { id: 'value', label: 'Value' },
  { id: 'probability', label: 'Probability' },
  { id: 'title', label: 'Title' },
  { id: 'company', label: 'Company' },
  { id: 'contact', label: 'Contact' },
  { id: 'assignedTo', label: 'Owner' },
  { id: 'priority', label: 'Priority' },
  { id: 'dueDate', label: 'Close / due date' },
  { id: 'createdAt', label: 'Created date' },
  { id: 'updatedAt', label: 'Updated date' },
  { id: 'healthScore', label: 'Health score' }
];

const CONTROL_CLASS =
  'px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white';

/** Multi-key sort editor (popover). */
const SortRules: React.FC = () => {
  const sorting = useBoardViewStore(s => s.sorting);
  const setSorting = useBoardViewStore(s => s.setSorting);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const update = (i: number, patch: Partial<ViewSort>) => setSorting(sorting.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const unused = SORT_FIELDS.filter(f => !sorting.some(s => s.field === f.id));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center space-x-1 ${CONTROL_CLASS}`}
      >
        <ArrowUpDown className="w-4 h-4" />
        <span>Sort rules{sorting.length > 0 ? ` (${sorting.length})` : ''}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Sort rules" className="absolute left-0 top-full mt-1 z-30 w-80 p-3 space-y-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Cards are sorted by the first rule, then the next. Manual dragging is off while rules are set.</p>
          {sorting.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-300">Manual order</p>}
          {sorting.map((s, i) => (
            <div key={s.field} className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 w-4">{i + 1}.</span>
              <select
                aria-label={`Sort rule ${i + 1} field`}
                value={s.field}
                onChange={(e) => update(i, { field: e.target.value })}
                className={`${CONTROL_CLASS} flex-1 py-1`}
              >
                {SORT_FIELDS.filter(f => f.id === s.field || unused.some(u => u.id === f.id)).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => update(i, { direction: s.direction === 'asc' ? 'desc' : 'asc' })}
                className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={`Sort rule ${i + 1} direction: ${s.direction === 'asc' ? 'ascending' : 'descending'}`}
              >
                {s.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setSorting(sorting.filter((_, idx) => idx !== i))}
                className="p-1.5 text-gray-400 hover:text-red-600"
                aria-label={`Remove sort rule ${i + 1}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={unused.length === 0}
              onClick={() => setSorting([...sorting, { field: unused[0].id, direction: 'asc', priority: sorting.length }])}
              className="inline-flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add sort</span>
            </button>
            {sorting.length > 0 && (
              <button type="button" onClick={() => setSorting([])} className="text-xs text-gray-500 hover:text-red-600 underline">Reset to manual</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** Saved view picker + group-by + multi-key sort for the board toolbar. */
export const BoardToolbar: React.FC<{ showGroupBy?: boolean }> = ({ showGroupBy = true }) => {
  const groupBy = useBoardViewStore(s => s.groupBy);
  const setGroupBy = useBoardViewStore(s => s.setGroupBy);
  const saved = useSavedBoardViews();

  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [renaming, setRenaming] = useState<SavedPipelineView | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const submitSave = async () => {
    if (await saved.saveAs(name, isPublic)) { setSaveOpen(false); setName(''); setIsPublic(false); }
  };
  const submitRename = async () => {
    if (renaming && await saved.rename(renaming, renameValue)) setRenaming(null);
  };
  const confirmDelete = (view: SavedPipelineView) => {
    if (window.confirm(`Delete view "${view.name}"?`)) void saved.remove(view);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4" data-testid="board-toolbar">
      <ViewPickerDropdown
        views={saved.views}
        currentView={saved.activeView}
        dirty={saved.dirty}
        onViewSelect={saved.select}
        onViewCreate={() => { setName(''); setSaveOpen(true); }}
        onViewRename={(v) => { setRenaming(v); setRenameValue(v.name); }}
        onViewDelete={(id) => { const v = saved.views.find(x => x.id === id); if (v) confirmDelete(v); }}
        onSetDefault={(v) => void saved.toggleDefault(v)}
        onTogglePublic={(v) => void saved.togglePublic(v)}
        onManage={() => setManageOpen(true)}
      />

      {saved.activeView && saved.dirty && (
        <Button size="sm" variant="outline" type="button" onClick={() => void saved.saveChanges()}>
          <Save className="w-4 h-4 mr-1" />
          Save changes
        </Button>
      )}
      <Button size="sm" variant="outline" type="button" onClick={() => { setName(saved.activeView ? `${saved.activeView.name} copy` : ''); setSaveOpen(true); }}>
        <SaveAll className="w-4 h-4 mr-1" />
        {saved.activeView ? 'Save as...' : 'Save view'}
      </Button>

      {showGroupBy && (
      <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
        <span>Group by</span>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as BoardGroupBy)}
          aria-label="Group board by"
          className={CONTROL_CLASS}
        >
          {BOARD_GROUP_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      )}

      <SortRules />

      {saved.status && (
        <span
          role="status"
          className={`text-sm ${saved.status.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}
        >
          {saved.status.text}
        </span>
      )}

      <Modal isOpen={saveOpen} onClose={() => setSaveOpen(false)} title="Save view">
        <form onSubmit={(e) => { e.preventDefault(); void submitSave(); }} className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">Saves the current filters, sorting and grouping.</p>
          <input
            autoFocus
            aria-label="View name"
            placeholder="View name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${CONTROL_CLASS} w-full`}
          />
          <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
            <span>Share with everyone</span>
          </label>
          <div className="flex justify-end space-x-2">
            <Button variant="ghost" type="button" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim()}>Save view</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!renaming} onClose={() => setRenaming(null)} title="Rename view">
        <form onSubmit={(e) => { e.preventDefault(); void submitRename(); }} className="space-y-3">
          <input autoFocus aria-label="View name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className={`${CONTROL_CLASS} w-full`} />
          <div className="flex justify-end space-x-2">
            <Button variant="ghost" type="button" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" disabled={!renameValue.trim()}>Rename</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={manageOpen} onClose={() => setManageOpen(false)} title="Saved views" className="max-w-2xl">
        <SavedViewsPanel
          views={saved.views}
          activeViewId={saved.activeViewId}
          loading={saved.loading}
          onApply={(v) => { saved.select(v); setManageOpen(false); }}
          onSetDefault={(v) => void saved.toggleDefault(v)}
          onTogglePublic={(v) => void saved.togglePublic(v)}
          onRename={saved.rename}
          onDelete={(v) => void saved.remove(v)}
          onSaveCurrent={saved.saveAs}
        />
      </Modal>
    </div>
  );
};

export default BoardToolbar;
