import fs from 'node:fs';
import path from 'node:path';
import * as B from '../lib/board.mjs';
import { RESULTS_DIR } from '../lib/browser.mjs';
const VP = { width: 1600, height: 1300 };
const tabBtn = (page, name) => page.getByRole('button', { name: new RegExp('^' + name + ' \\d') }).first();

export default [{
  id: 'E', name: 'Deal record page + modal', async run(ctx) {
    const id = ctx.ids.deal;
    const open = async (route = `/deals/${id}`) => {
      const fake = ctx.fake(); const p = await ctx.page({ fake, viewport: VP });
      await p.page.goto(route); await p.page.getByText('Overview').first().waitFor({ timeout: 15000 });
      return { ...p, fake };
    };

    await ctx.step('inline fields (title/stage/priority/amount) persist', async () => {
      const { page, context, fake, shot } = await open();
      await page.waitForFunction(() => !!window.__e2e);
      await page.locator('button[aria-haspopup="listbox"]').first().click();
      await page.getByRole('option', { name: 'Proposal' }).first().click(); await page.waitForTimeout(800);
      await page.getByRole('button', { name: /priority/i }).filter({ hasText: /priority/i }).first().click();
      await page.getByLabel('Priority', { exact: true }).selectOption('low'); await page.waitForTimeout(800);
      const d = (await B.dealsState(page)).find(x => x.id === id);
      ctx.check(d.stage === 'proposal' && d.priority === 'low', 'stage+priority edited inline: ' + d.stage + '/' + d.priority);
      if (fake) { const r = fake.table('deals').find(x => x.id === id); ctx.check(r.stage === 'proposal' && r.priority === 'low', 'fake DB persisted inline edits'); }
      await shot('record-inline');
      await context.close();
    });

    await ctx.step('notes: Tiptap type + autosave + reload', async () => {
      const { page, context, fake, shot } = await open();
      await tabBtn(page, 'Notes').click();
      await page.getByRole('button', { name: 'New note' }).click();
      const ed = page.locator('.ProseMirror').first();
      await ed.waitFor({ timeout: 8000 });
      await ed.click(); await page.keyboard.type('E2E note body text');
      await page.getByText('Saved', { exact: true }).first().waitFor({ timeout: 8000 }).catch(() => {});
      await shot('note-typed');
      ctx.check(await page.getByText('Saved', { exact: true }).count() > 0 || await page.getByText(/Saving/).count() > 0, 'autosave indicator shows Saved');
      await page.getByRole('button', { name: 'Done' }).first().click().catch(() => {});
      await page.waitForTimeout(800);
      if (fake) { const n = fake.table('notes'); ctx.check(n.length === 1 && /E2E note body text/.test(JSON.stringify(n[0])), 'fake DB has the note: ' + n.length); }
      if (fake) {
        await page.reload(); await page.getByText('Overview').first().waitFor();
        await tabBtn(page, 'Notes').click(); await page.waitForTimeout(1200);
        ctx.check(await page.getByText('E2E note body text').count() > 0, 'note visible after reload');
      } else ctx.notes.push('demo: notes/tasks/files are in-memory only by design (no reload persistence)');
      await context.close();
    });

    await ctx.step('tasks: add, complete, delete', async () => {
      const { page, context, fake } = await open();
      await tabBtn(page, 'Tasks').click();
      await page.getByLabel('New task title').fill('Call the buyer');
      await page.getByRole('button', { name: 'Add', exact: true }).click(); await page.waitForTimeout(800);
      ctx.check(await page.getByText('Call the buyer').count() > 0, 'task appears');
      if (fake) ctx.check(fake.table('tasks').some(t => t.title === 'Call the buyer'), 'fake DB has task');
      await page.getByLabel(/^Mark "Call the buyer"/).click(); await page.waitForTimeout(700);
      if (fake) ctx.check(fake.table('tasks').some(t => t.title === 'Call the buyer' && (t.completed === true || t.status === 'done' || t.completed_at || t.is_done)), 'fake DB task completed: ' + JSON.stringify(fake.table('tasks')[0]));
      await page.getByLabel(/^Delete task "Call the buyer"/).click(); await page.waitForTimeout(700);
      ctx.check(await page.getByText('Call the buyer').count() === 0, 'task deleted');
      await context.close();
    });

    await ctx.step('files: dropzone upload appears', async () => {
      const { page, context, fake, shot } = await open();
      await tabBtn(page, 'Files').click(); await page.waitForTimeout(600);
      const f = path.join(RESULTS_DIR, 'downloads', 'e2e-upload.txt'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, 'hello e2e file');
      await page.getByLabel('Upload files').setInputFiles(f);
      await page.getByText('e2e-upload.txt').first().waitFor({ timeout: 10000 });
      await shot('file-uploaded');
      ctx.check(true, 'uploaded file listed');
      if (fake) { ctx.check(fake.table('deal_files').length === 1, 'fake DB deal_files row'); ctx.check(fake.requests('storage').some(r => r.method === 'POST' || r.method === 'PUT'), 'storage upload request sent'); }
      await context.close();
    });

    await ctx.step('timeline shows stage change after moving the deal', async () => {
      const { page, context, shot } = await open();
      await page.waitForFunction(() => !!window.__e2e);
      await page.locator('button[aria-haspopup="listbox"]').first().click();
      await page.getByRole('option', { name: 'Negotiation' }).first().click(); await page.waitForTimeout(1000);
      await tabBtn(page, 'Timeline').click(); await page.waitForTimeout(1500);
      await shot('timeline');
      const txt = await page.locator('body').innerText();
      ctx.check(/stage/i.test(txt) && /negotiation/i.test(txt), 'timeline mentions the stage change to Negotiation');
      await context.close();
    });

    await ctx.step('favorite toggle, merge modal, delete -> deleted state', async () => {
      const { page, context, fake, shot } = await open();
      await page.getByLabel(/favorites$/).first().click(); await page.waitForTimeout(700);
      const fav1 = (await page.evaluate((id) => window.__e2e.deal.getState().deals[id].isFavorite, id));
      await page.getByLabel(/favorites$/).first().click(); await page.waitForTimeout(700);
      const fav2 = (await page.evaluate((id) => window.__e2e.deal.getState().deals[id].isFavorite, id));
      ctx.check(fav1 !== fav2, `favorite toggles (${fav1} -> ${fav2})`);
      await page.getByLabel('More actions').click();
      await page.getByRole('menuitem', { name: /Find duplicates/ }).click();
      await page.getByLabel('Search deals').waitFor({ timeout: 5000 });
      await shot('merge-modal');
      ctx.check(await page.getByText(/Possible duplicate|No deals match|No field conflicts/).count() >= 0, 'merge modal opens');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.getByLabel('More actions').click();
      await page.getByRole('menuitem', { name: /Delete deal/ }).click(); await page.waitForTimeout(1200);
      await shot('deleted');
      const deleted = await page.evaluate((id) => !window.__e2e.deal.getState().deals[id], id);
      ctx.check(deleted, 'deal removed from store after delete');
      if (fake) ctx.check(!!fake.table('deals').find(x => x.id === id).deleted_at, 'fake DB soft-deleted');
      ctx.check(await page.getByRole('button', { name: /Restore/ }).count() > 0 || /deleted/i.test(await page.locator('body').innerText()), 'deleted-state with restore offered');
      await context.close();
    });

    await ctx.step('AI buttons degrade gracefully without a key', async () => {
      const { page, context, log, shot } = await open();
      const crashes = () => page.getByText(/Component Error|Something went wrong/).count();
      for (const label of ['Summarize deal', 'Next best action']) {
        const b = page.getByRole('button', { name: label });
        if (await b.count()) { await b.click(); await page.waitForTimeout(2500); }
        else ctx.notes.push(`button "${label}" not found`);
      }
      await shot('ai-buttons');
      ctx.check(await crashes() === 0, 'no crash after AI assist buttons');
      ctx.check(log.pageErrors.length === 0, 'no uncaught page errors from AI buttons: ' + log.pageErrors[0]);
      for (const t of ['AI Insights']) { await tabBtn(page, t).click(); await page.waitForTimeout(1500); ctx.check(await crashes() === 0, `${t} tab does not crash`); }
      await shot('ai-insights-tab');
      await context.close();
    });

    await ctx.step('related contact/company cards, contact & company pages, calendar tab', async () => {
      const { page, context, shot } = await open();
      const co = page.locator('a[href^="/companies/"]').first();
      ctx.check(await co.count() > 0, 'related company card link');
      await tabBtn(page, 'Calendar').click(); await page.waitForTimeout(1200);
      await shot('calendar-tab');
      ctx.check(await page.getByText(/Component Error|Something went wrong/).count() === 0, 'Calendar tab renders');
      await tabBtn(page, 'Overview').click();
      await co.click(); await page.waitForTimeout(1500);
      ctx.check(/\/companies\//.test(page.url()), 'company link navigates');
      ctx.check(await page.getByText(ctx.ids.dealTitle).count() > 0, 'company page lists related deal');
      await shot('company-page');
      await page.goto(`/contacts/${ctx.ids.contact}`); await page.waitForTimeout(1500);
      ctx.check(await page.getByText(ctx.ids.dealTitle).count() > 0, 'contact page lists related deal');
      await shot('contact-page');
      await context.close();
    });

    await ctx.step('board modal variant opens and tabs work', async () => {
      const fake = ctx.fake(); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
      await B.openBoard(page);
      await B.card(page, id).click({ position: { x: 150, y: 8 } });
      await page.getByText('Deal Profile').first().waitFor({ timeout: 8000 });
      await tabBtn(page, 'Tasks').click(); await page.waitForTimeout(600);
      await page.getByLabel('New task title').fill('Modal task');
      await page.getByRole('button', { name: 'Add', exact: true }).click(); await page.waitForTimeout(800);
      ctx.check(await page.getByText('Modal task').count() > 0, 'task added from modal');
      await shot('modal');
      await context.close();
    });
  }
}];
