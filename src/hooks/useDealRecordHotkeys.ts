import { useEffect, useRef } from 'react';
import { isEditableTarget } from './useKeyboardShortcuts';

/** Documented record shortcuts (rendered by RecordShortcutHelp). */
export const RECORD_HOTKEYS: Array<{ keys: string; description: string }> = [
  { keys: 'e', description: 'Edit the deal title' },
  { keys: 'n', description: 'New note' },
  { keys: 't', description: 'New task' },
  { keys: 'f', description: 'Toggle favorite' },
  { keys: '[', description: 'Previous deal' },
  { keys: ']', description: 'Next deal' },
  { keys: 'g then p', description: 'Go to the pipeline' },
  { keys: 'g then c', description: 'Go to contacts' },
  { keys: 'Esc', description: 'Close the record' },
  { keys: '?', description: 'Show this help' }
];

export interface DealRecordHotkeyHandlers {
  onEditTitle?: () => void;
  onNewNote?: () => void;
  onNewTask?: () => void;
  onToggleFavorite?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onGoPipeline?: () => void;
  onGoContacts?: () => void;
  onClose?: () => void;
}

/** How long "g" waits for its second key. */
export const CHORD_TIMEOUT_MS = 1000;

const hasOpenDialog = (): boolean =>
  typeof document !== 'undefined' && !!document.querySelector('[role="dialog"][aria-modal="true"]');

/**
 * Single-key record shortcuts. Ignored while typing in inputs/textareas/selects/contenteditable, with
 * Ctrl/Cmd/Alt held, when another handler already consumed the event, or when `enabled` is false.
 * `g` starts a two-key chord (g p, g c) that expires after CHORD_TIMEOUT_MS. Esc is only handled when
 * no modal dialog (e.g. the command palette or shortcut help) is open on top.
 */
export function useDealRecordHotkeys(dealId: string | null | undefined, handlers: DealRecordHotkeyHandlers, enabled = true): void {
  const ref = useRef({ dealId, handlers, enabled });
  ref.current = { dealId, handlers, enabled };

  useEffect(() => {
    let chord: number | null = null;
    const clearChord = () => { if (chord !== null) { window.clearTimeout(chord); chord = null; } };

    const onKeyDown = (e: KeyboardEvent) => {
      const { dealId: id, handlers: h, enabled: on } = ref.current;
      if (!on || !id || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key === 'Escape') {
        clearChord();
        if (h.onClose && !hasOpenDialog()) { e.preventDefault(); h.onClose(); }
        return;
      }
      if (e.key.length !== 1) return;
      const key = e.key.toLowerCase();

      if (chord !== null) {
        clearChord();
        const fn = key === 'p' ? h.onGoPipeline : key === 'c' ? h.onGoContacts : undefined;
        if (fn) { e.preventDefault(); fn(); return; }
        // not a chord completion: fall through and treat as a normal key
      }
      const run = (fn?: () => void) => { if (fn) { e.preventDefault(); fn(); } };
      switch (key) {
        case 'g':
          if (h.onGoPipeline || h.onGoContacts) {
            e.preventDefault();
            chord = window.setTimeout(() => { chord = null; }, CHORD_TIMEOUT_MS);
          }
          return;
        case 'e': return run(h.onEditTitle);
        case 'n': return run(h.onNewNote);
        case 't': return run(h.onNewTask);
        case 'f': return run(h.onToggleFavorite);
        case '[': return run(h.onPrevious);
        case ']': return run(h.onNext);
        default:
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); clearChord(); };
  }, []);
}
