import React, { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { RECORD_HOTKEYS } from '../../hooks/useDealRecordHotkeys';
import { isEditableTarget } from '../../hooks/useKeyboardShortcuts';
import { BTN_ICON } from '../ui/buttonStyles';

interface Props {
  /** Controlled mode: when `open` is provided the parent owns the state (and gets onOpenChange). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Press "?" to open (default true). */
  listen?: boolean;
}

/** Shortcut cheat-sheet overlay for the deal record. Opens with "?", closes with Esc / backdrop / button. */
export const RecordShortcutHelp: React.FC<Props> = ({ open: controlled, onOpenChange, listen = true }) => {
  const [inner, setInner] = React.useState(false);
  const open = controlled ?? inner;
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const setOpen = useCallback((v: boolean) => {
    if (controlled === undefined) setInner(v);
    onOpenChange?.(v);
  }, [controlled, onOpenChange]);

  useEffect(() => {
    if (!listen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [listen, open, setOpen]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); returnFocus.current?.focus?.(); }
    };
    document.addEventListener('keydown', onEsc, true);
    return () => document.removeEventListener('keydown', onEsc, true);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Deal shortcuts" className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Deal shortcuts</h2>
          <button ref={closeRef} type="button" aria-label="Close shortcuts" onClick={() => setOpen(false)} className={BTN_ICON}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="space-y-1.5">
          {RECORD_HOTKEYS.map(h => (
            <div key={h.keys} className="flex items-start justify-between gap-3 text-xs">
              <dt><kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono whitespace-nowrap">{h.keys}</kbd></dt>
              <dd className="text-gray-600 dark:text-gray-300 text-right">{h.description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">Shortcuts are ignored while typing in a field.</p>
      </div>
    </div>
  );
};

export default RecordShortcutHelp;
