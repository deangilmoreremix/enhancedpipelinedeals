// Strict-contract helpers for the fake Supabase: schema.json (generated from the real migrations by
// e2e/sql/run.sh -> emit-schema.sql) is the single source of truth for tables/columns/rpc/policies/buckets.
// Every function here is pure; FakeSupabase decides what to do with the verdicts and records violations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
export const schema = JSON.parse(fs.readFileSync(path.join(dir, 'schema.json'), 'utf8'));

export const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict']);
export const OPS = { GET: 'SELECT', HEAD: 'SELECT', POST: 'INSERT', PATCH: 'UPDATE', DELETE: 'DELETE' };

export function splitTop(s) {
  const out = []; let d = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') d++; if (ch === ')') d--;
    if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export const tableDef = (t) => schema.tables[t] || null;
export const hasColumn = (t, c) => !!schema.tables[t]?.columns?.[c];

/** Base column of a filter/select token: strips ->/->> json paths and ::casts. */
export function baseColumn(tok) {
  return tok.split('::')[0].split('->')[0].trim();
}

// ---------------------------------------------------------------------------------------------
// PostgREST error shapes
// ---------------------------------------------------------------------------------------------
export const errTable = (t) => ({ status: 404, body: { code: 'PGRST205', details: null, hint: null, message: `Could not find the table 'public.${t}' in the schema cache` } });
export const errInsCol = (t, c) => ({ status: 400, body: { code: 'PGRST204', details: null, hint: null, message: `Could not find the '${c}' column of '${t}' in the schema cache` } });
export const errCol = (t, c) => ({ status: 400, body: { code: '42703', details: null, hint: null, message: `column ${t}.${c} does not exist` } });
export const errRel = (a, b) => ({ status: 400, body: { code: 'PGRST200', details: `Searched for a foreign key relationship between '${a}' and '${b}' in the schema 'public', but no matches were found.`, hint: null, message: `Could not find a relationship between '${a}' and '${b}' in the schema cache` } });
export const errRls = (t) => ({ status: 403, body: { code: '42501', details: null, hint: null, message: `new row violates row-level security policy for table "${t}"` } });
export const errView = (t, op) => ({ status: 400, body: { code: '55000', details: null, hint: null, message: `cannot ${op.toLowerCase()} view "${t}"` } });
export const errNotNull = (t, c) => ({ status: 400, body: { code: '23502', details: null, hint: null, message: `null value in column "${c}" of relation "${t}" violates not-null constraint` } });
export const errGenerated = (t, c) => ({ status: 400, body: { code: '428C9', details: null, hint: null, message: `cannot insert a non-DEFAULT value into column "${c}"` } });

// ---------------------------------------------------------------------------------------------
// Column validation
// ---------------------------------------------------------------------------------------------
/** Validate a PostgREST `select=` string. Returns an error {status, body} or null. */
export function checkSelect(table, sel) {
  if (!sel || sel === '*') return null;
  for (let item of splitTop(sel)) {
    item = item.trim();
    if (!item || item === '*') continue;
    const paren = item.indexOf('(');
    if (paren >= 0) {
      // embed: [alias:]rel[!hint][!inner](cols)   or aggregate like count()
      const head = item.slice(0, paren);
      const inner = item.slice(paren + 1, item.lastIndexOf(')'));
      const afterAlias = head.includes(':') ? head.split(':').slice(1).join(':') : head;
      const [rel, ...hints] = afterAlias.split('!');
      if (!rel || rel === 'count' || /\.(sum|avg|min|max|count)$/.test(rel)) continue;
      if (tableDef(rel)) { const e = checkSelect(rel, inner); if (e) return e; continue; }
      if (hints.some(h => h !== 'inner' && h !== 'left')) continue; // explicit fk hint: cannot verify
      if (hasColumn(table, rel)) continue; // column-name embedding
      return errRel(table, rel);
    }
    const am = item.match(/^[\w"]+:(?!:)(.*)$/); // alias:column
    const col = baseColumn(am ? am[1] : item);
    if (col && col !== 'count' && !hasColumn(table, col)) return errCol(table, col);
  }
  return null;
}

/** Validate filter keys, `or`/`and` expressions, order and on_conflict/columns. */
export function checkQuery(table, q) {
  for (const [k, v] of q.entries()) {
    if (k === 'select') { const e = checkSelect(table, v); if (e) return e; continue; }
    if (k === 'order') {
      for (const spec of splitTop(v)) { if (spec.includes('(')) continue; const c = baseColumn(spec.split('.')[0]); if (c && !hasColumn(table, c)) return errCol(table, c); }
      continue;
    }
    if (k === 'on_conflict' || k === 'columns') {
      for (const c of v.replace(/^"|"$/g, '').split(',')) { const cc = c.trim().replace(/^"|"$/g, ''); if (cc && !hasColumn(table, cc)) return k === 'columns' ? errInsCol(table, cc) : errCol(table, cc); }
      continue;
    }
    if (k === 'limit' || k === 'offset') continue;
    if (k === 'or' || k === 'and' || k === 'not.or' || k === 'not.and') {
      const e = checkLogic(table, v.replace(/^\(|\)$/g, '')); if (e) return e; continue;
    }
    if (k.includes('.')) continue; // embedded-resource filter (rel.col=...)
    const c = baseColumn(k);
    if (c && !hasColumn(table, c)) return errCol(table, c);
  }
  return null;
}
function checkLogic(table, expr) {
  for (const part of splitTop(expr)) {
    const m = part.match(/^(and|or)\((.*)\)$/);
    if (m) { const e = checkLogic(table, m[2]); if (e) return e; continue; }
    const c = baseColumn(part.split('.')[0]);
    if (c && !hasColumn(table, c)) return errCol(table, c);
  }
  return null;
}

/** Validate keys of an insert/update body (PGRST204 for unknown, 428C9 for generated). */
export function checkBody(table, items, op) {
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    for (const k of Object.keys(it)) {
      const col = schema.tables[table].columns[k];
      if (!col) return errInsCol(table, k);
      if (col.generated && it[k] != null) return errGenerated(table, k);
    }
  }
  return null;
}

/** Columns that are NOT NULL, have no default and are not generated, and are missing from `row`. */
export function missingRequired(table, row) {
  for (const [name, c] of Object.entries(schema.tables[table].columns)) {
    if (c.nullable === false && c.default == null && !c.generated && (row[name] === undefined || row[name] === null)) return name;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// RLS (open mode): a role may perform an op iff at least one policy for (role, op) exists.
// ---------------------------------------------------------------------------------------------
export function policyAllows(table, role, op) {
  const t = tableDef(table);
  if (!t) return false;
  if (t.kind === 'view') return op === 'SELECT';
  if (t.rls === false) return true;
  return (t.by_role?.[role]?.[op] || []).length > 0;
}

// ---------------------------------------------------------------------------------------------
// RPC signatures
// ---------------------------------------------------------------------------------------------
export function parseArgs(argStr) {
  if (!argStr || !argStr.trim()) return [];
  return splitTop(argStr).map(a => {
    const s = a.trim().replace(/^(IN|INOUT|VARIADIC)\s+/i, '');
    const name = s.split(/\s+/)[0];
    return { name, required: !/\sDEFAULT\s/i.test(s) };
  });
}
export function rpcOverloads(fn) { return (schema.rpc[fn] || []).map(o => ({ ...o, parsed: parseArgs(o.args) })); }

/** Returns {ok, overload} | {error: {status, body}} for calling `fn` with named args `keys`. */
export function matchRpc(fn, keys) {
  const ovs = rpcOverloads(fn);
  const sig = (o) => o.parsed.map(p => p.name).join(', ');
  if (!ovs.length) return { error: { status: 404, body: { code: 'PGRST202', details: `Searched for the function public.${fn} with parameter names ${keys.join(', ') || '(none)'} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`, hint: null, message: `Could not find the function public.${fn}(${keys.join(', ')}) in the schema cache` } } };
  for (const o of ovs) {
    const names = new Set(o.parsed.map(p => p.name));
    if (keys.every(k => names.has(k)) && o.parsed.filter(p => p.required).every(p => keys.includes(p.name))) return { ok: true, overload: o };
  }
  return { error: { status: 404, body: { code: 'PGRST202', details: `Searched for the function public.${fn} with parameter names ${keys.join(', ') || '(none)'} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`, hint: `Perhaps you meant to call the function public.${fn}(${sig(ovs[0])})`, message: `Could not find the function public.${fn}(${keys.join(', ')}) in the schema cache` } } };
}

// ---------------------------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------------------------
export const bucketDef = (b) => schema.storage.buckets[b] || null;
/** Storage policy lookup: policies are named "<who> <verb> <bucket>"; match by bucket name in the policy name. */
export function storageAllows(bucket, role, op) {
  const ps = schema.storage.policies.filter(p => p.name.includes(bucket) && p.roles.includes(role) && (p.cmd === op || p.cmd === 'ALL'));
  if (ps.length) return true;
  return !schema.storage.policies.some(p => p.name.includes(bucket)); // no policies for bucket at all: not enforceable
}
export const bucketNotFound = { status: 400, body: { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' } };
export const storageRls = { status: 403, body: { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' } };
