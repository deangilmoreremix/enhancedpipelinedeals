import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow, ReactFlowProvider, applyNodeChanges, useReactFlow,
  type Connection, type Edge, type EdgeChange, type NodeChange, type OnConnectEnd
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { usePermissions } from '../../hooks/usePermissions';
import { AlertTriangle, Copy, LayoutTemplate, PanelLeft, Play, Redo2, RotateCcw, Save, Settings, Trash2, Undo2 } from 'lucide-react';
import type { Workflow, WorkflowStep } from '../../types/workflow';
import { findEntryByRef, type ConfigFieldOption, type RegistryEntry } from '../../services/workflowActionRegistry';
import { StepPicker, STEP_DRAG_MIME } from './StepPicker';
import { StepConfigForm } from './StepConfigForm';
import { InsertEdge, WorkflowNode, type InsertEdgeData, type StepNode, type StepNodeData } from './WorkflowNode';
import { validateWorkflow } from './workflowValidation';
import { autoLayout } from './autoLayout';
import {
  GRID, appendAfter, connectSteps, createStepFromEntry, disconnectSteps, handleForConnection, insertOnEdge, newId, nextPosition,
  removeSteps, snap, withDerivedTriggers, type RunStatus
} from './workflowGraph';
import { useIsDark } from './useIsDark';
import type { StepRunInfo } from './workflowRunUtils';

export interface WorkflowBuilderProps {
  workflow: Workflow;
  onWorkflowChange: (workflow: Workflow) => void;
  onSave: () => void;
  onExecute: () => void;
  isExecuting?: boolean;
  /** Read-only diagram (run detail): no palette, properties are view-only, no editing. */
  readOnly?: boolean;
  /** Per-step run overlay (completed/failed/skipped/waiting/running) keyed by step id. */
  statusByStep?: Record<string, StepRunInfo>;
  /** Controlled selection (e.g. synced with a timeline list). */
  selectedStepId?: string | null;
  onSelectStep?: (id: string | null) => void;
  /** Hide the toolbar header (embedding). */
  hideHeader?: boolean;
  /** Hide the right-hand properties panel even when a step is selected. */
  hideProperties?: boolean;
  /** Pipeline stages for stage pickers; loaded automatically when omitted. */
  stageOptions?: ConfigFieldOption[];
}

const nodeTypes = { step: WorkflowNode };
const edgeTypes = { insertable: InsertEdge };

type PickerState =
  | { kind: 'append'; x: number; y: number }
  | { kind: 'edge'; source: string; target: string; x: number; y: number }
  | { kind: 'handle'; source: string; handle: string | null; flow: { x: number; y: number }; x: number; y: number };

const BRANCH_TEXT: Record<string, string> = { true: 'True', false: 'False', item: 'Item', done: 'Done' };
const MINIMAP_COLOR: Record<string, string> = { trigger: '#f59e0b', action: '#2563eb', condition: '#a855f7', delay: '#6b7280' };

const HISTORY_LIMIT = 100;

const BuilderInner: React.FC<WorkflowBuilderProps> = ({
  workflow, onWorkflowChange, onSave, onExecute, isExecuting = false, readOnly: readOnlyProp = false, statusByStep, selectedStepId, onSelectStep,
  hideHeader = false, hideProperties = false, stageOptions: stageOptionsProp
}) => {
  // Read-only canvas (no edits, Save or Run) unless the user may manage workflows
  const { allowed: permAllowed } = usePermissions();
  const readOnly = readOnlyProp || !permAllowed('manage_workflows', 'workflow');
  const rf = useReactFlow();
  const isDark = useIsDark();
  const steps = workflow.steps;
  const containerRef = useRef<HTMLDivElement>(null);

  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const selectedId = selectedStepId !== undefined ? selectedStepId : localSelected;
  const select = useCallback((id: string | null) => { setLocalSelected(id); onSelectStep?.(id); }, [onSelectStep]);
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set());
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [stages, setStages] = useState<ConfigFieldOption[] | undefined>(stageOptionsProp);

  useEffect(() => {
    if (stageOptionsProp || readOnly) return;
    let cancelled = false;
    void import('../../services/pipelineStageService')
      .then(m => m.getStages())
      .then(list => { if (!cancelled) setStages(list.map(s => ({ value: s.key, label: s.name }))); })
      .catch(() => { /* free-text stage input is the fallback */ });
    return () => { cancelled = true; };
  }, [stageOptionsProp, readOnly]);

  // ---- history (local undo/redo) ------------------------------------------------------------------
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const workflowRef = useRef(workflow);
  workflowRef.current = workflow;
  const past = useRef<WorkflowStep[][]>([]);
  const future = useRef<WorkflowStep[][]>([]);
  const lastCoalesce = useRef<{ key: string; t: number } | null>(null);
  const [, bump] = useState(0);

  const emit = useCallback((next: WorkflowStep[]) => {
    onWorkflowChange(withDerivedTriggers(workflowRef.current, next));
  }, [onWorkflowChange]);

  /** Applies a change. `coalesceKey` merges rapid edits (typing) into one undo step. */
  const commit = useCallback((next: WorkflowStep[], coalesceKey?: string) => {
    if (readOnly) return;
    const now = Date.now();
    const lc = lastCoalesce.current;
    const merge = coalesceKey && lc && lc.key === coalesceKey && now - lc.t < 800;
    if (!merge) {
      past.current = [...past.current, stepsRef.current].slice(-HISTORY_LIMIT);
    }
    lastCoalesce.current = coalesceKey ? { key: coalesceKey, t: now } : null;
    future.current = [];
    emit(next);
    bump(n => n + 1);
  }, [emit, readOnly]);

  const undo = useCallback(() => {
    const prev = past.current[past.current.length - 1];
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, stepsRef.current];
    lastCoalesce.current = null;
    emit(prev);
    bump(n => n + 1);
  }, [emit]);

  const redo = useCallback(() => {
    const nxt = future.current[future.current.length - 1];
    if (!nxt) return;
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, stepsRef.current];
    lastCoalesce.current = null;
    emit(nxt);
    bump(n => n + 1);
  }, [emit]);

  // ---- validation ----------------------------------------------------------------------------------
  const validation = useMemo(
    () => validateWorkflow(steps, { legacyTriggers: (workflow.triggers?.length ?? 0) > 0 }),
    [steps, workflow.triggers]
  );

  // ---- nodes & edges -------------------------------------------------------------------------------
  const toggleActive = useCallback((id: string, active: boolean) => {
    commit(stepsRef.current.map(s => (s.id === id ? { ...s, isActive: active } : s)));
  }, [commit]);

  const [nodes, setNodes] = useState<StepNode[]>([]);
  useEffect(() => {
    setNodes(prev => steps.map(step => {
      const existing = prev.find(n => n.id === step.id);
      const info = statusByStep?.[step.id];
      const data: StepNodeData = {
        step,
        issues: readOnly ? [] : validation.byStep[step.id] ?? [],
        readOnly,
        status: info?.status as RunStatus | undefined,
        durationMs: info?.durationMs,
        output: info?.output,
        error: info?.error,
        onToggleActive: toggleActive
      };
      return {
        ...(existing ?? {}),
        id: step.id,
        type: 'step' as const,
        position: existing?.dragging ? existing.position : step.position,
        data,
        selected: step.id === selectedId,
        draggable: !readOnly,
        deletable: !readOnly,
        connectable: !readOnly
      } as StepNode;
    }));
  }, [steps, selectedId, statusByStep, validation, readOnly, toggleActive]);

  const onNodesChange = useCallback((changes: NodeChange<StepNode>[]) => {
    setNodes(ns => applyNodeChanges(changes, ns));
  }, []);

  const onNodeDragStop = useCallback((_: unknown, __: unknown, dragged: StepNode[]) => {
    const moved = new Map(dragged.map(n => [n.id, n.position]));
    commit(stepsRef.current.map(s => {
      const p = moved.get(s.id);
      return p ? { ...s, position: { x: snap(p.x), y: snap(p.y) } } : s;
    }));
  }, [commit]);

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];
    for (const s of steps) {
      for (const t of s.connections ?? []) {
        if (!steps.some(x => x.id === t)) continue;
        const handle = handleForConnection(s, t);
        const id = `${s.id}:${handle}->${t}`;
        const data: InsertEdgeData = {
          label: BRANCH_TEXT[handle],
          readOnly,
          onInsert: (source, target, client) => openPickerAt({ kind: 'edge', source, target }, client),
          onRemove: (source, target) => commit(disconnectSteps(stepsRef.current, source, target))
        };
        const ran = statusByStep?.[s.id]?.status === 'completed' && statusByStep?.[t] && statusByStep[t].status !== 'pending';
        list.push({
          id, source: s.id, target: t, sourceHandle: handle, targetHandle: 'in', type: 'insertable', data,
          selected: selectedEdges.has(id), deletable: !readOnly,
          markerEnd: { type: MarkerType.ArrowClosed, color: ran ? '#16a34a' : '#9ca3af' },
          style: ran ? { stroke: '#16a34a' } : undefined
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, selectedEdges, readOnly, statusByStep, commit]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setSelectedEdges(prev => {
      const next = new Set(prev);
      for (const c of changes) if (c.type === 'select') { if (c.selected) next.add(c.id); else next.delete(c.id); }
      return next;
    });
  }, []);

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    let next = stepsRef.current;
    for (const e of deleted) next = disconnectSteps(next, e.source, e.target);
    commit(next);
  }, [commit]);

  const onNodesDelete = useCallback((deleted: StepNode[]) => {
    const ids = deleted.map(n => n.id);
    commit(removeSteps(stepsRef.current, ids));
    if (selectedId && ids.includes(selectedId)) select(null);
  }, [commit, select, selectedId]);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    commit(connectSteps(stepsRef.current, c.source, c.target, c.sourceHandle));
  }, [commit]);

  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (c.source === c.target) return false;
    const tgt = stepsRef.current.find(s => s.id === c.target);
    return Boolean(tgt && tgt.type !== 'trigger');
  }, []);

  // ---- picker --------------------------------------------------------------------------------------
  function openPickerAt(base: { kind: 'edge'; source: string; target: string } | { kind: 'handle'; source: string; handle: string | null; flow: { x: number; y: number } } | { kind: 'append' }, client: { x: number; y: number }) {
    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 800;
    const height = rect?.height ?? 600;
    const x = Math.max(8, Math.min((client.x - (rect?.left ?? 0)) - 20, width - 330));
    const y = Math.max(8, Math.min((client.y - (rect?.top ?? 0)) - 10, height - 420));
    setPicker({ ...base, x, y } as PickerState);
  }

  const onConnectEnd = useCallback<OnConnectEnd>((event, state) => {
    if (readOnly || state.isValid || !state.fromNode || state.fromHandle?.type !== 'source') return;
    const pt = 'changedTouches' in event ? event.changedTouches[0] : event;
    const flow = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
    openPickerAt({ kind: 'handle', source: state.fromNode.id, handle: state.fromHandle.id ?? null, flow }, { x: pt.clientX, y: pt.clientY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, rf]);

  const addEntry = useCallback((entry: RegistryEntry, position?: { x: number; y: number }, mode?: PickerState | null) => {
    const current = stepsRef.current;
    const anchor = mode?.kind === 'append' || !mode ? current.find(s => s.id === selectedId) : undefined;
    let newStep = createStepFromEntry(entry, position ?? nextPosition(current, anchor));
    let next: WorkflowStep[];
    if (mode?.kind === 'edge') {
      const src = current.find(s => s.id === mode.source);
      const tgt = current.find(s => s.id === mode.target);
      if (src && tgt) newStep = { ...newStep, position: { x: snap((src.position.x + tgt.position.x) / 2), y: snap((src.position.y + tgt.position.y) / 2) } };
      next = insertOnEdge(current, mode.source, mode.target, newStep);
    } else if (mode?.kind === 'handle') {
      newStep = { ...newStep, position: { x: snap(mode.flow.x - 130), y: snap(mode.flow.y) } };
      next = appendAfter(current, mode.source, mode.handle, newStep);
    } else if (!position && anchor && anchor.type !== 'condition' && !(anchor.type === 'action' && anchor.action?.type === 'iterator') && entry.category !== 'Triggers') {
      // click-to-add after the selected step
      next = appendAfter(current, anchor.id, 'out', newStep);
    } else {
      next = [...current, newStep];
    }
    commit(next);
    select(newStep.id);
    setPicker(null);
    // a freshly added step may be off-screen
    setTimeout(() => { try { void rf.fitView({ duration: 200, padding: 0.3, maxZoom: 1 }); } catch { /* not mounted */ } }, 60);
  }, [commit, rf, select, selectedId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    const key = e.dataTransfer.getData(STEP_DRAG_MIME);
    if (!key || readOnly) return;
    e.preventDefault();
    const entry = findEntryByRef(key);
    if (!entry) return;
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addEntry(entry, { x: snap(p.x - 130), y: snap(p.y - 30) });
  }, [addEntry, readOnly, rf]);

  // ---- actions -------------------------------------------------------------------------------------
  const selectedStep = steps.find(s => s.id === selectedId) ?? null;

  const updateStep = useCallback((step: WorkflowStep) => {
    commit(stepsRef.current.map(s => (s.id === step.id ? step : s)), `edit:${step.id}`);
  }, [commit]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit(removeSteps(stepsRef.current, [selectedId]));
    select(null);
  }, [commit, select, selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selectedStep || selectedStep.type === 'trigger') return;
    const copy: WorkflowStep = {
      ...JSON.parse(JSON.stringify(selectedStep)) as WorkflowStep,
      id: newId('step'), name: `${selectedStep.name} (copy)`,
      position: { x: selectedStep.position.x + GRID * 2, y: selectedStep.position.y + GRID * 2 },
      connections: [], connectionLabels: undefined
    };
    commit([...stepsRef.current, copy]);
    select(copy.id);
  }, [commit, select, selectedStep]);

  const runAutoLayout = useCallback(() => {
    commit(autoLayout(stepsRef.current));
    setTimeout(() => { try { void rf.fitView({ duration: 250, padding: 0.2, maxZoom: 1 }); } catch { /* not mounted */ } }, 60);
  }, [commit, rf]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (readOnly) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  }, [readOnly, redo, undo]);

  const hasTrigger = steps.some(s => s.type === 'trigger');
  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;
  const blocked = validation.hasErrors;
  const issueSteps = new Map(steps.map(s => [s.id, s.name]));

  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      className="relative flex flex-col h-full min-h-[560px] bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {!hideHeader && !readOnly && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{workflow.name}</h2>
            {workflow.description && <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{workflow.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${btn} lg:hidden`} onClick={() => setShowPalette(v => !v)} aria-pressed={showPalette}><PanelLeft className="w-4 h-4" /> Steps</button>
            <button type="button" className={btn} onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
            <button type="button" className={btn} onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Redo2 className="w-4 h-4" /></button>
            <button type="button" className={btn} onClick={runAutoLayout} disabled={steps.length === 0} title="Auto layout"><LayoutTemplate className="w-4 h-4" /> Auto layout</button>
            <button
              type="button"
              onClick={onSave}
              disabled={blocked}
              title={blocked ? 'Fix the errors before saving' : 'Save workflow'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" /> Save
            </button>
            <button
              type="button"
              onClick={onExecute}
              disabled={isExecuting || steps.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isExecuting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isExecuting ? 'Running…' : 'Execute'}
            </button>
          </div>
        </div>
      )}

      {!readOnly && validation.issues.length > 0 && (
        <div role="status" aria-label="Validation" className={`px-4 py-2 text-xs border-b ${blocked ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-300' : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-900/40 dark:text-amber-300'}`}>
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {validation.errors.length > 0 && `${validation.errors.length} error${validation.errors.length > 1 ? 's' : ''}`}
            {validation.errors.length > 0 && validation.warnings.length > 0 && ', '}
            {validation.warnings.length > 0 && `${validation.warnings.length} warning${validation.warnings.length > 1 ? 's' : ''}`}
            {blocked && ' (Save is disabled until errors are fixed)'}
          </div>
          <ul className="mt-1 space-y-0.5 max-h-16 overflow-y-auto">
            {validation.issues.slice(0, 6).map((i, idx) => (
              <li key={idx}>
                {i.stepId ? <button type="button" className="underline" onClick={() => select(i.stepId as string)}>{issueSteps.get(i.stepId) || i.stepId}</button> : null}
                {i.stepId ? ': ' : ''}{i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {!readOnly && showPalette && (
          <aside className="lg:w-64 w-full max-h-64 lg:max-h-none shrink-0 bg-white dark:bg-gray-800 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 min-h-0">
            <StepPicker variant="panel" title="Workflow steps" hasTrigger={hasTrigger} onSelect={entry => addEntry(entry)} />
          </aside>
        )}

        <div className="relative flex-1 min-h-[360px]" onDragOver={e => { if (!readOnly) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }} onDrop={onDrop}>
          <ReactFlow<StepNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            isValidConnection={isValidConnection}
            onNodeClick={(_, n) => select(n.id)}
            onPaneClick={() => { select(null); setPicker(null); }}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable
            deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
            snapToGrid
            snapGrid={[GRID, GRID]}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={1.75}
            colorMode={isDark ? 'dark' : 'light'}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={GRID} size={1.2} />
            <Controls showInteractive={!readOnly} aria-label="Canvas controls" />
            <MiniMap
              pannable
              zoomable
              ariaLabel="Workflow minimap"
              nodeColor={n => {
                const d = (n as StepNode).data;
                return d?.step.type === 'action' && d.step.action?.type === 'iterator' ? '#14b8a6' : MINIMAP_COLOR[d?.step.type ?? 'action'];
              }}
              className="!hidden sm:!block"
            />
          </ReactFlow>
          {steps.length === 0 && !readOnly && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-500 dark:text-gray-400 px-6">
                <Settings className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">Start by adding a trigger</p>
                <p className="text-xs">Pick a step from the list, or drag it onto the canvas.</p>
              </div>
            </div>
          )}
          {picker && (
            <div className="absolute z-30" style={{ left: picker.x, top: picker.y }}>
              <StepPicker
                variant="popover"
                title={picker.kind === 'edge' ? 'Insert a step' : 'Add a step'}
                hasTrigger={hasTrigger}
                triggerBlockedReason={picker.kind === 'append' ? undefined : 'Triggers start a workflow and cannot follow another step.'}
                onClose={() => setPicker(null)}
                onSelect={entry => addEntry(entry, undefined, picker)}
              />
            </div>
          )}
        </div>

        {!hideProperties && selectedStep && (
          <aside aria-label="Step properties" className="lg:w-80 w-full max-h-[28rem] lg:max-h-none overflow-y-auto shrink-0 bg-white dark:bg-gray-800 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Step properties</h3>
              {!readOnly && (
                <div className="flex items-center gap-1">
                  {selectedStep.type !== 'trigger' && (
                    <button type="button" onClick={duplicateSelected} aria-label="Duplicate step" title="Duplicate" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><Copy className="w-4 h-4" /></button>
                  )}
                  <button type="button" onClick={deleteSelected} aria-label="Delete step" title="Delete" className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <StepConfigForm
              key={selectedStep.id}
              step={selectedStep}
              steps={steps}
              onChange={updateStep}
              issues={readOnly ? [] : validation.byStep[selectedStep.id]}
              stageOptions={stages}
              readOnly={readOnly}
            />
          </aside>
        )}
      </div>
    </div>
  );
};

/** Visual workflow editor (nodes = steps, edges = `connections`). Same JSON as before: `workflow.steps`. */
export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = props => (
  <ReactFlowProvider>
    <BuilderInner {...props} />
  </ReactFlowProvider>
);

export default WorkflowBuilder;
