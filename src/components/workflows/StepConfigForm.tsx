import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import type { WorkflowAction, WorkflowCondition, WorkflowStep, WorkflowTrigger } from '../../types/workflow';
import {
  ACTION_ENTRIES, CONDITION_OPERATORS, DEAL_VARIABLE_FIELDS, TRIGGER_ENTRIES, getActionEntry, getConfigValue, getTriggerEntry,
  setConfigValue, visibleFields, type ConfigField, type ConfigFieldOption, type RegistryEntry
} from '../../services/workflowActionRegistry';
import { VariablePicker, insertAtCaret } from './VariablePicker';
import type { WorkflowIssue } from './workflowValidation';
import { newId } from './workflowGraph';

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60';
const labelCls = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1';

interface StepConfigFormProps {
  step: WorkflowStep;
  /** All steps (for the variable picker's "previous steps"). */
  steps: WorkflowStep[];
  onChange: (step: WorkflowStep) => void;
  issues?: WorkflowIssue[];
  stageOptions?: ConfigFieldOption[];
  readOnly?: boolean;
}

// ---- JSON field ---------------------------------------------------------------------------------

const JsonField: React.FC<{
  id: string; value: unknown; onCommit: (v: unknown) => void; placeholder?: string; disabled?: boolean;
  supportsVariables?: boolean; steps: WorkflowStep[]; stepId: string;
}> = ({ id, value, onCommit, placeholder, disabled, supportsVariables, steps, stepId }) => {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(() => (value === undefined ? '' : JSON.stringify(value, null, 2)));
  const [invalid, setInvalid] = useState(false);
  const last = useRef(value);
  useEffect(() => {
    // external change (different step / undo): resync
    if (JSON.stringify(last.current) !== JSON.stringify(value)) {
      setText(value === undefined ? '' : JSON.stringify(value, null, 2));
      setInvalid(false);
      last.current = value;
    }
  }, [value]);
  const apply = (t: string) => {
    setText(t);
    if (t.trim() === '') { setInvalid(false); last.current = undefined; onCommit(undefined); return; }
    try { const parsed = JSON.parse(t); setInvalid(false); last.current = parsed; onCommit(parsed); } catch { setInvalid(true); }
  };
  return (
    <>
      {supportsVariables && !disabled && (
        <div className="flex justify-end -mt-6 mb-1">
          <VariablePicker steps={steps} currentStepId={stepId} onInsert={token => apply(insertAtCaret(areaRef.current, text, token))} />
        </div>
      )}
      <textarea
        id={id}
        ref={areaRef}
        rows={4}
        disabled={disabled}
        spellCheck={false}
        value={text}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={e => apply(e.target.value)}
        className={`${inputCls} font-mono text-xs ${invalid ? 'border-red-400 focus:ring-red-400' : ''}`}
      />
      {invalid && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Invalid JSON. Changes are not applied until it parses.</p>}
    </>
  );
};

// ---- text-like input with variable picker -------------------------------------------------------

const VariableTextInput: React.FC<{
  id: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string;
  supportsVariables?: boolean; steps: WorkflowStep[]; currentStepId: string; disabled?: boolean; type?: string;
}> = ({ id, value, onChange, multiline, placeholder, supportsVariables, steps, currentStepId, disabled, type = 'text' }) => {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  return (
    <div className="flex items-start gap-1">
      {multiline ? (
        <textarea id={id} ref={ref as React.RefObject<HTMLTextAreaElement>} rows={4} disabled={disabled} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={inputCls} />
      ) : (
        <input id={id} ref={ref as React.RefObject<HTMLInputElement>} type={type} disabled={disabled} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={inputCls} />
      )}
      {supportsVariables && !disabled && (
        <VariablePicker steps={steps} currentStepId={currentStepId} onInsert={token => onChange(insertAtCaret(ref.current, value, token))} />
      )}
    </div>
  );
};

// ---- one schema field ---------------------------------------------------------------------------

interface FieldProps {
  field: ConfigField; config: Record<string, any>; onSet: (key: string, v: unknown) => void;
  steps: WorkflowStep[]; stepId: string; stageOptions?: ConfigFieldOption[]; disabled?: boolean; idPrefix: string;
}

export const SchemaField: React.FC<FieldProps> = ({ field, config, onSet, steps, stepId, stageOptions, disabled, idPrefix }) => {
  const id = `${idPrefix}-${field.key.replace(/\./g, '-')}`;
  const raw = getConfigValue(config, field.key);
  const value = raw ?? field.defaultValue;
  const str = value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);

  let control: React.ReactNode;
  switch (field.type) {
    case 'select':
      control = (
        <select id={id} disabled={disabled} value={str} onChange={e => onSet(field.key, e.target.value)} className={inputCls}>
          {(!field.required || raw === undefined) && <option value="">{field.placeholder ?? (field.required ? 'Select…' : 'Any')}</option>}
          {(field.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case 'stage':
      control = stageOptions && stageOptions.length > 0 ? (
        <select id={id} disabled={disabled} value={str} onChange={e => onSet(field.key, e.target.value)} className={inputCls}>
          <option value="">{field.placeholder ?? 'Select stage…'}</option>
          {stageOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input id={id} disabled={disabled} value={str} placeholder={field.placeholder ?? 'Stage key'} onChange={e => onSet(field.key, e.target.value)} className={inputCls} />
      );
      break;
    case 'record-field':
      control = (
        <>
          <input id={id} disabled={disabled} list={`${id}-list`} value={str} placeholder={field.placeholder ?? 'Field name'} onChange={e => onSet(field.key, e.target.value)} className={inputCls} />
          <datalist id={`${id}-list`}>{DEAL_VARIABLE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</datalist>
        </>
      );
      break;
    case 'number':
      control = (
        <input id={id} type="number" disabled={disabled} value={str} placeholder={field.placeholder}
          onChange={e => onSet(field.key, e.target.value === '' ? undefined : Number(e.target.value))} className={inputCls} />
      );
      break;
    case 'boolean':
      control = (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input id={id} type="checkbox" disabled={disabled} checked={Boolean(value)} onChange={e => onSet(field.key, e.target.checked)} /> Enabled
        </label>
      );
      break;
    case 'json':
      control = (
        <div className="flex items-start gap-1">
          <div className="flex-1"><JsonField id={id} disabled={disabled} value={raw} placeholder={field.placeholder} onCommit={v => onSet(field.key, v)} supportsVariables={field.supportsVariables} steps={steps} stepId={stepId} /></div>
        </div>
      );
      break;
    default: // text | textarea | template | user
      control = (
        <VariableTextInput
          id={id} value={str} onChange={v => onSet(field.key, v)} multiline={field.type === 'textarea' || field.type === 'template'}
          placeholder={field.placeholder ?? (field.type === 'user' ? 'User ID or {{variable}}' : undefined)}
          supportsVariables={field.supportsVariables} steps={steps} currentStepId={stepId} disabled={disabled}
        />
      );
  }
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {field.label}{field.required && <span className="text-red-500"> *</span>}
      </label>
      {control}
      {field.help && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{field.help}</p>}
    </div>
  );
};

// ---- condition builder --------------------------------------------------------------------------

export const ConditionBuilder: React.FC<{
  conditions: WorkflowCondition[]; onChange: (c: WorkflowCondition[]) => void; steps: WorkflowStep[]; stepId: string;
  /** One row, no AND/OR (condition nodes). */
  single?: boolean; disabled?: boolean; idPrefix: string;
}> = ({ conditions, onChange, steps, stepId, single, disabled, idPrefix }) => {
  const update = (i: number, patch: Partial<WorkflowCondition>) => onChange(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      {conditions.map((c, i) => {
        const noValue = c.operator === 'is_empty' || c.operator === 'is_not_empty';
        return (
          <div key={c.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-2">
            {i > 0 && !single && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Combine with previous</span>
                <select
                  aria-label="Logical operator"
                  disabled={disabled}
                  value={conditions[i - 1].logicalOperator ?? 'AND'}
                  onChange={e => update(i - 1, { logicalOperator: e.target.value as 'AND' | 'OR' })}
                  className="px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              </div>
            )}
            <div>
              <label htmlFor={`${idPrefix}-${i}-field`} className={labelCls}>Field</label>
              <input
                id={`${idPrefix}-${i}-field`} list={`${idPrefix}-fields`} disabled={disabled} value={c.field} placeholder="e.g. value, stage, trigger.to"
                onChange={e => update(i, { field: e.target.value })} className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor={`${idPrefix}-${i}-op`} className={labelCls}>Operator</label>
                <select id={`${idPrefix}-${i}-op`} disabled={disabled} value={c.operator} onChange={e => update(i, { operator: e.target.value as WorkflowCondition['operator'] })} className={inputCls}>
                  {CONDITION_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {!noValue && (
                <div>
                  <label htmlFor={`${idPrefix}-${i}-value`} className={labelCls}>Value</label>
                  <VariableTextInput id={`${idPrefix}-${i}-value`} value={c.value === undefined || c.value === null ? '' : String(c.value)} onChange={v => update(i, { value: v })} supportsVariables steps={steps} currentStepId={stepId} disabled={disabled} />
                </div>
              )}
            </div>
            {!single && !disabled && (
              <button type="button" onClick={() => onChange(conditions.filter((_, idx) => idx !== i))} className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            )}
          </div>
        );
      })}
      <datalist id={`${idPrefix}-fields`}>{DEAL_VARIABLE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</datalist>
      {!single && !disabled && (
        <button type="button" onClick={() => onChange([...conditions, { id: newId('cond'), field: '', operator: 'equals', value: '' }])} className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add condition
        </button>
      )}
    </div>
  );
};

// ---- main form ----------------------------------------------------------------------------------

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h4>
    {children}
  </section>
);

function entryOptions(entries: RegistryEntry[]) {
  return entries.map(e => <option key={e.key} value={e.key} disabled={!e.engines.server && !e.engines.client}>{e.label}{e.engines.server ? '' : ' (browser only)'}</option>);
}

export const StepConfigForm: React.FC<StepConfigFormProps> = ({ step, steps, onChange, issues = [], stageOptions, readOnly }) => {
  const p = `cfg-${step.id}`;
  const patch = (u: Partial<WorkflowStep>) => onChange({ ...step, ...u });

  const triggerEntry = step.type === 'trigger' ? getTriggerEntry(step.trigger?.type) : undefined;
  const actionEntry = step.type === 'action' ? getActionEntry(step.action?.type) : undefined;

  const setTriggerConfig = (key: string, v: unknown) => {
    const t = step.trigger as WorkflowTrigger;
    patch({ trigger: { ...t, config: setConfigValue(t.config as Record<string, any>, key, v) as WorkflowTrigger['config'] } });
  };
  const setActionConfig = (key: string, v: unknown) => {
    const a = step.action as WorkflowAction;
    patch({ action: { ...a, config: setConfigValue(a.config as Record<string, any>, key, v) as WorkflowAction['config'] } });
  };

  const changeTriggerType = (key: string) => {
    const entry = getTriggerEntry(key);
    if (!entry || !step.trigger) return;
    const wasDefault = step.name === getTriggerEntry(step.trigger.type)?.label;
    patch({
      name: wasDefault ? entry.label : step.name,
      trigger: { ...step.trigger, type: entry.key as WorkflowTrigger['type'], name: entry.label, description: entry.description, config: step.trigger.config?.recordType ? { recordType: step.trigger.config.recordType } : {} }
    });
  };
  const changeActionType = (key: string) => {
    const entry = getActionEntry(key);
    if (!entry) return;
    const config: Record<string, any> = {};
    for (const f of entry.fields) if (f.defaultValue !== undefined && !f.key.includes('.')) config[f.key] = f.defaultValue;
    const prevLabel = getActionEntry(step.action?.type)?.label;
    const base: WorkflowAction = step.action ?? { id: newId('action'), type: entry.key as WorkflowAction['type'], name: entry.label, description: entry.description, config: {} };
    patch({
      name: !prevLabel || step.name === prevLabel ? entry.label : step.name,
      action: { ...base, type: entry.key as WorkflowAction['type'], name: entry.label, description: entry.description, config: config as WorkflowAction['config'] }
    });
  };

  const err = issues.filter(i => i.severity === 'error');
  const warn = issues.filter(i => i.severity === 'warning');

  return (
    <form className="space-y-5" onSubmit={e => e.preventDefault()} aria-label="Step settings">
      {(err.length > 0 || warn.length > 0) && (
        <ul className="space-y-1" aria-label="Step issues">
          {[...err, ...warn].map((i, idx) => (
            <li key={idx} className={`flex items-start gap-1.5 text-xs rounded-lg px-2 py-1.5 ${i.severity === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" /> {i.message}
            </li>
          ))}
        </ul>
      )}

      <Section title="General">
        <div>
          <label htmlFor={`${p}-name`} className={labelCls}>Name</label>
          <input id={`${p}-name`} disabled={readOnly} value={step.name} onChange={e => patch({ name: e.target.value })} className={inputCls} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" disabled={readOnly} checked={step.isActive !== false} onChange={e => patch({ isActive: e.target.checked })} /> Active
        </label>
      </Section>

      {step.type === 'trigger' && step.trigger && (
        <>
          <Section title="Trigger">
            <div>
              <label htmlFor={`${p}-type`} className={labelCls}>Trigger type</label>
              <select id={`${p}-type`} disabled={readOnly} value={step.trigger.type} onChange={e => changeTriggerType(e.target.value)} className={inputCls}>
                {entryOptions(TRIGGER_ENTRIES)}
              </select>
              {triggerEntry && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{triggerEntry.description}</p>}
            </div>
            {visibleFields(triggerEntry, step.trigger.config as Record<string, any>).map(f => (
              <SchemaField key={f.key} field={f} config={step.trigger?.config as Record<string, any>} onSet={setTriggerConfig} steps={steps} stepId={step.id} stageOptions={stageOptions} disabled={readOnly} idPrefix={p} />
            ))}
          </Section>
          <Section title="Only when (optional)">
            <ConditionBuilder
              idPrefix={`${p}-tc`} steps={steps} stepId={step.id} disabled={readOnly}
              conditions={step.trigger.conditions ?? []}
              onChange={c => patch({ trigger: { ...(step.trigger as WorkflowTrigger), conditions: c.length ? c : undefined } })}
            />
          </Section>
        </>
      )}

      {step.type === 'action' && (
        <>
          <Section title="Action">
            <div>
              <label htmlFor={`${p}-type`} className={labelCls}>Action type</label>
              <select id={`${p}-type`} disabled={readOnly} value={step.action?.type ?? ''} onChange={e => changeActionType(e.target.value)} className={inputCls}>
                {!actionEntry && <option value="">{step.action?.type ? `${step.action.type} (unknown)` : 'Select…'}</option>}
                {entryOptions(ACTION_ENTRIES)}
              </select>
              {actionEntry && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{actionEntry.description}</p>}
            </div>
            {step.action && visibleFields(actionEntry, step.action.config as Record<string, any>).map(f => (
              <SchemaField key={f.key} field={f} config={step.action?.config as Record<string, any>} onSet={setActionConfig} steps={steps} stepId={step.id} stageOptions={stageOptions} disabled={readOnly} idPrefix={p} />
            ))}
          </Section>
          {step.action && (
            <>
              <Section title="Run only when (optional)">
                <ConditionBuilder
                  idPrefix={`${p}-ac`} steps={steps} stepId={step.id} disabled={readOnly}
                  conditions={step.action.conditions ?? []}
                  onChange={c => patch({ action: { ...(step.action as WorkflowAction), conditions: c.length ? c : undefined } })}
                />
              </Section>
              <Section title="Error handling">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox" disabled={readOnly} checked={Boolean(step.action.errorHandling?.continueOnError)}
                    onChange={e => patch({ action: { ...(step.action as WorkflowAction), errorHandling: { retryCount: step.action?.errorHandling?.retryCount, continueOnError: e.target.checked } } })}
                  /> Continue workflow if this step fails
                </label>
                <div>
                  <label htmlFor={`${p}-retry`} className={labelCls}>Retry count</label>
                  <input
                    id={`${p}-retry`} type="number" min={0} max={5} disabled={readOnly} className={inputCls}
                    value={step.action.errorHandling?.retryCount ?? 0}
                    onChange={e => patch({ action: { ...(step.action as WorkflowAction), errorHandling: { continueOnError: Boolean(step.action?.errorHandling?.continueOnError), retryCount: Math.max(0, Number(e.target.value) || 0) } } })}
                  />
                </div>
              </Section>
            </>
          )}
        </>
      )}

      {step.type === 'condition' && (
        <Section title="Condition">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Follows the True output when the condition matches, otherwise the False output.</p>
          <ConditionBuilder
            single idPrefix={`${p}-cond`} steps={steps} stepId={step.id} disabled={readOnly}
            conditions={step.condition ? [step.condition] : [{ id: newId('cond'), field: '', operator: 'equals', value: '' }]}
            onChange={c => patch({ condition: c[0] })}
          />
        </Section>
      )}

      {step.type === 'delay' && (
        <Section title="Delay">
          <div>
            <label htmlFor={`${p}-delay`} className={labelCls}>Wait (minutes)<span className="text-red-500"> *</span></label>
            <input id={`${p}-delay`} type="number" min={1} disabled={readOnly} value={step.delay ?? ''} onChange={e => patch({ delay: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputCls} />
          </div>
        </Section>
      )}
    </form>
  );
};

export default StepConfigForm;
