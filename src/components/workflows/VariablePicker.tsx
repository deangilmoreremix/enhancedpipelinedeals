import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Braces } from 'lucide-react';
import type { WorkflowStep } from '../../types/workflow';
import { DEAL_VARIABLE_FIELDS, TRIGGER_PAYLOAD_VARIABLES, variableToken } from '../../services/workflowActionRegistry';

export interface VariableGroup { title: string; items: Array<{ label: string; token: string }> }

/** Typical output keys per action type (see the executors in netlify/functions/_workflowSteps.ts). */
const OUTPUT_KEYS: Record<string, string[]> = {
  ai_agent: ['text'],
  search_records: ['count'],
  create_task: ['taskId'],
  create_note: ['noteId'],
  create_record: ['id'],
  upsert_record: ['id'],
  http_request: ['status', 'data'],
  webhook: ['status', 'data'],
  send_email: ['queued'],
  filter: ['count']
};

/** Steps that can reach `stepId` (its ancestors), nearest first is not guaranteed. */
export function ancestorsOf(steps: WorkflowStep[], stepId: string): WorkflowStep[] {
  const parents = new Map<string, string[]>();
  for (const s of steps) for (const c of s.connections ?? []) parents.set(c, [...(parents.get(c) ?? []), s.id]);
  const seen = new Set<string>();
  const queue = [...(parents.get(stepId) ?? [])];
  while (queue.length) {
    const id = queue.shift() as string;
    if (seen.has(id) || id === stepId) continue;
    seen.add(id);
    queue.push(...(parents.get(id) ?? []));
  }
  return steps.filter(s => seen.has(s.id));
}

/**
 * Builds the variable catalog. Tokens match interpolate() in _workflowSteps.ts:
 * `{{record.<field>}}`, `{{trigger.<key>}}`, `{{steps.<stepId>.output.<key>}}`, `{{recordId}}`, `{{aiResult}}`, `{{item.<key>}}`.
 */
export function buildVariableGroups(steps: WorkflowStep[], currentStepId?: string): VariableGroup[] {
  const groups: VariableGroup[] = [
    { title: 'Record fields', items: DEAL_VARIABLE_FIELDS.map(f => ({ label: f.label, token: variableToken(`record.${f.value}`) })) },
    {
      title: 'Trigger payload',
      items: [
        ...TRIGGER_PAYLOAD_VARIABLES.filter(v => v.value !== 'recordId').map(v => ({ label: v.label, token: variableToken(`trigger.${v.value}`) })),
        { label: 'Record ID', token: variableToken('recordId') }
      ]
    }
  ];
  const prev = currentStepId ? ancestorsOf(steps, currentStepId) : steps;
  const stepItems: VariableGroup['items'] = [];
  for (const s of prev) {
    if (s.type === 'trigger') continue;
    const keys = (s.type === 'action' && s.action ? OUTPUT_KEYS[s.action.type] : undefined) ?? [];
    stepItems.push({ label: `${s.name}: output`, token: variableToken(`steps.${s.id}.output`) });
    for (const k of keys) stepItems.push({ label: `${s.name}: ${k}`, token: variableToken(`steps.${s.id}.output.${k}`) });
  }
  if (stepItems.length) groups.push({ title: 'Previous steps', items: stepItems });
  const extras: VariableGroup['items'] = [];
  if (prev.some(s => s.action?.type === 'ai_agent')) extras.push({ label: 'AI result', token: variableToken('aiResult') });
  if (prev.some(s => s.action?.type === 'iterator')) {
    extras.push({ label: 'Current item', token: variableToken('item') }, { label: 'Item ID', token: variableToken('item.id') }, { label: 'Item title', token: variableToken('item.title') });
  }
  if (extras.length) groups.push({ title: 'Run variables', items: extras });
  return groups;
}

interface VariablePickerProps {
  steps: WorkflowStep[];
  currentStepId?: string;
  onInsert: (token: string) => void;
  label?: string;
}

export const VariablePicker: React.FC<VariablePickerProps> = ({ steps, currentStepId, onInsert, label = 'Insert variable' }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => buildVariableGroups(steps, currentStepId), [steps, currentStepId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const needle = q.trim().toLowerCase();
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="p-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
      >
        <Braces className="w-4 h-4" />
      </button>
      {open && (
        <div role="dialog" aria-label="Variables" className="absolute right-0 z-30 mt-1 w-72 max-h-80 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
          <div className="p-2 sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search variables"
              aria-label="Search variables"
              className="w-full px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          {groups.map(g => {
            const items = g.items.filter(i => !needle || i.label.toLowerCase().includes(needle) || i.token.toLowerCase().includes(needle));
            if (!items.length) return null;
            return (
              <div key={g.title} className="py-1">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{g.title}</div>
                {items.map(i => (
                  <button
                    key={i.token}
                    type="button"
                    onClick={() => { onInsert(i.token); setOpen(false); setQ(''); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 flex items-center justify-between gap-2"
                  >
                    <span className="text-gray-800 dark:text-gray-100 truncate">{i.label}</span>
                    <code className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[45%]">{i.token}</code>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** Inserts `token` into `value` at the element's caret (or appends). */
export function insertAtCaret(el: HTMLInputElement | HTMLTextAreaElement | null, value: string, token: string): string {
  if (!el || el.selectionStart === null || el.selectionStart === undefined) return `${value}${token}`;
  const start = el.selectionStart;
  const end = el.selectionEnd ?? start;
  return `${value.slice(0, start)}${token}${value.slice(end)}`;
}
