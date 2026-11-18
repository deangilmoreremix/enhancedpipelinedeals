// Contract-path scenarios (fake mode only): flows that used to hide schema/RLS bugs. The strict fake fails every
// scenario that triggers an undeclared contract violation (see lib/fakeSupabase.mjs), so each of these also proves
// the flow only touches real tables/columns/RPC args and is allowed by the real policies.
import * as B from '../lib/board.mjs';
import { defaultSeed } from '../lib/fakeSupabase.mjs';
import { DEFAULT_USER } from '../lib/browser.mjs';
import { knownFor } from '../lib/knownViolations.mjs';
const VP = { width: 1700, height: 1300 };
const D = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const nodes = (page) => page.locator('.react-flow__node');
const edges = (page) => page.locator('.react-flow__edge');
const pick = (page, label) => page.locator('aside, div').getByRole('button', { name: new RegExp('^' + label) }).first();

function seedWithWorkflow() {
  const seed = defaultSeed(); const now = new Date().toISOString();
  seed.deal_workflows = [{ id: 'f0000000-0000-4000-8000-000000000001', name: 'Seed WF', description: 'seeded', category: 'custom', is_active: true, version: 1, created_at: now, updated_at: now,
    stages: [
      { id: 't1', name: 'Stage changed', type: 'trigger', position: { x: 100, y: 40 }, connections: ['a1'], isActive: true, trigger: { id: 'tr', type: 'stage_changed', name: 'Stage changed', description: '', config: {} } },
      { id: 'a1', name: 'Create task', type: 'action', position: { x: 100, y: 220 }, connections: [], isActive: true, action: { id: 'ac', type: 'create_task', name: 'Create task', description: '', config: { fields: { title: 'Follow up' } } } },
    ], triggers: [], settings: null, metadata: null }];
  return seed;
}

export default [
  {
    id: 'I', name: 'Workflow create/edit/delete via UI persists', modes: ['fake'], async run(ctx) {
      await ctx.step('create: new workflow with trigger+action saves to deal_workflows', async () => {
        const fake = ctx.fake(); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
        await page.goto('/workflows'); await page.waitForTimeout(1500);
        await page.getByRole('button', { name: /New Workflow|Create Workflow/ }).first().click();
        await page.getByLabel('Search steps').waitFor();
        await pick(page, 'Stage changed').click(); await page.waitForTimeout(400);
        await pick(page, 'Create task').click(); await page.waitForTimeout(400);
        ctx.check(await nodes(page).count() === 2, 'trigger + action on canvas');
        await page.getByLabel('Workflow name').fill('I Created WF'); await page.waitForTimeout(200);
        const save = page.getByRole('button', { name: /^Save$/ });
        if (await save.isDisabled()) { // fill the required action title like scenario F
          await nodes(page).nth(1).click({ position: { x: 20, y: 10 } }).catch(() => {}); await page.waitForTimeout(300);
          await page.getByLabel(/^Title/).first().fill('Follow up').catch(() => {});
        }
        await save.click({ timeout: 5000 }); await page.waitForTimeout(1200);
        const rows = fake.table('deal_workflows');
        ctx.check(rows.length === 1 && rows[0].name === 'I Created WF', 'row persisted: ' + JSON.stringify(rows.map(r => r.name)));
        ctx.check(fake.requests('deal_workflows', 'POST').length === 1, 'exactly one INSERT');
        await shot('created');
        await context.close();
      });

      await ctx.step('edit: rename + save PATCHes the row and survives reload', async () => {
        const fake = ctx.fake(seedWithWorkflow()); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
        await page.goto('/workflows'); await page.waitForTimeout(1500);
        await page.getByRole('button', { name: /Edit/ }).first().click(); await page.waitForTimeout(1000);
        await page.getByLabel('Workflow name').fill('Seed WF renamed'); await page.waitForTimeout(300);
        await page.getByRole('button', { name: /^Save$/ }).click({ timeout: 5000 }); await page.waitForTimeout(1200);
        ctx.check(fake.table('deal_workflows')[0].name === 'Seed WF renamed', 'fake DB has the new name: ' + fake.table('deal_workflows')[0].name);
        ctx.check(fake.requests('deal_workflows', 'PATCH').length >= 1, 'saved with PATCH');
        await page.goto('/workflows'); await page.waitForTimeout(1500);
        ctx.check(await page.locator('h3', { hasText: 'Seed WF renamed' }).count() > 0, 'renamed workflow listed after reload');
        await shot('edited');
        await context.close();
      });

      await ctx.step('delete: removes the row; a zero-row delete surfaces an error (assertRowsAffected)', async () => {
        const fake = ctx.fake(seedWithWorkflow()); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
        await page.goto('/workflows'); await page.waitForTimeout(1500);
        await page.getByLabel('Delete workflow').first().click(); await page.waitForTimeout(1200);
        ctx.check(fake.table('deal_workflows').length === 0, 'row deleted in fake DB');
        ctx.check(await page.locator('h3', { hasText: 'Seed WF' }).count() === 0, 'card gone from the list');
        ctx.check(await page.getByText(/No Workflows Yet/).count() > 0, 'empty state shown');
        await context.close();
        // second page: the row vanishes server-side (RLS-hidden/stale) -> DELETE matches 0 rows -> 200 [] -> UI must not pretend success
        const fake2 = ctx.fake(seedWithWorkflow()); const p2 = await ctx.page({ fake: fake2, viewport: VP });
        await p2.page.goto('/workflows'); await p2.page.waitForTimeout(1500);
        fake2.tables.deal_workflows = [];
        await p2.page.getByLabel('Delete workflow').first().click(); await p2.page.waitForTimeout(1200);
        await p2.shot('zero-row-delete');
        ctx.check(fake2.requests('deal_workflows', 'DELETE').length === 1, 'DELETE was sent');
        ctx.check(await p2.page.getByText(/Could not delete|permission|not allowed/i).count() > 0, 'zero-row delete shows an error notice');
        await p2.context.close();
      });
    }
  },

  {
    id: 'J', name: 'Signed-in user reads feature flags', modes: ['fake'], async run(ctx) {
      const seed = () => { const s = defaultSeed(); s.feature_flags = [
        { id: 'ff1', feature_key: 'deal_timeline', enabled: true, rollout_percentage: 100, description: 'on', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'ff2', feature_key: 'bulk_deal_actions', enabled: false, rollout_percentage: 0, description: 'off', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]; return s; };
      const flag = (page, key) => page.evaluate(async (k) => { const m = await import('/src/services/featureFlagService.ts'); return m.FeatureFlagService.isFeatureEnabled(k); }, key);
      await ctx.step('authenticated user: enabled flag true, disabled flag false, unknown false', async () => {
        const fake = ctx.fake(seed()); const { page, context } = await ctx.page({ fake, viewport: VP });
        await page.goto('/'); await page.waitForTimeout(1500);
        ctx.check(await flag(page, 'deal_timeline') === true, 'deal_timeline enabled');
        ctx.check(await flag(page, 'bulk_deal_actions') === false, 'bulk_deal_actions disabled');
        ctx.check(await flag(page, 'does_not_exist') === false, 'unknown flag -> false');
        const reads = fake.requests('feature_flags', 'GET');
        ctx.check(reads.length >= 3 && reads.every(r => r.role === 'authenticated'), 'flag reads were made as `authenticated`: ' + [...new Set(reads.map(r => r.role))]);
        await context.close();
      });
      await ctx.step('anon (signed out) can also read flags (policy: Allow anon read access)', async () => {
        const fake = ctx.fake(seed()); const { page, context } = await ctx.page({ fake, viewport: VP, anon: true });
        fake.expectViolation({ kind: 'rls', code: 'RLS-ZERO-ROWS', target: /as anon$/ }); // signed-out users see nothing on authenticated-only tables
        await page.goto('/'); await page.waitForTimeout(1500);
        ctx.check(await flag(page, 'deal_timeline') === true, 'anon sees deal_timeline');
        await page.evaluate(() => fetch('http://fake.supabase.local/rest/v1/deal_workflows?select=id', { headers: { apikey: 'fake' } }).then(r => r.json())); // deterministic anon zero-row read
        ctx.check(fake.requests('feature_flags', 'GET').every(r => r.role === 'anon'), 'reads were anon');
        await context.close();
      });
      await ctx.step('initialize_all_feature_flags is service_role only: a client call is a permission error', async () => {
        const fake = ctx.fake(seed()); const { page, context } = await ctx.page({ fake, viewport: VP });
        fake.expectViolation({ kind: 'rls', target: 'rpc/initialize_all_feature_flags' });
        await page.goto('/'); await page.waitForTimeout(800);
        const st = await page.evaluate(async () => (await fetch('http://fake.supabase.local/rest/v1/rpc/initialize_all_feature_flags', { method: 'POST', headers: { apikey: 'fake', authorization: 'Bearer fake.jwt.token', 'content-type': 'application/json' }, body: '{}' })).status);
        ctx.check(st === 403, 'authenticated rpc call denied with 403, got ' + st);
        await context.close();
      });
    }
  },

  {
    id: 'K', name: 'RLS-denied deal create surfaces an error, no phantom deal', modes: ['fake'], async run(ctx) {
      await ctx.step('quick-create denied by RLS: visible error, no local/phantom deal, nothing persisted', async () => {
        const fake = ctx.fake(); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
        await B.openBoard(page);
        const before = (await B.dealsState(page)).length;
        fake.deny('deals', 'POST');
        await B.column(page, 'qualification').getByRole('button', { name: /Add Deal/ }).click();
        await page.getByLabel('Deal title').fill('Phantom Deal'); await page.getByLabel('Deal value').fill('1234');
        await page.getByRole('button', { name: /^Add$/ }).click(); await page.waitForTimeout(1200);
        await shot('denied-create');
        ctx.check(fake.requests('deals', 'POST').length === 1, 'INSERT attempted once');
        ctx.check((await B.dealsState(page)).length === before, 'store has no phantom deal');
        ctx.check((await B.dealsState(page)).every(d => d.title !== 'Phantom Deal'), 'no Phantom Deal in store');
        ctx.check(await page.getByText('Phantom Deal').count() === 0, 'no Phantom Deal card rendered');
        ctx.check(!fake.table('deals').some(d => d.title === 'Phantom Deal'), 'nothing persisted');
        const msg = await page.getByRole('alert').allInnerTexts();
        ctx.check(msg.some(t => /permission|could not create|not allowed/i.test(t)) || await page.getByText(/permission|Could not create/i).count() > 0, 'a visible error is shown: ' + JSON.stringify(msg));
        await page.reload(); await B.openBoard(page);
        ctx.check((await B.dealsState(page)).length === before, 'still no phantom after reload');
        await context.close();
      });
      await ctx.step('allowed create (control): authenticated INSERT passes the real policy and persists', async () => {
        const fake = ctx.fake(); const { page, context } = await ctx.page({ fake, viewport: VP });
        await B.openBoard(page);
        await B.column(page, 'qualification').getByRole('button', { name: /Add Deal/ }).click();
        await page.getByLabel('Deal title').fill('Control Deal'); await page.getByRole('button', { name: /^Add$/ }).click(); await page.waitForTimeout(1200);
        ctx.check(fake.table('deals').some(d => d.title === 'Control Deal'), 'deal persisted');
        ctx.check(await page.getByText('Control Deal').count() > 0, 'card rendered');
        await context.close();
      });
    }
  },

  {
    id: 'L', name: 'Merge duplicates: one merge_deals RPC, notes move', modes: ['fake'], async run(ctx) {
      await ctx.step('merge 2 deals through the modal', async () => {
        const seed = defaultSeed();
        seed.notes = [
          { id: 'n0000000-0000-4000-8000-000000000001', deal_id: D(2), content: 'note on the duplicate', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'n0000000-0000-4000-8000-000000000002', deal_id: D(1), content: 'note on the survivor', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
        const fake = ctx.fake(seed); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
        await page.goto('/deals/' + D(1)); await page.waitForTimeout(2500);
        await page.getByLabel('More actions').click();
        await page.getByRole('menuitem', { name: /Find duplicates/ }).click();
        await page.getByLabel('Search deals').waitFor({ timeout: 5000 });
        await page.getByLabel('Select Marketing Automation Platform').check(); await page.waitForTimeout(300);
        await shot('merge-modal');
        const patchBefore = fake.requests('deals', 'PATCH').length;
        await page.getByRole('button', { name: /^Merge 2 deals/ }).click(); await page.waitForTimeout(2000);
        const rpcs = fake.requests(null, 'RPC').filter(r => r.table === 'merge_deals');
        ctx.check(rpcs.length === 1, 'exactly one merge_deals RPC: ' + rpcs.length);
        const b = rpcs[0]?.body || {};
        ctx.check(b.keep === D(1) && Array.isArray(b.merge_ids) && b.merge_ids.length === 1 && b.merge_ids[0] === D(2) && 'p_fields' in b, 'RPC args keep/merge_ids/p_fields: ' + JSON.stringify(Object.keys(b)));
        ctx.check(fake.requests('deals', 'PATCH').length === patchBefore, 'no per-deal PATCH fallbacks around the merge');
        ctx.check(fake.table('notes').every(n => n.deal_id === D(1)), 'all notes now belong to the survivor');
        ctx.check(!!fake.table('deals').find(d => d.id === D(2)).deleted_at, 'duplicate soft-deleted');
        ctx.check(!fake.table('deals').find(d => d.id === D(1)).deleted_at, 'survivor alive');
        await shot('merged');
        await context.close();
      });
    }
  },

  {
    id: 'M', name: 'Favorites keep deals.is_favorite and favorites row in sync', modes: ['fake'], async run(ctx) {
      await ctx.step('toggle on/off from the record header', async () => {
        const fake = ctx.fake(); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
        await page.goto('/deals/' + D(1)); await page.waitForTimeout(2500);
        const fav = () => fake.table('favorites').filter(f => f.entity_type === 'deal' && f.entity_id === D(1));
        const flag = () => fake.table('deals').find(d => d.id === D(1)).is_favorite;
        await page.getByLabel(/favorites$/).first().click(); await page.waitForTimeout(1200);
        ctx.check(flag() === true && fav().length === 1, `ON: deals.is_favorite=${flag()} favorites rows=${fav().length}`);
        ctx.check(fav()[0]?.user_id === DEFAULT_USER.id, 'favorites row carries the signed-in user id: ' + fav()[0]?.user_id);
        await shot('fav-on');
        await page.getByLabel(/favorites$/).first().click(); await page.waitForTimeout(1200);
        ctx.check(flag() === false && fav().length === 0, `OFF: deals.is_favorite=${flag()} favorites rows=${fav().length}`);
        await page.getByLabel(/favorites$/).first().click(); await page.waitForTimeout(1200);
        await page.getByLabel(/favorites$/).first().click(); await page.waitForTimeout(600); await page.getByLabel(/favorites$/).first().click(); await page.waitForTimeout(1200);
        ctx.check(fav().length <= 1, 'rapid toggling never duplicates the favorites row: ' + fav().length);
        ctx.check((flag() === true) === (fav().length === 1), `final state in sync (flag=${flag()}, rows=${fav().length})`);
        await context.close();
      });
      await ctx.step('board toggle (store action) syncs both and survives reload', async () => {
        const fake = ctx.fake(); const { page, context } = await ctx.page({ fake, viewport: VP });
        await B.openBoard(page);
        await page.evaluate((id) => window.__e2e.deal.getState().toggleFavorite(id), D(3)); await page.waitForTimeout(1200);
        ctx.check(fake.table('deals').find(d => d.id === D(3)).is_favorite === true && fake.table('favorites').some(f => f.entity_id === D(3)), 'store toggle wrote both representations');
        await page.reload(); await B.openBoard(page);
        ctx.check((await B.dealsState(page)).find(d => d.id === D(3)).isFavorite === true, 'favorite survives reload');
        await context.close();
      });
    }
  },

  {
    id: 'N', name: 'Analytics/KPI queries use only existing columns', modes: ['fake'], async run(ctx) {
      await ctx.step('analytics + views + deal timeline issue real queries (strict fake rejects bad columns)', async () => {
        const seed = defaultSeed();
        seed.deal_history = [{ id: 'h1', deal_id: D(1), field: 'stage', old_value: 'qualification', new_value: 'proposal', changed_at: new Date().toISOString() }];
        const fake = ctx.fake(seed); const { page, context, shot } = await ctx.page({ fake, viewport: VP });
        await page.goto('/analytics'); await page.waitForTimeout(2500);
        await shot('analytics');
        ctx.check(fake.requests(null, 'RPC').some(r => r.table === 'pipeline_aggregates' && Object.keys(r.body || {}).every(k => ['p_stage_keys', 'p_op', 'p_field'].includes(k))), 'pipeline_aggregates called with real arg names');
        ctx.check(fake.requests('deal_history', 'GET').length > 0, 'deal_history queried');
        ctx.check(await page.getByText(/Component Error|Something went wrong/).count() === 0, 'analytics renders');
        await page.goto('/views'); await page.waitForTimeout(2500);
        await shot('views');
        ctx.check(await page.getByText(/Component Error|Something went wrong/).count() === 0, 'views/reporting renders');
        await page.goto('/deals/' + D(1)); await page.waitForTimeout(2500);
        ctx.check(await page.getByText(/Component Error|Something went wrong/).count() === 0, 'deal record renders');
        ctx.notes.push('REST tables touched: ' + [...new Set(fake.log.filter(l => l.table && l.method !== 'RPC' && l.table !== 'storage').map(l => l.table))].sort().join(','));
        await context.close();
      });
    }
  },

  {
    id: 'O', name: 'Strict fake self-check (expectViolation opt-in)', modes: ['fake'], async run(ctx) {
      await ctx.step('unknown table/column/rpc/arg, private-bucket public URL and RLS denials are rejected with real shapes', async () => {
        const fake = ctx.fake(); const { page, context } = await ctx.page({ fake, viewport: VP });
        await page.goto('/'); await page.waitForTimeout(1000);
        const ex = [
          { kind: 'schema', code: 'PGRST205' }, { kind: 'schema', code: '42703' }, { kind: 'schema', code: 'PGRST204' },
          { kind: 'schema', code: 'PGRST202' }, { kind: 'storage', target: /object\/public\/deal-files/ }, { kind: 'rls', code: '42501', target: /deal_workflows INSERT as anon/ }, { kind: 'rls', code: 'RLS-ZERO-ROWS', target: /deal_workflows DELETE as anon/ }];
        ex.forEach(e => fake.expectViolation(e));
        const declared = () => fake.unexpectedViolations().filter(v => !knownFor(v));
        const call = (path, init = {}, bearer = 'fake.jwt.token') => page.evaluate(async ([p, i, b]) => {
          const r = await fetch('http://fake.supabase.local' + p, { ...i, headers: { apikey: 'fake', authorization: 'Bearer ' + b, 'content-type': 'application/json', prefer: 'return=representation', ...(i.headers || {}) } });
          let j = null; try { j = await r.json(); } catch {} return { status: r.status, code: j && j.code, body: j };
        }, [path, init, bearer]);
        let r = await call('/rest/v1/no_such_table?select=*'); ctx.check(r.status === 404 && r.code === 'PGRST205', 'unknown table 404 PGRST205: ' + r.status + r.code);
        r = await call('/rest/v1/deals?select=id,bogus_col'); ctx.check(r.status === 400 && r.code === '42703', 'unknown select column 42703: ' + r.status + r.code);
        r = await call('/rest/v1/deals?bogus_col=eq.1'); ctx.check(r.status === 400 && r.code === '42703', 'unknown filter column 42703');
        r = await call('/rest/v1/deals?order=bogus_col.asc'); ctx.check(r.status === 400 && r.code === '42703', 'unknown order column 42703');
        r = await call('/rest/v1/deals', { method: 'POST', body: JSON.stringify({ title: 'x', bogus_col: 1 }) }); ctx.check(r.status === 400 && r.code === 'PGRST204', 'unknown insert column PGRST204: ' + r.code);
        r = await call('/rest/v1/deals?id=eq.' + D(1), { method: 'PATCH', body: JSON.stringify({ bogus_col: 1 }) }); ctx.check(r.status === 400 && r.code === 'PGRST204', 'unknown update column PGRST204');
        r = await call('/rest/v1/rpc/no_such_fn', { method: 'POST', body: '{}' }); ctx.check(r.status === 404 && r.code === 'PGRST202', 'unknown rpc PGRST202');
        r = await call('/rest/v1/rpc/merge_deals', { method: 'POST', body: JSON.stringify({ p_primary: D(1), p_duplicate: D(2) }) }); ctx.check(r.status === 404 && r.code === 'PGRST202', 'wrong rpc arg names PGRST202');
        r = await call('/rest/v1/rpc/search_deals', { method: 'POST', body: JSON.stringify({ q: 'x' }) }); ctx.check(r.status === 200, 'rpc with default args omitted is fine');
        // RLS: anon has no INSERT policy on deal_workflows / user_roles; authenticated has none on achievements
        r = await call('/rest/v1/deal_workflows', { method: 'POST', body: JSON.stringify({ name: 'x' }) }, 'fake'); ctx.check(r.status === 403 && r.code === '42501', 'anon insert denied 42501: ' + r.status + r.code);
        r = await call('/rest/v1/deal_workflows?id=eq.x', { method: 'DELETE' }, 'fake'); ctx.check(r.status === 200 && Array.isArray(r.body) && r.body.length === 0, 'anon delete = 200 with zero rows');
        // storage: deal-files is private
        let st = await page.evaluate(async () => (await fetch('http://fake.supabase.local/storage/v1/object/public/deal-files/x/y.pdf', { headers: { apikey: 'fake' } })).status);
        ctx.check(st === 400, 'public URL on private bucket rejected: ' + st);
        st = await page.evaluate(async () => (await fetch('http://fake.supabase.local/storage/v1/object/public/deal-images/x.png', { headers: { apikey: 'fake' } })).status);
        ctx.check(st === 404, 'public bucket serves public URL (404 only because object is absent): ' + st);
        ctx.check(declared().length === 0, 'all violations were declared: ' + JSON.stringify(declared().map(v => v.target)));
        await context.close();
      });
    }
  },
];
