import { create } from 'zustand';
import { useEffect } from 'react';
import {
  DealViewPrefs, EMPTY_PREFS, MAX_PINNED, assertKeyList, loadPrefs, normalizePrefs, savePrefs
} from '../services/dealViewPrefsService';
import { toastFailure } from '../utils/permissionToast';

interface DealViewPrefsState {
  prefs: DealViewPrefs;
  loaded: boolean;
  /** Loads once (pass force to refetch). */
  getPrefs: (force?: boolean) => Promise<DealViewPrefs>;
  setTabOrder: (order: string[]) => Promise<void>;
  setHiddenTabs: (tabs: string[]) => Promise<void>;
  toggleFieldGroup: (group: string) => Promise<void>;
  pin: (dealId: string) => Promise<void>;
  unpin: (dealId: string) => Promise<void>;
  isPinned: (dealId: string) => boolean;
  reset: () => void;
}

let inflight: Promise<DealViewPrefs> | null = null;

export const useDealViewPrefsStore = create<DealViewPrefsState>((set, get) => {
  /** Optimistic apply + persist; roll back (and toast) when the save fails. */
  const mutate = async (next: DealViewPrefs) => {
    const prev = get().prefs;
    set({ prefs: next });
    try {
      await savePrefs(next);
    } catch (e) {
      set({ prefs: prev });
      toastFailure(e, 'edit', 'view preferences', 'Could not save your view preferences');
    }
  };

  return {
    prefs: EMPTY_PREFS,
    loaded: false,
    getPrefs: async (force = false) => {
      if (get().loaded && !force) return get().prefs;
      if (!inflight) {
        inflight = loadPrefs()
          .then(p => { set({ prefs: p, loaded: true }); return p; })
          .catch(() => { set({ loaded: true }); return get().prefs; })
          .finally(() => { inflight = null; });
      }
      return inflight;
    },
    setTabOrder: async order => mutate({ ...get().prefs, tabOrder: assertKeyList('tabOrder', order) }),
    setHiddenTabs: async tabs => mutate({ ...get().prefs, hiddenTabs: assertKeyList('hiddenTabs', tabs) }),
    toggleFieldGroup: async group => {
      const [g] = assertKeyList('group', [group]);
      const cur = get().prefs.hiddenFieldGroups;
      await mutate({ ...get().prefs, hiddenFieldGroups: cur.includes(g) ? cur.filter(x => x !== g) : [...cur, g] });
    },
    pin: async dealId => {
      const [id] = assertKeyList('dealId', [dealId]);
      const cur = get().prefs.pinnedDealIds;
      if (cur.includes(id)) return;
      if (cur.length >= MAX_PINNED) {
        toastFailure(new Error('limit'), 'pin', 'deal', `You can pin up to ${MAX_PINNED} deals`);
        return;
      }
      await mutate({ ...get().prefs, pinnedDealIds: [...cur, id] });
    },
    unpin: async dealId => {
      const cur = get().prefs.pinnedDealIds;
      if (!cur.includes(dealId)) return;
      await mutate({ ...get().prefs, pinnedDealIds: cur.filter(x => x !== dealId) });
    },
    isPinned: dealId => get().prefs.pinnedDealIds.includes(dealId),
    reset: () => { inflight = null; set({ prefs: normalizePrefs({}), loaded: false }); }
  };
});

/** Layout prefs for the signed-in user; loads on first use. */
export function useDealViewPrefs() {
  const prefs = useDealViewPrefsStore(s => s.prefs);
  const loaded = useDealViewPrefsStore(s => s.loaded);
  const actions = useDealViewPrefsStore;
  useEffect(() => { void actions.getState().getPrefs(); }, [actions]);
  const s = actions.getState();
  return {
    prefs,
    loaded,
    getPrefs: s.getPrefs,
    setTabOrder: s.setTabOrder,
    setHiddenTabs: s.setHiddenTabs,
    toggleFieldGroup: s.toggleFieldGroup,
    pin: s.pin,
    unpin: s.unpin,
    isPinned: (dealId: string) => prefs.pinnedDealIds.includes(dealId)
  };
}
