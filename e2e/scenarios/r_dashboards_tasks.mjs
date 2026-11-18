import * as B from '../lib/board.mjs';
import { DEFAULT_USER } from '../lib/browser.mjs';
import { defaultSeed } from '../lib/fakeSupabase.mjs';

// Analytics > Dashboards widget builder and the Tasks page (board / list / calendar), demo + strict fake.
const VP = { width: 1600, height: 1300 };
const day = (n, h = 9) => { const d = new Date(); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString(); };
const TASK = (n, title, status, assignee, due, deal) => ({
  id: `7a000000-0000-4000-8000-00000000000${n}`, title, status, assignee_id: assignee, due_date: due, deal_id: deal, board_position: 0, notes: null,
  created_at: new Date(Date.now() - n * 3600e3).toISOString(), updated_at: new Date().toISOString(),
});
const ME = DEFAULT_USER.id;
const seedWithTasks = (dealId) => {
  const s = defaultSeed();
  s.tasks = [
    TASK(1, 'Send proposal', 'todo', ME, day(2), dealId), TASK(2, 'Prepare redlines', 'todo', ME, day(-2), dealId),
    TASK(3, 'Security review', 'todo', null, null, null), TASK(4, 'Procurement follow up', 'in_progress', ME, day(0), dealId),
    TASK(5, 'Demo setup', 'in_progress', 'a0000000-0000-4000-8000-000000000002', day(3), null), TASK(6, 'Kickoff notes', 'done', ME, day(-4), dealId),
  ];
  return s;
};
// demo mode seeds 8 tasks, 4 of them assigned to the stand-in current user ("You")
const MINE = () => 4;

/** Real mouse drag from the centre of `from` to the centre of `to` (cards/chips are small, so no top offset). */
async function drag(page, from, to) {
  const a = await from.boundingBox(); const b = await to.boundingBox();
  if (!a || !b) throw new Error('drag: missing bounding box');
  const sx = a.x + a.width / 2, sy = a.y + a.height / 2, tx = b.x + b.width / 2, ty = b.y + Math.min(b.height / 2, 60);
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.waitForTimeout(120);
  await page.mouse.move(sx + 10, sy + 10, { steps: 4 }); await page.waitForTimeout(120);
  for (let i = 1; i <= 18; i++) { await page.mouse.move(sx + (tx - sx) * i / 18, sy + (ty - sy) * i / 18); await page.waitForTimeout(25); }
  await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(700);
}

export default [{
  id: 'R', name: 'Dashboards and Tasks', async run(ctx) {
    const dealId = ctx.ids.deal;
    const open = async (route) => {
      const fake = ctx.fake(seedWithTasks(dealId)); const p = await ctx.page({ fake, viewport: VP });
      await p.page.goto(route);
      await p.page.waitForFunction(() => !!window.__e2e, null, { timeout: 15000 });
      return { ...p, fake };
    };
    const openTasks = async () => {
      const p = await open('/tasks');
      await p.page.locator('[data-task-id]').first().waitFor({ timeout: 15000 });
      return p;
    };
    const cardsIn = (page, status) => page.locator(`[data-column-status="${status}"] [data-testid="task-card"]`);

    await ctx.step('dashboards: create, add a bar widget by stage and a number widget; values match the board', async () => {
      const { page, context, fake, log, shot } = await open('/analytics');
      await page.getByRole('tab', { name: 'Dashboards' }).click();
      await page.getByRole('button', { name: /Create dashboard/ }).click();
      await page.getByLabel('Dashboard name').fill('Exec view');
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await page.getByRole('combobox', { name: 'Dashboard' }).waitFor({ timeout: 8000 });

      await page.getByRole('button', { name: /Add widget/ }).click();
      let dlg = page.getByRole('dialog');
      await dlg.getByLabel('Widget title').fill('Deals by stage');
      await dlg.getByRole('button', { name: 'Add widget' }).click();
      await page.getByRole('region', { name: 'Widget: Deals by stage' }).waitFor({ timeout: 8000 });

      await page.getByRole('button', { name: /Add widget/ }).click();
      dlg = page.getByRole('dialog');
      await dlg.getByLabel('Chart type').selectOption('number');
      await dlg.getByLabel('Measure').selectOption('sum');
      await dlg.getByLabel('Widget title').fill('Pipeline total');
      await dlg.getByRole('button', { name: 'Add widget' }).click();
      const num = page.getByRole('region', { name: 'Widget: Pipeline total' }).getByTestId('widget-number');
      await num.waitFor({ timeout: 8000 });
      await page.waitForTimeout(800);
      await shot('dashboard');

      await page.waitForFunction(() => !!window.__e2e?.deal, null, { timeout: 15000 });
      const deals = await B.dealsState(page);
      const stages = await B.stagesState(page);
      const total = deals.reduce((s, d) => s + (d.value || 0), 0);
      ctx.check((await num.innerText()).includes('$' + total.toLocaleString('en-US')), `number widget shows pipeline total $${total}: ` + (await num.innerText()).replace(/\n/g, ' '));

      const rows = await page.getByRole('region', { name: 'Widget: Deals by stage' }).locator('table.sr-only tbody tr').evaluateAll(trs => trs.map(tr => [tr.querySelector('th').textContent, Number(tr.querySelector('td').textContent.replace(/,/g, ''))]));
      const expected = stages.slice().sort((a, b) => a.position - b.position).map(s => [s.name, deals.filter(d => d.stage === s.key).length]);
      ctx.check(JSON.stringify(rows) === JSON.stringify(expected), `bar widget counts per stage equal the board columns: ${JSON.stringify(rows)} vs ${JSON.stringify(expected)}`);

      const csv = page.waitForEvent('download', { timeout: 8000 });
      await page.getByRole('button', { name: 'Export Deals by stage as CSV' }).click();
      const dl = await csv;
      ctx.check(/\.csv$/.test(dl.suggestedFilename()), 'CSV export downloads a .csv file');

      if (fake) {
        ctx.check(fake.table('dashboards').length === 1 && fake.table('dashboard_widgets').length === 2, 'dashboard + 2 widgets persisted in the fake');
        const w = fake.table('dashboard_widgets').find(r => r.widget_type === 'number');
        ctx.check(w && w.data_source === 'deals' && w.config.measure === 'sum', 'widget config persisted as jsonb');
      }
      await page.reload();
      await page.getByRole('tab', { name: 'Dashboards' }).click();
      await page.getByRole('region', { name: 'Widget: Pipeline total' }).waitFor({ timeout: 10000 });
      ctx.check(await page.getByRole('region', { name: /^Widget:/ }).count() === 2, 'both widgets survive a reload');
      ctx.check(await page.getByRole('combobox', { name: 'Dashboard' }).inputValue() !== '', 'dashboard still selected after reload');

      // resize + reorder persist
      await page.getByLabel('Width of Deals by stage').selectOption('3');
      await page.getByRole('button', { name: 'Move Deals by stage later' }).click(); await page.waitForTimeout(600);
      if (fake) ctx.check(fake.table('dashboard_widgets').find(r => r.title === 'Deals by stage').position.cols === 3, 'resize persisted (position.cols)');
      await page.getByRole('button', { name: 'Remove Pipeline total' }).click(); await page.waitForTimeout(600);
      if (fake) ctx.check(fake.table('dashboard_widgets').length === 1, 'widget delete persisted');
      ctx.check(log.pageErrors.length === 0, 'no page errors: ' + log.pageErrors[0]);
      await context.close();
    });

    await ctx.step('tasks board: drag changes status and persists; quick add', async () => {
      const { page, context, fake, log, shot } = await openTasks();
      ctx.check(await page.getByRole('tab').count() >= 3, 'Board / List / Calendar tabs');
      const before = await cardsIn(page, 'in_progress').count();
      const card = cardsIn(page, 'todo').first();
      const id = await card.getAttribute('data-task-id');
      await drag(page, card, page.locator('ul[aria-label="In progress tasks"]'));
      ctx.check(await page.locator(`[data-column-status="in_progress"] [data-task-id="${id}"]`).count() === 1, 'card moved to In progress');
      ctx.check(await cardsIn(page, 'in_progress').count() === before + 1, 'In progress count +1');
      if (fake) {
        const row = fake.table('tasks').find(r => r.id === id);
        ctx.check(row && row.status === 'in_progress', 'tasks.status persisted: ' + row?.status);
        ctx.check(Number.isFinite(Number(row.board_position)), 'board_position written');
        await page.reload(); await page.locator('[data-task-id]').first().waitFor();
        ctx.check(await page.locator(`[data-column-status="in_progress"] [data-task-id="${id}"]`).count() === 1, 'moved task stays in In progress after reload');
        // a failing write rolls back and toasts
        fake.fail('tasks', 'PATCH', 500);
        const c2 = cardsIn(page, 'todo').first(); const id2 = await c2.getAttribute('data-task-id');
        await drag(page, c2, page.locator('ul[aria-label="Done tasks"]'));
        await page.waitForTimeout(500);
        ctx.check(await page.locator(`[data-column-status="todo"] [data-task-id="${id2}"]`).count() === 1, 'failed move rolls back');
        ctx.check(await page.getByRole('alert').filter({ hasText: /Could not move task/ }).first().waitFor({ timeout: 4000 }).then(() => true, () => false), 'failure toast shown');
      }
      await page.getByRole('button', { name: 'Add task to Done' }).click();
      await page.getByLabel('New task title (Done)').fill('Quick added');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.locator('[data-column-status="done"]').getByText('Quick added').waitFor({ timeout: 6000 });
      if (fake) ctx.check(fake.table('tasks').some(r => r.title === 'Quick added' && r.status === 'done'), 'quick-added task persisted in the Done column');
      await shot('board');
      ctx.check(log.pageErrors.length === 0, 'no page errors: ' + log.pageErrors[0]);
      await context.close();
    });

    await ctx.step('tasks: My tasks filter, list inline edit, overdue chip', async () => {
      const { page, context, fake } = await openTasks();
      const all = await page.locator('[data-testid="task-card"]').count();
      const mine = page.getByRole('button', { name: 'My tasks' });
      await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent === 'My tasks'); return b && !b.disabled; }, null, { timeout: 8000 });
      await mine.click();
      const n = await page.locator('[data-testid="task-card"]').count();
      ctx.check(n === MINE(ctx) && n < all, `My tasks shows ${n} of ${all} (expected ${MINE(ctx)})`);
      ctx.check(await page.locator('[data-testid="due-chip"][data-overdue="true"]').count() > 0, 'overdue due chip is flagged');
      await mine.click();
      await page.getByRole('tab', { name: 'List' }).click();
      const sel = page.locator('select[aria-label^="Status of "]').first();
      const title = (await sel.getAttribute('aria-label')).replace('Status of ', '');
      const was = await sel.inputValue();
      await sel.selectOption(was === 'done' ? 'todo' : 'done'); await page.waitForTimeout(600);
      ctx.check(await sel.inputValue() !== was, 'list inline status edit applied to ' + title);
      if (fake) ctx.check(fake.table('tasks').find(r => r.title === title).status !== was, 'list inline status edit persisted');
      await page.getByRole('button', { name: 'Task', exact: true }).click();
      ctx.check(await page.getByRole('columnheader', { name: /Task/ }).first().getAttribute('aria-sort') === 'ascending', 'header sort sets aria-sort');
      await context.close();
    });

    await ctx.step('tasks calendar: drag a task to another day reschedules it', async () => {
      const { page, context, fake, shot } = await openTasks();
      await page.getByRole('tab', { name: 'Calendar' }).click();
      const chip = page.getByTestId('calendar-task').first();
      await chip.waitFor({ timeout: 6000 });
      const id = await chip.getAttribute('data-task-id');
      const fromDay = await chip.evaluate(el => el.closest('[data-day]').getAttribute('data-day'));
      const cells = await page.locator('[role="gridcell"]').evaluateAll(els => els.map(e => e.getAttribute('data-day')));
      const target = cells[(cells.indexOf(fromDay) + 3) % cells.length];
      await drag(page, chip, page.locator(`[role="gridcell"][data-day="${target}"]`));
      const now = await page.locator(`[data-task-id="${id}"]`).first().evaluate(el => el.closest('[data-day]').getAttribute('data-day'));
      ctx.check(now === target, `task moved from ${fromDay} to ${target} (now ${now})`);
      if (fake) {
        const due = new Date(fake.table('tasks').find(r => r.id === id).due_date);
        const k = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
        ctx.check(k === target, 'due_date persisted as ' + k);
      }
      await shot('calendar');
      await context.close();
    });

    await ctx.step('task deal link opens the deal record', async () => {
      const { page, context } = await openTasks();
      const link = page.getByTestId('task-deal-link').first();
      await link.click();
      await page.waitForURL(/\/deals\/[^/]+$/, { timeout: 8000 });
      ctx.check(true, 'deal chip navigates to /deals/:id');
      await context.close();
    });

    await ctx.step('viewer role: tasks are read-only', async () => {
      if (ctx.mode !== 'fake') { ctx.skip('viewer role needs the permission store (fake mode)'); return; }
      const { page, context, fake } = await openTasks();
      await page.evaluate(() => window.__e2e.permission.setState({ role: 'viewer', rlsMode: 'workspace', loadedAt: Date.now() + 1e9 }));
      await page.waitForTimeout(500);
      ctx.check(await page.getByRole('button', { name: /Add task to/ }).count() === 0, 'viewer sees no quick add');
      await page.getByRole('tab', { name: 'List' }).click();
      ctx.check(await page.getByLabel('Status of Send proposal').isDisabled(), 'viewer cannot edit status inline');
      void fake;
      await context.close();
    });
  },
}];
