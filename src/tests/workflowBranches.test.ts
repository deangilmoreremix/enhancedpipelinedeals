import { runWorkflowGraph, type DbLike, type ServerStep, type StepContext } from '../../netlify/functions/_workflowSteps';
import { conditionTargets, iteratorTargets } from '../services/workflowBranching';

const db: DbLike = {
  from() {
    const chain: any = {
      insert() { return chain; }, select() { return chain; },
      single: async () => ({ data: { id: 'n1' }, error: null }),
      then(res: any) { return Promise.resolve({ data: [], error: null }).then(res); }
    };
    return chain;
  }
};

const ctx = (inputData: Record<string, any> = {}, over: Partial<StepContext> = {}): StepContext => ({
  recordId: 'deal-1', recordType: 'deal', inputData, variables: {}, ...over
});

const notify = (id: string, connections: string[] = []): ServerStep => ({
  id, type: 'action', action: { type: 'notification', config: { notificationMessage: `hi ${id}` } }, connections
});

const ran = (r: Awaited<ReturnType<typeof runWorkflowGraph>>) => r.steps.map(s => s.stepId);

describe('branch helpers', () => {
  it('conditionTargets: unlabelled follows only when true; labelled follow their branch', () => {
    expect(conditionTargets({ connections: ['a'] }, true)).toEqual(['a']);
    expect(conditionTargets({ connections: ['a'] }, false)).toEqual([]);
    const s = { connections: ['t', 'f'], connectionLabels: { t: 'true', f: 'false' } };
    expect(conditionTargets(s, true)).toEqual(['t']);
    expect(conditionTargets(s, false)).toEqual(['f']);
  });
  it('iteratorTargets: unlabelled = item', () => {
    expect(iteratorTargets({ connections: ['a', 'b'], connectionLabels: { b: 'done' } })).toEqual({ item: ['a'], done: ['b'] });
    expect(iteratorTargets({ connections: ['a'] })).toEqual({ item: ['a'], done: [] });
  });
});

describe('condition branches (server runner)', () => {
  const graph = (): ServerStep[] => [
    { id: 'trig', type: 'trigger', connections: ['cond'] },
    {
      id: 'cond', type: 'condition', condition: { field: 'value', operator: 'greater_than', value: 1000 },
      connections: ['yes', 'no'], connectionLabels: { yes: 'true', no: 'false' }
    },
    notify('yes'),
    notify('no')
  ];

  it('follows the true branch when the condition matches', async () => {
    const r = await runWorkflowGraph(graph(), ctx({ value: 5000 }), { db });
    expect(r.status).toBe('completed');
    expect(ran(r)).toEqual(['trig', 'cond', 'yes']);
  });

  it('follows the false branch when it does not match', async () => {
    const r = await runWorkflowGraph(graph(), ctx({ value: 10 }), { db });
    expect(r.status).toBe('completed');
    expect(ran(r)).toEqual(['trig', 'cond', 'no']);
  });

  it('legacy unlabelled connections: run when true, halt (not fail) when false', async () => {
    const legacy: ServerStep[] = [
      { id: 'trig', type: 'trigger', connections: ['cond'] },
      { id: 'cond', type: 'condition', condition: { field: 'value', operator: 'greater_than', value: 1000 }, connections: ['yes'] },
      notify('yes')
    ];
    expect(ran(await runWorkflowGraph(legacy, ctx({ value: 5000 }), { db }))).toEqual(['trig', 'cond', 'yes']);
    const halted = await runWorkflowGraph(legacy, ctx({ value: 1 }), { db });
    expect(halted.status).toBe('completed');
    expect(ran(halted)).toEqual(['trig', 'cond']);
  });

  it('exposes earlier step outputs to later steps as steps.<id>.output.*', async () => {
    const inserts: any[] = [];
    const recDb: DbLike = {
      from() {
        const chain: any = { insert(p: any) { inserts.push(p); return chain; }, select() { return chain; }, single: async () => ({ data: { id: 'n' }, error: null }) };
        return chain;
      }
    };
    const steps: ServerStep[] = [
      { id: 'cond', type: 'condition', condition: { field: 'value', operator: 'greater_than', value: 1 }, connections: ['n'] },
      { id: 'n', type: 'action', action: { type: 'notification', config: { notificationMessage: 'matched={{steps.cond.output.matched}}' } } }
    ];
    await runWorkflowGraph(steps, ctx({ value: 5 }), { db: recDb });
    expect(inserts[0].message).toBe('matched=true');
  });
});

describe('iterator branches (server runner)', () => {
  const records = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const graph = (labelled: boolean): ServerStep[] => [
    { id: 'trig', type: 'trigger', connections: ['it'] },
    {
      id: 'it', type: 'action', action: { type: 'iterator', config: { iteratorSource: 'records' } },
      connections: ['per', 'after'], connectionLabels: labelled ? { per: 'item', after: 'done' } : undefined
    },
    notify('per'),
    notify('after')
  ];

  it('runs Item per item and Done exactly once after the loop', async () => {
    const r = await runWorkflowGraph(graph(true), ctx({ records }), { db });
    expect(r.status).toBe('completed');
    expect(ran(r).filter(s => s === 'per')).toHaveLength(3);
    expect(ran(r).filter(s => s === 'after')).toHaveLength(1);
    expect(ran(r).lastIndexOf('per')).toBeLessThan(ran(r).indexOf('after'));
  });

  it('unlabelled connections stay per item (legacy)', async () => {
    const r = await runWorkflowGraph(graph(false), ctx({ records }), { db });
    expect(ran(r).filter(s => s === 'per')).toHaveLength(3);
    expect(ran(r).filter(s => s === 'after')).toHaveLength(3);
  });
});
