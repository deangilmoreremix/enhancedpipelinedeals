import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { Eye, EyeOff, GripVertical, Plus, Trash2, X } from 'lucide-react';
import type { PipelineStage } from '../../../types';
import { useDealStore } from '../../../store/dealStore';
import { STAGE_COLOR_OPTIONS, getStageDotClass } from './kanbanUtils';

/** Legacy column shape, kept for backwards-compatible exports. */
export interface CustomPipelineColumn {
  id: string;
  name: string;
  position: number;
  config: {
    color?: string;
    wipLimit?: number;
    description?: string;
  };
  is_active: boolean;
}

export interface CustomColumnManagerProps {
  /** Called after any successful change with the current stages in the legacy column shape. */
  onColumnsChange?: (columns: CustomPipelineColumn[]) => void;
  onClose?: () => void;
}

const normalizeColor = (c: string) => (c || '').replace(/^border-/, '').replace(/-\d+$/, '');

const inputClass =
  'w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

interface RowProps {
  stage: PipelineStage;
  index: number;
  others: PipelineStage[];
  dealCount: number;
  onUpdate: (key: string, updates: Partial<Omit<PipelineStage, 'id' | 'key'>>) => void;
  onDelete: (key: string, moveTo: string) => void;
}

const StageRow: React.FC<RowProps> = ({ stage, index, others, dealCount, onUpdate, onDelete }) => {
  const [name, setName] = useState(stage.name);
  const [prob, setProb] = useState(String(stage.probability ?? 0));
  const [wip, setWip] = useState(stage.wipLimit ? String(stage.wipLimit) : '');
  const [confirming, setConfirming] = useState(false);
  const [moveTo, setMoveTo] = useState(others[0]?.key ?? '');

  useEffect(() => setName(stage.name), [stage.name]);
  useEffect(() => setProb(String(stage.probability ?? 0)), [stage.probability]);
  useEffect(() => setWip(stage.wipLimit ? String(stage.wipLimit) : ''), [stage.wipLimit]);
  useEffect(() => { if (!others.some(s => s.key === moveTo)) setMoveTo(others[0]?.key ?? ''); }, [others, moveTo]);

  const commitName = () => {
    const next = name.trim();
    if (next && next !== stage.name) onUpdate(stage.key, { name: next });
    else setName(stage.name);
  };
  const commitProb = () => {
    const n = Math.min(100, Math.max(0, Math.round(Number(prob))));
    if (!Number.isFinite(n) || prob.trim() === '') { setProb(String(stage.probability ?? 0)); return; }
    if (n !== stage.probability) onUpdate(stage.key, { probability: n });
    setProb(String(n));
  };
  const commitWip = () => {
    const n = wip.trim() === '' ? null : Math.max(0, Math.floor(Number(wip)));
    const next = n && Number.isFinite(n) ? n : null;
    if (next !== (stage.wipLimit || null)) onUpdate(stage.key, { wipLimit: next });
  };
  const enter = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } };

  return (
    <Draggable draggableId={`stage:${stage.key}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          data-testid={`stage-row-${stage.key}`}
          className={`border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 ${snapshot.isDragging ? 'shadow-lg' : ''} ${stage.visible ? '' : 'opacity-60'}`}
        >
          <div className="flex items-center gap-2">
            <span {...provided.dragHandleProps} aria-label={`Drag to reorder ${stage.name}`} className="text-gray-400 cursor-grab">
              <GripVertical className="w-4 h-4" />
            </span>
            <input
              aria-label={`Name of stage ${stage.name}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={enter(commitName)}
              className={`${inputClass} font-medium flex-1`}
            />
            <button
              type="button"
              onClick={() => onUpdate(stage.key, { visible: !stage.visible })}
              aria-label={stage.visible ? `Hide ${stage.name}` : `Show ${stage.name}`}
              title={stage.visible ? 'Hide column' : 'Show column'}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {stage.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              type="button"
              disabled={others.length === 0}
              onClick={() => setConfirming(c => !c)}
              aria-label={`Delete ${stage.name}`}
              className="p-1.5 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              Win probability %
              <input
                aria-label={`Probability of ${stage.name}`}
                inputMode="numeric"
                value={prob}
                onChange={(e) => setProb(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={commitProb}
                onKeyDown={enter(commitProb)}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-xs text-gray-500 dark:text-gray-400">
              WIP limit (empty = none)
              <input
                aria-label={`WIP limit of ${stage.name}`}
                inputMode="numeric"
                value={wip}
                onChange={(e) => setWip(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={commitWip}
                onKeyDown={enter(commitWip)}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                aria-label={`${stage.name} is a won stage`}
                checked={stage.isWon}
                onChange={(e) => onUpdate(stage.key, e.target.checked ? { isWon: true, isLost: false } : { isWon: false })}
                className="rounded border-gray-300 dark:border-gray-600 text-green-600"
              />
              <span>Won</span>
            </label>
            <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                aria-label={`${stage.name} is a lost stage`}
                checked={stage.isLost}
                onChange={(e) => onUpdate(stage.key, e.target.checked ? { isLost: true, isWon: false } : { isLost: false })}
                className="rounded border-gray-300 dark:border-gray-600 text-red-600"
              />
              <span>Lost</span>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`Colour of ${stage.name}`}>
            {STAGE_COLOR_OPTIONS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => onUpdate(stage.key, { color: c })}
                aria-label={`Colour ${c} for ${stage.name}`}
                aria-pressed={normalizeColor(stage.color) === c}
                className={`w-5 h-5 rounded-full ${getStageDotClass(c)} ${
                  normalizeColor(stage.color) === c ? 'ring-2 ring-offset-1 ring-gray-900 dark:ring-white dark:ring-offset-gray-800' : ''
                }`}
              />
            ))}
          </div>

          {confirming && (
            <div className="mt-3 flex flex-wrap items-center gap-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20">
              <span className="text-sm text-red-700 dark:text-red-300">
                {dealCount > 0 ? `Move ${dealCount} deal${dealCount === 1 ? '' : 's'} to` : 'Delete this stage?'}
              </span>
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label={`Move deals from ${stage.name} to`} className={`${inputClass} !w-auto`}>
                {others.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
              <button type="button" onClick={() => setConfirming(false)} className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
                Cancel
              </button>
              <button
                type="button"
                disabled={!moveTo}
                onClick={() => { setConfirming(false); onDelete(stage.key, moveTo); }}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Delete stage
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

/** Pure: the stage keys after dragging `from` to `to`. */
export const reorderKeys = (keys: string[], from: number, to: number): string[] => {
  const next = [...keys];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

/**
 * THE stage manager: add, rename, colour, reorder (drag), hide/show, delete-with-move-to, WIP limit,
 * win probability and won/lost flags. Works on useDealStore.stages (optimistic, persisted when connected).
 */
export const CustomColumnManager: React.FC<CustomColumnManagerProps> = ({ onColumnsChange, onClose }) => {
  const stages = useDealStore(s => s.stages);
  const deals = useDealStore(s => s.deals);
  const addStage = useDealStore(s => s.addStage);
  const updateStage = useDealStore(s => s.updateStage);
  const reorderStages = useDealStore(s => s.reorderStages);
  const removeStage = useDealStore(s => s.removeStage);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    Object.values(deals).forEach(d => { c[d.stage] = (c[d.stage] ?? 0) + 1; });
    return c;
  }, [deals]);

  const notifyChange = () => {
    if (!onColumnsChange) return;
    const cur = useDealStore.getState().stages;
    onColumnsChange([...cur].sort((a, b) => a.position - b.position).map(s => ({
      id: s.key, name: s.name, position: s.position + 1, is_active: s.visible,
      config: { color: `border-${normalizeColor(s.color)}-500`, wipLimit: s.wipLimit ?? 0 }
    })));
  };

  const handleUpdate = async (key: string, updates: Partial<Omit<PipelineStage, 'id' | 'key'>>) => {
    setError(null);
    // Won and lost are mutually exclusive (also enforced here for programmatic callers)
    const patch = { ...updates };
    if (patch.isWon) patch.isLost = false;
    if (patch.isLost) patch.isWon = false;
    const ok = await updateStage(key, patch);
    if (!ok) setError('Could not save the change');
    else notifyChange();
  };

  const handleDelete = async (key: string, moveTo: string) => {
    setError(null);
    const ok = await removeStage(key, moveTo);
    if (!ok) setError('Could not delete the stage');
    else notifyChange();
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setError(null);
    const created = await addStage(newName);
    if (created) { setNewName(''); notifyChange(); }
    else setError('Could not add the stage');
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const keys = reorderKeys(sorted.map(s => s.key), result.source.index, result.destination.index);
    setError(null);
    const ok = await reorderStages(keys);
    if (!ok) setError('Could not reorder the stages');
    else notifyChange();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto" role="dialog" aria-label="Manage pipeline stages">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Manage Pipeline Stages</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <DragDropContext onDragEnd={(r) => void handleDragEnd(r)}>
        <Droppable droppableId="stage-manager-list">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {sorted.map((stage, index) => (
                <StageRow
                  key={stage.key}
                  stage={stage}
                  index={index}
                  others={sorted.filter(s => s.key !== stage.key)}
                  dealCount={counts[stage.key] ?? 0}
                  onUpdate={(k, u) => void handleUpdate(k, u)}
                  onDelete={(k, m) => void handleDelete(k, m)}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <input
            aria-label="New stage name"
            placeholder="New stage name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAdd(); } }}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!newName.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center space-x-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add stage</span>
          </button>
        </div>
        <button type="button" onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg">
          Done
        </button>
      </div>
    </div>
  );
};

/** The manager in its modal shell (same look as the previous Pipeline modal). */
export const StageManagerModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <CustomColumnManager onClose={onClose} />
      </div>
    </div>
  );
};
