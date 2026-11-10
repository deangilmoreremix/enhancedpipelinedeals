import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import type { Deal } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  BoardExportFormat,
  DEAL_EXPORT_COLUMNS,
  downloadDeals,
  loadExportColumns,
  saveExportColumns
} from './exportDeals';

interface BoardToolbarExportProps {
  /** Deals in the current view (search + filters applied). */
  viewDeals: Deal[];
  /** Every deal on the board. */
  allDeals: Deal[];
  /** Status text for the toolbar (success / failure). */
  onMessage: (text: string) => void;
  /** Open the export menu from outside (command palette). */
  openSignal?: number;
}

const FORMATS: BoardExportFormat[] = ['csv', 'xlsx', 'json'];

/** Export menu: current view or all deals, CSV/XLSX/JSON, optionally with a column selection. */
export const BoardToolbarExport: React.FC<BoardToolbarExportProps> = ({ viewDeals, allDeals, onMessage, openSignal }) => {
  const [open, setOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<string[]>(() => loadExportColumns());
  const [useColumns, setUseColumns] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const run = async (deals: Deal[], format: BoardExportFormat, name: string) => {
    setOpen(false);
    try {
      const file = await downloadDeals(deals, format, { name, columns: useColumns ? columns : undefined });
      onMessage(`Exported ${deals.length} deal${deals.length === 1 ? '' : 's'} to ${file}`);
    } catch (error) {
      console.error('Export failed:', error);
      onMessage('Export failed');
    }
  };

  const toggleColumn = (id: string) =>
    setColumns(prev => {
      const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
      return DEAL_EXPORT_COLUMNS.map(c => c.id).filter(c => next.includes(c));
    });

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800/60 transition-colors font-medium"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full mt-1 z-30 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
          <p className="px-3 pt-1 pb-0.5 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Current view ({viewDeals.length})</p>
          {FORMATS.map(f => (
            <button key={`v-${f}`} role="menuitem" type="button" onClick={() => void run(viewDeals, f, 'deals-view')} className="w-full px-3 py-1.5 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
              {f.toUpperCase()}
            </button>
          ))}
          <p className="px-3 pt-2 pb-0.5 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 mt-1">All deals ({allDeals.length})</p>
          {FORMATS.map(f => (
            <button key={`a-${f}`} role="menuitem" type="button" onClick={() => void run(allDeals, f, 'deals-all')} className="w-full px-3 py-1.5 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
              {f.toUpperCase()}
            </button>
          ))}
          <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1 px-3 py-1.5 flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
            <label className="flex items-center space-x-1">
              <input type="checkbox" checked={useColumns} onChange={(e) => setUseColumns(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
              <span>Choose columns ({columns.length})</span>
            </label>
            <button type="button" onClick={() => { setOpen(false); setColumnsOpen(true); }} className="text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
          </div>
        </div>
      )}

      <Modal isOpen={columnsOpen} onClose={() => setColumnsOpen(false)} title="Export columns">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Columns to export">
          {DEAL_EXPORT_COLUMNS.map(c => (
            <label key={c.id} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={columns.includes(c.id)} onChange={() => toggleColumn(c.id)} className="rounded border-gray-300 text-blue-600" />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="ghost" type="button" onClick={() => setColumnsOpen(false)}>Cancel</Button>
          <Button type="button" disabled={columns.length === 0} onClick={() => { saveExportColumns(columns); setUseColumns(true); setColumnsOpen(false); }}>Use these columns</Button>
        </div>
      </Modal>
    </div>
  );
};

export default BoardToolbarExport;
