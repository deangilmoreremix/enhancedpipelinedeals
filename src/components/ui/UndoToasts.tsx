import React from 'react';
import { Undo2, X } from 'lucide-react';
import { dismissUndo, runUndo, useUndoStore } from '../../services/undoService';

/** Toast stack for undoable / informational actions (bottom-left so it never covers the bulk bar or other toasts). */
export const UndoToasts: React.FC = () => {
  const entries = useUndoStore(s => s.entries);
  if (entries.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[90] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite" data-testid="undo-toasts" {...(entries.some(e => e.undo && !e.running) ? { 'data-undo-available': '' } : {})}>
      {entries.map(e => (
        <div
          key={e.id}
          role="status"
          className="pointer-events-auto flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <span className="flex-1">{e.label}</span>
          {e.undo && (
            <button
              type="button"
              disabled={e.running}
              onClick={() => { void runUndo(e.id); }}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-600 px-2.5 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-900/30"
            >
              <Undo2 className="h-4 w-4" />{e.running ? 'Undoing...' : 'Undo'}
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => dismissUndo(e.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
};

export default UndoToasts;
