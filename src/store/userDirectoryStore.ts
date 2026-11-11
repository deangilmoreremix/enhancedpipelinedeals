import { create } from 'zustand';
import type { DirectoryUser } from '../types';
import { filterUsers, listUsers } from '../services/userDirectoryService';
import { registerOwnerNameLookup } from '../utils/ownerLabel';

const TTL_MS = 5 * 60 * 1000;

interface UserDirectoryStore {
  users: DirectoryUser[];
  isLoading: boolean;
  loadedAt: number | null;
  error: string | null;
  /** Load (cached for 5 minutes unless force). */
  load: (force?: boolean) => Promise<DirectoryUser[]>;
  search: (q: string) => DirectoryUser[];
  getById: (id: string | undefined | null) => DirectoryUser | undefined;
}

let inflight: Promise<DirectoryUser[]> | null = null;

export const useUserDirectoryStore = create<UserDirectoryStore>((set, get) => ({
  users: [],
  isLoading: false,
  loadedAt: null,
  error: null,

  load: async (force = false) => {
    const { loadedAt, users } = get();
    if (!force && loadedAt && Date.now() - loadedAt < TTL_MS) return users;
    if (inflight) return inflight;
    set({ isLoading: true });
    inflight = listUsers()
      .then(list => { set({ users: list, loadedAt: Date.now(), isLoading: false, error: null }); return list; })
      .catch(e => { set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to load users' }); return get().users; })
      .finally(() => { inflight = null; });
    return inflight;
  },

  search: (q) => filterUsers(get().users, q),
  getById: (id) => (id ? get().users.find(u => u.id === id) : undefined),
}));

// Lets filters/grouping resolve ownerId -> display name without importing this store.
registerOwnerNameLookup(id => useUserDirectoryStore.getState().users.find(u => u.id === id)?.name);
