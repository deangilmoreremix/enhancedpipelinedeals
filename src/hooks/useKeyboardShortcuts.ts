import { useEffect } from 'react';
import { openCommandPalette } from '../components/commandPaletteEvents';
import { toggleWorkspaceChat } from '../components/ai/openWorkspaceChat';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

/** True when the event target is somewhere the user is typing. */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
};

/** Focuses the board's search input (marked with data-board-search), if one is mounted. */
export const focusSearchInput = (): boolean => {
  const input = document.querySelector<HTMLInputElement>('input[data-board-search]');
  if (!input) return false;
  input.focus();
  input.select();
  return true;
};

export const globalShortcuts: KeyboardShortcut[] = [
  {
    // Opens the command palette (src/components/CommandPalette.tsx listens for this event)
    key: 'k',
    ctrl: true,
    action: () => {
      openCommandPalette();
    },
    description: 'Command palette'
  },
  {
    key: 'k',
    meta: true,
    action: () => {
      openCommandPalette();
    },
    description: 'Command palette'
  },
  { key: 'j', ctrl: true, action: () => toggleWorkspaceChat(), description: 'Ask AI' },
  { key: 'j', meta: true, action: () => toggleWorkspaceChat(), description: 'Ask AI' },
  {
    key: 'n',
    ctrl: true,
    action: () => {
      // New deal/contact
      console.log('New item activated');
    },
    description: 'New item'
  },
  {
    key: 'd',
    ctrl: true,
    shift: true,
    action: () => {
      // Toggle dark mode
      console.log('Dark mode toggle activated');
    },
    description: 'Toggle dark mode'
  },
  {
    key: '/',
    action: () => {
      focusSearchInput();
    },
    description: 'Focus search'
  }
];

/**
 * Ctrl/Cmd+Z undoes the newest undoable action while an Undo toast is on screen (marked data-undo-available).
 * Never in text fields (native undo keeps working there) and never without a toast.
 */
function useUndoShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || e.shiftKey || e.altKey || !(e.ctrlKey || e.metaKey)) return;
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
      if (!document.querySelector('[data-undo-available]')) return;
      e.preventDefault();
      void import('../services/undoService').then(m => m.undoLast());
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useUndoShortcut();
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Plain-key shortcuts (like "/") must not hijack typing in form fields
      const typing = isEditableTarget(event.target);
      for (const shortcut of shortcuts) {
        if (typing && !shortcut.ctrl && !shortcut.meta && !shortcut.alt) continue;
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;

        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          shiftMatch &&
          altMatch &&
          metaMatch
        ) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [shortcuts]);
}