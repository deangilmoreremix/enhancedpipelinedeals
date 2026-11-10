import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, EyeOff, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { PipelineStage } from '../../types';
import { STAGE_COLOR_OPTIONS, getStageDotClass } from './kanban/kanbanUtils';

interface StageMenuProps {
  stage: PipelineStage;
  /** Other stages that can receive deals when this one is deleted. */
  otherStages: PipelineStage[];
  canMoveLeft: boolean;
  canMoveRight: boolean;
  dealCount: number;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onWipLimit: (limit: number | null) => void;
  onHide: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: (moveToKey: string) => void;
}

/** Per-column manage menu: rename, colour, WIP limit, hide, reorder, delete (with move-to). */
export const StageMenu: React.FC<StageMenuProps> = ({
  stage, otherStages, canMoveLeft, canMoveRight, dealCount,
  onRename, onColor, onWipLimit, onHide, onMove, onDelete
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(stage.name);
  const [wip, setWip] = useState(stage.wipLimit ? String(stage.wipLimit) : '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveTo, setMoveTo] = useState(otherStages[0]?.key ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setName(stage.name); }, [stage.name]);
  useEffect(() => { setWip(stage.wipLimit ? String(stage.wipLimit) : ''); }, [stage.wipLimit]);
  useEffect(() => { if (!otherStages.some(s => s.key === moveTo)) setMoveTo(otherStages[0]?.key ?? ''); }, [otherStages, moveTo]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setConfirmDelete(false); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const commitName = () => {
    const next = name.trim();
    if (next && next !== stage.name) onRename(next);
    else setName(stage.name);
  };
  const commitWip = () => {
    const n = wip.trim() === '' ? null : Math.max(0, Math.floor(Number(wip)));
    const next = n && Number.isFinite(n) ? n : null;
    if (next !== (stage.wipLimit || null)) onWipLimit(next);
  };

  const itemClass =
    'w-full flex items-center space-x-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent';
  const inputClass =
    'w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
        aria-label={`Manage stage ${stage.name}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 text-gray-900 dark:text-white">
          <div className="px-3 pb-2 space-y-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              Rename
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitName(); } }}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              WIP limit (empty = none)
              <input
                value={wip}
                onChange={(e) => setWip(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={commitWip}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitWip(); } }}
                inputMode="numeric"
                className={`${inputClass} mt-1`}
              />
            </label>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Colour</div>
              <div className="flex flex-wrap gap-1.5">
                {STAGE_COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onColor(c)}
                    aria-label={`Colour ${c}`}
                    className={`w-5 h-5 rounded-full ${getStageDotClass(c)} ${
                      stage.color.replace(/^border-/, '').replace(/-\d+$/, '') === c ? 'ring-2 ring-offset-1 ring-gray-900 dark:ring-white dark:ring-offset-gray-800' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-1">
            <button type="button" className={itemClass} disabled={!canMoveLeft} onClick={() => onMove(-1)}>
              <ArrowLeft className="w-4 h-4" /><span>Move left</span>
            </button>
            <button type="button" className={itemClass} disabled={!canMoveRight} onClick={() => onMove(1)}>
              <ArrowRight className="w-4 h-4" /><span>Move right</span>
            </button>
            <button type="button" className={itemClass} onClick={() => { setOpen(false); onHide(); }}>
              <EyeOff className="w-4 h-4" /><span>Hide column</span>
            </button>
            {!confirmDelete ? (
              <button
                type="button"
                className={`${itemClass} !text-red-600 dark:!text-red-400`}
                disabled={otherStages.length === 0}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-4 h-4" /><span>Delete stage...</span>
              </button>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {dealCount > 0 ? `Move ${dealCount} deal${dealCount === 1 ? '' : 's'} to:` : 'Delete this stage?'}
                </p>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={inputClass} aria-label="Move deals to">
                  {otherStages.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
                </select>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!moveTo}
                    onClick={() => { setOpen(false); setConfirmDelete(false); onDelete(moveTo); }}
                    className="flex-1 px-2 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
