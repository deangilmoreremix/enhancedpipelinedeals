/**
 * Bundles every Netlify function with esbuild (as Netlify's `node_bundler = "esbuild"` does): relative imports
 * (src/**, skills/**) are bundled, node_modules packages stay external (resolved from the repo's node_modules).
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, '../../..');
export const FUNCTIONS_DIR = path.join(REPO, 'netlify/functions');
export const OUT_DIR = process.env.HANDLERS_OUT ? path.resolve(process.env.HANDLERS_OUT) : path.resolve(here, '../.build');

export function functionEntries() {
  return fs.readdirSync(FUNCTIONS_DIR)
    .filter((f) => /\.(ts|js)$/.test(f))
    .filter((f) => fs.statSync(path.join(FUNCTIONS_DIR, f)).size > 0) // personas.ts is an empty file
    .map((f) => path.join(FUNCTIONS_DIR, f));
}

export async function buildHandlers() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // out dir outside the repo (HANDLERS_OUT) still needs to resolve node_modules
  const nm = path.join(OUT_DIR, 'node_modules');
  if (!OUT_DIR.startsWith(REPO + path.sep) && !fs.existsSync(nm)) fs.symlinkSync(path.join(REPO, 'node_modules'), nm, 'dir');
  const result = await build({
    entryPoints: functionEntries(),
    outdir: OUT_DIR,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    packages: 'external',
    outExtension: { '.js': '.mjs' },
    sourcemap: 'inline',
    logLevel: 'silent',
    absWorkingDir: REPO,
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    metafile: true,
  });
  return { outDir: OUT_DIR, metafile: result.metafile };
}

/** Import a built function by its source basename (e.g. 'ai-gateway'). */
export async function loadFunction(name) {
  const mod = await import(path.join(OUT_DIR, `${name}.mjs`));
  // CJS sources (`exports.handler = ...`) bundle to a default export
  return mod.handler || mod.default?.handler ? { ...mod, handler: mod.handler ?? mod.default.handler, default: mod.default?.handler ? undefined : mod.default } : mod;
}
