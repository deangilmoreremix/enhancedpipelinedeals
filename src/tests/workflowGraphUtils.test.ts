import type { WorkflowStep } from '../types/workflow';
import { validateWorkflow, findCycleSteps } from '../components/workflows/workflowValidation';
import { autoLayout } from '../components/workflows/autoLayout';
import {
  appendAfter, connectSteps, createStepFromEntry, disconnectSteps, handleForConnection, insertOnEdge, removeSteps, withDerivedTriggers
} from '../components/workflows/workflowGraph';
import { ACTION_ENTRIES, CONDITION_ENTRY, TRIGGER_ENTRIES } from '../services/workflowActionRegistry';

const base = (id: string, type: WorkflowStep['type'], extra: Partial<WorkflowStep> = {}): WorkflowStep => ({
  id, name: id, type, position: { x: 0, y: 0 }, connections: [], isActive: true, ...extra
});
const trigger = (id = 't', connections: string[] = []) =>
  base(id, 'trigger', { connections, trigger: { id: `${id}-t`, type: 'record_created', name: 'T', description: '', config: {}, isActive: true } });
const action = (id: string, type: string, config: Record<string, any> = {}, connections: string[] = [], extra: Partial<WorkflowStep> = {}) =>
  base(id, 'action', { connections, action: { id: `${id}-a`, type: type as any, name: id, description: '', config }, ...extra });
const cond = (id: string, connections: string[] = [], labels?: WorkflowStep['connectionLabels']) =>
  base(id, 'condition', { connections, connectionLabels: labels, condition: { id: `${id}-c`, field: 'value', operator: 'equals', value: 1 } });

const codes = (steps: WorkflowStep[], opts = {}) => validateWorkflow(steps, opts).issues.map(i => `${i.severity}:${i.code}${i.stepId ? `@${i.stepId}` : ''}`);

describe('validateWorkflow', () => {
  it('accepts a valid trigger -> action chain', () => {
    const v = validateWorkflow([trigger('t', ['a']), action('a', 'notification', { notificationMessage: 'hi' })]);
    expect(v.issues).toEqual([]);
    expect(v.hasErrors).toBe(false);
  });

  it('errors on a missing trigger (warning for legacy workflows with triggers)', () => {
    const steps = [action('a', 'notification', { notificationMessage: 'x' })];
    expect(codes(steps)).toContain('error:missing_trigger');
    expect(codes(steps, { legacyTriggers: true })).toContain('warning:missing_trigger');
    expect(validateWorkflow([]).issues).toEqual([]);
  });

  it('errors on duplicate triggers', () => {
    const v = validateWorkflow([trigger('t1'), trigger('t2')]);
    expect(v.errors.filter(e => e.code === 'duplicate_trigger')).toHaveLength(2);
    expect(v.hasErrors).toBe(true);
  });

  it('warns about unreachable steps', () => {
    const v = validateWorkflow([trigger('t', ['a']), action('a', 'notification', { notificationMessage: 'x' }), action('orphan', 'notification', { notificationMessage: 'x' })]);
    expect(v.byStep.orphan?.map(i => i.code)).toEqual(['unreachable']);
    expect(v.hasErrors).toBe(false);
  });

  it('detects cycles as errors', () => {
    const steps = [trigger('t', ['a']), action('a', 'notification', { notificationMessage: 'x' }, ['b']), action('b', 'notification', { notificationMessage: 'x' }, ['a'])];
    expect([...findCycleSteps(steps)].sort()).toEqual(['a', 'b']);
    expect(validateWorkflow(steps).errors.map(e => e.code)).toContain('cycle');
  });

  it('flags missing required config and unknown action types', () => {
    const v = validateWorkflow([trigger('t', ['a', 'b']), action('a', 'send_email', { subject: 's' }), action('b', 'does_not_exist')]);
    expect(v.byStep.a.map(i => i.message)).toEqual(['Body is required.']);
    expect(v.byStep.b[0].code).toBe('unknown_type');
  });

  it('warns (not errors) when a condition lacks a branch, and when an action is browser-only', () => {
    const steps = [trigger('t', ['c']), cond('c', ['x'], { x: 'true' }), action('x', 'code', { codeSnippet: '1' })];
    const v = validateWorkflow(steps);
    expect(v.byStep.c.map(i => `${i.severity}:${i.code}`)).toEqual(['warning:condition_branch']);
    expect(v.byStep.x.map(i => `${i.severity}:${i.code}`)).toEqual(['warning:engine_support']);
    expect(v.hasErrors).toBe(false);
  });

  it('requires a positive delay and a condition field', () => {
    const v = validateWorkflow([trigger('t', ['d', 'c']), base('d', 'delay', { delay: 0 }), { ...cond('c'), condition: { id: 'x', field: '', operator: 'equals', value: '' } }]);
    expect(v.errors.map(e => e.stepId).sort()).toEqual(['c', 'd']);
  });

  it('reports dangling connections', () => {
    expect(codes([trigger('t', ['ghost'])])).toContain('error:dangling@t');
  });
});

describe('autoLayout', () => {
  it('places steps in top-down layers by depth, without overlap', () => {
    const steps = [trigger('t', ['c']), cond('c', ['a', 'b']), action('a', 'notification', {}, ['end']), action('b', 'notification', {}, ['end']), action('end', 'notification')];
    const out = autoLayout(steps);
    const pos = Object.fromEntries(out.map(s => [s.id, s.position]));
    expect(pos.t.y).toBeLessThan(pos.c.y);
    expect(pos.c.y).toBeLessThan(pos.a.y);
    expect(pos.a.y).toBe(pos.b.y);
    expect(pos.a.x).not.toBe(pos.b.x);
    expect(pos.end.y).toBeGreaterThan(pos.a.y);
    // does not mutate input or other fields
    expect(steps[0].position).toEqual({ x: 0, y: 0 });
    expect(out.map(s => s.connections)).toEqual(steps.map(s => s.connections));
  });

  it('terminates on cycles and handles empty input', () => {
    const cyc = [action('a', 'notification', {}, ['b']), action('b', 'notification', {}, ['a'])];
    expect(autoLayout(cyc)).toHaveLength(2);
    expect(autoLayout([])).toEqual([]);
  });
});

describe('graph operations', () => {
  it('connects with branch labels and disconnects', () => {
    let steps = [cond('c'), action('a', 'notification'), action('b', 'notification')];
    steps = connectSteps(steps, 'c', 'a', 'true');
    steps = connectSteps(steps, 'c', 'b', 'false');
    expect(steps[0].connections).toEqual(['a', 'b']);
    expect(steps[0].connectionLabels).toEqual({ a: 'true', b: 'false' });
    expect(handleForConnection(steps[0], 'b')).toBe('false');
    steps = disconnectSteps(steps, 'c', 'b');
    expect(steps[0].connections).toEqual(['a']);
    expect(steps[0].connectionLabels).toEqual({ a: 'true' });
  });

  it('refuses self-loops and connections into a trigger', () => {
    const steps = [trigger('t'), action('a', 'notification')];
    expect(connectSteps(steps, 'a', 'a', 'out')).toBe(steps);
    expect(connectSteps(steps, 'a', 't', 'out')).toBe(steps);
  });

  it('removes steps and their inbound connections/labels', () => {
    const steps = removeSteps([cond('c', ['a', 'b'], { a: 'true', b: 'false' }), action('a', 'notification'), action('b', 'notification')], ['a']);
    expect(steps.map(s => s.id)).toEqual(['c', 'b']);
    expect(steps[0].connections).toEqual(['b']);
    expect(steps[0].connectionLabels).toEqual({ b: 'false' });
  });

  it('inserts a step on an edge keeping the branch label', () => {
    const steps = [cond('c', ['b'], { b: 'false' }), action('b', 'notification')];
    const mid = action('m', 'notification');
    const out = insertOnEdge(steps, 'c', 'b', mid);
    expect(out.find(s => s.id === 'c')?.connections).toEqual(['m']);
    expect(out.find(s => s.id === 'c')?.connectionLabels).toEqual({ m: 'false' });
    expect(out.find(s => s.id === 'm')?.connections).toEqual(['b']);
  });

  it('appends after a handle', () => {
    const out = appendAfter([action('a', 'notification')], 'a', 'out', action('n', 'notification'));
    expect(out[0].connections).toEqual(['n']);
  });

  it('creates well-formed steps for every registry entry (no unknown types, no origin drops)', () => {
    for (const e of [...TRIGGER_ENTRIES, CONDITION_ENTRY, ...ACTION_ENTRIES]) {
      const s = createStepFromEntry(e, { x: 40, y: 80 });
      expect(s.position).toEqual({ x: 40, y: 80 });
      if (e.category === 'Triggers') expect(s.trigger?.type).toBe(e.key);
      else if (e.key === 'condition') expect(s.type).toBe('condition');
      else if (e.key === 'delay') expect(s.type).toBe('delay');
      else { expect(s.type).toBe('action'); expect(s.action?.type).toBe(e.key); }
    }
    // the webhook *action* must not become a trigger
    const hook = ACTION_ENTRIES.find(e => e.key === 'webhook');
    expect(createStepFromEntry(hook!, { x: 0, y: 0 }).type).toBe('action');
  });

  it('mirrors trigger steps into workflow.triggers', () => {
    const wf = { triggers: [], steps: [] } as any;
    expect(withDerivedTriggers(wf, [trigger('t')]).triggers).toHaveLength(1);
    const legacy = { triggers: [{ id: 'old' }], steps: [] } as any;
    expect(withDerivedTriggers(legacy, [action('a', 'notification')]).triggers).toEqual([{ id: 'old' }]);
  });
});
