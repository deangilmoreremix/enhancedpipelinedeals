import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as B from '../lib/board.mjs';
import { RESULTS_DIR } from '../lib/browser.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ExcelJS = createRequire(path.join(root, 'package.json'))('exceljs');
const VP = { width: 1700, height: 1500 };
const dlDir = path.join(RESULTS_DIR, 'downloads'); fs.mkdirSync(dlDir, { recursive: true });

function parseCsv(text) { // small RFC4180 parser
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c; }
  if (cur || row.length) { row.push(cur); rows.push(row); } return rows;
}

export default [{
  id: 'D', name: 'Bulk actions + export/import', async run(ctx) {
    const open = async (seed) => { const fake = ctx.fake(seed); const p = await ctx.page({ fake, viewport: VP }); await B.openBoard(p.page); return { ...p, fake }; };
    const selectAllInTable = async (page) => {
      await page.getByRole('button', { name: 'Table', exact: true }).first().click(); await page.waitForSelector('[data-testid="deal-table-view"]');
      await page.getByLabel('Select all deals').check();
    };

    await ctx.step('bulk move/priority/tags/follow-up/favorite/owner', async () => {
      const { page, context, fake, shot } = await open();
      await selectAllInTable(page);
      const n = (await B.dealsState(page)).length;
      ctx.check((await B.selState(page)).selected.length === n, 'select-all selects all ' + n);
      await page.getByLabel('Move to stage').selectOption('proposal'); await page.waitForTimeout(1000);
      ctx.check((await B.dealsState(page)).every(d => d.stage === 'proposal'), 'bulk move stage: all in proposal');
      if (fake) ctx.check(fake.table('deals').every(d => d.stage === 'proposal'), 'fake DB: bulk stage persisted');
      await page.getByLabel('Select all deals').check().catch(() => {});
      if ((await B.selState(page)).selected.length === 0) await page.getByLabel('Select all deals').check();
      await page.getByLabel('Set priority').selectOption('low'); await page.waitForTimeout(1000);
      ctx.check((await B.dealsState(page)).every(d => d.priority === 'low'), 'bulk priority low');
      if ((await B.selState(page)).selected.length === 0) await page.getByLabel('Select all deals').check();
      await page.getByRole('button', { name: /^Tags/ }).click(); await page.getByLabel('Tag', { exact: true }).fill('e2e-tag'); await page.keyboard.press('Enter'); await page.waitForTimeout(1000);
      ctx.check((await B.dealsState(page)).every(d => (d.tags || []).includes('e2e-tag')), 'bulk tag added');
      if ((await B.selState(page)).selected.length === 0) await page.getByLabel('Select all deals').check();
      await page.getByLabel('Schedule follow-up').fill('2030-05-06'); await page.waitForTimeout(1000);
      const fu = (await B.dealsState(page)).map(d => d.nextFollowUp && String(d.nextFollowUp).slice(0, 10));
      ctx.check(fu.every(x => x && x.startsWith('2030-05-06')) || fu.every(x => !!x), 'bulk follow-up date set: ' + fu[0]);
      if ((await B.selState(page)).selected.length === 0) await page.getByLabel('Select all deals').check();
      await page.getByRole('button', { name: /^Favorite$/ }).click(); await page.waitForTimeout(1000);
      ctx.check((await B.dealsState(page)).every(d => d.isFavorite), 'bulk favorite');
      await shot('bulk-done');
      if ((await B.selState(page)).selected.length === 0) await page.getByLabel('Select all deals').check();
      await page.getByRole('button', { name: /Set owner/ }).click(); await page.waitForTimeout(500);
      await shot('owner-picker');
      await page.getByText('Alex Rivera', { exact: true }).last().click(); await page.waitForTimeout(1200);
      const owners = (await B.dealsState(page)).map(d => d.assignedTo);
      ctx.check(owners.every(o => o === 'Alex Rivera'), 'bulk owner set to Alex Rivera: ' + owners.join(','));
      if (fake) {
        await page.reload(); await B.openBoard(page);
        const st = await B.dealsState(page);
        ctx.check(st.every(d => d.priority === 'low' && (d.tags || []).includes('e2e-tag') && d.isFavorite), 'bulk edits survive reload (fake DB)');
      }
      await context.close();
    });

    await ctx.step('delete -> trash -> restore', async () => {
      const { page, context, fake, shot } = await open();
      await selectAllInTable(page);
      const total = (await B.dealsState(page)).length;
      // select just first two
      await page.getByLabel('Clear selection').click();
      const ids = await page.evaluate(() => [...document.querySelectorAll('tr[data-deal-id]')].map(e => e.getAttribute('data-deal-id')).slice(0, 2));
      for (const id of ids) await page.locator(`tr[data-deal-id="${id}"] input[type=checkbox]`).first().check();
      await page.getByLabel('Bulk actions').getByRole('button', { name: 'Delete' }).first().click();
      await page.getByLabel('Bulk actions').getByRole('button', { name: 'Delete' }).last().click(); await page.waitForTimeout(1000);
      ctx.check((await B.dealsState(page)).length === total - 2, 'two deals soft-deleted from board');
      ctx.check((await B.trashState(page)).length === 2, 'two deals in trash store');
      if (fake) ctx.check(fake.table('deals').filter(d => d.deleted_at).length === 2, 'fake DB: deleted_at set on two rows (soft delete)');
      // open trash through command palette action
      await page.keyboard.press('Control+k'); await page.getByLabel('Search deals, contacts and actions').fill('deleted'); await page.waitForTimeout(400); await page.keyboard.press('Enter');
      await page.getByRole('button', { name: /Restore/ }).first().waitFor({ timeout: 6000 });
      await shot('trash');
      await page.getByRole('button', { name: /Restore/ }).first().click(); await page.waitForTimeout(1000);
      ctx.check((await B.dealsState(page)).length === total - 1, 'restore brings one deal back');
      if (fake) ctx.check(fake.table('deals').filter(d => d.deleted_at).length === 1, 'fake DB: deleted_at cleared on restore');
      await context.close();
    });

    await ctx.step('export CSV / XLSX / JSON content + counts', async () => {
      const { page, context } = await open();
      const st = await B.dealsState(page);
      for (const f of ['CSV', 'XLSX', 'JSON']) {
        await page.getByRole('button', { name: /^Export/ }).first().click();
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByRole('menuitem', { name: f, exact: true }).last().click()]);
        const file = path.join(dlDir, `${ctx.mode}-${dl.suggestedFilename()}`); await dl.saveAs(file);
        ctx.check(dl.suggestedFilename().toLowerCase().endsWith('.' + f.toLowerCase()), `${f} filename ${dl.suggestedFilename()}`);
        if (f === 'CSV') {
          const rows = parseCsv(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
          ctx.check(rows.length - 1 === st.length, `CSV has header + ${st.length} rows (got ${rows.length - 1})`);
          const titleCol = rows[0].findIndex(h => h.toLowerCase() === 'title');
          ctx.check(titleCol >= 0 && st.every(d => rows.some(r => r[titleCol] === d.title)), 'CSV titles match board deals');
        } else if (f === 'JSON') {
          const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
          const list = Array.isArray(arr) ? arr : arr.deals || [];
          ctx.check(list.length === st.length, `JSON has ${list.length} deals (expected ${st.length})`);
        } else {
          const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
          const ws = wb.worksheets[0];
          ctx.check(ws.rowCount - 1 === st.length, `XLSX has ${ws.rowCount - 1} data rows (expected ${st.length})`);
          const headers = ws.getRow(1).values.map(String);
          ctx.check(headers.some(h => h.toLowerCase() === 'title') && headers.some(h => h.toLowerCase() === 'value'), 'XLSX header has Title/Value');
        }
      }
      await context.close();
    });

    await ctx.step('import wizard: CSV happy path, bad rows, duplicates, unknown stage', async () => {
      const { page, context, fake, shot } = await open();
      const before = (await B.dealsState(page)).length;
      const csv = [
        'Title,Company,Contact,Value,Stage,Priority',
        'Imported One,ImpCo,Ann,1500,Qualification,high',
        'Imported Two,ImpCo,Bob,2500,Proposal,low',
        'Imported Unknown Stage,ImpCo,Cy,3500,Pilot Phase,medium',
        ',NoTitleCo,Dee,10,Proposal,low',
        'Bad Value,BadCo,Eve,notanumber,Proposal,low',
        'Enterprise Software License,TechCorp Inc.,Sarah Johnson,75000,Qualification,high',
      ].join('\n');
      const f = path.join(dlDir, 'import.csv'); fs.writeFileSync(f, csv);
      await page.getByRole('button', { name: /^Import/ }).first().click();
      await page.getByLabel('Deal import file').setInputFiles(f);
      await page.getByRole('button', { name: 'Preview' }).waitFor({ timeout: 8000 });
      await shot('import-map');
      await page.getByRole('button', { name: 'Preview' }).click();
      await page.waitForTimeout(600); await shot('import-preview');
      const preview = await page.getByRole('dialog').innerText().catch(async () => await page.locator('body').innerText());
      ctx.check(/Pilot Phase/.test(preview), 'unknown stage "Pilot Phase" surfaced for mapping');
      ctx.check(await page.getByLabel('Stage for Pilot Phase').count() === 1, 'stage resolution select present');
      ctx.check(/duplicate/i.test(preview), 'duplicate detected in preview');
      ctx.check(/error|invalid|required|missing/i.test(preview), 'bad rows flagged in preview');
      await page.getByRole('button', { name: /^Import \d+ deal/ }).click();
      await page.getByText(/deals? created/).waitFor({ timeout: 15000 });
      await shot('import-result');
      const res = await page.getByText(/deals? created/).locator('xpath=ancestor::ul[1]').innerText();
      const created = Number((res.match(/(\d+) deals? created/) || [])[1]);
      ctx.check(created === 3, `3 valid new rows created (got ${created}): ${res.replace(/\n/g, ' | ')}`);
      ctx.check(/[1-9]\d* rows? with errors/.test(res), 'error rows counted');
      ctx.check(await page.getByRole('button', { name: /error/i }).count() > 0 || await page.getByText(/deal-import-errors|Download error/i).count() > 0, 'error CSV download offered');
      const errBtn = page.getByRole('button', { name: /error/i }).first();
      if (await errBtn.count()) {
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), errBtn.click()]);
        if (dl) { const p2 = path.join(dlDir, `${ctx.mode}-${dl.suggestedFilename()}`); await dl.saveAs(p2); ctx.check(/Title/.test(fs.readFileSync(p2, 'utf8')) && fs.readFileSync(p2, 'utf8').split('\n').length >= 2, 'error CSV downloaded with rows'); }
      }
      await page.getByRole('button', { name: /^(Done|Close)$/ }).first().click().catch(() => {});
      await page.waitForTimeout(800);
      const after = await B.dealsState(page);
      ctx.check(after.length === before + 3, `deals ${before} -> ${after.length}`);
      const stages = await B.stagesState(page);
      ctx.check(stages.some(s => /pilot phase/i.test(s.name)), 'new stage "Pilot Phase" created');
      const unk = after.find(d => d.title === 'Imported Unknown Stage');
      ctx.check(unk && stages.find(s => s.key === unk.stage)?.name.match(/pilot/i), 'unknown-stage deal placed in new stage');
      ctx.check(after.filter(d => d.title === 'Enterprise Software License').length === 1, 'duplicate row was not re-imported (skip policy)');
      if (fake) {
        ctx.check(fake.table('deals').filter(d => d.title && d.title.startsWith('Imported')).length === 3, 'fake DB: 3 imported deals persisted');
        ctx.check(fake.table('pipeline_stages').some(s => /pilot phase/i.test(s.name)), 'fake DB: new stage persisted');
      }
      await context.close();
    });
  }
}];
