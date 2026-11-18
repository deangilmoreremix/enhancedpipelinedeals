/**
 * Small, safe formula language for computed custom fields.
 *
 *   {value} * {probability} / 100
 *   IF({tier} = "Gold", {value} * 0.9, {value})
 *   CONCAT({company}, " - ", {title})
 *   DAYS_BETWEEN({createdAt}, {closeDate})
 *
 * Hand-written tokenizer + recursive-descent parser + tree-walking evaluator. There is NO eval / Function and no
 * property access: `{key}` refs go through a caller supplied resolver, functions come from a fixed table.
 */
import type { CustomFieldEntityType, CustomFieldValue, DealFieldDefinition } from '../types/customFields';

export type FormulaValue = number | string | boolean | null;

export class FormulaError extends Error {
  constructor(message: string) { super(message); this.name = 'FormulaError'; }
}

export const MAX_FORMULA_LENGTH = 1000;
const MAX_TOKENS = 400;
const MAX_DEPTH = 40;
export const ERROR_TEXT = '#ERR';

// ---- tokenizer ---------------------------------------------------------------------------------

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ref'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'end' };

const REF_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function tokenize(src: string): Tok[] {
  if (src.length > MAX_FORMULA_LENGTH) throw new FormulaError(`Formula is too long (max ${MAX_FORMULA_LENGTH} characters)`);
  const out: Tok[] = [];
  let i = 0;
  const push = (tok: Tok) => {
    out.push(tok);
    if (out.length > MAX_TOKENS) throw new FormulaError('Formula is too complex');
  };
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '{') {
      const close = src.indexOf('}', i + 1);
      if (close < 0) throw new FormulaError('Missing "}"');
      const key = src.slice(i + 1, close).trim();
      if (!REF_KEY.test(key)) throw new FormulaError(`Invalid field reference {${key}}`);
      push({ t: 'ref', v: key });
      i = close + 1;
      continue;
    }
    if ((c >= '0' && c <= '9') || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      let j = i;
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j++;
      if (src[j] === '.') { j++; while (j < src.length && src[j] >= '0' && src[j] <= '9') j++; }
      const n = Number(src.slice(i, j));
      if (!Number.isFinite(n)) throw new FormulaError('Invalid number');
      push({ t: 'num', v: n });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = '';
      for (;;) {
        if (j >= src.length) throw new FormulaError('Unterminated string');
        const d = src[j];
        if (d === '\\' && j + 1 < src.length) { s += src[j + 1]; j += 2; continue; }
        if (d === c) { if (src[j + 1] === c) { s += c; j += 2; continue; } break; }
        s += d; j++;
      }
      push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_') {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '<>' || two === '<=' || two === '>=' || two === '&&' || two === '||') {
      push({ t: 'op', v: two === '<>' ? '!=' : two === '==' ? '=' : two });
      i += 2;
      continue;
    }
    if ('+-*/%()<>=,!'.includes(c)) { push({ t: 'op', v: c }); i++; continue; }
    throw new FormulaError(`Unexpected character "${c}"`);
  }
  push({ t: 'end' });
  return out;
}

// ---- parser ------------------------------------------------------------------------------------

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'lit'; v: boolean | null }
  | { k: 'ref'; key: string }
  | { k: 'un'; op: '-' | '+' | '!'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; name: string; args: Node[] };

const FUNCTION_NAMES = ['IF', 'ROUND', 'MIN', 'MAX', 'ABS', 'CONCAT', 'DAYS_BETWEEN'] as const;
export const FORMULA_FUNCTIONS: readonly string[] = FUNCTION_NAMES;

class Parser {
  private pos = 0;
  private depth = 0;
  constructor(private readonly toks: Tok[]) {}

  private peek(): Tok { return this.toks[this.pos]; }
  private next(): Tok { return this.toks[this.pos++]; }
  private isOp(v: string): boolean { const t = this.peek(); return t.t === 'op' && t.v === v; }
  private expectOp(v: string) {
    if (!this.isOp(v)) throw new FormulaError(`Expected "${v}"`);
    this.pos++;
  }

  parse(): Node {
    if (this.peek().t === 'end') throw new FormulaError('Formula is empty');
    const n = this.or();
    if (this.peek().t !== 'end') throw new FormulaError('Unexpected input after the end of the expression');
    return n;
  }

  private enter() { if (++this.depth > MAX_DEPTH) throw new FormulaError('Formula is nested too deeply'); }
  private leave() { this.depth--; }

  private or(): Node {
    let a = this.and();
    while (this.isOp('||')) { this.pos++; a = { k: 'bin', op: '||', a, b: this.and() }; }
    return a;
  }
  private and(): Node {
    let a = this.cmp();
    while (this.isOp('&&')) { this.pos++; a = { k: 'bin', op: '&&', a, b: this.cmp() }; }
    return a;
  }
  private cmp(): Node {
    let a = this.add();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && ['=', '!=', '<', '<=', '>', '>='].includes(t.v)) { this.pos++; a = { k: 'bin', op: t.v, a, b: this.add() }; } else return a;
    }
  }
  private add(): Node {
    let a = this.mul();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && (t.v === '+' || t.v === '-')) { this.pos++; a = { k: 'bin', op: t.v, a, b: this.mul() }; } else return a;
    }
  }
  private mul(): Node {
    let a = this.unary();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && (t.v === '*' || t.v === '/' || t.v === '%')) { this.pos++; a = { k: 'bin', op: t.v, a, b: this.unary() }; } else return a;
    }
  }
  private unary(): Node {
    const t = this.peek();
    if (t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '!')) {
      this.pos++;
      this.enter();
      const a = this.unary();
      this.leave();
      return { k: 'un', op: t.v as '-' | '+' | '!', a };
    }
    return this.primary();
  }
  private primary(): Node {
    const t = this.next();
    switch (t.t) {
      case 'num': return { k: 'num', v: t.v };
      case 'str': return { k: 'str', v: t.v };
      case 'ref': return { k: 'ref', key: t.v };
      case 'id': {
        const upper = t.v.toUpperCase();
        if (this.isOp('(')) {
          if (!FUNCTION_NAMES.includes(upper as typeof FUNCTION_NAMES[number])) throw new FormulaError(`Unknown function ${t.v}`);
          this.pos++;
          this.enter();
          const args: Node[] = [];
          if (!this.isOp(')')) {
            for (;;) {
              args.push(this.or());
              if (this.isOp(',')) { this.pos++; continue; }
              break;
            }
          }
          this.expectOp(')');
          this.leave();
          return { k: 'call', name: upper, args };
        }
        if (upper === 'TRUE') return { k: 'lit', v: true };
        if (upper === 'FALSE') return { k: 'lit', v: false };
        if (upper === 'NULL') return { k: 'lit', v: null };
        throw new FormulaError(`Unknown name ${t.v} (wrap field keys in braces, e.g. {${t.v}})`);
      }
      case 'op':
        if (t.v === '(') {
          this.enter();
          const n = this.or();
          this.expectOp(')');
          this.leave();
          return n;
        }
        throw new FormulaError(`Unexpected "${t.v}"`);
      default:
        throw new FormulaError('Unexpected end of formula');
    }
  }
}

export function parseFormula(src: string): Node {
  return new Parser(tokenize(String(src ?? ''))).parse();
}

/** Distinct `{key}` references in the order they appear (throws FormulaError on a syntax error). */
export function formulaRefs(src: string): string[] {
  const refs: string[] = [];
  const walk = (n: Node) => {
    if (n.k === 'ref') { if (!refs.includes(n.key)) refs.push(n.key); }
    else if (n.k === 'un') walk(n.a);
    else if (n.k === 'bin') { walk(n.a); walk(n.b); }
    else if (n.k === 'call') n.args.forEach(walk);
  };
  walk(parseFormula(src));
  return refs;
}

/** Throws a FormulaError when `src` does not parse. */
export function validateFormula(src: string): void { parseFormula(src); }

// ---- evaluator ---------------------------------------------------------------------------------

const isNil = (v: FormulaValue) => v === null || v === '';

function toNumber(v: FormulaValue): number {
  if (v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v.trim());
  if (v.trim() === '' || !Number.isFinite(n)) throw new FormulaError(`"${v.length > 20 ? `${v.slice(0, 20)}...` : v}" is not a number`);
  return n;
}
const toText = (v: FormulaValue): string => (v === null ? '' : typeof v === 'number' ? String(Math.round(v * 1e10) / 1e10) : String(v));
const truthy = (v: FormulaValue): boolean => (typeof v === 'string' ? v !== '' : !!v);

function toTime(v: FormulaValue): number {
  if (isNil(v)) throw new FormulaError('DAYS_BETWEEN needs two dates');
  const s = String(v);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T00:00:00Z`) : Date.parse(s);
  if (!Number.isFinite(t)) throw new FormulaError(`"${s}" is not a date`);
  return t;
}

const asComparable = (a: FormulaValue, b: FormulaValue): [number, number] | [string, string] => {
  const numeric = (v: FormulaValue) => typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));
  if ((numeric(a) || a === null) && (numeric(b) || b === null)) return [toNumber(a), toNumber(b)];
  return [toText(a).toLowerCase(), toText(b).toLowerCase()];
};

export type FormulaResolver = (key: string) => FormulaValue;

function evalNode(n: Node, resolve: FormulaResolver): FormulaValue {
  switch (n.k) {
    case 'num': case 'str': case 'lit': return n.v;
    case 'ref': return resolve(n.key);
    case 'un': {
      const v = evalNode(n.a, resolve);
      if (n.op === '!') return !truthy(v);
      return n.op === '-' ? -toNumber(v) : toNumber(v);
    }
    case 'bin': {
      if (n.op === '&&') return truthy(evalNode(n.a, resolve)) && truthy(evalNode(n.b, resolve));
      if (n.op === '||') return truthy(evalNode(n.a, resolve)) || truthy(evalNode(n.b, resolve));
      const a = evalNode(n.a, resolve);
      const b = evalNode(n.b, resolve);
      switch (n.op) {
        case '+':
          if (typeof a === 'string' && a !== '' && !Number.isFinite(Number(a))) return a + toText(b);
          if (typeof b === 'string' && b !== '' && !Number.isFinite(Number(b))) return toText(a) + b;
          return toNumber(a) + toNumber(b);
        case '-': return toNumber(a) - toNumber(b);
        case '*': return toNumber(a) * toNumber(b);
        case '/': {
          const d = toNumber(b);
          if (d === 0) throw new FormulaError('Division by zero');
          return toNumber(a) / d;
        }
        case '%': {
          const d = toNumber(b);
          if (d === 0) throw new FormulaError('Division by zero');
          return toNumber(a) % d;
        }
        default: {
          const [x, y] = asComparable(a, b);
          switch (n.op) {
            case '=': return x === y;
            case '!=': return x !== y;
            case '<': return x < y;
            case '<=': return x <= y;
            case '>': return x > y;
            case '>=': return x >= y;
            default: throw new FormulaError(`Unsupported operator ${n.op}`);
          }
        }
      }
    }
    case 'call': return callFunction(n, resolve);
  }
}

function callFunction(n: Extract<Node, { k: 'call' }>, resolve: FormulaResolver): FormulaValue {
  const arity = (min: number, max = min) => {
    if (n.args.length < min || n.args.length > max) {
      throw new FormulaError(`${n.name} takes ${min === max ? min : `${min}-${max === Infinity ? 'n' : max}`} argument${max === 1 ? '' : 's'}`);
    }
  };
  const ev = (i: number) => evalNode(n.args[i], resolve);
  switch (n.name) {
    case 'IF': arity(2, 3); return truthy(ev(0)) ? ev(1) : n.args.length > 2 ? ev(2) : null;
    case 'ROUND': {
      arity(1, 2);
      const digits = n.args.length > 1 ? Math.trunc(toNumber(ev(1))) : 0;
      if (digits < 0 || digits > 10) throw new FormulaError('ROUND digits must be 0-10');
      const f = 10 ** digits;
      return Math.round((toNumber(ev(0)) + Number.EPSILON) * f) / f;
    }
    case 'MIN': arity(1, Infinity); return Math.min(...n.args.map((_, i) => toNumber(ev(i))));
    case 'MAX': arity(1, Infinity); return Math.max(...n.args.map((_, i) => toNumber(ev(i))));
    case 'ABS': arity(1); return Math.abs(toNumber(ev(0)));
    case 'CONCAT': arity(1, Infinity); return n.args.map((_, i) => toText(ev(i))).join('');
    case 'DAYS_BETWEEN': arity(2); return Math.round((toTime(ev(1)) - toTime(ev(0))) / 86_400_000);
    default: throw new FormulaError(`Unknown function ${n.name}`);
  }
}

export type FormulaResult = { ok: true; value: FormulaValue } | { ok: false; error: string };

/** Parse + evaluate. Never throws: failures come back as `{ ok: false, error }`. */
export function evaluateFormula(src: string, resolve: FormulaResolver): FormulaResult {
  try {
    const value = evalNode(parseFormula(src), resolve);
    if (typeof value === 'number' && !Number.isFinite(value)) throw new FormulaError('Result is not a finite number');
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof FormulaError ? e.message : 'Could not evaluate formula' };
  }
}

// ---- records -----------------------------------------------------------------------------------

const iso = (v: unknown): FormulaValue => {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

/** Built-in (non-custom) fields a formula may reference, by entity. */
export const BUILTIN_FORMULA_FIELDS: Record<CustomFieldEntityType, string[]> = {
  deal: ['title', 'value', 'probability', 'stage', 'priority', 'company', 'contact', 'healthScore', 'aiScore', 'closeDate', 'dueDate', 'createdAt', 'updatedAt', 'tagCount'],
  contact: ['name', 'firstName', 'lastName', 'email', 'phone', 'title', 'company', 'status', 'aiScore', 'createdAt', 'updatedAt'],
  company: ['name', 'industry', 'website', 'domain', 'size', 'revenue', 'phone', 'address', 'createdAt', 'updatedAt'],
};
const DATE_BUILTINS = new Set(['closeDate', 'dueDate', 'createdAt', 'updatedAt']);

/** Built-in values of a record, restricted to the whitelist above (no arbitrary property access). */
export function builtinValues(entity: CustomFieldEntityType, record: Record<string, unknown> | null | undefined): Record<string, FormulaValue> {
  const out: Record<string, FormulaValue> = {};
  const r = record ?? {};
  for (const key of BUILTIN_FORMULA_FIELDS[entity]) {
    let raw: unknown;
    if (key === 'tagCount') raw = Array.isArray(r.tags) ? r.tags.length : 0;
    else raw = Object.prototype.hasOwnProperty.call(r, key) ? r[key] : undefined;
    if (DATE_BUILTINS.has(key)) out[key] = iso(raw);
    else if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string') out[key] = raw;
    else out[key] = null;
  }
  return out;
}

const customToFormula = (v: CustomFieldValue | undefined): FormulaValue => (Array.isArray(v) ? v.join(', ') : v === undefined ? null : v);

export interface ComputedFieldValue {
  value: FormulaValue;
  error?: string;
}

/**
 * Values of every computed definition for one record. `rollups` (by definition key) feeds rollup fields; formulas may
 * reference built-ins, stored custom fields, rollups and other formulas (cycles are reported as errors).
 */
export function computeFieldValues(
  entity: CustomFieldEntityType,
  defs: Array<Pick<DealFieldDefinition, 'key' | 'type' | 'config'>>,
  record: Record<string, unknown> | null | undefined,
  custom: Record<string, CustomFieldValue> | undefined,
  rollups: Record<string, FormulaValue> = {},
): Record<string, ComputedFieldValue> {
  const builtins = builtinValues(entity, record);
  const byKey = new Map(defs.map(d => [d.key, d]));
  const done = new Map<string, ComputedFieldValue>();
  const stack: string[] = [];

  const compute = (key: string): ComputedFieldValue => {
    const cached = done.get(key);
    if (cached) return cached;
    const def = byKey.get(key)!;
    let res: ComputedFieldValue;
    if (def.type === 'rollup') {
      res = { value: Object.prototype.hasOwnProperty.call(rollups, key) ? rollups[key] : null };
    } else if (stack.includes(key)) {
      res = { value: null, error: `Circular reference: ${[...stack.slice(stack.indexOf(key)), key].join(' -> ')}` };
    } else {
      stack.push(key);
      const r = evaluateFormula(def.config?.formula ?? '', ref => resolve(ref));
      stack.pop();
      res = r.ok ? { value: r.value } : { value: null, error: r.error };
    }
    // a cycle error must not be cached for the nodes that were only mid-evaluation
    if (!(res.error && res.error.startsWith('Circular') && stack.length > 0)) done.set(key, res);
    return res;
  };

  const resolve = (ref: string): FormulaValue => {
    const def = byKey.get(ref);
    if (def && (def.type === 'formula' || def.type === 'rollup')) {
      const c = compute(ref);
      if (c.error) throw new FormulaError(c.error);
      return c.value;
    }
    if (Object.prototype.hasOwnProperty.call(builtins, ref)) return builtins[ref];
    if (def) return customToFormula(custom && Object.prototype.hasOwnProperty.call(custom, ref) ? custom[ref] : undefined);
    throw new FormulaError(`Unknown field {${ref}}`);
  };

  const out: Record<string, ComputedFieldValue> = {};
  for (const d of defs) if (d.type === 'formula' || d.type === 'rollup') out[d.key] = compute(d.key);
  return out;
}

/** Display text for a computed value ('#ERR' for failures). */
export function formatComputed(c: ComputedFieldValue | undefined, config?: { metric?: string }): string {
  if (!c) return '';
  if (c.error) return ERROR_TEXT;
  const v = c.value;
  if (v === null || v === '') return '';
  if (typeof v === 'number') {
    if (config?.metric === 'open_deal_value' || config?.metric === 'won_deal_value') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
    }
    return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  if (config?.metric === 'last_activity') {
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
  }
  return typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
}
