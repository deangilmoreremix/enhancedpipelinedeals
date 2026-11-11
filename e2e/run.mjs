#!/usr/bin/env node
// Usage: node e2e/run.mjs [--only A,B] [--mode demo|fake|both]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startVite } from './lib/server.mjs';
import { launch, newPage, errorsOf, RESULTS_DIR } from './lib/browser.mjs';
import { FakeSupabase, defaultSeed } from './lib/fakeSupabase.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const only = (arg('only', '') || '').split(',').filter(Boolean).map(s => s.toUpperCase());
const mode = arg('mode', 'both');
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const files = fs.readdirSync(path.join(dir, 'scenarios')).filter(f => f.endsWith('.mjs')).sort();
const scenarios = [];
for (const f of files) scenarios.push(...[].concat((await import(pathToFileURL(path.join(dir, 'scenarios', f)))).default));

const servers = [];
const modes = [];
if (mode !== 'fake') { const s = await startVite(Number(process.env.E2E_PORT_DEMO || 5199)); servers.push(s); modes.push({ id: 'demo', url: s.url }); }
if (mode !== 'demo') {
  const s = await startVite(Number(process.env.E2E_PORT_FAKE || 5198), { VITE_SUPABASE_URL: 'http://fake.supabase.local', VITE_SUPABASE_ANON_KEY: 'fake' });
  servers.push(s); modes.push({ id: 'fake', url: s.url });
}
const browser = await launch();
const rows = [];
for (const m of modes) {
  for (const sc of scenarios) {
    if (sc.modes && !sc.modes.includes(m.id)) continue;
    if (only.length && !only.includes(sc.id.toUpperCase()) && !only.includes((sc.id + ':' + sc.name).toUpperCase())) continue;
    const started = Date.now();
    const notes = [];
    const checks = [];
    const ctx = {
      mode: m.id, url: m.url, browser, notes,
      fake: (seed) => (m.id === 'fake' ? new FakeSupabase(seed || defaultSeed()) : null),
      ids: m.id === 'fake' ? { deal: '00000000-0000-4000-8000-000000000001', contact: 'c0000000-0000-4000-8000-000000000001', dealTitle: 'Enterprise Software License' } : { deal: 'deal-1', contact: 'contact-1', dealTitle: 'Enterprise Software License' },
      page: (opts = {}) => newPage(browser, { baseURL: m.url, name: `${sc.id}-${m.id}`, ...opts }),
      // soft check: records failures but continues
      check(cond, msg) { checks.push({ ok: !!cond, msg }); if (!cond) notes.push('FAIL: ' + msg); return !!cond; },
      async step(name, fn) { try { await fn(); } catch (e) { checks.push({ ok: false, msg: name }); notes.push(`FAIL: ${name} -> ${String(e.message || e).split('\n')[0].slice(0, 220)}`); } },
      skip(msg) { checks.push({ ok: true, skip: true, msg }); notes.push('SKIP: ' + msg); },
      errs: (log) => errorsOf(log),
    };
    let status = 'PASS';
    try { await sc.run(ctx); } catch (e) { status = 'FAIL'; notes.push('EXCEPTION: ' + String(e.message || e).split('\n').slice(0, 3).join(' | ')); }
    if (checks.some(c => !c.ok)) status = 'FAIL';
    else if (status === 'PASS' && checks.length && checks.every(c => c.skip)) status = 'SKIP';
    rows.push({ id: sc.id, name: sc.name, mode: m.id, status, secs: ((Date.now() - started) / 1000).toFixed(1), notes });
    console.log(`${status.padEnd(4)} ${sc.id} ${sc.name} [${m.id}] ${((Date.now() - started) / 1000).toFixed(1)}s`);
    for (const n of notes) console.log('      ' + n);
  }
}
await browser.close();
servers.forEach(s => s.stop());
fs.writeFileSync(path.join(RESULTS_DIR, 'results.json'), JSON.stringify(rows, null, 2));
const md = ['| Scenario | Mode | Status | Notes |', '|---|---|---|---|', ...rows.map(r => `| ${r.id} ${r.name} | ${r.mode} | ${r.status} | ${r.notes.join('; ').replace(/\|/g, '/')} |`)];
fs.writeFileSync(path.join(RESULTS_DIR, 'results.md'), md.join('\n'));
process.exit(rows.some(r => r.status === 'FAIL') ? 1 : 0);
