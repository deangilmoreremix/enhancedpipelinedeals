import React, { useState } from 'react';
import { Globe, Star } from 'lucide-react';
import { SavedPipelineView, normalizeSavedFilters } from '../../services/savedPipelineViewService';
import { Button } from '../ui/Button';
import { usePermissions } from '../../hooks/usePermissions';

interface SavedViewsPanelProps {
  views: SavedPipelineView[];
  activeViewId: string | null;
  loading?: boolean;
  onApply: (view: SavedPipelineView) => void;
  onSetDefault: (view: SavedPipelineView) => void;
  onTogglePublic: (view: SavedPipelineView) => void;
  onRename: (view: SavedPipelineView, name: string) => Promise<boolean>;
  onDelete: (view: SavedPipelineView) => void;
  /** Save the current board configuration under a new name. */
  onSaveCurrent: (name: string, isPublic: boolean) => Promise<boolean>;
}

const INPUT_CLASS =
  'px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/** Saved views management list (apply / rename / default / share / delete) + "save current view". */
export const SavedViewsPanel: React.FC<SavedViewsPanelProps> = ({
  views, activeViewId, loading = false, onApply, onSetDefault, onTogglePublic, onRename, onDelete, onSaveCurrent
}) => {
  const { allowed } = usePermissions();
  const canManage = allowed('manage_views', 'view');
  const [newName, setNewName] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (loading) {
    return <p className="p-4 text-sm text-gray-500 dark:text-gray-400" role="status">Loading views...</p>;
  }

  return (
    <div className="space-y-4">
      {views.length === 0 ? (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
          No saved views yet. Set up filters, sorting and grouping, then save them below.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Saved views">
          {views.map(view => {
            const f = normalizeSavedFilters(view.filters);
            const count = f.conditions.length + f.groups.length + (f.favoritesOnly ? 1 : 0) + (f.search ? 1 : 0);
            return (
              <li
                key={view.id}
                className={`border rounded-lg p-3 flex items-center justify-between gap-3 ${
                  view.id === activeViewId ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {renamingId === view.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await onRename(view, renameValue)) setRenamingId(null);
                      }}
                    >
                      <input autoFocus aria-label="View name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className={`${INPUT_CLASS} flex-1`} />
                      <Button size="sm" type="submit">Save</Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => setRenamingId(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{view.name}</span>
                        {view.is_default && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" aria-label="Default view" />}
                        {view.is_public && <Globe className="w-3.5 h-3.5 text-green-600" aria-label="Shared" />}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {count} filter{count === 1 ? '' : 's'}
                        {Array.isArray(view.sorting) && view.sorting.length > 0 ? ` · ${view.sorting.length} sort` : ''}
                        {view.group_by && view.group_by !== 'stage' ? ` · grouped by ${view.group_by}` : ''}
                      </p>
                    </>
                  )}
                </div>
                {renamingId !== view.id && (
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="outline" type="button" onClick={() => onApply(view)}>Load</Button>
                    <Button size="sm" variant="ghost" type="button" disabled={!canManage} onClick={() => onSetDefault(view)}>{view.is_default ? 'Unset default' : 'Set default'}</Button>
                    <Button size="sm" variant="ghost" type="button" disabled={!canManage} onClick={() => onTogglePublic(view)}>{view.is_public ? 'Unshare' : 'Share'}</Button>
                    <Button size="sm" variant="ghost" type="button" disabled={!canManage} onClick={() => { setRenamingId(view.id); setRenameValue(view.name); }}>Rename</Button>
                    <Button size="sm" variant="destructive" type="button" disabled={!canManage} onClick={() => { if (window.confirm(`Delete view "${view.name}"?`)) onDelete(view); }}>Delete</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && <form
        className="pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onSaveCurrent(newName, newPublic)) { setNewName(''); setNewPublic(false); }
        }}
      >
        <input aria-label="New view name" placeholder="Name for current view" value={newName} onChange={(e) => setNewName(e.target.value)} className={`${INPUT_CLASS} flex-1 min-w-[12rem]`} />
        <label className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={newPublic} onChange={(e) => setNewPublic(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
          <span>Share with everyone</span>
        </label>
        <Button size="sm" type="submit" disabled={!newName.trim()}>Save current view</Button>
      </form>}
    </div>
  );
};

export default SavedViewsPanel;
