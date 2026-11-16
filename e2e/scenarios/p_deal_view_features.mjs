import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as B from '../lib/board.mjs';
import { RESULTS_DIR } from '../lib/browser.mjs';
import { defaultSeed } from '../lib/fakeSupabase.mjs';

// Deal view features end to end (demo + strict fake): side panel, every tab, custom fields, mentions + bell, linked notes,
// task status/filter, file rename, duplicate warning + per-field merge, trash purge, clone, tab prefs, palette, pins, shortcuts.
const VP = { width: 1600, height: 1300 };
const tabBtn = (page, name) => page.getByRole('navigation', { name: 'Deal sections' }).getByRole('button', { name: new RegExp('^' + name + '( \\d)?$') });
const PLACEHOLDER = /would go here|lorem ipsum|coming soon|not yet available|mock (data|insight)|TODO/i;
const CRASH = /Component Error|Something went wrong/;

const TABS = ['Overview', 'Notes', 'Tasks', 'Files', 'Timeline', 'AI Insights', 'Assistant', 'Journey', 'Communication', 'Calendar', 'Email', 'Analytics', 'Automation', 'Management'];

export default [{
  id: 'P', name: 'Deal view features', async run(ctx) {
    const id = ctx.ids.deal;
    const open = async (route = `/deals/${id}`, opts = {}) => {
      const fake = ctx.fake(opts.seed); const p = await ctx.page({ fake, viewport: VP });
      await p.page.goto(route); await p.page.getByText('Overview').first().waitFor({ timeout: 15000 });
      await p.page.waitForFunction(() => !!window.__e2e, null, { timeout: 10000 });
      return { ...p, fake };
    };
    const palette = async (page, text) => {
      await page.keyboard.press('Control+k');
      await page.getByRole('dialog', { name: 'Command palette' }).waitFor({ timeout: 5000 });
      if (text) { await page.getByRole('dialog', { name: 'Command palette' }).getByRole('combobox').fill(text); await page.waitForTimeout(300); }
    };

    await ctx.step('side panel opens from the board, palette has "This deal", expand goes to the full page', async () => {
      const fake = ctx.fake(); const { page, context, log, shot } = await ctx.page({ fake, viewport: VP });
      await B.openBoard(page);
      await B.card(page, id).click({ position: { x: 150, y: 8 } });
      await page.getByTestId('deal-side-panel').waitFor({ timeout: 8000 });
      ctx.check(await page.getByTestId('deal-side-panel').getByText(ctx.ids.dealTitle).count() > 0, 'panel header shows the deal title');
      ctx.check(await page.getByTestId('deal-side-panel').locator('.w-80').count() === 0, 'panel is compact (no profile sidebar)');
      await shot('panel');
      await palette(page);
      ctx.check(await page.getByRole('group', { name: 'This deal' }).count() > 0, 'Ctrl+K shows the "This deal" group while the panel is open');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Expand to full page' }).click();
      await page.waitForURL(new RegExp(`/deals/${id}$`), { timeout: 8000 });
      await page.getByText('Deal Profile').first().waitFor({ timeout: 8000 });
      ctx.check(true, 'Expand navigates to /deals/:id and shows the full record');
      await page.goBack(); await B.openBoard(page);
      await B.card(page, id).click({ position: { x: 150, y: 8 } });
      await page.getByTestId('deal-side-panel').waitFor();
      await page.getByRole('button', { name: 'Close panel' }).click();
      ctx.check(await page.getByTestId('deal-side-panel').count() === 0, 'Close hides the panel');
      ctx.check(log.pageErrors.length === 0, 'no page errors: ' + log.pageErrors[0]);
      await context.close();
    });

    await ctx.step('every tab shows real content (no placeholders or mock text)', async () => {
      const { page, context, shot } = await open();
      for (const t of TABS) {
        await tabBtn(page, t).click(); await page.waitForTimeout(900);
        const txt = await page.locator('body').innerText();
        ctx.check(!PLACEHOLDER.test(txt), `${t}: no placeholder text` + (PLACEHOLDER.test(txt) ? ' -> ' + txt.match(PLACEHOLDER)[0] : ''));
        ctx.check(!CRASH.test(txt), `${t}: no crash`);
        if (t === 'Management' && ctx.mode === 'demo') ctx.check(/health|probability|template/i.test(txt) && !/No management tools are enabled/.test(txt), 'Management tab is not empty in demo mode');
        if (t === 'Automation') ctx.check(/Workflows/.test(txt), 'Automation tab shows the workflows panel');
        if (t === 'Analytics') await shot('analytics');
      }
      await context.close();
    });

    await ctx.step('sidebar controls are live: Meet, Files, Insights, Analytics, Add Field, AI Goals, SDR agents', async () => {
      const { page, context, log, shot } = await open();
      const side = page.locator('.w-80').first();
      await side.getByRole('button', { name: /^Meet$/ }).click();
      ctx.check(await tabBtn(page, 'Calendar').getAttribute('aria-current') === 'page', 'Meet switches to the Calendar tab');
      if (ctx.mode === 'fake') ctx.check(await page.getByRole('form', { name: 'Schedule meeting' }).count() > 0, 'Meet opens the schedule form');
      await side.getByRole('button', { name: /^Files$/ }).click();
      ctx.check(await tabBtn(page, 'Files').getAttribute('aria-current') === 'page', 'Files button switches to Files');
      await side.getByRole('button', { name: /^Insights$/ }).click();
      ctx.check(await tabBtn(page, 'AI Insights').getAttribute('aria-current') === 'page', 'Insights button switches to AI Insights');
      await side.getByRole('button', { name: /^Analytics$/ }).click();
      ctx.check(await tabBtn(page, 'Analytics').getAttribute('aria-current') === 'page', 'Analytics button switches to Analytics');
      await side.getByRole('button', { name: /Add Field/ }).click();
      ctx.check(await page.getByLabel('New field name').count() > 0, 'Add Field opens the custom field manager');
      await page.keyboard.press('Escape');
      await side.getByRole('button', { name: 'AI Goals' }).click(); await page.waitForTimeout(1500);
      ctx.check(await page.getByText(/Could not generate goals|returned no goals|Generat|Goals/i).count() > 0, 'AI Goals opens its panel (error is shown when the gateway is down)');
      // the AI Goals panel is not a modal dialog, so Esc would close the record: close it with its own control
      await page.getByRole('button', { name: 'Close', exact: true }).last().click().catch(() => {});
      await page.goto(`/deals/${id}`); await page.getByText('Overview').first().waitFor({ timeout: 15000 });
      await side.getByRole('button', { name: /^Edit$/ }).click();
      ctx.check(await page.getByLabel('Title', { exact: true }).count() > 0, 'Edit focuses the inline title editor');
      await page.keyboard.press('Escape');
      ctx.check(await page.getByText('AI SDR:').count() > 0, 'SDR button group is visible');
      await page.getByRole('button', { name: /^(?!Configure).*(SDR|Enrich Contact|Handle Objections)$/ }).first().click();
      await page.getByRole('dialog', { name: / results$/ }).waitFor({ timeout: 8000 });
      await page.waitForTimeout(1500);
      await shot('sdr-results');
      ctx.check(await page.getByRole('dialog', { name: / results$/ }).getByRole('alert').count() > 0 || await page.getByRole('dialog', { name: / results$/ }).getByText(/Draft|Approval required/).count() > 0, 'SDR run shows a result or an error in the results modal');
      ctx.check(log.pageErrors.length === 0, 'no page errors: ' + log.pageErrors[0]);
      await context.close();
    });

    await ctx.step('custom field: add, then edit its value on the Overview', async () => {
      const { page, context, fake, shot } = await open();
      await page.getByRole('button', { name: /Manage fields/ }).first().click();
      await page.getByLabel('New field name').fill('Renewal risk');
      await page.getByRole('button', { name: /^Add field$/ }).click(); await page.waitForTimeout(1000);
      await shot('field-added');
      ctx.check(await page.getByRole('list', { name: 'Custom fields' }).getByText('Renewal risk').count() > 0, 'field listed in the manager');
      if (fake) ctx.check(fake.table('deal_field_definitions').some(r => r.label === 'Renewal risk'), 'definition persisted');
      await page.keyboard.press('Escape');
      const section = page.locator('section[aria-label="Custom fields"]');
      await section.getByText('Renewal risk').first().waitFor({ timeout: 5000 });
      await section.getByRole('button', { name: 'Empty' }).first().click();
      await page.getByLabel('Renewal risk', { exact: true }).fill('High'); await page.keyboard.press('Enter'); await page.waitForTimeout(1000);
      ctx.check(await section.getByText('High').count() > 0, 'custom field value shown after editing');
      if (fake) ctx.check(JSON.stringify(fake.table('deals').find(d => d.id === id)).includes('High'), 'value persisted on the deal');
      await context.close();
    });

    await ctx.step('mention a teammate in a note: bell shows it (demo) / mention row saved (fake); linked chips on the note', async () => {
      const { page, context, fake, shot } = await open();
      await tabBtn(page, 'Notes').click();
      await page.getByRole('button', { name: 'New note' }).click();
      const ed = page.locator('.ProseMirror').first(); await ed.waitFor({ timeout: 8000 });
      await ed.click(); await page.keyboard.type('ping @Sa');
      const opt = page.getByRole('listbox', { name: 'Mention a teammate' }).getByRole('option').first();
      await opt.waitFor({ timeout: 5000 });
      await opt.getByRole('button').click();
      await page.keyboard.type(' please review');
      await page.getByText('Saved', { exact: true }).first().waitFor({ timeout: 8000 }).catch(() => {});
      await page.getByRole('button', { name: 'Done' }).first().click().catch(() => {}); await page.waitForTimeout(1200);
      await shot('note-mention');
      ctx.check(await page.getByTestId('mention-chip').count() > 0, 'mention renders as a chip');
      ctx.check(await page.getByTestId('linked-chip').count() > 0, 'note shows its linked-record chips');
      if (fake) ctx.check(fake.table('note_mentions').length === 1, 'note_mentions row saved: ' + fake.table('note_mentions').length);
      else {
        await page.getByRole('button', { name: /^Notifications/ }).click();
        ctx.check(await page.getByText(/mentioned/i).count() > 0, 'bell lists the local mention notification');
        ctx.check(await page.getByTestId('notification-count').count() > 0, 'bell shows an unread count');
      }
      await context.close();
    });

    await ctx.step('tasks: status control and filters', async () => {
      const { page, context } = await open();
      await tabBtn(page, 'Tasks').click();
      for (const t of ['Open item', 'Finished item']) {
        await page.getByLabel('New task title').fill(t);
        await page.getByRole('button', { name: 'Add', exact: true }).click(); await page.waitForTimeout(700);
      }
      await page.getByRole('radiogroup', { name: 'Status of "Finished item"' }).getByRole('radio', { name: 'Done' }).click(); await page.waitForTimeout(600);
      await page.getByLabel('Filter by status').selectOption('done'); await page.waitForTimeout(300);
      ctx.check(await page.getByText('Finished item').count() > 0 && await page.getByText('Open item').count() === 0, 'status filter "Done" shows only the finished task');
      await page.getByLabel('Filter by status').selectOption('open'); await page.waitForTimeout(300);
      ctx.check(await page.getByText('Open item').count() > 0 && await page.getByText('Finished item').count() === 0, 'status filter "open" hides the finished task');
      await page.getByRole('radiogroup', { name: 'Status of "Open item"' }).getByRole('radio', { name: 'In progress' }).click(); await page.waitForTimeout(500);
      ctx.check(await page.getByRole('radiogroup', { name: 'Status of "Open item"' }).getByRole('radio', { name: 'In progress' }).getAttribute('aria-checked') === 'true', 'task moves to In progress');
      await context.close();
    });

    await ctx.step('files: rename an uploaded file', async () => {
      const { page, context, fake } = await open();
      await tabBtn(page, 'Files').click(); await page.waitForTimeout(500);
      const f = path.join(RESULTS_DIR, 'downloads', 'p-rename-me.txt'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, 'rename me');
      await page.getByLabel('Upload files').setInputFiles(f);
      await page.getByText('p-rename-me.txt').first().waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: 'Rename p-rename-me.txt' }).click();
      await page.getByLabel('New name for p-rename-me.txt').fill('p-renamed.txt');
      await page.getByRole('button', { name: 'Save name' }).click(); await page.waitForTimeout(1000);
      ctx.check(await page.getByText('p-renamed.txt').count() > 0 && await page.getByText('p-rename-me.txt').count() === 0, 'file shows its new name');
      if (fake) ctx.check(fake.table('deal_files').some(r => (r.name || r.file_name) === 'p-renamed.txt'), 'rename persisted');
      await context.close();
    });

    await ctx.step('create warns about duplicates, then per-field merge through the palette', async () => {
      const fake = ctx.fake(); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
      await B.openBoard(page);
      const before = (await B.dealsState(page)).length;
      // New deal dialog (checks title + company; the board's quick-create only sends the title)
      await palette(page, 'New deal');
      await page.getByRole('option', { name: /New deal/ }).first().click();
      await page.getByLabel('Deal title').fill(ctx.ids.dealTitle);
      await page.getByLabel('Company', { exact: true }).fill('TechCorp Inc.');
      await page.getByLabel('Value', { exact: true }).fill('1234');
      await page.getByRole('button', { name: 'Create deal' }).click();
      await page.getByRole('region', { name: 'Possible duplicates' }).waitFor({ timeout: 6000 });
      await shot('duplicate-warning');
      ctx.check(true, 'duplicate warning shown before creating');
      await page.getByRole('button', { name: 'Create anyway' }).click(); await page.waitForTimeout(1200);
      ctx.check((await B.dealsState(page)).length === before + 1, 'deal created after "Create anyway"');
      await B.card(page, id).click({ position: { x: 150, y: 8 } });
      await page.getByTestId('deal-side-panel').waitFor();
      await palette(page, 'Find duplicates');
      await page.getByRole('option', { name: /Find duplicates/ }).first().click();
      await page.getByRole('radiogroup', { name: 'Surviving deal' }).waitFor({ timeout: 6000 });
      await shot('merge-modal');
      await page.getByRole('radio', { name: /^Value:.*1,234/ }).first().click();
      await page.getByRole('button', { name: /^Merge 2 deals/ }).click(); await page.waitForTimeout(1800);
      const after = await B.dealsState(page);
      ctx.check(after.length === before, 'one deal remains after the merge: ' + after.length + ' vs ' + before);
      ctx.check(after.some(d => d.value === 1234 && d.title === ctx.ids.dealTitle), 'the chosen per-field value (1,234) survived the merge');
      await context.close();
    });

    await ctx.step('trash purge needs the typed confirmation; clone duplicates the deal', async () => {
      const { page, context, fake, shot } = await open();
      await page.getByLabel('More actions').click();
      await page.getByRole('menuitem', { name: 'Duplicate deal' }).click();
      await page.getByRole('dialog', { name: 'Duplicate deal' }).waitFor({ timeout: 5000 });
      const n0 = (await B.dealsState(page)).length;
      await page.getByRole('dialog', { name: 'Duplicate deal' }).getByRole('button', { name: /^Duplicate$/ }).click(); await page.waitForTimeout(1500);
      ctx.check((await B.dealsState(page)).length === n0 + 1, 'clone adds a deal');
      ctx.check(!page.url().endsWith(`/deals/${id}`), 'clone navigates to the new deal: ' + page.url());
      await shot('cloned');
      // delete the clone, then purge it from Deleted deals
      await page.getByLabel('More actions').click();
      await page.getByRole('menuitem', { name: /Delete deal/ }).click(); await page.waitForTimeout(1500);
      await page.getByLabel('More actions').click();
      await page.getByRole('menuitem', { name: /Deleted deals/ }).click();
      await page.getByLabel(/^Delete .* permanently$/).first().click();
      const confirm = page.getByRole('alertdialog', { name: 'Confirm permanent delete' });
      await confirm.waitFor({ timeout: 5000 });
      ctx.check(await confirm.getByRole('button', { name: 'Delete permanently' }).isDisabled(), 'purge is disabled until DELETE is typed');
      await confirm.getByLabel('Type DELETE to confirm').fill('DELETE');
      await confirm.getByRole('button', { name: 'Delete permanently' }).click(); await page.waitForTimeout(1500);
      await shot('purged');
      const trash = await B.trashState(page);
      ctx.check(trash.length === 0, 'trash is empty after the purge: ' + trash.length);
      if (fake) ctx.check(fake.table('deals').length === n0, 'row removed from the database');
      await context.close();
    });

    await ctx.step('tab customization persists after reload; Alt hint is accurate', async () => {
      const { page, context } = await open();
      await page.getByRole('button', { name: 'Customize tabs' }).click();
      await page.getByRole('checkbox', { name: 'Show Files tab' }).uncheck();
      await page.getByRole('button', { name: 'Move Tasks up' }).click(); await page.waitForTimeout(800);
      await page.keyboard.press('Escape');
      ctx.check(await tabBtn(page, 'Files').count() === 0, 'Files tab hidden');
      await page.reload(); await page.getByText('Overview').first().waitFor();
      await page.waitForTimeout(800);
      ctx.check(await tabBtn(page, 'Files').count() === 0, 'hidden tab stays hidden after reload');
      const names = await page.getByRole('navigation', { name: 'Deal sections' }).getByRole('button').allInnerTexts();
      ctx.check(/^Tasks/.test(names[1] || ''), 'reordered tabs persist: ' + names.slice(0, 3).join(' | '));
      ctx.check(await page.getByText('1-9', { exact: true }).count() > 0, 'Alt hint says 1-9 while 13 tabs are visible');
      await page.keyboard.press('Alt+2'); await page.waitForTimeout(400);
      ctx.check(await tabBtn(page, 'Tasks').getAttribute('aria-current') === 'page', 'Alt+2 selects the second visible tab');
      await page.getByRole('button', { name: 'Customize tabs' }).click();
      await page.getByRole('button', { name: 'Reset to default' }).click(); await page.waitForTimeout(600);
      await context.close();
    });

    await ctx.step('pin a deal and file a favorite in a folder; both show on the board', async () => {
      const { page, context, shot } = await open();
      await page.getByRole('button', { name: 'Pin deal' }).first().click(); await page.waitForTimeout(600);
      await page.getByLabel(/favorites$/).first().click(); await page.waitForTimeout(800);
      await page.getByRole('link', { name: 'Pipeline' }).first().click();
      await page.waitForSelector('[data-deal-id]');
      const nav = page.getByRole('navigation', { name: 'Pinned deals' });
      await nav.waitFor({ timeout: 5000 });
      ctx.check(await nav.getByText(ctx.ids.dealTitle).count() > 0, 'pinned deal appears in the board header strip');
      await nav.getByText(ctx.ids.dealTitle).click();
      await page.getByTestId('deal-side-panel').waitFor({ timeout: 5000 });
      ctx.check(true, 'pinned deal opens in the side panel');
      await page.getByRole('button', { name: 'Close panel' }).click();
      await page.getByRole('button', { name: 'Favorite folders' }).click();
      await page.getByLabel('New folder name').fill('Hot deals'); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
      await shot('folder');
      ctx.check(await page.getByRole('group', { name: 'Folder Hot deals' }).count() > 0 || await page.getByText('Hot deals').count() > 0, 'folder created');
      await page.reload(); await page.waitForSelector('[data-deal-id]');
      await page.getByRole('button', { name: 'Favorite folders' }).click(); await page.waitForTimeout(800);
      ctx.check(await page.getByText('Hot deals').count() > 0, 'folder survives reload');
      await context.close();
    });

    await ctx.step('shortcut help opens with "?" and record hotkeys work', async () => {
      const { page, context } = await open();
      await page.keyboard.press('?');
      await page.getByRole('dialog', { name: 'Deal shortcuts' }).waitFor({ timeout: 4000 });
      ctx.check(true, '"?" opens the shortcut help');
      await page.keyboard.press('Escape');
      ctx.check(await page.getByRole('dialog', { name: 'Deal shortcuts' }).count() === 0, 'Esc closes the help');
      await page.keyboard.press('n'); await page.waitForTimeout(800);
      ctx.check(await tabBtn(page, 'Notes').getAttribute('aria-current') === 'page', '"n" opens Notes');
      ctx.check(await page.locator('.ProseMirror').count() > 0, '"n" opens the note composer');
      await page.keyboard.press('Escape');
      await context.close();
    });

    await ctx.step('workflows: palette "Run workflow" focuses the panel; Run now POSTs one workflow for this deal', async () => {
      if (ctx.mode !== 'fake') { ctx.skip('deal_workflows needs a database: covered in fake mode'); return; }
      const seed = defaultSeed(); const now = new Date().toISOString();
      seed.deal_workflows = [{ id: 'f0000000-0000-4000-8000-0000000000aa', name: 'Nudge owner', description: 'd', category: 'custom', is_active: true, version: 1, created_at: now, updated_at: now, stages: [], triggers: [], settings: null, metadata: null }];
      const { page, context, shot } = await open(undefined, { seed });
      let posted = null;
      await page.route('**/api/workflow/run', r => { posted = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, executionId: 'manual:x', status: 'completed' }) }); });
      await palette(page, 'Run workflow');
      await page.getByRole('option', { name: /Run workflow/ }).first().click(); await page.waitForTimeout(1200);
      ctx.check(await tabBtn(page, 'Automation').getAttribute('aria-current') === 'page', 'palette action switches to the Automation tab');
      await shot('workflows');
      await page.getByRole('button', { name: 'Run Nudge owner now' }).click(); await page.waitForTimeout(1000);
      ctx.check(posted && posted.action === 'manual' && posted.workflowId === 'f0000000-0000-4000-8000-0000000000aa' && posted.dealId === id, 'POST body is {action:"manual", workflowId, dealId}: ' + JSON.stringify(posted));
      ctx.check(await page.getByText(/Ran "Nudge owner"/).count() > 0, 'result message shown');
      await context.close();
    });
  }
}];
