#!/usr/bin/env node
/**
 * Netlify function handler harness: bundles every function, starts stub OpenAI + stub Supabase, executes the handlers
 * and prints a PASS/FAIL/SKIP table. Exit code 1 on any FAIL.
 *   node e2e/handlers/run.mjs [scenario-name-substring ...] [--verbose]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const filters = args.filter((a) => !a.startsWith('--'));

const OPENAI_PORT = Number(process.env.STUB_OPENAI_PORT || 54401);
const SUPABASE_PORT = Number(process.env.STUB_SUPABASE_PORT || 54402);

// ---- environment (must be set BEFORE the bundles are imported: several modules read env at import time)
Object.assign(process.env, {
  OPENAI_API_KEY: 'sk-test',
  OPENAI_BASE_URL: `http://127.0.0.1:${OPENAI_PORT}/v1`,
  SUPABASE_URL: `http://127.0.0.1:${SUPABASE_PORT}`,
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_ANON_KEY: 'anon-key',
  OPENAI_AGENTS_DISABLE_TRACING: '1',
  NO_PROXY: '127.0.0.1,localhost',
  no_proxy: '127.0.0.1,localhost',
});
for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'AI_GATEWAY_ALLOW_UNAUTHENTICATED', 'HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy']) delete process.env[k];

const { createStubOpenAI } = await import('./lib/stubOpenAI.mjs');
const { createStubSupabase } = await import('./lib/stubSupabase.mjs');
const { buildHandlers, loadFunction, REPO, OUT_DIR } = await import('./lib/build.mjs');
const { Results, makeT } = await import('./lib/util.mjs');

const openai = createStubOpenAI({ port: OPENAI_PORT });
const supa = createStubSupabase({ port: SUPABASE_PORT });
await openai.start();
await supa.start();

const results = new Results();
let exitCode = 0;
try {
  const t0 = Date.now();
  const { metafile } = await buildHandlers();
  console.log(`built ${Object.keys(metafile.outputs).filter((o) => o.endsWith('.mjs') && !/chunk-/.test(o)).length} function bundles -> ${path.relative(REPO, OUT_DIR) || OUT_DIR} (${Date.now() - t0} ms)`);

  const dir = path.join(here, 'scenarios');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
  for (const f of files) {
    const name = f.replace(/\.mjs$/, '');
    if (filters.length && !filters.some((x) => name.includes(x))) continue;
    openai.reset();
    supa.reset();
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    const handlerLabel = mod.label ?? name;
    const t = makeT(results, handlerLabel);
    const started = Date.now();
    try {
      await mod.default({ t, openai, supa, loadFunction, results, REPO, makeT: (label) => makeT(results, label) });
    } catch (e) {
      results.add(handlerLabel, 'scenario crashed', 'FAIL', (e?.stack ?? String(e)).split('\n').slice(0, 6).join(' / '));
    }
    if (verbose) console.log(`scenario ${name} done in ${Date.now() - started} ms`);
  }
} catch (e) {
  console.error('harness failure:', e);
  exitCode = 2;
} finally {
  await openai.stop();
  await supa.stop();
}

// ---- report
const byHandler = new Map();
for (const r of results.rows) {
  const g = byHandler.get(r.handler) ?? { PASS: 0, FAIL: 0, SKIP: 0, INFO: 0, rows: [] };
  g[r.status]++;
  g.rows.push(r);
  byHandler.set(r.handler, g);
}
const pad = (s, n) => String(s).padEnd(n);
console.log('\n' + pad('HANDLER', 38) + pad('PASS', 6) + pad('FAIL', 6) + pad('SKIP', 6) + 'RESULT');
console.log('-'.repeat(66));
let total = { PASS: 0, FAIL: 0, SKIP: 0 };
for (const [h, g] of byHandler) {
  total.PASS += g.PASS; total.FAIL += g.FAIL; total.SKIP += g.SKIP;
  console.log(pad(h, 38) + pad(g.PASS, 6) + pad(g.FAIL, 6) + pad(g.SKIP, 6) + (g.FAIL ? 'FAIL' : 'PASS'));
}
console.log('-'.repeat(66));
console.log(pad('TOTAL', 38) + pad(total.PASS, 6) + pad(total.FAIL, 6) + pad(total.SKIP, 6) + (total.FAIL ? 'FAIL' : 'PASS'));

for (const [h, g] of byHandler) {
  for (const r of g.rows) {
    if (r.status === 'FAIL' || r.status === 'SKIP' || r.status === 'INFO' || verbose) console.log(`  [${r.status}] ${h} :: ${r.check}${r.note ? ` -- ${r.note}` : ''}`);
  }
}
if (total.FAIL || exitCode) process.exitCode = exitCode || 1;
