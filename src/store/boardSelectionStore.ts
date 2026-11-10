import { create } from 'zustand';

/** Board selection + keyboard focus. Kept separate from dealStore to keep that lean. */
interface BoardSelectionState {
  selectedIds: string[];
  /** Last card toggled/clicked; anchor for shift-range selection. */
  anchorId: string | null;
  /** Card with keyboard focus (ring), independent of selection. */
  focusedId: string | null;

  isSelected: (id: string) => boolean;
  toggleSelect: (id: string) => void;
  /** Select every id between the anchor and `toId` (inclusive) in `orderedIds`. */
  selectRange: (toId: string, orderedIds: string[]) => void;
  selectAllInStage: (idsInStage: string[]) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  setFocused: (id: string | null) => void;
}

export const useBoardSelectionStore = create<BoardSelectionState>((set, get) => ({
  selectedIds: [],
  anchorId: null,
  focusedId: null,

  isSelected: (id) => get().selectedIds.includes(id),

  toggleSelect: (id) =>
    set(st => ({
      selectedIds: st.selectedIds.includes(id) ? st.selectedIds.filter(x => x !== id) : [...st.selectedIds, id],
      anchorId: id,
    })),

  selectRange: (toId, orderedIds) => {
    const { anchorId, selectedIds } = get();
    const to = orderedIds.indexOf(toId);
    const from = anchorId ? orderedIds.indexOf(anchorId) : -1;
    if (to < 0) return;
    if (from < 0) {
      set({ selectedIds: selectedIds.includes(toId) ? selectedIds : [...selectedIds, toId], anchorId: toId });
      return;
    }
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    const range = orderedIds.slice(lo, hi + 1);
    set({ selectedIds: Array.from(new Set([...selectedIds, ...range])) });
  },

  selectAllInStage: (idsInStage) =>
    set(st => ({
      selectedIds: Array.from(new Set([...st.selectedIds, ...idsInStage])),
      anchorId: idsInStage[0] ?? st.anchorId,
    })),

  setSelection: (ids) => set({ selectedIds: Array.from(new Set(ids)) }),

  clearSelection: () => set({ selectedIds: [], anchorId: null }),

  setFocused: (id) => set({ focusedId: id }),
}));
