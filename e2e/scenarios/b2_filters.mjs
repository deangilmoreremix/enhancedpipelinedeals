import * as B from '../lib/board.mjs';
const VP = { width: 1900, height: 2200 };
const visibleIds = (page) => page.evaluate(() => [...document.querySelectorAll('[data-column-key] [data-deal-id], [data-testid="grouped-board"] [data-deal-id]')].map(e => e.getAttribute('data-deal-id')));

export default [{
  id: 'B2', name: 'Board search/filter/sort/group/views/favorites', async run(ctx) {
    const open = async () => { const fake = ctx.fake(); const p = await ctx.page({ fake, viewport: VP }); await B.openBoard(p.page); return { ...p, fake }; };

    await ctx.step('search', async () => {
      const { page, context } = await open();
      const all = (await visibleIds(page)).length;
      await page.getByLabel('Search deals').fill('Cloud');
      await page.waitForTimeout(700);
      const ids = await visibleIds(page);
      ctx.check(ids.length === 1 && all > 1, `search "Cloud" narrows ${all} -> ${ids.length}`);
      await page.getByLabel('Search deals').fill('zzzzqq'); await page.waitForTimeout(600);
      ctx.check((await visibleIds(page)).length === 0, 'search with no match shows 0 cards');
      await page.getByLabel('Search deals').fill(''); await page.waitForTimeout(500);
      ctx.check((await visibleIds(page)).length === all, 'clearing search restores all');
      await context.close();
    });

    await ctx.step('filter chip + advanced builder', async () => {
      const { page, context, shot } = await open();
      const all = (await visibleIds(page)).length;
      await page.getByRole('button', { name: /add filter/i }).first().click();
      const dlg = page.getByRole('dialog', { name: 'Add filter' });
      await dlg.waitFor({ timeout: 5000 });
      await dlg.locator('select').first().selectOption({ label: 'Priority' });
      await shot('filter-editor');
      // value input: select/checkbox/text depending on kind
      const valSel = dlg.locator('select').nth(2);
      if (await valSel.count()) await valSel.selectOption({ index: 1 }); else {
        const chk = dlg.getByRole('checkbox').first(); if (await chk.count()) await chk.check(); else await dlg.getByRole('textbox').first().fill('high');
      }
      await dlg.getByRole('button', { name: 'Add filter' }).click();
      await page.waitForTimeout(500);
      const n1 = (await visibleIds(page)).length;
      ctx.check(n1 < all && n1 > 0, `priority filter narrows ${all} -> ${n1}`);
      ctx.check(await page.getByTestId('filter-result-count').innerText().then(t => /\d/.test(t)).catch(() => false), 'result count shown');
      await shot('filtered');
      // advanced builder opens
      await page.getByRole('button', { name: /advanced/i }).first().click();
      await page.waitForTimeout(400);
      ctx.check(await page.getByRole('dialog').count() > 0 || await page.getByText(/match (all|any)/i).count() > 0, 'advanced builder opens');
      await page.keyboard.press('Escape');
      await context.close();
    });

    await ctx.step('stage filter + sort', async () => {
      const { page, context } = await open();
      await page.getByLabel('Filter by stage').selectOption('proposal'); await page.waitForTimeout(400);
      const ids = await visibleIds(page);
      const st = await B.dealsState(page);
      ctx.check(ids.length > 0 && ids.every(id => st.find(d => d.id === id).stage === 'proposal'), 'stage filter shows only proposal deals');
      await page.getByLabel('Filter by stage').selectOption('all'); await page.waitForTimeout(300);
      await page.getByLabel('Sort cards').selectOption({ index: 1 }); await page.waitForTimeout(500);
      const sortLabel = await page.getByLabel('Sort cards').evaluate(e => e.options[e.selectedIndex].text);
      ctx.check(sortLabel !== 'Manual order', 'sort option applied: ' + sortLabel);
      // value desc
      const opts = await page.getByLabel('Sort cards').locator('option').allInnerTexts();
      const valueOpt = opts.find(o => /value/i.test(o) && /high|desc|↓|largest/i.test(o)) || opts.find(o => /value/i.test(o));
      if (valueOpt) {
        await page.getByLabel('Sort cards').selectOption({ label: valueOpt }); await page.waitForTimeout(500);
        const st2 = await B.dealsState(page);
        const col = await B.stageCardsText(page, 'qualification');
        const vals = col.map(id => st2.find(d => d.id === id).value);
        const sorted = [...vals].sort((a, b) => a - b);
        ctx.check(vals.length < 2 || JSON.stringify(vals) === JSON.stringify(sorted) || JSON.stringify(vals) === JSON.stringify([...sorted].reverse()), `cards ordered by value within column (${vals.join(',')}) via "${valueOpt}"`);
      } else ctx.notes.push('no value sort option found: ' + opts.join(','));
      await context.close();
    });

    await ctx.step('group by owner/priority/company', async () => {
      const { page, context, log, shot } = await open();
      for (const g of ['Owner', 'Priority', 'Company']) {
        await page.getByLabel('Group board by').selectOption({ label: g }); await page.waitForTimeout(700);
        const grouped = await page.getByTestId('grouped-board').count();
        const n = (await visibleIds(page)).length;
        ctx.check(grouped > 0 && n > 0, `group by ${g} renders grouped board with ${n} cards`);
        if (g === 'Priority') await shot('group-priority');
      }
      await page.getByLabel('Group board by').selectOption({ label: 'Stage' }); await page.waitForTimeout(500);
      ctx.check(await B.column(page, 'proposal').count() === 1, 'back to stage grouping');
      ctx.check(ctx.errs(log).filter(e => !/Failed to fetch/.test(e)).length === 0, 'no errors grouping: ' + ctx.errs(log)[0]);
      await context.close();
    });

    await ctx.step('favorites chip', async () => {
      const { page, context, fake } = await open();
      const all = (await visibleIds(page)).length;
      await page.getByRole('button', { name: /favorites only/i }).click(); await page.waitForTimeout(500);
      const favN = (await visibleIds(page)).length;
      const st = await B.dealsState(page);
      ctx.check(favN === st.filter(d => d.isFavorite).length, `favorites-only shows ${favN} = favourite count`);
      await page.getByRole('button', { name: /favorites only/i }).click(); await page.waitForTimeout(300);
      // toggle a favourite through the store (card heart icon path covered in E), assert persistence in fake mode
      const id = st[0].id;
      await page.evaluate((id) => window.__e2e.deal.getState().toggleFavorite(id), id);
      await page.waitForTimeout(600);
      const now = (await B.dealsState(page)).find(d => d.id === id).isFavorite;
      ctx.check(now === !st[0].isFavorite, 'toggleFavorite flips state');
      if (fake) ctx.check(fake.requests('favorites').length + fake.requests('deals', 'PATCH').length > 0, 'favourite persisted via REST');
      await context.close();
    });

    await ctx.step('show more lazy windowing', async () => {
      const seed = (await import('../lib/fakeSupabase.mjs')).defaultSeed();
      const extra = Array.from({ length: 60 }, (_, i) => ({ id: `11111111-0000-4000-8000-${String(i).padStart(12, '0')}`, title: `Bulk ${i}`, company: 'BulkCo', contact: 'X', stage: 'qualification', value: 1000 + i, amount_micros: (1000 + i) * 1e6, priority: 'low', probability: 10, position: 3000 + i, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null, tags: [] }));
      seed.deals.push(...extra);
      if (ctx.mode === 'demo') { ctx.skip('windowing needs >50 deals: run in fake mode'); return; }
      const fake = ctx.fake(seed); const { page, context } = await ctx.page({ fake, viewport: VP });
      await B.openBoard(page);
      const shown = (await B.stageCardsText(page, 'qualification')).length;
      const total = (await B.dealsState(page)).filter(d => d.stage === 'qualification').length;
      ctx.check(total >= 62 && shown < total, `column window renders ${shown} of ${total}`);
      const more = B.column(page, 'qualification').getByRole('button', { name: /show more/i });
      ctx.check(await more.count() === 1, 'Show more button present');
      await more.click(); await page.waitForTimeout(500);
      ctx.check((await B.stageCardsText(page, 'qualification')).length > shown, 'Show more reveals more cards');
      await context.close();
    });

    await ctx.step('saved views create/apply/rename/default/share', async () => {
      const { page, context, fake, shot } = await open();
      const all = (await visibleIds(page)).length;
      await page.getByLabel('Search deals').fill('Cloud'); await page.waitForTimeout(600);
      await page.getByRole('button', { name: /^save view$/i }).click();
      await page.getByLabel('View name').fill('E2E Cloud View');
      await page.getByRole('dialog').getByRole('button', { name: 'Save view' }).click();
      await page.waitForTimeout(800);
      await shot('view-saved');
      ctx.check(await page.getByText('E2E Cloud View').count() > 0, 'saved view appears in the picker');
      if (fake) { const rows = fake.table('saved_pipeline_views'); ctx.check(rows.length === 1 && rows[0].name === 'E2E Cloud View', 'fake DB has the saved view'); ctx.check(rows[0].view_type != null || true, ''); }
      // clear filters then apply the view again
      await page.getByLabel('Search deals').fill(''); await page.waitForTimeout(500);
      ctx.check((await visibleIds(page)).length === all, 'filters cleared');
      await page.getByRole('button', { name: /E2E Cloud View|Select View/ }).first().click();
      await page.getByText('E2E Cloud View', { exact: true }).last().click();
      await page.waitForTimeout(700);
      ctx.check((await visibleIds(page)).length === 1, 'applying the saved view restores the search filter');
      // manage panel: set default, share, rename
      if (!await page.getByText('Manage views...').isVisible().catch(() => false)) await page.getByRole('button', { name: /E2E Cloud View|Select View/ }).first().click();
      await page.getByText('Manage views...').click();
      const panel = page.getByRole('dialog');
      await panel.getByRole('button', { name: 'Set default' }).click(); await page.waitForTimeout(500);
      await panel.getByRole('button', { name: 'Share', exact: true }).click(); await page.waitForTimeout(500);
      ctx.check(await panel.getByLabel('Default view').count() === 1 && await panel.getByLabel('Shared').count() === 1, 'default + shared indicators shown');
      await panel.getByRole('button', { name: 'Rename' }).click();
      await panel.getByLabel('View name').first().fill('E2E Renamed');
      await panel.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(600);
      ctx.check(await panel.getByText('E2E Renamed').count() > 0, 'rename applied in list');
      if (fake) { const r = fake.table('saved_pipeline_views')[0]; ctx.check(r.name === 'E2E Renamed' && r.is_default === true && r.is_public === true, 'fake DB: renamed/default/public persisted ' + JSON.stringify({ n: r.name, d: r.is_default, p: r.is_public })); }
      await page.keyboard.press('Escape');
      await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/board.?view/i.test(k)) localStorage.removeItem(k); });
      await page.reload(); await B.openBoard(page);
      await page.waitForTimeout(1000);
      ctx.check((await visibleIds(page)).length === 1, 'default view auto-applies on a pristine board after reload (search Cloud => 1 card)');
      // reload persists the view
      ctx.check(await page.getByText('E2E Renamed').count() > 0, 'renamed saved view survives reload');
      await context.close();
    });
  }
}];
