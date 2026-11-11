import * as B from '../lib/board.mjs';
import { defaultSeed } from '../lib/fakeSupabase.mjs';
const VP = { width: 1700, height: 1300 };
const nodes = (page) => page.locator('.react-flow__node');
const edges = (page) => page.locator('.react-flow__edge');
const pick = (page, label) => page.locator('aside, div').getByRole('button', { name: new RegExp('^' + label) }).first();

function seededWorkflowSeed() {
  const seed = defaultSeed();
  const now = new Date().toISOString();
  seed.deal_workflows = [{ id: 'f0000000-0000-4000-8000-000000000001', name: 'Seed WF', description: 'seeded', category: 'custom', is_active: true, version: 1, created_at: now, updated_at: now,
    stages: [
      { id: 't1', name: 'Stage changed', type: 'trigger', position: { x: 100, y: 40 }, connections: ['a1'], isActive: true, trigger: { id: 'tr', type: 'stage_changed', name: 'Stage changed', description: '', config: {} } },
      { id: 'a1', name: 'Create task', type: 'action', position: { x: 100, y: 220 }, connections: [], isActive: true, action: { id: 'ac', type: 'create_task', name: 'Create task', description: '', config: {} } },
    ], triggers: [], settings: null, metadata: null }];
  const ex = (id, status, err) => ({ id, workflow_id: seed.deal_workflows[0].id, trigger_type: 'stage_changed', status, started_at: now, completed_at: now, duration: 1234, context: { recordId: '00000000-0000-4000-8000-000000000001', recordType: 'deal' }, logs: [],
    steps: [{ id: id + 's1', stepId: 't1', status: 'completed', duration: 10, output: { ok: true } }, { id: id + 's2', stepId: 'a1', status: status === 'failed' ? 'failed' : 'completed', duration: 20, error: err }], error_message: err || null, error_step_id: err ? 'a1' : null });
  seed.workflow_executions = [ex('e0000000-0000-4000-8000-000000000001', 'completed'), ex('e0000000-0000-4000-8000-000000000002', 'failed', 'boom: task creation failed')];
  return seed;
}

export default [{
  id: 'F', name: 'Analytics + workflows', async run(ctx) {
    await ctx.step('analytics page: charts render, headline totals match board', async () => {
      const fake = ctx.fake(); const { page, context, log, shot } = await ctx.page({ fake, viewport: VP });
      await B.openBoard(page);
      const st = await B.dealsState(page);
      const lostKeys = new Set((await B.stagesState(page)).filter(x => x.isLost).map(x => x.key));
      const open = st.filter(d => !lostKeys.has(d.stage)); // headline excludes lost stages
      const total = open.reduce((s, d) => s + d.value, 0);
      await page.goto('/analytics'); await page.waitForTimeout(2500);
      await shot('analytics');
      for (const t of ['value-by-stage-chart', 'funnel-chart', 'forecast-chart', 'win-rate-gauge', 'time-in-stage-chart', 'group-aggregate-chart']) {
        const el = page.getByTestId(t);
        ctx.check(await el.count() > 0, `chart ${t} present`);
        if (await el.count()) ctx.check(await el.first().locator('svg, li, canvas').count() > 0, `chart ${t} has content`);
      }
      const txt = await page.locator('body').innerText();
      const m = txt.match(/Pipeline value\s*\n\s*\$([\d.,]+)(K|M)?/);
      ctx.check(!!m, 'analytics headline pipeline value present');
      if (m) {
        const v = Number(m[1].replace(/,/g, '')) * (m[2] === 'K' ? 1e3 : m[2] === 'M' ? 1e6 : 1);
        ctx.check(Math.abs(v - total) / total < 0.01, `analytics pipeline value ${v} ~= board total ${total}`);
      }
      const dealsM = txt.match(/Pipeline value[\s\S]{0,40}?(\d+) deals/);
      ctx.check(dealsM && Number(dealsM[1]) === open.length, `analytics deal count ${dealsM && dealsM[1]} = board non-lost ${open.length}`);
      await page.getByLabel('Date range').selectOption({ index: 0 }); await page.waitForTimeout(600);
      ctx.check(await page.getByText(/Component Error|Something went wrong/).count() === 0, 'date range change does not crash');
      ctx.check(ctx.errs(log).filter(e => !/Failed to fetch/.test(e)).length === 0, 'no errors on analytics: ' + ctx.errs(log).find(e => !/Failed to fetch/.test(e)));
      await context.close();
    });

    await ctx.step('workflow canvas: add steps, connect, branches, move, undo/redo, auto-layout', async () => {
      const fake = ctx.fake(); const { page, context, log, shot } = await ctx.page({ fake, viewport: VP });
      await page.goto('/workflows'); await page.waitForTimeout(1500);
      await page.getByRole('button', { name: /New Workflow|Create Workflow/ }).first().click();
      await page.getByLabel('Search steps').waitFor();
      await pick(page, 'Stage changed').click(); await page.waitForTimeout(400);
      ctx.check(await nodes(page).count() === 1, 'trigger node added via StepPicker');
      await pick(page, 'Condition').click(); await page.waitForTimeout(400);
      await pick(page, 'Create task').click(); await page.waitForTimeout(400);
      ctx.check(await nodes(page).count() === 3, 'condition + action added: ' + await nodes(page).count());
      await shot('canvas-3-nodes');
      let e = await edges(page).count();
      ctx.notes.push(`edges after adding 3 steps via picker: ${e} (auto-connect ${e > 0 ? 'on' : 'off'})`);
      // connect by dragging handles: node i source handle -> node i+1 target handle, only if missing
      const hasEdge = async (i, j) => { const ids = await nodes(page).evaluateAll(a => a.map(n => n.getAttribute('data-id'))); return (await edges(page).evaluateAll((es, [s, t]) => es.some(e => (e.getAttribute('data-id') || '').includes(s) && (e.getAttribute('data-id') || '').includes(t)), [ids[i], ids[j]])); };
      const connect = async (i, j, srcSel = '.source') => {
        const a = nodes(page).nth(i).locator('.react-flow__handle' + srcSel).first();
        const b = nodes(page).nth(j).locator('.react-flow__handle.target').first();
        const ab = await a.boundingBox(), bb = await b.boundingBox();
        if (!ab || !bb) throw new Error('handle not found');
        await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2); await page.mouse.down();
        await page.mouse.move((ab.x + bb.x) / 2, (ab.y + bb.y) / 2, { steps: 6 }); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400);
      };
      // auto-connect links trigger -> condition; connect condition(True) -> action and trigger -> action by hand
      ctx.check(await hasEdge(0, 1), 'picker auto-connects trigger -> condition');
      const before = await edges(page).count();
      if (!(await hasEdge(0, 2))) await connect(0, 2);
      ctx.check(await edges(page).count() > before || await hasEdge(0, 2), 'handle drag creates an edge trigger -> action');
      await shot('canvas-connected');
      const condTxt = await nodes(page).nth(1).innerText();
      ctx.check(/true/i.test(condTxt) && /false/i.test(condTxt), 'condition node shows True / False branch outputs: ' + condTxt.replace(/\n/g, ' '));
      // move node
      const n0 = nodes(page).nth(2); const b0 = await n0.boundingBox();
      await page.mouse.move(b0.x + b0.width / 2, b0.y + 12); await page.mouse.down(); await page.mouse.move(b0.x + b0.width / 2 + 160, b0.y + 12 - 40, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
      const b1 = await nodes(page).nth(2).boundingBox();
      ctx.check(Math.abs(b1.x - b0.x) > 60, `node dragged (dx=${Math.round(b1.x - b0.x)})`);
      // undo / redo
      const undo = page.getByLabel('Undo'), redo = page.getByLabel('Redo');
      ctx.check(await undo.isEnabled(), 'undo enabled after edits');
      await undo.click(); await page.waitForTimeout(300);
      const b2b = await nodes(page).nth(2).boundingBox();
      ctx.check(Math.abs(b2b.x - b0.x) < Math.abs(b1.x - b0.x), 'undo reverts the move');
      await redo.click(); await page.waitForTimeout(300);
      ctx.check(await redo.isDisabled(), 'redo consumed');
      // auto layout
      const pre = await nodes(page).evaluateAll(a => a.map(n => n.style.transform));
      await page.getByRole('button', { name: /Auto layout/ }).click(); await page.waitForTimeout(500);
      const post = await nodes(page).evaluateAll(a => a.map(n => n.style.transform));
      ctx.check(JSON.stringify(pre) !== JSON.stringify(post), 'auto-layout repositions nodes');
      await shot('canvas-autolayout');
      ctx.check(ctx.errs(log).filter(e => !/Failed to fetch/.test(e)).length === 0, 'no errors on canvas: ' + ctx.errs(log).find(e => !/Failed to fetch/.test(e)));
      await context.close();
    });

    await ctx.step('validation blocks save; valid workflow saves and persists across reload', async () => {
      if (ctx.mode !== 'fake') { ctx.skip('workflows have no demo-mode persistence (deal_workflows needs Supabase): covered in fake mode'); return; }
      const fake = ctx.fake(); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
      await page.goto('/workflows'); await page.waitForTimeout(1500);
      await page.getByRole('button', { name: /New Workflow|Create Workflow/ }).first().click();
      await page.getByLabel('Search steps').waitFor();
      await pick(page, 'Create task').click(); await page.waitForTimeout(400); // no trigger
      await shot('validation');
      const save = page.getByRole('button', { name: /^Save$/ });
      ctx.check(await page.getByRole('status', { name: 'Validation' }).count() > 0, 'validation banner shown for trigger-less workflow');
      ctx.check(await save.isDisabled(), 'Save disabled while validation errors exist');
      // fix: add a trigger and connect
      await pick(page, 'Stage changed').click(); await page.waitForTimeout(400);
      // connect trigger (node index 1) -> task (node 0)
      const a = nodes(page).nth(1).locator('.react-flow__handle.source').first(), b = nodes(page).nth(0).locator('.react-flow__handle.target').first();
      if (await edges(page).count() === 0) {
        const ab = await a.boundingBox(), bb = await b.boundingBox();
        await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + 5, bb.y + 5, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(400);
      }
      await nodes(page).nth(0).click({ position: { x: 20, y: 10 } }); await page.waitForTimeout(300);
      await page.getByLabel(/^Title/).first().fill('Follow up').catch(async () => { await page.locator('aside[aria-label="Step properties"] input[type=text], aside[aria-label="Step properties"] input:not([type])').nth(1).fill('Follow up'); });
      await page.getByLabel('Workflow name').fill('E2E Saved Workflow');
      await page.waitForTimeout(300);
      if (await save.isDisabled()) { await shot('still-blocked'); ctx.notes.push('Save still disabled after trigger+edge: ' + (await page.getByRole('status', { name: 'Validation' }).innerText().catch(() => ''))); }
      await save.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1200);
      const rows = fake.table('deal_workflows');
      ctx.check(rows.length === 1 && rows[0].name === 'E2E Saved Workflow', 'fake DB has the saved workflow: ' + JSON.stringify(rows.map(r => r.name)));
      if (rows[0]) {
        const stg = rows[0].stages || [];
        ctx.check(stg.length === 2 && stg.every(s => s.position && typeof s.position.x === 'number'), 'saved steps carry positions: ' + stg.length);
        ctx.check(stg.some(s => (s.connections || []).length > 0), 'saved steps carry connections');
      }
      await page.goto('/workflows'); await page.waitForTimeout(2000);
      ctx.check(await page.getByText('E2E Saved Workflow').count() > 0, 'workflow listed after reload');
      await page.getByRole('button', { name: /Edit/ }).first().click(); await page.waitForTimeout(1200);
      ctx.check(await nodes(page).count() === 2, 'reopened workflow shows 2 nodes: ' + await nodes(page).count());
      ctx.check(await edges(page).count() >= 1, 'reopened workflow keeps its edge');
      await shot('reopened');
      await context.close();
    });

    await ctx.step('run history list + detail overlay with seeded runs', async () => {
      if (ctx.mode !== 'fake') { ctx.skip('run history reads workflow_run_history (Supabase only): covered in fake mode'); return; }
      const fake = ctx.fake(seededWorkflowSeed()); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
      await page.goto('/workflows'); await page.waitForTimeout(1500);
      await page.getByRole('tab', { name: /^Executions/ }).click(); await page.waitForTimeout(1500);
      await shot('runs-list');
      const txt = await page.locator('body').innerText();
      ctx.check(/failed/i.test(txt) && /completed/i.test(txt), 'run history lists completed + failed seeded runs');
      await page.getByText('boom: task creation failed').first().click().catch(async () => { await page.getByText('Seed WF').first().click(); });
      await page.waitForTimeout(1500);
      await shot('run-detail');
      ctx.check(await page.getByLabel('Workflow run detail').count() > 0 || /Back to run history/.test(await page.locator('body').innerText()), 'run detail opens');
      ctx.check(await page.locator('.react-flow__node').count() >= 1, 'run detail shows the diagram with step nodes: ' + await page.locator('.react-flow__node').count());
      ctx.check(/boom|failed/i.test(await page.locator('body').innerText()), 'failed step error/status visible in overlay');
      await context.close();
    });
  }
}];
