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

// A signed-in user for fake mode (supabase-js storage key for http://fake.supabase.local is sb-fake-auth-token).
export const DEFAULT_USER = { id: 'u0000000-0000-4000-8000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'e2e@example.com', app_metadata: {}, user_metadata: { name: 'E2E User' }, created_at: new Date().toISOString() };
export function sessionInit(user = DEFAULT_USER) {
  const session = { access_token: 'fake.jwt.token', refresh_token: 'rt', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user };
  return `localStorage.setItem('sb-fake-auth-token', ${JSON.stringify(JSON.stringify(session))});`;
}

// fake mode signs in by default (real users are `authenticated`; anon has far fewer RLS policies). Pass anon: true to stay signed out.
export async function newPage(browser, { baseURL, name, fake, viewport, acceptDownloads = true, init, anon = false } = {}) {
  const context = await browser.newContext({ baseURL, deviceScaleFactor: 1,
    viewport: viewport || { width: 1440, height: 900 }, acceptDownloads });
  const log = { console: [], pageErrors: [], failedRequests: [] };
  if (fake) await fake.install(context);
  else await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort()); // block external
  if (fake && !anon && !fake.session) { fake.session = { user: DEFAULT_USER }; await context.addInitScript(sessionInit()); }
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on('dialog', d => { log.dialogs = (log.dialogs || []); log.dialogs.push(d.message()); d.accept().catch(() => {}); });
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
// AI gateway (Netlify function) is absent in the sandbox: handled 404s are expected, not app bugs.
const TOLERATED = [/AIGatewayError/, /OpenAI Function Calling failed/];
export function errorsOf(log) { return [...log.pageErrors.map(e => 'PAGEERROR ' + e), ...log.console.map(e => 'CONSOLE ' + e), ...log.failedRequests.map(e => 'REQ ' + e)].filter(e => !TOLERATED.some(r => r.test(e))); }
