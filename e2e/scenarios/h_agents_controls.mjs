import { defaultSeed } from '../lib/fakeSupabase.mjs';

/** Agents > Controls: agents / personas / settings / logs come from Supabase (or the bundled catalog in demo mode), never from dead endpoints. */
const DEAD = /\/\.netlify\/functions\/(get-agents|get-personas|save-agent-settings|get-agent-logs|calendar-list|calendar-schedule)|\/api\/personas/;

export default [{
  id: 'H', name: 'Agent controls panel', async run(ctx) {
    await ctx.step('controls tab: agents + personas load, settings save, logs load, no dead endpoints', async () => {
      let seed = null;
      if (ctx.mode === 'fake') {
        seed = defaultSeed();
        seed.agent_metadata = [{ id: 'sdr-cold-email', label: 'Cold Email SDR' }, { id: 'sdr-follow-up', label: 'Follow-Up SDR' }];
        seed.sdr_personas = [{ id: 'p-bold', name: 'Bold persona', description: 'd', tone: 't', persona_prompt: 'p' }];
        seed.agent_logs = [{ id: 'l1', contact_id: ctx.ids.contact, level: 'info', message: 'Draft prepared for step 1', created_at: new Date().toISOString() }];
        seed.contact_agent_settings = [];
      }
      const fake = ctx.fake(seed);
      const { page, context, log, shot } = await ctx.page({ fake });
      const dead = [];
      page.on('request', (r) => { if (DEAD.test(r.url())) dead.push(r.url()); });
      await page.goto('/agents'); await page.waitForTimeout(1200);
      await page.getByRole('tab', { name: 'Controls' }).click(); await page.waitForTimeout(1200);
      await shot('controls');
      const selects = page.locator('select');
      const agentOpts = await selects.nth(0).locator('option').allInnerTexts();
      const personaOpts = await selects.nth(1).locator('option').allInnerTexts();
      if (ctx.mode === 'fake') {
        ctx.check(agentOpts.includes('Cold Email SDR') && agentOpts.length === 3, 'agents come from agent_metadata: ' + agentOpts.join('|'));
        ctx.check(personaOpts.includes('Bold persona'), 'personas come from sdr_personas: ' + personaOpts.join('|'));
      } else {
        ctx.check(agentOpts.length > 5, 'demo mode lists the bundled SDR agents: ' + agentOpts.length);
        ctx.check(personaOpts.length > 1, 'demo mode lists bundled personas');
      }
      await page.getByPlaceholder('Enter a contact ID').fill(ctx.ids.contact);
      await selects.nth(0).selectOption({ index: 1 });
      await selects.nth(1).selectOption({ index: 1 });
      await page.getByRole('button', { name: /Save Settings/ }).click(); await page.waitForTimeout(800);
      ctx.check(await page.getByRole('status').filter({ hasText: /Settings saved/ }).count() === 1, 'save shows a success message');
      if (ctx.mode === 'fake') {
        const row = fake.table('contact_agent_settings')[0];
        ctx.check(row && row.contact_id === ctx.ids.contact && row.agent_id === 'sdr-cold-email' && row.persona_id === 'p-bold', 'settings upserted into contact_agent_settings: ' + JSON.stringify(row));
      }
      await page.getByRole('button', { name: /Load Logs/ }).click(); await page.waitForTimeout(800);
      if (ctx.mode === 'fake') ctx.check(await page.getByText('Draft prepared for step 1').count() === 1, 'agent_logs rendered');
      ctx.check(dead.length === 0, 'no request to removed endpoints: ' + dead.join(','));
      ctx.check(await page.getByText(/Component Error|Something went wrong/).count() === 0, 'panel renders without crashing');
      const errs = ctx.errs(log).filter((e) => !/Failed to fetch/.test(e));
      ctx.check(errs.length === 0, 'no console errors: ' + errs[0]);
      await context.close();
    });
  },
}];
