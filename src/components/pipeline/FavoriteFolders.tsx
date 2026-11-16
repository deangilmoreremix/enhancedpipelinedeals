import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { Check, FolderPlus, GripVertical, Pencil, Star, Trash2, X } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';
import { useFavoriteFolders } from '../../store/favoriteFoldersStore';
import { BTN, BTN_ICON, CONTROL } from '../ui/buttonStyles';
import { dealLabel } from './PinnedDeals';

const ROOT = 'root';
const FOLDER_LIST = 'folders';
const folderDroppable = (id: string) => `folder:${id}`;

interface Props {
  /** Defaults to navigating to /deals/:id. */
  onOpenDeal?: (dealId: string) => void;
}

/**
 * Favorites folders popover: the "Favorites" root (every favorited deal) plus user folders.
 * Drag a deal from Favorites into a folder (or between folders) to file it, back onto Favorites to remove it
 * from a folder, and drag folders by their handle to reorder.
 */
export const FavoriteFolders: React.FC<Props> = ({ onOpenDeal }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const { folders, loaded, createFolder, renameFolder, deleteFolder, removeDeal, reorderFolders, moveDeal } = useFavoriteFolders();
  const deals = useDealStore(s => s.deals);

  const favorites = useMemo(() => Object.values(deals).filter(d => d.isFavorite), [deals]);
  const openDeal = (id: string) => { setOpen(false); if (onOpenDeal) onOpenDeal(id); else navigate(`/deals/${id}`); };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (editingId) setEditingId(null); else setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, editingId]);

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const created = await createFolder(newName);
    if (created) setNewName('');
  };
  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && editName.trim()) await renameFolder(editingId, editName);
    setEditingId(null);
  };

  const onDragEnd = (r: DropResult) => {
    const { source, destination, draggableId, type } = r;
    if (!destination) return;
    if (type === 'FOLDER') {
      if (source.index === destination.index) return;
      const ids = folders.map(f => f.id);
      const [moved] = ids.splice(source.index, 1);
      ids.splice(destination.index, 0, moved);
      void reorderFolders(ids);
      return;
    }
    const dealId = draggableId.split('|')[1];
    const from = source.droppableId === ROOT ? null : source.droppableId.replace('folder:', '');
    const to = destination.droppableId === ROOT ? null : destination.droppableId.replace('folder:', '');
    if (from === to) {
      if (to && source.index !== destination.index) void moveDeal(to, to, dealId, destination.index);
      return;
    }
    if (to) void moveDeal(from, to, dealId, destination.index);
    else if (from) void removeDeal(from, dealId); // dropped back on Favorites: take it out of the folder
  };

  const dealRow = (id: string, index: number, scope: string, onRemove?: () => void) => (
    <Draggable key={`${scope}|${id}`} draggableId={`${scope}|${id}`} index={index}>
      {(p, snap) => (
        <li
          ref={p.innerRef}
          {...p.draggableProps}
          {...p.dragHandleProps}
          className={`flex items-center gap-2 px-2 py-1 rounded-md text-sm text-gray-700 dark:text-gray-200 ${snap.isDragging ? 'bg-blue-50 dark:bg-blue-900/40 shadow' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
          <button type="button" onClick={() => openDeal(id)} className="flex-1 min-w-0 text-left truncate hover:text-blue-600 dark:hover:text-blue-400">
            {dealLabel(deals[id])}
          </button>
          {onRemove && (
            <button type="button" aria-label={`Remove ${dealLabel(deals[id])} from folder`} onClick={onRemove} className="text-gray-400 hover:text-red-600">
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </li>
      )}
    </Draggable>
  );

  return (
    <div className="relative" ref={ref}>
      <button type="button" className={BTN_ICON} aria-label="Favorite folders" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Star className="w-4 h-4" />
      </button>
      {open && (
        <div role="dialog" aria-label="Favorite folders" className="absolute right-0 top-full mt-1 z-40 w-80 max-h-[70vh] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Favorites</h3>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId={ROOT} type="DEAL">
              {(p, snap) => (
                <ul ref={p.innerRef} {...p.droppableProps} aria-label="Favorites" className={`min-h-[2rem] rounded-md ${snap.isDraggingOver ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}>
                  {favorites.length === 0 && <li className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">No favorite deals yet. Star a deal to add it here.</li>}
                  {favorites.map((d, i) => dealRow(d.id, i, ROOT))}
                  {p.placeholder}
                </ul>
              )}
            </Droppable>

            <h4 className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Folders</h4>
            {loaded && folders.length === 0 && <p className="px-2 text-xs text-gray-500 dark:text-gray-400">No folders yet.</p>}
            <Droppable droppableId={FOLDER_LIST} type="FOLDER">
              {(lp) => (
                <div ref={lp.innerRef} {...lp.droppableProps} className="space-y-2">
                  {folders.map((f, fi) => (
                    <Draggable key={f.id} draggableId={`folder|${f.id}`} index={fi}>
                      {(fp, fsnap) => (
                        <section
                          ref={fp.innerRef}
                          {...fp.draggableProps}
                          aria-label={`Folder ${f.name}`}
                          className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 ${fsnap.isDragging ? 'shadow-lg' : ''}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <span {...fp.dragHandleProps} aria-label={`Reorder folder ${f.name}`} className="text-gray-400 cursor-grab"><GripVertical className="w-4 h-4" aria-hidden="true" /></span>
                            {editingId === f.id ? (
                              <form onSubmit={submitRename} className="flex flex-1 items-center gap-1">
                                <input autoFocus aria-label="Folder name" value={editName} onChange={e => setEditName(e.target.value)} maxLength={60} className={`${CONTROL} flex-1 min-w-0 !h-7`} />
                                <button type="submit" aria-label="Save folder name" className="text-green-600"><Check className="w-4 h-4" /></button>
                              </form>
                            ) : (
                              <>
                                <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">{f.name}</span>
                                <span className="text-xs text-gray-400">{f.dealIds.length}</span>
                                <button type="button" aria-label={`Rename folder ${f.name}`} onClick={() => { setEditingId(f.id); setEditName(f.name); }} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><Pencil className="w-3.5 h-3.5" /></button>
                                <button type="button" aria-label={`Delete folder ${f.name}`} onClick={() => { void deleteFolder(f.id); }} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                          </div>
                          <Droppable droppableId={folderDroppable(f.id)} type="DEAL">
                            {(dp, dsnap) => (
                              <ul ref={dp.innerRef} {...dp.droppableProps} aria-label={`Deals in ${f.name}`} className={`min-h-[1.5rem] rounded ${dsnap.isDraggingOver ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}>
                                {f.dealIds.length === 0 && <li className="px-2 text-xs text-gray-400">Drag favorites here</li>}
                                {f.dealIds.map((id, i) => dealRow(id, i, `f${f.id}`, () => { void removeDeal(f.id, id); }))}
                                {dp.placeholder}
                              </ul>
                            )}
                          </Droppable>
                        </section>
                      )}
                    </Draggable>
                  ))}
                  {lp.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <form onSubmit={submitNew} className="mt-3 flex items-center gap-2">
            <input aria-label="New folder name" placeholder="New folder" value={newName} onChange={e => setNewName(e.target.value)} maxLength={60} className={`${CONTROL} flex-1 min-w-0`} />
            <button type="submit" className={BTN} disabled={!newName.trim()}><FolderPlus className="w-4 h-4" />Add</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default FavoriteFolders;
