import { entryRef, ACTION_ENTRIES, ALL_ENTRIES, TRIGGER_ENTRIES, getConfigValue, serverActionKeys, setConfigValue, visibleFields, missingRequired, getActionEntry, variableToken } from '../services/workflowActionRegistry';
import { EVENT_TO_TRIGGER } from '../services/workflowTriggerMatch';
import { HANDLED_ACTION_KEYS, executeAction, interpolate, type DbLike, type StepContext } from '../../netlify/functions/_workflowSteps';
import type { ActionType, TriggerType } from '../types/workflow';

const noopDb: DbLike = {
  from() {
    const chain: any = {
      insert() { return chain; }, update() { return chain; }, delete() { return chain; }, select() { return chain; },
      eq() { return chain; }, limit() { return chain; },
      single: async () => ({ data: { id: 'x' }, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then(res: any) { return Promise.resolve({ data: [], error: null }).then(res); }
    };
    return chain;
  }
};

describe('workflow action registry', () => {
  it('has unique keys with required metadata', () => {
    const refs = ALL_ENTRIES.map(entryRef);
    expect(new Set(refs).size).toBe(refs.length);
    for (const e of ALL_ENTRIES) {
      expect(e.label).toBeTruthy();
      expect(e.icon).toBeTruthy();
      expect(e.category).toBeTruthy();
      expect(typeof e.engines.server).toBe('boolean');
      expect(typeof e.engines.client).toBe('boolean');
    }
  });

  it('covers every trigger type', () => {
    const all: TriggerType[] = ['record_created', 'record_updated', 'record_deleted', 'stage_changed', 'field_changed', 'scheduled', 'manual', 'webhook', 'sla_breach', 'milestone_reached'];
    expect(TRIGGER_ENTRIES.map(t => t.key).sort()).toEqual([...all].sort());
  });

  it('marks as server-capable every trigger the runner can match', () => {
    const matched = new Set(Object.values(EVENT_TO_TRIGGER));
    for (const t of TRIGGER_ENTRIES) expect(t.engines.server).toBe(matched.has(t.key));
  });

  it('covers the required actions', () => {
    const required: ActionType[] = ['create_task', 'create_note', 'add_comment', 'update_record', 'update_stage', 'assign_owner', 'create_record', 'search_records', 'send_email', 'notification', 'http_request', 'webhook', 'ai_agent', 'filter', 'delay', 'iterator', 'code', 'delete_record', 'upsert_record'];
    const have = ACTION_ENTRIES.map(a => a.key);
    for (const r of required) expect(have).toContain(r);
    expect(getActionEntry('code')?.engines).toEqual({ server: false, client: true });
  });

  describe('parity with the server executor', () => {
    it('every registry action marked server:true is handled, and nothing handled is missing from the registry', () => {
      expect([...serverActionKeys()].sort()).toEqual([...HANDLED_ACTION_KEYS].sort());
    });

    it.each(HANDLED_ACTION_KEYS.map(k => [k]))('executeAction handles "%s" (never "Unsupported action type")', async key => {
      const ctx: StepContext = { recordId: 'deal-1', recordType: 'deal', inputData: {}, variables: {} };
      const result = await executeAction({ type: key, config: {} }, ctx, { db: noopDb, ai: async () => 'ok' });
      expect(result.error ?? '').not.toMatch(/Unsupported action type/);
    });

    it('rejects actions that are not server-capable', async () => {
      const ctx: StepContext = { recordId: 'deal-1', recordType: 'deal', inputData: {}, variables: {} };
      const result = await executeAction({ type: 'code', config: {} }, ctx, { db: noopDb });
      expect(result.success).toBe(false);
    });
  });

  describe('config helpers', () => {
    it('reads and writes dotted keys immutably', () => {
      const base = { fields: { title: 'a' } };
      const next = setConfigValue(base, 'fields.notes', 'n');
      expect(next).toEqual({ fields: { title: 'a', notes: 'n' } });
      expect(base).toEqual({ fields: { title: 'a' } });
      expect(getConfigValue(next, 'fields.title')).toBe('a');
      expect(setConfigValue(next, 'fields.notes', '')).toEqual({ fields: { title: 'a' } });
    });

    it('honours showWhen and reports missing required fields', () => {
      const http = getActionEntry('http_request');
      expect(visibleFields(http, { httpMethod: 'GET' }).map(f => f.key)).not.toContain('httpBody');
      expect(visibleFields(http, { httpMethod: 'POST' }).map(f => f.key)).toContain('httpBody');
      expect(missingRequired(http, {}).map(f => f.key)).toEqual(['httpUrl']);
      expect(missingRequired(http, { httpUrl: 'https://x.test' })).toEqual([]);
    });
  });

  describe('variable tokens', () => {
    it('match what interpolate() resolves on the server', () => {
      const ctx: StepContext = {
        recordId: 'd1', recordType: 'deal',
        inputData: { record: { title: 'Acme' }, from: 'a', to: 'b' },
        variables: { aiResult: 'hello' },
        stepOutputs: { s1: { output: { text: 'T' } } }
      };
      const out = interpolate(
        [variableToken('record.title'), variableToken('trigger.to'), variableToken('steps.s1.output.text'), variableToken('recordId'), variableToken('aiResult')].join('|'),
        ctx
      );
      expect(out).toBe('Acme|b|T|d1|hello');
    });
  });
});
