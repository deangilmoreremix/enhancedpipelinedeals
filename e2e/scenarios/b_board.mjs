import * as B from '../lib/board.mjs';
const VP = { width: 1900, height: 2200 };

export default [{
  id: 'B', name: 'Board core', async run(ctx) {
    const open = async (fakeSeed) => {
      const fake = ctx.fake(fakeSeed);
      const p = await ctx.page({ fake, viewport: VP });
      await B.openBoard(p.page);
      return { ...p, fake };
    };
    const idOf = (n) => ctx.mode === 'fake' ? `00000000-0000-4000-8000-00000000000${n === 2 ? 3 : n}` : `deal-${n}`; // fake: deal 3 (proposal, top of its column) plays the role of demo deal-2
    const reloadSettle = async (page) => { await page.reload(); await B.openBoard(page); };

    await ctx.step('columns from stages', async () => {
      const { page, log, context } = await open();
      for (const k of ['qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost']) ctx.check(await B.column(page, k).count() === 1, `column ${k} rendered`);
      ctx.check(ctx.errs(log).filter(e => !/Failed to fetch/.test(e)).length === 0, 'no errors on board load: ' + ctx.errs(log)[0]);
      await context.close();
    });

    await ctx.step('mouse drag between columns persists', async () => {
      const { page, log, context, fake, shot } = await open();
      const id = idOf(2); // proposal (demo) / qualification (fake) -> move to closed-won col
      const from = (await B.dealsState(page)).find(d => d.id === id).stage;
      await B.dragTo(page, B.card(page, id), B.column(page, 'negotiation'), { toOffset: 300 });
      const after = (await B.dealsState(page)).find(d => d.id === id);
      await shot('after-drag');
      ctx.check(after.stage === 'negotiation' && from !== 'negotiation', `mouse DnD ${from} -> negotiation (got ${after.stage})`);
      ctx.check(typeof after.position === 'number', 'moved deal got a numeric position');
      if (fake) {
        await page.waitForTimeout(500);
        const row = fake.table('deals').find(d => d.id === id);
        ctx.check(row.stage === 'negotiation', `fake DB persisted stage (got ${row.stage})`);
        ctx.check(typeof row.position === 'number', 'fake DB persisted position ' + row.position);
        await reloadSettle(page);
        ctx.check((await B.dealsState(page)).find(d => d.id === id).stage === 'negotiation', 'moved deal still in negotiation after reload');
      }
      ctx.check(ctx.errs(log).filter(e => !/Failed to fetch/.test(e)).length === 0, 'no errors during DnD: ' + ctx.errs(log)[0]);
      await context.close();
    });

    await ctx.step('WIP limit blocks drop, Shift overrides', async () => {
      const { page, context, shot } = await open();
      await page.evaluate(() => window.__e2e.deal.getState().updateStage('negotiation', { wipLimit: 1 }));
      await page.waitForTimeout(400);
      const id = idOf(2);
      const ds = await B.dealsState(page);
      const negCount = ds.filter(d => d.stage === 'negotiation').length;
      ctx.check(negCount >= 1, 'negotiation already at WIP limit (' + negCount + ')');
      await B.dragTo(page, B.card(page, id), B.column(page, 'negotiation'), { toOffset: 300 });
      await shot('wip-blocked');
      const s1 = (await B.dealsState(page)).find(d => d.id === id).stage;
      ctx.check(s1 !== 'negotiation', 'drop into full column blocked (stage=' + s1 + ')');
      await B.dragTo(page, B.card(page, id), B.column(page, 'negotiation'), { toOffset: 300, shift: true });
      const sMid = (await B.dealsState(page)).find(d => d.id === id).stage;
      if (sMid !== 'negotiation') {
        ctx.notes.push('NOTE: pressing Shift mid-drag (after mouse down) is NOT seen by the board (stage=' + sMid + ')');
        await B.dragTo(page, B.card(page, id), B.column(page, 'negotiation'), { toOffset: 300, shiftEarly: true });
      }
      const s2 = (await B.dealsState(page)).find(d => d.id === id).stage;
      ctx.check(s2 === 'negotiation', 'Shift+drop overrides WIP limit (stage=' + s2 + ')');
      await context.close();
    });

    await ctx.step('per-column quick add', async () => {
      const { page, context, fake } = await open();
      await B.column(page, 'proposal').getByRole('button', { name: /add deal/i }).click();
      await page.getByLabel('Deal title').fill('E2E Quick Deal');
      await page.getByLabel('Deal value').fill('12345');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
      const d = (await B.dealsState(page)).find(x => x.title === 'E2E Quick Deal');
      ctx.check(d && d.stage === 'proposal' && d.value === 12345, 'quick-added deal in column with value: ' + JSON.stringify(d));
      ctx.check(await B.column(page, 'proposal').getByText('E2E Quick Deal').count() > 0, 'quick-added card visible in column');
      if (fake) {
        const row = fake.table('deals').find(x => x.title === 'E2E Quick Deal');
        ctx.check(row && row.stage === 'proposal' && Number(row.value) === 12345, 'fake DB has the new deal');
        await reloadSettle(page);
        ctx.check((await B.dealsState(page)).some(x => x.title === 'E2E Quick Deal'), 'new deal survives reload');
      }
      await context.close();
    });

    await ctx.step('column aggregate picker', async () => {
      const { page, context } = await open();
      const col = B.column(page, 'qualification');
      const before = await col.getByLabel('Change column aggregate').first().innerText();
      await col.getByLabel('Change column aggregate').first().click();
      const selects = col.locator('select');
      ctx.check(await selects.count() >= 1, 'aggregate picker shows operation select');
      const opts = await selects.first().locator('option').allInnerTexts();
      const other = opts.find(o => !before.toLowerCase().includes(o.toLowerCase().split(' ')[0]));
      await selects.first().selectOption({ label: other });
      await page.waitForTimeout(300);
      const after = await col.getByLabel('Change column aggregate').first().innerText();
      ctx.check(after !== before, `aggregate label changed: "${before}" -> "${after}" (ops: ${opts.join(',')})`);
      await context.close();
    });

    await ctx.step('stage manager add/rename/colour/probability/won-lost/hide/reorder/delete-with-move', async () => {
      const { page, context, fake, shot } = await open();
      await page.getByRole('button', { name: 'Manage pipeline stages' }).first().click();
      await page.getByLabel('New stage name').fill('Pilot');
      await page.locator('button:has-text("Add stage")').last().click();
      await page.waitForTimeout(500);
      let st = await B.stagesState(page);
      const pilot = st.find(s => s.name === 'Pilot');
      ctx.check(!!pilot, 'added stage Pilot');
      const k = pilot.key;
      await shot('stage-manager');
      const nameInput = page.getByLabel('Name of stage Pilot');
      await nameInput.fill('Pilot Program'); await nameInput.press('Enter'); await page.waitForTimeout(300);
      ctx.check((await B.stagesState(page)).find(s => s.key === k).name === 'Pilot Program', 'rename stage');
      await page.getByLabel(/^Colour (red|green|purple|orange|pink)\b.* for Pilot Program/i).first().click().catch(() => {});
      await page.waitForTimeout(200);
      const c1 = (await B.stagesState(page)).find(s => s.key === k).color;
      ctx.check(!!c1 && c1 !== 'blue', 'recolour stage (' + c1 + ')');
      const prob = page.getByLabel('Probability of Pilot Program'); await prob.fill('55'); await prob.press('Enter'); await page.waitForTimeout(200);
      ctx.check((await B.stagesState(page)).find(s => s.key === k).probability === 55, 'probability = 55');
      await page.getByLabel('Pilot Program is a won stage').check(); await page.waitForTimeout(200);
      let s = (await B.stagesState(page)).find(x => x.key === k); ctx.check(s.isWon && !s.isLost, 'won flag');
      await page.getByLabel('Pilot Program is a lost stage').check(); await page.waitForTimeout(200);
      s = (await B.stagesState(page)).find(x => x.key === k); ctx.check(s.isLost && !s.isWon, 'lost flag swaps won');
      await page.getByLabel('Hide Pilot Program').click(); await page.waitForTimeout(200);
      ctx.check(await B.column(page, k).count() === 0, 'hidden stage column disappears from the board');
      await page.getByLabel('Show Pilot Program').click(); await page.waitForTimeout(200);
      ctx.check(await B.column(page, k).count() === 1, 'shown again');
      // reorder via store API (DnD in modal is a separate hotspot) then check board order
      await page.evaluate(() => { const s = window.__e2e.deal.getState(); const keys = s.stages.map(x => x.key); const i = keys.indexOf(keys[keys.length - 1]); keys.unshift(keys.pop()); return s.reorderStages(keys); });
      await page.waitForTimeout(300);
      const order = await page.evaluate(() => [...document.querySelectorAll('[data-column-key]')].map(e => e.getAttribute('data-column-key')));
      ctx.check(order[0] === k, 'reordered stage first on the board: ' + order.join(','));
      // delete with move: move deals of qualification to proposal
      const qualCount = (await B.dealsState(page)).filter(d => d.stage === 'qualification').length;
      await page.getByLabel('Delete Qualification').click();
      await page.getByLabel('Move deals from Qualification to').selectOption('proposal');
      await page.getByRole('button', { name: 'Delete stage' }).click(); await page.waitForTimeout(700);
      const ds = await B.dealsState(page);
      ctx.check(!(await B.stagesState(page)).some(x => x.key === 'qualification'), 'stage deleted');
      ctx.check(ds.filter(d => d.stage === 'qualification').length === 0 && qualCount > 0, `deals moved out of deleted stage (${qualCount})`);
      if (fake) {
        ctx.check(!fake.table('pipeline_stages').some(x => x.key === 'qualification'), 'fake DB: stage row deleted');
        ctx.check(fake.table('deals').every(d => d.stage !== 'qualification'), 'fake DB: deals re-staged');
        ctx.check(fake.table('pipeline_stages').some(x => x.name === 'Pilot Program' && x.probability === 55), 'fake DB: renamed stage with probability persisted');
      }
      await context.close();
    });

    await ctx.step('selection: click/shift/ctrl, marquee, hotkeys, Alt+Arrow', async () => {
      const { page, context, log, shot } = await open();
      const ids = await B.stageCardsText(page, 'qualification');
      ctx.check(ids.length >= 2, 'qualification has >=2 cards: ' + ids.length);
      await page.keyboard.press('Escape');
      // ctrl-click to select two cards
      await B.card(page, ids[0]).click({ modifiers: ['Control'], position: { x: 150, y: 8 } });
      await B.card(page, ids[1]).click({ modifiers: ['Control'], position: { x: 150, y: 8 } });
      ctx.check((await B.selState(page)).selected.length === 2, 'ctrl-click selects 2: ' + JSON.stringify(await B.selState(page)));
      await shot('selected');
      ctx.check(await page.getByRole('region', { name: 'Bulk actions' }).or(page.getByLabel('Bulk actions')).count() > 0, 'bulk action bar visible');
      await page.keyboard.press('Escape');
      ctx.check((await B.selState(page)).selected.length === 0, 'Esc clears selection');
      // keyboard nav
      await page.mouse.click(5, 5);
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await page.keyboard.press('ArrowDown');
      const f1 = (await B.selState(page)).focused; ctx.check(!!f1, 'ArrowDown focuses first card: ' + f1);
      await page.keyboard.press('ArrowDown');
      const f2 = (await B.selState(page)).focused; ctx.check(f2 && f2 !== f1, 'ArrowDown moves focus');
      await page.keyboard.press(' ');
      ctx.check((await B.selState(page)).selected.includes(f2), 'Space toggles selection');
      // Alt+ArrowRight moves selection to next stage
      const before = (await B.dealsState(page)).find(d => d.id === f2).stage;
      await page.keyboard.press('Alt+ArrowRight'); await page.waitForTimeout(700);
      const after = (await B.dealsState(page)).find(d => d.id === f2).stage;
      ctx.check(before !== after, `Alt+ArrowRight moved ${before} -> ${after}`);
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      // '/' focuses search
      await page.keyboard.press('/');
      ctx.check(await page.evaluate(() => document.activeElement?.hasAttribute('data-board-search')), "'/' focuses search");
      await page.keyboard.press('Escape'); await page.locator('body').click({ position: { x: 5, y: 5 } });
      // 'n' quick-create in focused column
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('n'); await page.waitForTimeout(300);
      ctx.check(await page.getByLabel('Deal title').count() > 0, "'n' opens quick-create");
      await page.keyboard.press('Escape');
      // Enter opens the focused deal
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
      await page.getByText('Deal Profile').first().waitFor({ timeout: 5000 }).catch(() => {});
      ctx.check(await page.getByText('Deal Profile').count() > 0, 'Enter opens focused deal modal');
      ctx.check(ctx.errs(log).filter(e => !/Failed to fetch/.test(e)).length === 0, 'no errors in hotkeys: ' + ctx.errs(log)[0]);
      await context.close();
    });

    await ctx.step('multi-card drag moves the whole selection', async () => {
      const { page, context, fake, shot } = await open();
      const ids = await B.stageCardsText(page, 'qualification');
      ctx.check(ids.length >= 2, 'need 2 cards in qualification');
      for (const id of ids.slice(0, 2)) await B.card(page, id).click({ modifiers: ['Control'], position: { x: 150, y: 8 } });
      ctx.check((await B.selState(page)).selected.length === 2, 'two cards selected');
      await B.dragTo(page, B.card(page, ids[0]), B.column(page, 'closed-won'), { toOffset: 300 });
      await shot('multi-drag');
      const st = await B.dealsState(page);
      ctx.check(ids.slice(0, 2).every(id => st.find(d => d.id === id).stage === 'closed-won'), 'both selected cards moved to closed-won: ' + ids.slice(0, 2).map(id => st.find(d => d.id === id).stage).join(','));
      if (fake) { await page.waitForTimeout(800); ctx.check(ids.slice(0, 2).every(id => fake.table('deals').find(d => d.id === id).stage === 'closed-won'), 'fake DB persisted both moves'); }
      await context.close();
    });

    await ctx.step('marquee selection', async () => {
      const { page, context, shot } = await open();
      const a = await B.column(page, 'qualification').boundingBox();
      const b2 = await B.column(page, 'proposal').boundingBox();
      const x0 = (a.x + a.width + b2.x) / 2, y0 = a.y + 200;
      await page.mouse.move(x0, y0); await page.mouse.down();
      await page.mouse.move(x0 - 60, y0 + 100, { steps: 6 }); await page.mouse.move(a.x + 120, y0 + 700, { steps: 10 });
      await shot('marquee');
      const rect = await page.getByTestId('marquee-rect').count();
      await page.mouse.up();
      const sel = await B.selState(page);
      ctx.check(rect > 0 && sel.selected.length > 0, `marquee rectangle shown and cards selected (rect=${rect}, selected=${sel.selected.length})`);
      await context.close();
    });
  }
}];
