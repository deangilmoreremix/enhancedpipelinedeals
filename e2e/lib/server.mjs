import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function up(url) { return new Promise(res => { http.get(url, r => { r.resume(); res(true); }).on('error', () => res(false)); }); }

// Starts (or reuses) a vite dev server. env: extra env vars (e.g. VITE_SUPABASE_URL)
export async function startVite(port, env = {}) {
  const url = `http://localhost:${port}`;
  if (await up(url)) return { url, stop() {}, reused: true };
  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: root, env: { ...process.env, ...env }, stdio: 'ignore', detached: true });
  for (let i = 0; i < 90; i++) { if (await up(url)) break; await new Promise(r => setTimeout(r, 500)); }
  return { url, stop() { try { process.kill(-child.pid); } catch {} } };
}
