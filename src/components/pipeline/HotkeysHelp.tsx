import React, { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { BOARD_HOTKEYS } from '../../hooks/useBoardHotkeys';
import { isEditableTarget } from '../../hooks/useKeyboardShortcuts';

/** Keyboard shortcut help popover (button, or press "?"). */
export const HotkeysHelp: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditableTarget(e.target)) { e.preventDefault(); setOpen(o => !o); }
      else if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Keyboard className="w-4 h-4" />
      </button>
      {open && (
        <div role="dialog" aria-label="Keyboard shortcuts" className="absolute right-0 top-full mt-1 z-40 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Keyboard shortcuts</h3>
          <dl className="space-y-1.5">
            {BOARD_HOTKEYS.map(h => (
              <div key={h.keys} className="flex items-start justify-between gap-3 text-xs">
                <dt><kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono whitespace-nowrap">{h.keys}</kbd></dt>
                <dd className="text-gray-600 dark:text-gray-300 text-right">{h.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
};
