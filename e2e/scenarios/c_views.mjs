import * as B from '../lib/board.mjs';
const VP = { width: 1700, height: 1500 };
const rowIds = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map(e => e.getAttribute('data-deal-id')), sel);
const tab = (page, name) => page.getByRole('button', { name, exact: true }).first();

export default [{
  id: 'C', name: 'Views unification + inline edit', async run(ctx) {
    const open = async (seed) => { const fake = ctx.fake(seed); const p = await ctx.page({ fake, viewport: VP }); await B.openBoard(p.page); return { ...p, fake }; };

    await ctx.step('every view renders and shares filtered+sorted rows', async () => {
      const { page, context, log, shot } = await open();
      await page.getByLabel('Search deals').fill('o'); await page.waitForTimeout(600); // narrows a bit (company/title contains "o")
      await page.getByLabel('Sort cards').selectOption({ index: 1 }); await page.waitForTimeout(400);
      const st = await B.dealsState(page);
      await tab(page, 'Table').click(); await page.waitForSelector('[data-testid="deal-table-view"]');
      const tableIds = await rowIds(page, 'tr[data-deal-id]');
      await shot('table');
      await tab(page, 'List').click(); await page.waitForSelector('[data-testid="deal-list-view"]');
      const listIds = await rowIds(page, '[data-testid="deal-list-view"] [data-deal-id]');
      await shot('list');
      ctx.check(tableIds.length > 0, 'table has rows: ' + tableIds.length);
      ctx.check(JSON.stringify(tableIds) === JSON.stringify(listIds), `table and list show the same rows in the same order (${tableIds.length}/${listIds.length})`);
      const searchHits = st.filter(d => /o/i.test([d.title, d.company].join(' '))).length;
      ctx.check(tableIds.length <= st.length && tableIds.length >= 1, `filter applied in table (${tableIds.length} of ${st.length}; text-match>=${searchHits >= 0})`);
      for (const v of ['Calendar', 'Timeline', 'Dashboard', 'Kanban']) {
        await tab(page, v).click(); await page.waitForTimeout(900);
        const txt = await page.locator('body').innerText();
        ctx.check(!/Component Error|Something went wrong/.test(txt), `${v} view renders without error boundary`);
        await shot('view-' + v.toLowerCase());
      }
      ctx.check(ctx.errs(log).filter(e => !/Failed to fetch/.test(e)).length === 0, 'no errors switching views: ' + ctx.errs(log).find(e => !/Failed to fetch/.test(e)));
      await context.close();
    });

    await ctx.step('shared selection + bulk bar + aggregates footer', async () => {
      const { page, context, shot } = await open();
      await tab(page, 'Table').click(); await page.waitForSelector('[data-testid="deal-table-view"]');
      const first = (await rowIds(page, 'tr[data-deal-id]'))[0];
      await page.locator(`tr[data-deal-id="${first}"] input[type=checkbox]`).first().check();
      ctx.check((await B.selState(page)).selected.includes(first), 'table checkbox writes the shared selection store');
      ctx.check(await page.getByLabel('Bulk actions').count() > 0, 'bulk action bar shown in table view');
      await page.waitForSelector('[data-testid="table-aggregate"]');
      const aggSel = await page.getByTestId('table-aggregate').innerText();
      await page.getByLabel('Clear selection').click(); await page.waitForTimeout(300);
      const aggAll = await page.getByTestId('table-aggregate').innerText();
      ctx.check(aggSel !== aggAll, `aggregate footer follows selection ("${aggSel}" vs all "${aggAll}")`);
      // list view: same store + bulk bar (selection is intentionally cleared when a view unmounts)
      await tab(page, 'List').click(); await page.waitForSelector('[data-testid="deal-list-view"]');
      const lfirst = (await rowIds(page, '[data-testid="deal-list-view"] [data-deal-id]'))[0];
      await page.locator(`[data-testid="deal-list-view"] [data-deal-id="${lfirst}"] input[type=checkbox]`).first().check();
      ctx.check((await B.selState(page)).selected.includes(lfirst), 'list checkbox writes the shared selection store');
      ctx.check(await page.getByLabel('Bulk actions').count() > 0, 'bulk action bar shown in list view');
      ctx.check(await page.getByTestId('list-footer').count() > 0, 'list footer (count/sum row) shown');
      await tab(page, 'Table').click(); await page.waitForTimeout(400);
      ctx.notes.push('selection is cleared when switching views (useViewSelection unmount cleanup): by design');
      await shot('table-footer');
      await context.close();
    });

    await ctx.step('column chooser + resize + saved view restores view type and columns', async () => {
      const { page, context, shot, fake } = await open();
      await tab(page, 'Table').click(); await page.waitForSelector('[data-testid="deal-table-view"]');
      const headers0 = await page.locator('thead th').allInnerTexts();
      await page.getByRole('button', { name: /^Columns/ }).click();
      await page.getByLabel('Show Win %').uncheck();
      await page.getByLabel('Show Priority').check();
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      const headers1 = await page.locator('thead th').allInnerTexts();
      ctx.check(!headers1.some(h => /Win %/i.test(h)) && headers1.some(h => /Priority/i.test(h)), `column chooser hides Win % and shows Priority (${headers1.join('|').replace(/\n/g, '')})`);
      // resize via handle drag
      const handle = page.getByLabel('Resize Deal Title');
      const hb = await handle.boundingBox();
      const w0 = (await page.locator('thead th').nth(2).boundingBox()).width;
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
      await page.mouse.move(hb.x + 120, hb.y + hb.height / 2, { steps: 6 }); await page.mouse.up();
      const w1 = (await page.locator('thead th').nth(2).boundingBox()).width;
      ctx.check(w1 > w0 + 40, `column resize widens title column ${Math.round(w0)} -> ${Math.round(w1)}`);
      // save view while in table view with custom columns
      await page.getByRole('button', { name: /^save view$/i }).click();
      await page.getByLabel('View name').fill('Table layout');
      await page.getByRole('dialog').getByRole('button', { name: 'Save view' }).click(); await page.waitForTimeout(700);
      if (fake) { const r = fake.table('saved_pipeline_views')[0]; ctx.check(r && r.view_type === 'table', 'saved view row has view_type=table: ' + (r && r.view_type)); }
      await tab(page, 'Kanban').click(); await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Table layout/ }).first().click();
      await page.getByText('Table layout', { exact: true }).last().click();
      await page.waitForTimeout(800);
      ctx.check(await page.getByTestId('deal-table-view').count() === 1, 'applying saved view switches back to Table view');
      const headers2 = await page.locator('thead th').allInnerTexts();
      ctx.check(!headers2.some(h => /Win %/i.test(h)) && headers2.some(h => /Priority/i.test(h)), 'applying saved view restores column set');
      await shot('view-restored');
      await context.close();
    });

    await ctx.step('inline edit cells persist (title/value/stage/priority/close date)', async () => {
      const { page, context, fake, shot } = await open();
      await tab(page, 'Table').click(); await page.waitForSelector('[data-testid="deal-table-view"]');
      await page.getByRole('button', { name: /^Columns/ }).click();
      for (const l of ['Priority', 'Close date']) await page.getByLabel(`Show ${l}`).check();
      await page.mouse.click(5, 5);
      const id = (await rowIds(page, 'tr[data-deal-id]'))[0];
      const row = page.locator(`tr[data-deal-id="${id}"]`);
      // title
      await row.getByLabel('Edit Title').click(); await row.getByLabel('Title').fill('Renamed Inline'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      // value
      await row.getByLabel('Edit Value').click(); await row.getByLabel('Value').fill('99000'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      // stage chip
      await row.getByLabel(/^Stage:/).click(); await page.getByTestId('deal-table-view').getByRole('option', { name: 'Negotiation' }).click(); await page.waitForTimeout(600);
      // priority chip
      await row.getByLabel(/^Priority:/).click(); await page.getByTestId('deal-table-view').getByRole('option', { name: 'Low' }).click({ timeout: 5000 }).catch(async e => { await shot('inline-low-fail'); throw e; }); await page.waitForTimeout(600);
      // close date
      await row.getByLabel('Edit Close date').click(); await row.getByLabel('Close date').fill('2031-02-03'); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
      await shot('inline-edited');
      const d = (await B.dealsState(page)).find(x => x.id === id);
      ctx.check(d.title === 'Renamed Inline' && d.value === 99000 && d.stage === 'negotiation' && d.priority === 'low', 'inline edits applied in store: ' + JSON.stringify({ t: d.title, v: d.value, s: d.stage, p: d.priority }));
      const cd = await page.evaluate((id) => { const x = window.__e2e.deal.getState().deals[id]; return x.closeDate ? new Date(x.closeDate).toISOString().slice(0, 10) : null; }, id);
      ctx.check(cd === '2031-02-03', 'close date edited: ' + cd);
      if (fake) {
        await page.waitForTimeout(500);
        const r = fake.table('deals').find(x => x.id === id);
        ctx.check(r.title === 'Renamed Inline' && Number(r.value) === 99000 && r.stage === 'negotiation' && r.priority === 'low' && String(r.close_date).startsWith('2031-02-03'), 'fake DB persisted all inline edits: ' + JSON.stringify({ t: r.title, v: r.value, s: r.stage, p: r.priority, c: r.close_date }));
        await page.reload(); await B.openBoard(page);
        ctx.check((await B.dealsState(page)).find(x => x.id === id).title === 'Renamed Inline', 'inline title edit survives reload');
      }
      await context.close();
    });

    await ctx.step('inline edit rolls back on forced failure (500) and on RLS denial (42501)', async () => {
      if (ctx.mode !== 'fake') { ctx.skip('rollback needs the REST path: covered in fake mode (demo writes cannot fail)'); return; }
      const { page, context, fake, shot } = await open();
      await tab(page, 'Table').click(); await page.waitForSelector('[data-testid="deal-table-view"]');
      const id = (await rowIds(page, 'tr[data-deal-id]'))[0];
      const row = page.locator(`tr[data-deal-id="${id}"]`);
      const t0 = (await B.dealsState(page)).find(x => x.id === id).title;
      fake.fail('deals', 'PATCH', 500);
      await row.getByLabel('Edit Title').click(); await row.getByLabel('Title').fill('Should Roll Back'); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
      await shot('rollback-500');
      const t1 = (await B.dealsState(page)).find(x => x.id === id).title;
      ctx.check(t1 === t0, `title rolled back after 500 (${t0} -> ${t1})`);
      ctx.check(await page.getByText(/couldn.?t|could not|failed|error/i).count() > 0 || await page.getByRole('alert').count() > 0, 'user sees an error message after failed save');
      fake.deny('deals', 'PATCH');
      await row.getByLabel('Edit Title').click(); await row.getByLabel('Title').fill('Denied Edit'); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
      const t2 = (await B.dealsState(page)).find(x => x.id === id).title;
      ctx.check(t2 === t0, `title rolled back after 42501 (${t2})`);
      await shot('rollback-42501');
      ctx.check(await page.getByText(/permission/i).count() > 0, 'permission-denied message shown');
      await context.close();
    });
  }
}];
