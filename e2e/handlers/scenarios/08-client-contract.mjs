import fs from 'node:fs';
import path from 'node:path';
import { assert } from '../lib/util.mjs';

export const label = 'client endpoints vs deployed functions';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['__tests__', '__mocks__', 'tests', 'node_modules'].includes(e.name)) walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Every literal '/.netlify/functions/<name>' or '/api/...' the browser code calls must be served by something that exists:
 * a v1 function file, a v2 function `config.path`, or a netlify.toml redirect. Missing ones are reported (SKIP rows with
 * file:line) so they can be handed back; they are not failures of the handlers themselves.
 */
export default async function ({ t, REPO }) {
  const fnDir = path.join(REPO, 'netlify/functions');
  const files = fs.readdirSync(fnDir).filter((f) => /\.(ts|js)$/.test(f) && fs.statSync(path.join(fnDir, f)).size > 0);
  const v1 = new Set(files.map((f) => f.replace(/\.(ts|js)$/, '')));
  const paths = new Set();
  for (const f of files) {
    const src = fs.readFileSync(path.join(fnDir, f), 'utf8');
    for (const m of src.matchAll(/config\s*=\s*\{[^}]*path:\s*'([^']+)'/g)) paths.add(m[1]);
  }
  const toml = fs.readFileSync(path.join(REPO, 'netlify.toml'), 'utf8');
  for (const m of toml.matchAll(/^from\s*=\s*"([^"]+)"/gm)) if (m[1] !== '/*') paths.add(m[1]);

  const missing = [];
  const seen = new Set();
  for (const file of walk(path.join(REPO, 'src'))) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/['"`](\/\.netlify\/functions\/([\w-]+)|\/api\/[\w\-/]+)/g)) {
        if (/^\s*(\/\/|\*)/.test(line)) continue;
        const url = m[1];
        const ok = m[2] ? v1.has(m[2]) : [...paths].some((p) => url === p || url.startsWith(p + '/'));
        const key = `${url}@${path.relative(REPO, file)}:${i + 1}`;
        if (!ok && !seen.has(key) && !/\$\{/.test(url)) { seen.add(key); missing.push({ url, where: `${path.relative(REPO, file)}:${i + 1}` }); }
      }
    });
  }
  await t(`scanned client code: ${v1.size} v1 functions, ${paths.size} v2/redirect paths`, async () => assert.ok(v1.size > 10 && paths.size >= 5));
  // Every endpoint the client calls must exist (the dead ones were converted to direct Supabase queries / removed).
  await t(`all client endpoint literals are served (${seen.size} unresolved)`, async () => assert.deepEqual(missing.map((m) => `${m.url} (${m.where})`), []));
  // Calls to protected functions must carry the Supabase bearer token (authedFetch / authHeader), not a bare fetch().
  const PROTECTED = ['selectPersona', 'autopilot-run', 'memory-get', 'mood-preview', 'calendar-api', 'email-api'];
  const bare = [];
  for (const file of walk(path.join(REPO, 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bfetch\(\s*[`'"]\/\.netlify\/functions\/([\w-]+)/g)) {
      if (PROTECTED.includes(m[1])) bare.push(`${m[1]} @ ${path.relative(REPO, file)}`);
    }
  }
  await t('protected functions are called through authedFetch (no bare fetch)', async () => assert.deepEqual(bare, []));
}
