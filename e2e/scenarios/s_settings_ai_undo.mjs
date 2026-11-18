import * as B from '../lib/board.mjs';
import { defaultSeed } from '../lib/fakeSupabase.mjs';
import { DEFAULT_USER } from '../lib/browser.mjs';

// Settings hub (API keys, webhooks, roles, email templates), composer templates, workflow versioning + inbound webhook,
// workspace AI chat (proposal Apply -> Undo) and delete -> Undo. Demo + strict fake. The /api/keys function and the AI gateway
// are stubbed with Playwright routes (no Netlify functions run in e2e); everything else goes through the app's real code paths.
const VP = { width: 1600, height: 1300 };
const U = (n) => `b0000000-0000-4000-8000-00000000000${n}`;
const WS = 'c0000000-0000-4000-8000-000000000001';
const WF = 'f0000000-0000-4000-8000-0000000000a1';

function seed() {
  const s = defaultSeed(); const now = new Date().toISOString();
  const role = (n, name, permissions) => ({ id: U(n), name, description: null, permissions, workspace_id: null, is_system_role: true, created_at: now, updated_at: now });
  s.roles = [role(1, 'admin', []), role(2, 'manager', ['view', 'create', 'edit', 'delete', 'bulk']), role(3, 'member', ['view', 'create', 'edit', 'delete']), role(4, 'viewer', ['view', 'export'])];
  s.user_roles = [{ id: 'ur-e2e', user_id: DEFAULT_USER.id, role_id: U(1), workspace_id: WS, assigned_at: now, roles: { name: 'admin' }, expires_at: null }];
  s.profiles = [...(s.profiles || []), { id: DEFAULT_USER.id, name: 'E2E User', avatar: null }];
  s.deal_workflows = [{ id: WF, name: 'Seed WF', description: 'seeded', category: 'custom', is_active: true, version: 1, created_at: now, updated_at: now,
    stages: [
      { id: 't1', name: 'Stage changed', type: 'trigger', position: { x: 100, y: 40 }, connections: ['a1'], isActive: true, trigger: { id: 'tr', type: 'stage_changed', name: 'Stage changed', description: '', config: {} } },
      { id: 'a1', name: 'Create task', type: 'action', position: { x: 100, y: 220 }, connections: [], isActive: true, action: { id: 'ac', type: 'create_task', name: 'Create task', description: '', config: { fields: { title: 'Follow up' } } } },
    ], triggers: [], settings: null, metadata: null }];
  return s;
}

/** Stubs the Netlify functions the scenario needs. Returns the in-memory key store for assertions. */
async function stubFunctions(page, ctx, { proposals } = {}) {
  const keys = []; let n = 0;
  await page.route('**/api/keys**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const ok = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'GET') return ok(200, { ok: true, keys: keys.map(({ secret, ...k }) => k) });
    if (req.method() === 'POST') {
      const b = req.postDataJSON(); n++;
      const k = { id: `k-${n}`, name: b.name, prefix: `pre${n}abcd`.slice(0, 8), scopes: b.scopes, created_at: new Date().toISOString(), last_used_at: null, revoked_at: null, secret: `cb_live_pre${n}abcdSECRETSECRETSECRET${n}` };
      keys.push(k);
      return ok(201, { ok: true, id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes, key: k.secret });
    }
    if (req.method() === 'DELETE') { const k = keys.find(x => x.id === u.searchParams.get('id')); if (k) k.revoked_at = new Date().toISOString(); return ok(200, { ok: true }); }
    return ok(405, { ok: false });
  });
  await page.route('**/.netlify/functions/ai-gateway', async (route) => {
    const body = route.request().postDataJSON();
    ctx.lastChat = body;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, task: 'workspace_chat', model: 'stub', id: 'r1', text: 'ok', usage: null, citations: [], tool_calls: [], data: { reply: 'Here is **one** suggestion:\n- move the deal forward', proposals: proposals ?? [] } }) });
  });
  return keys;
}

export default [{
  id: 'S', name: 'Settings, AI chat and undo', async run(ctx) {
    const open = async (route, opts = {}) => {
      const fake = ctx.fake(opts.seed ?? seed()); const p = await ctx.page({ fake, viewport: VP });
      const keys = await stubFunctions(p.page, ctx, opts);
      await p.page.goto(route);
      return { ...p, fake, keys };
    };

    await ctx.step('settings hub: tabs, default route and Data model tab', async () => {
      const { page, context, log } = await open('/settings');
      await page.getByRole('navigation', { name: 'Settings sections' }).waitFor({ timeout: 15000 });
      await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'API keys' }).waitFor({ timeout: 10000 }); // role resolved
      await page.waitForURL(/\/settings\/data-model$/, { timeout: 8000 });
      for (const t of ['Data model', 'API keys', 'Webhooks', 'Roles & permissions', 'Email templates', 'General']) {
        ctx.check(await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: t }).count() === 1, `tab "${t}" is listed`);
      }
      await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'General' }).click();
      await page.getByRole('button', { name: 'Open app settings' }).waitFor({ timeout: 8000 }).catch(() => {});
      ctx.check(await page.getByRole('button', { name: 'Open app settings' }).count() === 1, 'General tab links to the settings dialog');
      ctx.check(log.pageErrors.length === 0, 'no page errors: ' + log.pageErrors[0]);
      await context.close();
    });

    await ctx.step('API keys: create shows the key once, list shows prefix, revoke', async () => {
      const { page, context, shot } = await open('/settings/api-keys');
      await page.getByRole('button', { name: 'Create key' }).first().waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: 'Create key' }).first().click();
      await page.getByLabel('Name', { exact: true }).fill('E2E integration');
      await page.getByRole('dialog', { name: 'Create API key' }).getByRole('button', { name: 'Create key' }).click();
      const dlg = page.getByRole('dialog', { name: 'Copy your API key' });
      await dlg.waitFor({ timeout: 8000 });
      const secret = await dlg.getByLabel(/^Key for/).inputValue();
      ctx.check(/^cb_live_/.test(secret), 'plaintext key shown in the copy dialog');
      ctx.check(await dlg.getByText(/only time the key is shown/i).count() === 1, 'one-time warning shown');
      await shot('key-once');
      await dlg.getByRole('button', { name: 'I have saved it' }).click();
      ctx.check(!(await page.locator('body').innerText()).includes(secret) && !(await page.locator('input').evaluateAll((els, s) => els.some(e => e.value === s), secret)), 'key is gone from the page after closing');
      const row = page.getByTestId('api-key-row').filter({ hasText: 'E2E integration' });
      ctx.check(await row.count() === 1 && /Active/.test(await row.innerText()) && /cb_live_/.test(await row.innerText()), 'row lists prefix and Active status');
      ctx.check(!(await row.innerText()).includes('SECRET'), 'row never shows the secret');
      ctx.check(await page.getByText('/api/v1/deals').count() > 0, 'docs snippet shows /api/v1/deals curl examples');
      await row.getByRole('button', { name: /Revoke/ }).click();
      await page.getByRole('dialog', { name: 'Revoke API key?' }).getByRole('button', { name: 'Revoke key' }).click();
      await page.waitForTimeout(600);
      ctx.check(/Revoked/.test(await page.getByTestId('api-key-row').filter({ hasText: 'E2E integration' }).innerText()), 'revoked key shows Revoked');
      ctx.check(await page.getByTestId('api-key-row').getByRole('button', { name: /Revoke/ }).count() === 0, 'no Revoke button on a revoked key');
      await context.close();
    });

    await ctx.step('roles: matrix edit persists, assign and remove a member role', async () => {
      const { page, context, fake, shot } = await open('/settings/roles');
      const cb = page.getByRole('checkbox', { name: 'member: Delete records' });
      await cb.waitFor({ timeout: 15000 });
      ctx.check(await cb.isChecked(), 'member can delete by default');
      ctx.check(await page.getByRole('checkbox', { name: 'admin: Edit records' }).isDisabled(), 'admin column is locked');
      await cb.uncheck();
      ctx.check(/unsaved/i.test(await page.getByText(/unsaved change/i).first().innerText()), 'unsaved changes are announced');
      await page.getByRole('button', { name: 'Save permissions' }).click(); await page.waitForTimeout(800);
      ctx.check(await page.getByText('No unsaved changes').count() === 1, 'saved');
      if (fake) ctx.check(!fake.table('roles').find(r => r.name === 'member').permissions.includes('delete'), 'roles.permissions updated through set_role_permissions');
      await shot('roles');
      const row = page.getByTestId('member-row').first();
      await row.getByLabel(/^Add role for/).selectOption({ label: 'viewer' }); await page.waitForTimeout(800);
      ctx.check(/viewer/.test(await page.getByTestId('member-row').first().innerText()), 'viewer role assigned');
      if (fake) ctx.check(fake.table('user_roles').some(r => r.role_id === U(4)), 'user_roles row created through assign_user_role');
      await page.getByRole('button', { name: /^Remove viewer from/ }).click(); await page.waitForTimeout(800);
      ctx.check(await page.getByRole('button', { name: /^Remove viewer from/ }).count() === 0, 'viewer role removed');
      await context.close();
    });

    await ctx.step('email templates: create template + snippet, live preview, use in the composer, delete', async () => {
      const { page, context, fake, shot } = await open('/settings/email-templates');
      await page.getByRole('button', { name: 'New' }).first().click();
      await page.getByLabel('Name', { exact: true }).fill('E2E follow-up');
      await page.getByLabel('Subject', { exact: true }).fill('About {{deal_title}}');
      await page.getByLabel('Body', { exact: true }).fill('Hi {{first_name}}, checking in on {{company}}. {{mystery}}');
      ctx.check(/Acme Renewal/.test(await page.getByTestId('preview-subject').innerText()), 'preview resolves {{deal_title}} with sample data');
      ctx.check(/Hi Jordan, checking in on Acme Corp\./.test(await page.getByTestId('preview-body').innerText()), 'preview resolves first name and company');
      ctx.check(/\{\{mystery\}\}/.test(await page.getByTestId('preview-body').innerText()) && await page.getByText(/Unknown variable/).count() === 1, 'unknown variable stays visible and is flagged');
      await page.getByLabel('Body', { exact: true }).fill('Hi {{first_name}}, checking in on {{company}}.');
      await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(800);
      if (fake) ctx.check(fake.table('email_templates').some(t => t.name === 'E2E follow-up' && !t.is_snippet), 'template persisted');
      await page.getByRole('button', { name: 'New' }).first().click();
      await page.getByLabel('Name', { exact: true }).fill('E2E sig');
      await page.getByLabel('This is a snippet').check();
      await page.getByLabel(/^Shortcut/).fill('esig');
      await page.getByLabel('Body', { exact: true }).fill('Best,\n{{owner}}');
      await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(800);
      if (fake) ctx.check(fake.table('email_templates').some(t => t.is_snippet && t.shortcut === 'esig'), 'snippet persisted with shortcut');
      await shot('templates');
      // duplicate shortcut is rejected
      await page.getByRole('button', { name: 'New' }).first().click();
      await page.getByLabel('Name', { exact: true }).fill('dupe'); await page.getByLabel('This is a snippet').check(); await page.getByLabel(/^Shortcut/).fill('esig'); await page.getByLabel('Body', { exact: true }).fill('x');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      ctx.check(await page.getByRole('alert').filter({ hasText: /already used/ }).count() === 1, 'duplicate shortcut is rejected');
      await page.getByRole('button', { name: 'Close', exact: true }).click();

      // composer
      await page.goto(`/deals/${ctx.ids.deal}`); await page.getByText('Overview').first().waitFor({ timeout: 15000 });
      await page.getByRole('navigation', { name: 'Deal sections' }).getByRole('button', { name: /^Communication/ }).click();
      const newEmail = page.getByRole('button', { name: /^New email$/ });
      await newEmail.waitFor({ timeout: 10000 });
      if (await newEmail.isDisabled()) { ctx.skip('deal has no linked contact: composer not reachable'); }
      else {
        await newEmail.click();
        const dlg = page.getByRole('dialog', { name: 'Compose email' });
        await dlg.waitFor({ timeout: 8000 });
        await dlg.getByLabel('Insert template').selectOption({ label: 'E2E follow-up' });
        const subject = await dlg.getByLabel('Subject').inputValue();
        ctx.check(/^About /.test(subject) && !/\{\{/.test(subject), 'template subject has variables resolved: ' + subject);
        ctx.check(!/\{\{/.test(await dlg.getByLabel('Message', { exact: true }).inputValue()), 'template body has variables resolved');
        await dlg.getByLabel('Message', { exact: true }).fill('Intro\n/esig');
        await dlg.getByLabel('Message', { exact: true }).press('Space'); await page.waitForTimeout(200);
        const body = await dlg.getByLabel('Message', { exact: true }).inputValue();
        ctx.check(/Best,/.test(body) && !/\/esig/.test(body), 'typing /esig then Space inserts the snippet: ' + JSON.stringify(body));
        await dlg.getByRole('button', { name: 'Preview' }).click();
        ctx.check(await dlg.getByTestId('composer-preview-body').innerText() !== '', 'preview shows resolved text');
        await shot('composer');
        await dlg.getByRole('button', { name: 'Cancel' }).click();
      }
      await page.goto('/settings/email-templates');
      await page.getByRole('button', { name: 'Delete E2E follow-up' }).click();
      await page.getByRole('dialog', { name: 'Delete template?' }).getByRole('button', { name: 'Delete' }).click(); await page.waitForTimeout(800);
      ctx.check(await page.getByRole('list', { name: 'Templates' }).getByText('E2E follow-up').count() === 0, 'template deleted');
      if (fake) ctx.check(!fake.table('email_templates').some(t => t.name === 'E2E follow-up'), 'row deleted in the database');
      await context.close();
    });

    await ctx.step('webhooks tab: outbound CRUD with masked secret + test payload', async () => {
      const { page, context, fake } = await open('/settings/webhooks');
      await page.getByRole('button', { name: 'Add webhook' }).waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: 'Add webhook' }).click();
      await page.getByLabel('Name', { exact: true }).fill('CI hook');
      await page.getByLabel('URL', { exact: true }).fill('http://not-secure.example.com/x');
      await page.getByLabel('Signing secret').fill('supersecretvalue');
      await page.getByRole('dialog', { name: 'Add webhook' }).getByRole('button', { name: 'Save' }).click();
      ctx.check(await page.getByRole('alert').filter({ hasText: /https/ }).count() === 1, 'non-https URL is rejected');
      await page.getByLabel('URL', { exact: true }).fill('https://example.com/hooks/crm');
      await page.getByRole('dialog', { name: 'Add webhook' }).getByRole('button', { name: 'Save' }).click(); await page.waitForTimeout(800);
      const row = page.locator('tr', { hasText: 'CI hook' });
      ctx.check(await row.count() === 1 && !(await row.innerText()).includes('supersecretvalue'), 'webhook listed, secret masked');
      if (fake) ctx.check(fake.table('webhook_configurations').some(w => w.name === 'CI hook'), 'webhook persisted');
      await row.getByRole('button', { name: 'Test CI hook' }).click();
      ctx.check(await page.getByRole('dialog', { name: 'Test send' }).getByText(/not available yet/).count() === 1, 'test send is honest about the missing delivery endpoint');
      await page.getByRole('dialog', { name: 'Test send' }).getByRole('button', { name: 'Close', exact: true }).last().click();
      await page.getByRole('button', { name: 'Delete CI hook' }).click();
      await page.getByRole('dialog', { name: 'Delete webhook?' }).getByRole('button', { name: 'Delete' }).click(); await page.waitForTimeout(600);
      ctx.check(await page.locator('tr', { hasText: 'CI hook' }).count() === 0, 'webhook deleted');
      await context.close();
    });

    await ctx.step('workflow: publish, version history with diff, restore as draft, inbound webhook enable/rotate', async () => {
      if (ctx.mode !== 'fake') { ctx.skip('workflows need the database (demo mode has no workflow store)'); return; }
      const { page, context, fake, shot } = await open('/workflows');
      await page.getByRole('button', { name: /Edit/ }).first().click();
      const badge = page.getByTestId('workflow-version-badge');
      await badge.waitFor({ timeout: 15000 });
      ctx.check((await badge.innerText()) === 'Draft', 'never published -> Draft: ' + await badge.innerText());
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      await page.getByLabel('Note (optional)').fill('first release');
      await page.getByRole('button', { name: 'Publish version' }).click(); await page.waitForTimeout(1000);
      ctx.check((await badge.innerText()) === 'Published v1', 'badge shows Published v1: ' + await badge.innerText());
      ctx.check(fake.table('workflow_versions').length === 1 && fake.table('deal_workflows')[0].published_version === 1, 'publish_workflow_version wrote the snapshot');
      // edit -> unsaved guard blocks publishing, save -> Draft (published v1)
      await page.getByLabel('Workflow name').fill('Seed WF v2'); await page.waitForTimeout(300);
      ctx.check(await page.getByRole('button', { name: 'Publish', exact: true }).isDisabled(), 'Publish is disabled while there are unsaved changes');
      ctx.check(/Draft/.test(await badge.innerText()), 'dirty workflow shows Draft');
      await page.getByRole('button', { name: /^Save$/ }).click(); await page.waitForTimeout(1200);
      ctx.check(/Draft \(published v1\)/.test(await badge.innerText()), 'saved edits differ from the snapshot: ' + await badge.innerText());
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      await page.getByRole('button', { name: 'Publish version' }).click(); await page.waitForTimeout(1000);
      ctx.check((await badge.innerText()) === 'Published v2', 'second publish -> v2');
      await page.getByRole('button', { name: 'Version history' }).click();
      const drawer = page.getByRole('dialog', { name: 'Version history' });
      await drawer.waitFor();
      const rows = drawer.getByTestId('version-row');
      ctx.check(await rows.count() === 2, 'two versions listed');
      ctx.check(/renamed/.test(await rows.first().innerText()), 'v2 diff summary mentions the rename: ' + (await rows.first().innerText()).replace(/\s+/g, ' '));
      ctx.check(/first release/.test(await rows.last().innerText()), 'v1 note shown');
      await shot('history');
      await drawer.getByRole('button', { name: 'Restore version 1 as draft' }).click();
      await drawer.getByRole('button', { name: 'Confirm restore' }).click(); await page.waitForTimeout(1200);
      ctx.check(await page.getByLabel('Workflow name').inputValue() === 'Seed WF', 'restore loaded version 1 into the builder');
      ctx.check(fake.table('deal_workflows')[0].name === 'Seed WF', 'live row restored');
      ctx.check(/Draft \(published v2\)/.test(await badge.innerText()), 'restored workflow is a draft vs published v2: ' + await badge.innerText());

      // inbound webhook panel (only for a saved workflow)
      const panel = page.getByRole('region', { name: 'Inbound webhook trigger' });
      await panel.getByRole('switch', { name: 'Enabled' }).click(); await panel.getByTestId('webhook-url').waitFor({ timeout: 8000 });
      const url1 = await panel.getByTestId('webhook-url').innerText();
      ctx.check(/\/api\/workflow\/hook\/[0-9a-f]{20,}$/.test(url1), 'enable shows the inbound URL: ' + url1);
      ctx.check(await panel.getByText(/curl -X POST/).count() === 1, 'sample curl shown');
      ctx.check(fake.table('deal_workflows')[0].webhook_enabled === true, 'webhook_enabled set through rotate_workflow_webhook_token');
      await panel.getByRole('button', { name: 'Rotate token' }).click();
      await page.getByRole('dialog', { name: 'Rotate webhook token?' }).getByRole('button', { name: 'Rotate token' }).click(); await page.waitForTimeout(800);
      const url2 = await panel.getByTestId('webhook-url').innerText();
      ctx.check(url2 !== url1 && /\/api\/workflow\/hook\//.test(url2), 'rotate gives a new URL');
      await shot('webhook');
      // settings > webhooks table shows it
      await page.goto('/settings/webhooks');
      await page.getByTestId('workflow-webhooks').getByText(/\/api\/workflow\/hook\//).first().waitFor({ timeout: 8000 });
      ctx.check(true, 'Settings > Webhooks lists the inbound URL');
      await context.close();
    });

    await ctx.step('workflow versioning panel is hidden for unsaved workflows', async () => {
      if (ctx.mode !== 'fake') { ctx.skip('workflows need the database'); return; }
      const { page, context } = await open('/workflows');
      await page.getByRole('button', { name: /New Workflow|Create Workflow/ }).first().click();
      await page.getByTestId('workflow-version-badge').waitFor({ timeout: 10000 });
      ctx.check((await page.getByTestId('workflow-version-badge').innerText()).startsWith('Draft'), 'new workflow is a draft');
      ctx.check(await page.getByRole('region', { name: 'Inbound webhook trigger' }).count() === 0, 'webhook panel only shows once the workflow is saved');
      ctx.check(await page.getByRole('button', { name: 'Publish', exact: true }).isDisabled(), 'cannot publish before saving');
      await context.close();
    });

    await ctx.step('AI chat: Ctrl+J opens, proposal shows, Apply moves the deal, Undo restores it; Dismiss never applies', async () => {
      const id = ctx.ids.deal;
      const proposals = [
        { id: 'p1', kind: 'move_deal', dealId: id, stage: 'negotiation', patch: null, title: null, body: null, reason: 'Quote was accepted' },
        { id: 'p2', kind: 'update_deal', dealId: id, patch: { priority: 'low' }, stage: null, title: null, body: null, reason: 'Cooling off' },
      ];
      const { page, context, shot } = await open('/', { proposals });
      await B.openBoard(page);
      const before = (await B.dealsState(page)).find(d => d.id === id);
      const target = before.stage === 'negotiation' ? 'proposal' : 'negotiation';
      proposals[0].stage = target; proposals[1].patch = { priority: before.priority === 'low' ? 'high' : 'low' };
      await page.keyboard.press('Control+j');
      const chat = page.getByRole('dialog', { name: 'Workspace AI chat' });
      await chat.waitFor({ timeout: 8000 });
      await chat.getByLabel('Message', { exact: true }).fill('What should I do about the enterprise deal?');
      await chat.getByRole('button', { name: 'Send message' }).click();
      await chat.getByTestId('chat-proposal').first().waitFor({ timeout: 8000 });
      ctx.check(ctx.lastChat?.task === 'workspace_chat' && ctx.lastChat.messages?.[0]?.content?.startsWith('What should I do'), 'request goes to the workspace_chat task with the message');
      ctx.check(await chat.locator('strong', { hasText: 'one' }).count() === 1, 'assistant markdown-lite renders bold');
      ctx.check(await chat.getByTestId('chat-proposal').count() === 2, 'two proposal cards');
      ctx.check((await B.dealsState(page)).find(d => d.id === id).stage === before.stage, 'nothing applied automatically');
      await shot('chat');
      // Dismiss the update card, apply the move
      await chat.getByTestId('chat-proposal').nth(1).getByRole('button', { name: 'Dismiss' }).click();
      await chat.getByTestId('chat-proposal').first().getByRole('button', { name: 'Apply' }).click(); await page.waitForTimeout(800);
      ctx.check((await B.dealsState(page)).find(d => d.id === id).stage === target, 'Apply moved the deal');
      ctx.check((await B.dealsState(page)).find(d => d.id === id).priority === before.priority, 'dismissed proposal changed nothing');
      const toasts = page.getByTestId('undo-toasts');
      await toasts.waitFor({ timeout: 5000 });
      await toasts.getByRole('button', { name: /Undo/ }).first().click(); await page.waitForTimeout(1000);
      ctx.check((await B.dealsState(page)).find(d => d.id === id).stage === before.stage, 'Undo moved the deal back');
      // Escape closes the panel; the header button reopens it
      await page.keyboard.press('Escape');
      ctx.check(await page.getByRole('dialog', { name: 'Workspace AI chat' }).count() === 0, 'Escape closes the chat');
      await page.locator('button[aria-label="Ask AI"]').click();
      await page.getByRole('dialog', { name: 'Workspace AI chat' }).waitFor({ timeout: 5000 });
      ctx.check(await page.getByRole('dialog', { name: 'Workspace AI chat' }).getByText('What should I do about the enterprise deal?').count() === 1, 'history is kept while the page stays loaded');
      await page.getByRole('button', { name: 'Clear conversation' }).click();
      ctx.check(await page.getByTestId('chat-proposal').count() === 0, 'Clear empties the conversation');
      await context.close();
    });

    await ctx.step('AI chat: gateway down is an explicit error', async () => {
      const { page, context } = await open('/');
      await B.openBoard(page);
      await page.route('**/.netlify/functions/ai-gateway', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'down' }) }));
      await page.keyboard.press('Control+j');
      const chat = page.getByRole('dialog', { name: 'Workspace AI chat' });
      await chat.getByLabel('Message', { exact: true }).fill('hello'); await chat.getByRole('button', { name: 'Send message' }).click();
      await chat.getByRole('alert').waitFor({ timeout: 8000 });
      ctx.check(/unavailable/i.test(await chat.getByRole('alert').innerText()), 'gateway-down message shown');
      await context.close();
    });

    await ctx.step('delete deal(s) -> Undo restores (toast button and Ctrl+Z); bulk priority -> Undo restores', async () => {
      const { page, context, fake, shot } = await open('/');
      await B.openBoard(page);
      await page.getByRole('button', { name: 'Table', exact: true }).first().click(); await page.waitForSelector('[data-testid="deal-table-view"]');
      const total = (await B.dealsState(page)).length;
      const ids = await page.evaluate(() => [...document.querySelectorAll('tr[data-deal-id]')].map(e => e.getAttribute('data-deal-id')).slice(0, 2));
      for (const id of ids) await page.locator(`tr[data-deal-id="${id}"] input[type=checkbox]`).first().check();
      // bulk priority -> Undo
      const prevPrio = (await B.dealsState(page)).filter(d => ids.includes(d.id)).map(d => [d.id, d.priority]);
      const newPrio = prevPrio.every(([, p]) => p === 'high') ? 'low' : 'high';
      await page.getByLabel('Set priority').selectOption(newPrio); await page.waitForTimeout(800);
      ctx.check((await B.dealsState(page)).filter(d => ids.includes(d.id)).every(d => d.priority === newPrio), 'bulk priority applied');
      await page.getByTestId('undo-toasts').getByRole('button', { name: /Undo/ }).first().click(); await page.waitForTimeout(1000);
      const afterUndo = await B.dealsState(page);
      ctx.check(prevPrio.every(([id, p]) => afterUndo.find(d => d.id === id).priority === p), 'bulk priority Undo restored each previous value');
      // delete -> Undo (button)
      await page.getByLabel('Bulk actions').getByRole('button', { name: 'Delete' }).first().click();
      await page.getByLabel('Bulk actions').getByRole('button', { name: 'Delete' }).last().click(); await page.waitForTimeout(1000);
      ctx.check((await B.dealsState(page)).length === total - 2, 'two deals deleted');
      await shot('deleted-toast');
      await page.getByTestId('undo-toasts').getByRole('button', { name: /Undo/ }).first().click(); await page.waitForTimeout(1500);
      ctx.check((await B.dealsState(page)).length === total && (await B.trashState(page)).length === 0, 'Undo restored both deals');
      if (fake) ctx.check(fake.table('deals').filter(d => d.deleted_at).length === 0, 'fake DB: deleted_at cleared (restore_deals)');
      // delete again -> Ctrl+Z with focus outside text fields
      await page.getByLabel('Bulk actions').getByRole('button', { name: 'Delete' }).first().click({ timeout: 5000 }).catch(async () => {
        for (const id of ids) await page.locator(`tr[data-deal-id="${id}"] input[type=checkbox]`).first().check();
        await page.getByLabel('Bulk actions').getByRole('button', { name: 'Delete' }).first().click();
      });
      await page.getByLabel('Bulk actions').getByRole('button', { name: 'Delete' }).last().click(); await page.waitForTimeout(1000);
      ctx.check((await B.dealsState(page)).length === total - 2, 'deleted again');
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
      ctx.check((await B.dealsState(page)).length === total, 'Ctrl+Z restored the deals');
      // Ctrl+Z inside a text field must not trigger undo
      await context.close();
    });

    await ctx.step('merge shows an informational toast without Undo', async () => {
      // Covered by the unit test (notifyMergeNotUndoable registers an entry without an undo callback); the merge dialog flow
      // itself is exercised by scenario L, so here only the toast contract is checked in the browser.
      const { page, context } = await open('/');
      await B.openBoard(page);
      await page.evaluate(async () => { const m = await import('/src/services/undoService.ts'); m.notifyMergeNotUndoable(2); });
      const t = page.getByTestId('undo-toasts');
      await t.waitFor({ timeout: 5000 });
      ctx.check(/cannot be undone/i.test(await t.innerText()) && await t.getByRole('button', { name: /Undo/ }).count() === 0, 'merge toast is informational, no Undo button');
      await context.close();
    });
  },
}];
