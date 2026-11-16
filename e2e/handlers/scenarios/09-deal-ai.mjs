import { assert, callV1 } from '../lib/util.mjs';
import { lintStrictSchema } from '../lib/schemaLint.mjs';

export const label = 'ai-gateway deal tasks (deal_assistant, deal_goals)';

export default async function ({ t, openai, supa, loadFunction }) {
  const { handler, TASKS } = await loadFunction('ai-gateway');
  const call = (body, o = {}) => callV1(handler, { body, ...o });
  const lastResp = () => openai.last('/v1/responses').body;

  await t('deal_assistant and deal_goals are registered with strict structured-output schemas', async () => {
    for (const k of ['deal_assistant', 'deal_goals']) {
      assert.ok(TASKS[k], `${k} missing`);
      assert.ok(TASKS[k].schema, `${k} has no schema`);
      assert.deepEqual(lintStrictSchema(TASKS[k].schema.schema), []);
    }
  });

  await t('deal_assistant schema: reply + suggestions[{id,kind,title,rationale,field,value}] with a kind enum and nullable field/value', async () => {
    const s = TASKS.deal_assistant.schema.schema;
    assert.deepEqual(Object.keys(s.properties).sort(), ['reply', 'suggestions']);
    const item = s.properties.suggestions.items;
    assert.deepEqual(Object.keys(item.properties).sort(), ['field', 'id', 'kind', 'rationale', 'title', 'value']);
    assert.deepEqual(item.properties.kind.enum, ['field_edit', 'next_step']);
    assert.deepEqual(item.properties.field.type, ['string', 'null']);
    assert.deepEqual(item.properties.value.type, ['string', 'null']);
  });

  await t('deal_assistant: loads the deal as the caller, grounds the prompt, returns structured data (never writes)', async () => {
    supa.reset({
      contacts: [{ id: 'c1', name: 'Grace Hopper', company: 'Navy' }],
      deals: [{ id: 'd1', title: 'Compiler deal', value: 5000, stage: 'proposal', contact_id: 'c1' }],
    });
    const n0 = supa.log.length;
    const r = await call({ task: 'deal_assistant', dealId: 'd1', input: 'Latest user message: what next?\n\nRespond as JSON.', context: { deal_snapshot: { id: 'd1', title: 'Compiler deal' } } });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json.task, 'deal_assistant');
    assert.ok(r.json.data && typeof r.json.data.reply === 'string', 'reply');
    assert.ok(Array.isArray(r.json.data.suggestions), 'suggestions array');
    const req = lastResp();
    assert.equal(req.text.format.type, 'json_schema');
    assert.equal(req.text.format.strict, true);
    assert.equal(req.text.format.name, 'deal_assistant');
    assert.ok(String(req.input).includes('Compiler deal') && String(req.input).includes('Grace Hopper'), 'deal + contact grounded');
    assert.ok(req.instructions.includes('field_edit') && req.instructions.includes('Never propose a stage change'), 'instructions restrict edits');
    const writes = supa.log.slice(n0).filter((l) => l.method !== 'GET');
    assert.deepEqual(writes, [], 'the gateway never writes CRM rows for the assistant');
  });

  await t('deal_assistant keeps a snapshot context for unsaved deals (no dealId)', async () => {
    const r = await call({ task: 'deal_assistant', input: 'hi (JSON)', context: { deal_snapshot: { title: 'Local deal' } } });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(String(lastResp().input).includes('Local deal'));
  });

  await t('deal-assistant / deal-goals aliases resolve', async () => {
    assert.equal((await call({ task: 'deal-assistant', input: 'x (JSON)' })).json.task, 'deal_assistant');
    assert.equal((await call({ task: 'deal-goals', input: 'x (JSON)' })).json.task, 'deal_goals');
  });

  await t('deal_goals: fast tier, goals[{title,rationale}], contact + deal context', async () => {
    supa.reset({ contacts: [{ id: 'c1', name: 'Ada' }], deals: [{ id: 'd1', title: 'Engine deal', contact_id: 'c1' }] });
    const r = await call({ task: 'deal_goals', dealId: 'd1', input: 'Generate goals. Respond in JSON.', context: { entityType: 'deal' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(Array.isArray(r.json.data.goals));
    const req = lastResp();
    assert.equal(req.model, 'gpt-6-luna');
    assert.equal(req.text.format.name, 'deal_goals');
    assert.ok(String(req.input).includes('Engine deal'));
    const item = TASKS.deal_goals.schema.schema.properties.goals.items;
    assert.deepEqual(Object.keys(item.properties).sort(), ['rationale', 'title']);
  });

  await t('stream:true on a structured task still returns the JSON envelope (structured tasks are not streamed)', async () => {
    const r = await call({ task: 'deal_assistant', stream: true, input: 'x (JSON)' });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(r.json && r.json.ok === true && r.json.data);
  });

  await t('unauthenticated deal_assistant -> 401', async () => {
    assert.equal((await call({ task: 'deal_assistant', input: 'x' }, { token: null })).statusCode, 401);
  });
}
