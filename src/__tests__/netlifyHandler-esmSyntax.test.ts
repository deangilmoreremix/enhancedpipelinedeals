/** @jest-environment node */
/**
 * Regression: the repo is "type": "module", so Netlify bundles every .js function as an ES module. CommonJS
 * (`require` / `module.exports` / `exports.handler`) in netlify/functions/*.js crashes at runtime with
 * "exports is not defined in ES module scope" (found by executing the handlers: e2e/handlers/run.mjs).
 */
import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'netlify/functions');
const jsFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

describe('netlify/functions/*.js are ES modules', () => {
  it('finds the JS functions', () => {
    expect(jsFiles.length).toBeGreaterThan(5);
  });

  it.each(jsFiles)('%s uses import/export, not CommonJS', (file) => {
    const src = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/\brequire\s*\(/);
    expect(src).not.toMatch(/\bmodule\.exports\b/);
    expect(src).not.toMatch(/(^|[^.\w])exports\.\w+\s*=/m);
  });
});
