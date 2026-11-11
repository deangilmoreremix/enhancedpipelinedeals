/**
 * Parses supabase/migrations/*.sql (CREATE TABLE / ALTER TABLE ADD COLUMN / RENAME) into { table -> Set(columns) } so that the
 * tables/columns the handlers touch (recorded by stubSupabase.audit) can be checked against the real schema.
 * Heuristic parser: good enough for the plain DDL used in this repo; tables it cannot see are reported as "unknown".
 */
import fs from 'node:fs';
import path from 'node:path';

const splitTop = (s) => {
  const out = []; let depth = 0, cur = '', q = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
};

const CONSTRAINT = /^(constraint|primary|foreign|unique|check|exclude|like)\b/i;
const ident = (x) => x.replace(/^public\./i, '').replace(/"/g, '').toLowerCase();

export function loadSchema(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const tables = new Map();
  const required = new Map(); // table -> Set(columns that are NOT NULL without default/identity)
  const req = (t) => { if (!required.has(t)) required.set(t, new Set()); return required.get(t); };
  const get = (t) => { if (!tables.has(t)) tables.set(t, new Set()); return tables.get(t); };
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8').replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:unlogged\s+)?(table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*(\(|as\b)/gi)) {
      const name = ident(m[2]);
      if (m[1].toLowerCase() !== 'table') { get(name).add('*'); continue; } // views: not column-checked
      let i = m.index + m[0].length - 1, depth = 0, j = i;
      if (m[3] !== '(') continue;
      for (; j < sql.length; j++) { if (sql[j] === '(') depth++; else if (sql[j] === ')') { depth--; if (depth === 0) break; } }
      for (const part of splitTop(sql.slice(i + 1, j))) {
        const p = part.trim();
        if (!p || CONSTRAINT.test(p)) continue;
        const col = ident(p.split(/\s+/)[0]);
        get(name).add(col);
        if (/\bnot\s+null\b/i.test(p) && !/\bdefault\b|\bgenerated\b|\bserial\b|primary\s+key/i.test(p)) req(name).add(col);
      }
    }
    for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+([^;]+);/gi)) {
      const name = ident(m[1]);
      for (const add of splitTop(m[2])) {
        const a = /add\s+column\s+(?:if\s+not\s+exists\s+)?("?[\w]+"?)/i.exec(add);
        if (a) { get(name).add(ident(a[1])); if (/not\s+null/i.test(add) && !/default/i.test(add)) req(name).add(ident(a[1])); }
        const r = /rename\s+column\s+("?\w+"?)\s+to\s+("?\w+"?)/i.exec(add);
        if (r) { get(name).delete(ident(r[1])); get(name).add(ident(r[2])); }
      }
    }
    for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?([\w."]+)\s+rename\s+to\s+("?[\w]+"?)/gi)) {
      const from = ident(m[1]), to = ident(m[2]);
      if (tables.has(from)) { tables.set(to, tables.get(from)); tables.delete(from); }
    }
  }
  tables.required = required;
  return tables;
}

/** Returns problems for audit entries touching unknown tables/columns. */
export function checkAudit(audit, tables) {
  const problems = new Map();
  for (const a of audit) {
    const cols = tables.get(a.table);
    if (!cols) { problems.set(`table:${a.table}`, `table "${a.table}" is not created by any migration`); continue; }
    if (cols.has('*')) continue;
    const req = tables.required?.get(a.table);
    if (req) for (const keys of a.rowKeys ?? []) for (const c of req) if (!keys.includes(c)) problems.set(`${a.table}.${c}!`, `insert into "${a.table}" omits NOT NULL column "${c}" (no default) -> real Postgres would reject it`);
    for (const c of a.cols) if (!cols.has(c.toLowerCase())) problems.set(`${a.table}.${c}`, `column "${a.table}.${c}" (${a.method}) is not defined by any migration`);
  }
  return [...problems.values()];
}
