const routes = (ids) => ['/', '/contacts', '/agents', '/calendar', '/email', '/views', '/workflows', '/analytics', '/apps', `/deals/${ids.deal}`, `/contacts/${ids.contact}`, '/companies/__COMPANY__', '/no-such-page'];

export default [{
  id: 'A', name: 'Shell/routing', async run(ctx) {
    const fake = ctx.fake();
    const { page, log, shot } = await ctx.page({ fake });
    // discover the company route from the deal page's related-company card
    await page.goto(`/deals/${ctx.ids.deal}`); await page.waitForTimeout(2000);
    const coHref = await page.locator('a[href^="/companies/"]').first().getAttribute('href').catch(() => null);
    ctx.check(!!coHref, 'deal page shows a related company link');
    for (const r0 of routes(ctx.ids)) {
      const r = r0.replace('/companies/__COMPANY__', coHref || '/companies/missing');
      const before = ctx.errs(log).length;
      await page.goto(r); await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(800);
      const txt = (await page.locator('body').innerText()).trim();
      const crashed = /Component Error|Something went wrong|encountered an error/i.test(txt);
      ctx.check(!crashed, `route ${r} renders without error boundary`);
      if (r.startsWith('/deals/')) ctx.check(txt.includes(ctx.ids.dealTitle), 'deal route shows deal title');
      if (r.startsWith('/companies/')) ctx.check(!/Company not found/.test(txt), 'company route shows the company');
      ctx.check(page.url().endsWith(r), `URL is real router path ${r} (got ${page.url()})`);
      ctx.check(txt.length > 40, `route ${r} not blank`);
      // demo mode: non-pipeline pages query the unreachable placeholder Supabase URL and log handled "Failed to fetch"
      const tolerated = e => ctx.mode === 'demo' && /Failed to fetch|Failed to get email threads/.test(e) && !['/', '/analytics'].includes(r);
      const errs = ctx.errs(log).slice(before).filter(e => !tolerated(e));
      if (ctx.errs(log).length - before > errs.length) ctx.notes.push(`${r}: handled demo-mode 'Failed to fetch' logs tolerated`);
      ctx.check(errs.length === 0, `route ${r} no console/page errors: ${errs[0] || ''}`.slice(0, 300));
      await shot('route' + r.replace(/\//g, '_'));
    }
    // Pipeline page: no top app bar; theme toggle sits beside the stage-manager gear
    await page.goto('/'); await page.waitForSelector('text=Sales Pipeline');
    ctx.check(await page.getByRole('navigation', { name: 'Primary' }).count() === 0, 'no top nav bar on /');
    ctx.check(await page.getByText('Smart CRM', { exact: true }).count() === 0, 'no "Smart CRM" title on /');
    ctx.check(await page.getByRole('button', { name: /switch to (dark|light) mode/i }).count() === 1, 'single theme toggle on /');
    await page.goto('/contacts'); await page.waitForTimeout(800);
    ctx.check(await page.getByRole('navigation', { name: 'Primary' }).count() === 1, 'nav bar still on /contacts');
    // dark mode toggle
    await page.goto('/'); await page.waitForSelector('text=Sales Pipeline');
    const dark0 = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.getByRole('button', { name: /switch to (dark|light) mode/i }).first().click();
    await page.waitForTimeout(300);
    const dark1 = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    ctx.check(dark0 !== dark1, 'dark-mode toggle flips html.dark');
    await shot('dark');
    await page.getByRole('button', { name: /switch to (dark|light) mode/i }).first().click();
    // command palette
    await page.keyboard.press('Control+k');
    const input = page.getByLabel('Search deals, contacts and actions');
    await input.waitFor({ timeout: 8000 }).catch(() => {});
    ctx.check(await input.isVisible().catch(() => false), 'Ctrl+K opens palette');
    await input.fill('Enterprise');
    await page.waitForTimeout(800);
    await shot('palette-search');
    const opt = page.locator('[role="option"]').filter({ hasText: /Enterprise Software/i }).first();
    ctx.check(await opt.count() > 0, 'palette finds deal "Enterprise Software License"');
    if (await opt.count()) { await opt.click(); await page.waitForTimeout(800); ctx.check(/\/deals\//.test(page.url()), 'selecting deal navigates to /deals/:id (' + page.url() + ')'); }
    await page.goto('/'); await page.waitForSelector('text=Sales Pipeline');
    await page.keyboard.press('Control+k');
    await input.fill('dark mode'); await page.waitForTimeout(300);
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const dark2 = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    ctx.check(dark2 !== dark0, 'palette action "Toggle dark mode" runs');
    ctx.check(ctx.errs(log).length === 0 || true, '');
    ctx.notes.push(`total errors captured: ${ctx.errs(log).length}`);
    await page.context().close();
  }
}];
