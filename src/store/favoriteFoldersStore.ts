import { create } from 'zustand';
import { useEffect } from 'react';
import * as svc from '../services/favoriteFoldersService';
import type { FavoriteFolder } from '../services/favoriteFoldersService';
import { toastFailure } from '../utils/permissionToast';
import { errorMessage } from '../services/dealRecordShared';

interface FolderState {
  folders: FavoriteFolder[];
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
  createFolder: (name: string) => Promise<FavoriteFolder | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  addDeal: (folderId: string, dealId: string) => Promise<void>;
  removeDeal: (folderId: string, dealId: string) => Promise<void>;
  reorderFolders: (idsInOrder: string[]) => Promise<void>;
  reorderDeals: (folderId: string, dealIdsInOrder: string[]) => Promise<void>;
  /** Moves a deal between folders (null = remove from source only / add to nothing). */
  moveDeal: (fromFolderId: string | null, toFolderId: string | null, dealId: string, index?: number) => Promise<void>;
  reset: () => void;
}

export const useFavoriteFoldersStore = create<FolderState>((set, get) => {
  /** Optimistic update; on failure restore the snapshot and toast. */
  const run = async (apply: (f: FavoriteFolder[]) => FavoriteFolder[], persist: () => Promise<void>, failure: string): Promise<boolean> => {
    const prev = get().folders;
    set({ folders: apply(prev) });
    try {
      await persist();
      return true;
    } catch (e) {
      set({ folders: prev });
      toastFailure(e, 'edit', 'folder', `${failure}: ${errorMessage(e)}`);
      return false;
    }
  };
  const patch = (id: string, fn: (f: FavoriteFolder) => FavoriteFolder) => (folders: FavoriteFolder[]) => folders.map(f => (f.id === id ? fn(f) : f));

  return {
    folders: [],
    loaded: false,
    load: async (force = false) => {
      if (get().loaded && !force) return;
      try {
        set({ folders: await svc.listFolders(), loaded: true });
      } catch (e) {
        set({ loaded: true });
        toastFailure(e, 'view', 'folder', `Could not load folders: ${errorMessage(e)}`);
      }
    },
    createFolder: async name => {
      let clean: string;
      try { clean = svc.validateFolderName(name); } catch (e) { toastFailure(e, 'create', 'folder', errorMessage(e)); return null; }
      const position = get().folders.reduce((m, f) => Math.max(m, f.position), -1) + 1;
      const tempId = `tmp-${Date.now()}`;
      const prev = get().folders;
      set({ folders: [...prev, { id: tempId, name: clean, position, dealIds: [] }] });
      try {
        const created = await svc.createFolder(clean, position);
        set(s => ({ folders: s.folders.map(f => (f.id === tempId ? created : f)) }));
        return created;
      } catch (e) {
        set({ folders: prev });
        toastFailure(e, 'create', 'folder', `Could not create folder: ${errorMessage(e)}`);
        return null;
      }
    },
    renameFolder: async (id, name) => {
      let clean: string;
      try { clean = svc.validateFolderName(name); } catch (e) { toastFailure(e, 'edit', 'folder', errorMessage(e)); return; }
      await run(patch(id, f => ({ ...f, name: clean })), () => svc.renameFolder(id, clean), 'Could not rename folder');
    },
    deleteFolder: async id => {
      await run(fs => fs.filter(f => f.id !== id), () => svc.deleteFolder(id), 'Could not delete folder');
    },
    addDeal: async (folderId, dealId) => {
      const folder = get().folders.find(f => f.id === folderId);
      if (!folder || folder.dealIds.includes(dealId)) return;
      await run(patch(folderId, f => ({ ...f, dealIds: [...f.dealIds, dealId] })), () => svc.addDealToFolder(folderId, dealId, folder.dealIds.length), 'Could not add deal');
    },
    removeDeal: async (folderId, dealId) => {
      await run(patch(folderId, f => ({ ...f, dealIds: f.dealIds.filter(d => d !== dealId) })), () => svc.removeDealFromFolder(folderId, dealId), 'Could not remove deal');
    },
    reorderFolders: async ids => {
      await run(fs => {
        const by = new Map(fs.map(f => [f.id, f]));
        const ordered = ids.map((id, i) => by.get(id) && ({ ...by.get(id)!, position: i })).filter((f): f is FavoriteFolder => !!f);
        return ordered.length === fs.length ? ordered : fs;
      }, () => svc.reorderFolders(ids), 'Could not reorder folders');
    },
    reorderDeals: async (folderId, ids) => {
      await run(patch(folderId, f => ({ ...f, dealIds: ids })), () => svc.reorderFolderDeals(folderId, ids), 'Could not reorder deals');
    },
    moveDeal: async (from, to, dealId, index) => {
      const folders = get().folders;
      const dest = to ? folders.find(f => f.id === to) : undefined;
      await run(fs => fs.map(f => {
        if (f.id === from && from !== to) return { ...f, dealIds: f.dealIds.filter(d => d !== dealId) };
        if (f.id === to) {
          const without = f.dealIds.filter(d => d !== dealId);
          const at = Math.max(0, Math.min(index ?? without.length, without.length));
          return { ...f, dealIds: [...without.slice(0, at), dealId, ...without.slice(at)] };
        }
        return f;
      }), async () => {
        if (to && dest) {
          await svc.addDealToFolder(to, dealId, index ?? dest.dealIds.length);
          const after = get().folders.find(f => f.id === to);
          if (after) await svc.reorderFolderDeals(to, after.dealIds);
        }
        if (from && from !== to) await svc.removeDealFromFolder(from, dealId);
      }, 'Could not move deal');
    },
    reset: () => set({ folders: [], loaded: false })
  };
});

export function useFavoriteFolders() {
  const folders = useFavoriteFoldersStore(s => s.folders);
  const loaded = useFavoriteFoldersStore(s => s.loaded);
  useEffect(() => { void useFavoriteFoldersStore.getState().load(); }, []);
  const { folders: _f, loaded: _l, ...actions } = useFavoriteFoldersStore.getState();
  return { folders, loaded, ...actions };
}
