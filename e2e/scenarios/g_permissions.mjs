import * as B from '../lib/board.mjs';
import { defaultSeed } from '../lib/fakeSupabase.mjs';
const VP = { width: 1700, height: 1500 };
const UID = 'u0000000-0000-4000-8000-000000000001';

function seedFor(role) {
  const seed = defaultSeed();
  seed.app_settings = [{ id: 's1', setting_key: 'rls_mode', setting_value: 'workspace', user_id: null }];
  seed.workspaces = [{ id: 'w0000000-0000-4000-8000-000000000001', name: 'Acme WS' }];
  seed.roles = [{ id: 'r1', name: role }];
  seed.user_roles = [{ id: 'ur1', user_id: UID, workspace_id: 'w0000000-0000-4000-8000-000000000001', role_id: 'r1', roles: { name: role }, expires_at: null }];
  return seed;
}
const sessionInit = (uid) => {
  const session = { access_token: 'fake.jwt.token', refresh_token: 'rt', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'viewer@example.com', app_metadata: {}, user_metadata: { name: 'Vera Viewer' }, created_at: new Date().toISOString() } };
  return `localStorage.setItem('sb-fake-auth-token', ${JSON.stringify(JSON.stringify(session))});`;
};

export default [{
  id: 'G', name: 'Permissions UI', modes: ['fake'], async run(ctx) {
    const open = async (role) => {
      const fake = ctx.fake(seedFor(role));
      fake.session = { user: { id: UID, aud: 'authenticated', email: 'viewer@example.com' } };
      const p = await ctx.page({ fake, viewport: VP, init: sessionInit(UID) });
      await B.openBoard(p.page);
      await p.page.waitForFunction(() => window.__e2e.permission.getState().role !== null, null, { timeout: 8000 }).catch(() => {});
      await p.page.waitForTimeout(500);
      return { ...p, fake };
    };

    await ctx.step('viewer role resolved from user_roles + rls_mode=workspace', async () => {
      const { page, context } = await open('viewer');
      const st = await page.evaluate(() => { const s = window.__e2e.permission.getState(); return { role: s.role, mode: s.rlsMode, ws: s.workspaceName, uid: s.userId }; });
      ctx.check(st.role === 'viewer' && st.mode === 'workspace', 'permission store: ' + JSON.stringify(st));
      await context.close();
    });

    await ctx.step('viewer: drag, inline edit, bulk, stage manager, delete are disabled/hidden', async () => {
      const { page, context, fake, shot } = await open('viewer');
      await shot('viewer-board');
      const id = '00000000-0000-4000-8000-000000000003';
      const before = fake.requests('deals', 'PATCH').length;
      await B.dragTo(page, B.card(page, id), B.column(page, 'negotiation'), { toOffset: 300 });
      const st = (await B.dealsState(page)).find(d => d.id === id).stage;
      ctx.check(st === 'proposal', 'viewer cannot drag a deal (stage stays ' + st + ')');
      ctx.check(fake.requests('deals', 'PATCH').length === before, 'no PATCH sent when viewer tries to drag');
      // table inline edits disabled
      await page.getByRole('button', { name: 'Table', exact: true }).first().click(); await page.waitForSelector('[data-testid="deal-table-view"]');
      const editBtn = page.locator('tr[data-deal-id]').first().getByLabel('Edit Title');
      ctx.check(await editBtn.count() === 0 || await editBtn.isDisabled(), 'inline title edit disabled for viewer');
      await shot('viewer-table');
      // bulk bar actions disabled
      await page.getByLabel('Select all deals').check(); await page.waitForTimeout(300);
      const bulk = page.getByLabel('Bulk actions');
      ctx.check(await bulk.count() > 0, 'bulk bar visible (export still allowed)');
      ctx.check(await page.getByLabel('Move to stage').isDisabled() && await page.getByLabel('Set priority').isDisabled(), 'bulk move/priority disabled');
      ctx.check(await bulk.getByRole('button', { name: 'Delete' }).first().isDisabled(), 'bulk delete disabled');
      await shot('viewer-bulk');
      // stage manager
      await page.getByRole('button', { name: 'Kanban', exact: true }).first().click(); await page.waitForTimeout(500);
      const mgr = page.getByRole('button', { name: 'Manage pipeline stages' });
      ctx.check(await mgr.count() === 0 || await mgr.first().isDisabled(), 'stage manager button hidden/disabled for viewer');
      // add-deal buttons
      const add = B.column(page, 'proposal').getByRole('button', { name: /add deal/i });
      ctx.check(await add.count() === 0 || await add.first().isDisabled(), 'per-column Add Deal hidden/disabled for viewer');
      await context.close();
    });

    await ctx.step('viewer: record page edit + workflow save disabled', async () => {
      const { page, context, shot } = await open('viewer');
      await page.goto('/deals/00000000-0000-4000-8000-000000000001'); await page.getByText('Overview').first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(800);
      const stageBtn = page.locator('button[aria-haspopup="listbox"]').first();
      ctx.check(await stageBtn.count() === 0 || await stageBtn.isDisabled(), 'record stage field is read-only for viewer');
      await shot('viewer-record');
      await page.goto('/workflows'); await page.waitForTimeout(1500);
      const nw = page.getByRole('button', { name: /New Workflow/ }).first();
      ctx.check(await nw.isDisabled(), 'New Workflow disabled for viewer');
      await shot('viewer-workflows');
      await context.close();
    });

    await ctx.step('admin in workspace mode: everything enabled, and 42501 rolls back with a permission toast', async () => {
      const { page, context, fake, shot } = await open('admin');
      const id = '00000000-0000-4000-8000-000000000003';
      ctx.check(await page.getByRole('button', { name: 'Manage pipeline stages' }).count() > 0, 'admin sees stage manager');
      fake.deny('deals', 'PATCH');
      await B.dragTo(page, B.card(page, id), B.column(page, 'negotiation'), { toOffset: 300 });
      await page.waitForTimeout(800);
      await shot('denied-toast');
      const st = (await B.dealsState(page)).find(d => d.id === id).stage;
      ctx.check(st === 'proposal', 'denied PATCH (42501) rolled the card back (stage=' + st + ')');
      ctx.check(await page.getByText(/permission/i).count() > 0, 'permission-denied toast shown');
      fake.allow();
      await B.dragTo(page, B.card(page, id), B.column(page, 'negotiation'), { toOffset: 300 });
      ctx.check((await B.dealsState(page)).find(d => d.id === id).stage === 'negotiation', 'after allowing again the drag persists');
      await context.close();
    });

    await ctx.step('member can edit own deals only (workspace mode)', async () => {
      const seed = seedFor('member'); seed.deals[2].owner_id = UID; // deal 3 owned by the member
      const fake = ctx.fake(seed); fake.session = { user: { id: UID, aud: 'authenticated', email: 'm@example.com' } };
      const { page, context } = await ctx.page({ fake, viewport: VP, init: sessionInit(UID) });
      await B.openBoard(page); await page.waitForTimeout(800);
      await B.dragTo(page, B.card(page, '00000000-0000-4000-8000-000000000003'), B.column(page, 'negotiation'), { toOffset: 300 });
      ctx.check((await B.dealsState(page)).find(d => d.id === '00000000-0000-4000-8000-000000000003').stage === 'negotiation', 'member can move own deal');
      await B.dragTo(page, B.card(page, '00000000-0000-4000-8000-000000000004'), B.column(page, 'proposal'), { toOffset: 300 });
      ctx.check((await B.dealsState(page)).find(d => d.id === '00000000-0000-4000-8000-000000000004').stage === 'negotiation', "member cannot move someone else's deal");
      await context.close();
    });
  }
}];
