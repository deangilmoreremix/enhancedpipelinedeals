import { useEffect } from 'react';

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
    key: 'k',
    ctrl: true,
    action: () => {
      focusSearchInput();
    },
    description: 'Quick search'
  },
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

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
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