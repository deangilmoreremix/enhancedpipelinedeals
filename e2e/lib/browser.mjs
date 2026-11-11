import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
// Prefer the globally preinstalled playwright (matches the browsers in PLAYWRIGHT_BROWSERS_PATH); fall back to local.
const require = createRequire(import.meta.url);
let pw;
try { pw = createRequire('/opt/node-tools/x.js')('playwright'); } catch { pw = require('playwright'); }
const { chromium } = pw;

export const RESULTS_DIR = process.env.E2E_RESULTS ||
  '/tmp/claude-0/-home-user-enhancedpipelinedeals/e37107ed-7c2a-5f25-b161-2c2842a1acc0/scratchpad/e2e-results';

// console noise that is not an app bug (network to blocked external hosts, fonts, etc.)
const IGNORE = [/Failed to load resource/i, /net::ERR_/i, /fonts\.(googleapis|gstatic)/i, /favicon/i,
  /Download the React DevTools/i, /\[vite\]/i, /ResizeObserver loop/i];

export async function launch() {
  const browser = await chromium.launch();
  return browser;
}

export async function newPage(browser, { baseURL, name, fake, viewport, acceptDownloads = true, init } = {}) {
  const context = await browser.newContext({ baseURL, deviceScaleFactor: 1,
    viewport: viewport || { width: 1440, height: 900 }, acceptDownloads });
  const log = { console: [], pageErrors: [], failedRequests: [] };
  if (fake) await fake.install(context);
  else await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort()); // block external
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (IGNORE.some(r => r.test(t))) return;
    log.console.push(t.slice(0, 400));
  });
  page.on('pageerror', e => log.pageErrors.push(String(e.stack || e).slice(0, 600)));
  page.on('requestfailed', r => {
    const u = r.url();
    if (!u.startsWith(baseURL || 'http://localhost')) return;
    log.failedRequests.push(`${r.method()} ${u} ${r.failure()?.errorText}`);
  });
  page.on('response', r => {
    const u = r.url();
    if (u.startsWith(baseURL || 'http://localhost') && r.status() >= 500) log.failedRequests.push(`${r.status()} ${u}`);
  });
  const shot = async (n) => {
    const dir = path.join(RESULTS_DIR, name || 'misc'); fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${n}.png`) }).catch(() => {});
  };
  return { context, page, log, shot };
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function errorsOf(log) { return [...log.pageErrors.map(e => 'PAGEERROR ' + e), ...log.console.map(e => 'CONSOLE ' + e), ...log.failedRequests.map(e => 'REQ ' + e)]; }
