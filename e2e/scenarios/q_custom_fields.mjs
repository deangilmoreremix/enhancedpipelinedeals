import fs from 'node:fs';
import * as B from '../lib/board.mjs';
import { defaultSeed } from '../lib/fakeSupabase.mjs';

// Custom fields for deals / contacts / companies end to end (demo + strict fake): Data model settings, contact page value,
// board filter by a deal custom field, formula field, company rollup, CSV export header, duplicate companies scan + merge.
const VP = { width: 1900, height: 2200 };
const CO_TECH = 'c1000000-0000-4000-8000-000000000001';
const CO_DUPE_A = 'a1000000-0000-4000-8000-000000000001';
const CO_DUPE_B = 'b1000000-0000-4000-8000-000000000001';
const slug = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

/** Fake seed: valid-uuid companies (TechCorp + two duplicates "Dupe Industries") linked to deals. */
function seed() {
  const s = defaultSeed();
  const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
  const old = s.companies[0].id;
  s.companies[0].id = CO_TECH;
  s.deals.forEach(d => { if (d.company_id === old) d.company_id = CO_TECH; });
  s.companies.push(
    { id: CO_DUPE_A, name: 'Dupe Industries', domain: 'dupe.com', industry: 'Manufacturing', created_at: iso(-9), updated_at: iso(-9) },
    { id: CO_DUPE_B, name: 'DUPE INDUSTRIES', phone: '555-0100', created_at: iso(-8), updated_at: iso(-8) },
  );
  const d2 = s.deals.find(d => d.title === 'Marketing Automation Platform'); d2.company = 'DUPE INDUSTRIES'; d2.company_id = CO_DUPE_B;
  const d3 = s.deals.find(d => d.title === 'Cloud Infrastructure Setup'); d3.company = 'Dupe Industries'; d3.company_id = CO_DUPE_A;
  return s;
}

export default [{
  id: 'Q', name: 'Custom fields, formulas, rollups, duplicates', async run(ctx) {
    const fake = ctx.fake(seed());
    const { page, context, log, shot } = await ctx.page({ fake, viewport: VP });
    const fake_ = ctx.mode === 'fake';
    const dealId = ctx.ids.deal;
    const stateOf = (id) => page.evaluate((i) => { const d = window.__e2e.deal.getState().deals[i]; return d ? { id: d.id, value: d.value, probability: d.probability, company: d.company, companyId: d.companyId, customFields: d.customFields } : null; }, id);
    const waitStore = async () => {
      await page.waitForFunction(() => !!window.__e2e, null, { timeout: 15000 });
      await page.waitForFunction(() => Object.keys(window.__e2e.deal.getState().deals).length > 0, null, { timeout: 15000 });
    };
    const settings = async (tab) => {
      await page.goto('/settings/data-model');
      await page.getByRole('tab', { name: tab }).waitFor({ timeout: 15000 });
      await page.getByRole('tab', { name: tab }).click();
    };
    const addField = async (name, type, extra) => {
      await page.getByLabel('New field name').fill(name);
      await page.getByLabel('Field type').selectOption(type);
      if (extra) await extra();
      await page.getByRole('button', { name: /^Add field$/ }).click();
      await page.getByRole('row', { name: new RegExp(name) }).waitFor({ timeout: 8000 });
    };

    await ctx.step('Data model: add a contact custom field (and the deal / company fields used below)', async () => {
      await settings('Contacts');
      await addField('Favourite colour', 'text');
      await shot('data-model-contact');
      ctx.check(await page.getByTestId('field-row-favourite_colour').count() === 1, 'contact field listed with its key in the Data model table');
      if (fake_) ctx.check(fake.table('deal_field_definitions').some(r => r.key === 'favourite_colour' && r.entity_type === 'contact'), 'definition persisted with entity_type=contact');
      ctx.check(await page.getByText('Region').count() === 0, 'deal fields are not listed under Contacts');

      await page.getByRole('tab', { name: 'Deals' }).click();
      await addField('Region', 'select', async () => { await page.getByLabel('New field options').fill('EMEA\nAPAC'); });
      await addField('Weighted value', 'formula', async () => { await page.getByLabel('Formula').fill('{value} * {probability} / 100'); });
      if (fake_) ctx.check(fake.table('deal_field_definitions').some(r => r.key === 'weighted_value' && r.type === 'formula' && r.entity_type === 'deal' && r.options?.formula === '{value} * {probability} / 100'), 'formula stored in options with entity_type=deal');

      await page.getByRole('tab', { name: 'Companies' }).click();
      await addField('Open pipeline', 'rollup', async () => { await page.getByLabel('Rollup metric').selectOption('open_deal_value'); });
      await shot('data-model-company');
      if (fake_) ctx.check(fake.table('deal_field_definitions').some(r => r.key === 'open_pipeline' && r.type === 'rollup' && r.entity_type === 'company'), 'rollup stored with entity_type=company');
    });

    await ctx.step('contact page: set a custom value, it persists across reload', async () => {
      await page.goto(`/contacts/${ctx.ids.contact}`);
      const section = page.locator('section[aria-label="Custom fields"]');
      await section.getByText('Favourite colour').first().waitFor({ timeout: 15000 });
      await section.getByRole('button', { name: 'Empty' }).first().click();
      await page.getByLabel('Favourite colour', { exact: true }).fill('Teal');
      await page.keyboard.press('Enter');
      await section.getByText('Teal').first().waitFor({ timeout: 8000 });
      await shot('contact-value');
      ctx.check(true, 'value shown after saving');
      if (fake_) ctx.check(fake.table('contacts').some(c => c.id === ctx.ids.contact && c.custom_fields?.favourite_colour === 'Teal'), 'contacts.custom_fields written');
      await page.reload();
      await page.locator('section[aria-label="Custom fields"]').getByText('Teal').first().waitFor({ timeout: 15000 });
      ctx.check(true, 'value still there after reload');
    });

    await ctx.step('board: filter by a deal custom field (select) through the shared engine', async () => {
      await B.openBoard(page);
      const ids = [dealId, ctx.ids.deal.replace(/1$/, '3')];
      const other = ctx.ids.deal.replace(/1$/, '2');
      // demo ids are deal-1..; fake ids are ...0001..
      const idOf = (n) => (ctx.mode === 'fake' ? `00000000-0000-4000-8000-00000000000${n}` : `deal-${n}`);
      await page.evaluate(async ([a, b, c]) => {
        const st = window.__e2e.deal.getState();
        await st.updateDeal(a, { customFields: { region: 'EMEA' } });
        await st.updateDeal(b, { customFields: { region: 'EMEA' } });
        await st.updateDeal(c, { customFields: { region: 'APAC' } });
      }, [idOf(1), idOf(3), idOf(2)]);
      await page.waitForTimeout(600);
      const visible = () => page.evaluate(() => [...document.querySelectorAll('[data-deal-id]')].map(e => e.getAttribute('data-deal-id')));
      const all = (await visible()).length;
      await page.getByRole('button', { name: /add filter/i }).first().click();
      const dlg = page.getByRole('dialog', { name: 'Add filter' });
      await dlg.waitFor({ timeout: 5000 });
      await dlg.locator('select').first().selectOption({ label: 'Region' });
      await dlg.locator('select').nth(2).selectOption('EMEA').catch(async () => { await dlg.getByRole('combobox').last().selectOption({ label: 'EMEA' }); });
      await shot('custom-filter-editor');
      await dlg.getByRole('button', { name: 'Add filter' }).click();
      await page.waitForTimeout(600);
      const filtered = await visible();
      ctx.check(all > 2 && filtered.length === 2 && filtered.includes(idOf(1)) && filtered.includes(idOf(3)), `Region = EMEA narrows ${all} -> ${filtered.length}: ${filtered.join(',')}`);
      ctx.check(await page.getByText(/Region/).count() > 0, 'filter chip is labelled with the custom field');
      await shot('custom-filtered');
      // table view shows the same deals + a Region column from the column chooser
      await page.getByRole('button', { name: 'Table' }).first().click().catch(() => {});
      await page.getByRole('button', { name: 'Columns' }).click();
      await page.getByLabel('Show Region').check();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const rows = await page.locator('[data-testid="deal-table-view"] tbody tr').count();
      ctx.check(rows === 2, `table view agrees with the board filter (${rows} rows)`);
      ctx.check(await page.locator('[data-testid="deal-table-view"] thead').getByText('Region').count() > 0, 'Region column added from the column chooser');
      await shot('custom-table');
      // leave the board clean for the following steps (demo deals are not persisted across reloads)
      await page.evaluate(() => { const v = window.__e2e.view.getState(); v.clearFilters(); v.setCurrentView('kanban'); });
    });

    await ctx.step('formula field computes on the deal page (read-only)', async () => {
      await page.goto(`/deals/${dealId}`);
      const section = page.locator('section[aria-label="Custom fields"]');
      await section.getByText('Weighted value').first().waitFor({ timeout: 15000 });
      await waitStore();
      const d = await stateOf(dealId);
      const expected = (d.value * d.probability) / 100;
      const cell = section.getByTestId('computed-weighted_value');
      const aria = await cell.locator('[aria-label]').first().getAttribute('aria-label');
      ctx.check(aria === `Weighted value: ${expected.toLocaleString('en-US', { maximumFractionDigits: 4 })}`, `formula shows ${expected} (aria: ${aria})`);
      ctx.check(await cell.getByRole('button').count() === 0, 'formula cell has no editor');
      await shot('formula');
    });

    await ctx.step('company page: rollup shows the company deal numbers', async () => {
      await page.goto('/');
      await B.openBoard(page);
      const d = await stateOf(dealId);
      const route = ctx.mode === 'fake' ? `/companies/${CO_TECH}` : `/companies/local-co-${slug(d.company)}`;
      await page.goto(route);
      const section = page.locator('section[aria-label="Custom fields"]');
      await section.getByText('Open pipeline').first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(1200);
      await waitStore();
      const expected = await page.evaluate((name) => {
        const st = window.__e2e.deal.getState();
        const won = new Set(st.stages.filter(s => s.isWon).map(s => s.key)); const lost = new Set(st.stages.filter(s => s.isLost).map(s => s.key));
        return Object.values(st.deals).filter(x => !x.deletedAt && x.company?.trim().toLowerCase() === name.trim().toLowerCase() && !won.has(x.stage) && !lost.has(x.stage)).reduce((s, x) => s + x.value, 0);
      }, d.company);
      const label = await section.getByTestId('computed-open_pipeline').locator('[aria-label]').first().getAttribute('aria-label');
      ctx.check(label === `Open pipeline: ${money(expected)}`, `rollup shows ${money(expected)} (aria: ${label})`);
      await shot('rollup');
    });

    await ctx.step('board CSV export has a column per active custom field', async () => {
      await B.openBoard(page);
      await waitStore();
      await page.evaluate(async (id) => { await window.__e2e.deal.getState().updateDeal(id, { customFields: { region: 'EMEA' } }); }, dealId); // demo deals reset on reload
      await page.waitForTimeout(400);
      await page.locator('button[aria-haspopup="true"]', { hasText: 'Export' }).click();
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.getByRole('menuitem', { name: 'CSV' }).first().click(),
      ]);
      const text = fs.readFileSync(await download.path(), 'utf8').replace(/^﻿/, '');
      const header = text.split(/\r?\n/)[0];
      ctx.check(/Region/.test(header) && /Weighted value/.test(header), `CSV header contains the custom fields: ${header.slice(-60)}`);
      ctx.check(/EMEA/.test(text), 'CSV rows contain custom values');
      const d = await stateOf(dealId);
      const line = text.split(/\r?\n/).find(l => l.includes(ctx.ids.dealTitle)) ?? '';
      ctx.check(line.split(',').includes(String((d.value * d.probability) / 100)), `formula computed in the export (${(d.value * d.probability) / 100}) in: ${line.slice(-50)}`);
      await shot('export-done');
    });

    await ctx.step('duplicate companies: scan, pick survivor, confirm, merge', async () => {
      let route; let survivorName = 'Dupe Industries'; let dupIds = [];
      if (ctx.mode === 'fake') route = `/companies/${CO_DUPE_A}`;
      else {
        await page.goto('/'); await waitStore();
        const ids = await page.evaluate(async () => {
          const c = window.__e2e.company.getState();
          const a = await c.create('Dupe Industries', { domain: 'dupe.com', industry: 'Manufacturing' });
          const b = await c.create('Dupe Industries Ltd', { domain: 'www.dupe.com', phone: '555-0100' });
          return [a.id, b.id];
        });
        dupIds = ids;
        route = `/companies/${ids[0]}`;
      }
      await page.goto(route);
      if (ctx.mode !== 'fake') { await waitStore(); await page.evaluate(async (cid) => { await window.__e2e.deal.getState().updateDeal('deal-2', { company: 'Dupe Industries Ltd', companyId: cid }); }, dupIds[1]); }
      await page.getByRole('button', { name: /Find duplicate companies/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Find duplicate companies' });
      const group = dlg.getByTestId('duplicate-group');
      await group.first().waitFor({ timeout: 10000 });
      await shot('duplicates-dialog');
      ctx.check(await group.count() >= 1, 'scan lists the duplicate group');
      await group.first().getByRole('radio', { name: `Keep ${survivorName}`, exact: true }).check();
      await group.first().getByRole('button', { name: /Merge into selected/ }).click();
      ctx.check(await group.first().getByRole('alert').count() === 1, 'a confirm step is shown before merging');
      if (fake_) ctx.check(fake.table('companies').filter(c => c.deleted_at).length === 0, 'nothing merged before the confirmation');
      await group.first().getByRole('button', { name: 'Confirm merge' }).click();
      await dlg.getByText(/No duplicate companies found/).waitFor({ timeout: 10000 });
      ctx.check(true, 'merge completes and the rescan finds no duplicates');
      if (fake_) {
        const dupB = fake.table('companies').find(c => c.id === CO_DUPE_B);
        const dupA = fake.table('companies').find(c => c.id === CO_DUPE_A);
        ctx.check(!!dupB.deleted_at && !dupA.deleted_at, 'loser soft-deleted (deleted_at), survivor kept');
        ctx.check(fake.table('deals').find(d => d.title === 'Marketing Automation Platform').company_id === CO_DUPE_A, 'deals repointed to the survivor');
        ctx.check(dupA.phone === '555-0100', 'missing field copied onto the survivor');
      } else {
        const d2 = await stateOf('deal-2');
        ctx.check(d2.company === 'Dupe Industries', `deal moved to the survivor (company: ${d2.company})`);
      }
      await shot('duplicates-merged');
    });

    const errs = ctx.errs(log);
    ctx.check(log.pageErrors.length === 0, 'no page errors: ' + log.pageErrors[0]);
    ctx.check(errs.filter(e => !/^REQ /.test(e)).length === 0, 'no console errors: ' + errs[0]);
    await context.close();
  },
}];
