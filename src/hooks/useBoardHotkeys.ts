import { useEffect, useRef } from 'react';
import { useBoardSelectionStore } from '../store/boardSelectionStore';
import { focusSearchInput, isEditableTarget } from './useKeyboardShortcuts';

export interface BoardHotkeyColumn {
  key: string;
  /** Card ids in display order. */
  ids: string[];
}

export interface UseBoardHotkeysOptions {
  enabled?: boolean;
  /** Current columns in display order (read lazily on every key press). */
  getColumns: () => BoardHotkeyColumn[];
  onOpen: (dealId: string) => void;
  /** Opens the quick-create row in the given column. */
  onQuickCreate?: (columnKey: string) => void;
}

/**
 * Keyboard navigation for the kanban board.
 * Arrows move focus (Left/Right keep the nearest index), Enter opens, Space toggles
 * selection, Escape clears selection then focus, "/" focuses search, "n" quick-creates
 * in the focused column and Cmd/Ctrl+A selects the focused column.
 */
export function useBoardHotkeys(options: UseBoardHotkeysOptions): void {
  const ref = useRef(options);
  ref.current = options;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { enabled = true, getColumns, onOpen, onQuickCreate } = ref.current;
      if (!enabled || event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;
      // Leave modifier chords alone except Select All
      const mod = event.metaKey || event.ctrlKey;
      if ((event.altKey || (mod && event.key.toLowerCase() !== 'a')) ) return;

      const sel = useBoardSelectionStore.getState();
      const columns = getColumns();
      const focusedId = sel.focusedId;
      let colIdx = -1;
      let rowIdx = -1;
      if (focusedId) {
        colIdx = columns.findIndex(c => c.ids.includes(focusedId));
        if (colIdx >= 0) rowIdx = columns[colIdx].ids.indexOf(focusedId);
      }

      const focusCard = (id: string | undefined) => {
        if (!id) return;
        useBoardSelectionStore.getState().setFocused(id);
        const el = Array.from(document.querySelectorAll<HTMLElement>('[data-deal-id]')).find(e => e.dataset.dealId === id);
        el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      };
      const firstNonEmpty = () => columns.findIndex(c => c.ids.length > 0);

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          event.preventDefault();
          if (colIdx < 0) {
            const first = firstNonEmpty();
            if (first >= 0) focusCard(columns[first].ids[0]);
            return;
          }
          const ids = columns[colIdx].ids;
          const next = event.key === 'ArrowDown' ? Math.min(rowIdx + 1, ids.length - 1) : Math.max(rowIdx - 1, 0);
          focusCard(ids[next]);
          return;
        }
        case 'ArrowLeft':
        case 'ArrowRight': {
          event.preventDefault();
          if (colIdx < 0) {
            const first = firstNonEmpty();
            if (first >= 0) focusCard(columns[first].ids[0]);
            return;
          }
          const step = event.key === 'ArrowRight' ? 1 : -1;
          for (let i = colIdx + step; i >= 0 && i < columns.length; i += step) {
            if (columns[i].ids.length > 0) {
              focusCard(columns[i].ids[Math.min(rowIdx, columns[i].ids.length - 1)]);
              return;
            }
          }
          return;
        }
        case 'Enter':
          if (focusedId) {
            event.preventDefault();
            onOpen(focusedId);
          }
          return;
        case ' ':
          if (focusedId) {
            event.preventDefault();
            sel.toggleSelect(focusedId);
          }
          return;
        case 'Escape':
          if (sel.selectedIds.length > 0) sel.clearSelection();
          else if (focusedId) sel.setFocused(null);
          return;
        case '/':
          if (!mod && focusSearchInput()) event.preventDefault();
          return;
        case 'n':
        case 'N': {
          if (mod || !onQuickCreate) return;
          const target = colIdx >= 0 ? columns[colIdx] : columns[0];
          if (target) {
            event.preventDefault();
            onQuickCreate(target.key);
          }
          return;
        }
        case 'a':
        case 'A': {
          if (!mod) return;
          const col = colIdx >= 0 ? columns[colIdx] : columns[firstNonEmpty()];
          if (col && col.ids.length > 0) {
            event.preventDefault();
            sel.selectAllInStage(col.ids);
          }
          return;
        }
        default:
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
