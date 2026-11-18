import {
  FormulaError, computeFieldValues, evaluateFormula, formulaRefs, formatComputed, parseFormula, builtinValues, MAX_FORMULA_LENGTH,
} from '../utils/formula';

const run = (src: string, vars: Record<string, any> = {}) =>
  evaluateFormula(src, k => { if (!(k in vars)) throw new FormulaError(`Unknown field {${k}}`); return vars[k]; });
const val = (src: string, vars?: Record<string, any>) => { const r = run(src, vars); if (!r.ok) throw new Error(r.error); return r.value; };

describe('formula evaluator', () => {
  it('does arithmetic with precedence, parentheses, unary minus and modulo', () => {
    expect(val('1 + 2 * 3')).toBe(7);
    expect(val('(1 + 2) * 3')).toBe(9);
    expect(val('10 / 4')).toBe(2.5);
    expect(val('10 % 4')).toBe(2);
    expect(val('-3 + 5')).toBe(2);
    expect(val('2 * -(1 + 1)')).toBe(-4);
    expect(val('.5 + 1.25')).toBe(1.75);
  });

  it('references built-in and custom fields via {key}', () => {
    expect(val('{value} * {probability} / 100', { value: 50000, probability: 20 })).toBe(10000);
    expect(val('{a} + {b}', { a: '4', b: 1 })).toBe(5); // numeric strings coerce
    expect(val('{missing_ok}', { missing_ok: null })).toBeNull();
    expect(formulaRefs('{value} * {discount} + {value}')).toEqual(['value', 'discount']);
  });

  it('treats empty values as 0 in arithmetic and joins text with +', () => {
    expect(val('{a} + 5', { a: null })).toBe(5);
    expect(val('"Hello " + {name}', { name: 'Ada' })).toBe('Hello Ada');
    expect(val('{n} + "x"', { n: 3 })).toBe('3x');
  });

  it('compares numbers and (case-insensitive) strings, and supports && || !', () => {
    expect(val('{a} > 3', { a: 5 })).toBe(true);
    expect(val('{a} >= 5 && {a} <= 5', { a: 5 })).toBe(true);
    expect(val('{s} = "gold"', { s: 'Gold' })).toBe(true);
    expect(val('{s} != "gold" || FALSE', { s: 'Gold' })).toBe(false);
    expect(val('!({a} == 1)', { a: 2 })).toBe(true);
    expect(val('{a} <> 2', { a: 3 })).toBe(true);
  });

  it('implements IF (lazily), ROUND, MIN, MAX, ABS, CONCAT, DAYS_BETWEEN', () => {
    expect(val('IF({v} > 100, "big", "small")', { v: 500 })).toBe('big');
    expect(val('IF(TRUE, 1, 1/0)')).toBe(1); // untaken branch is not evaluated
    expect(val('IF(FALSE, 1)')).toBeNull();
    expect(val('ROUND(2.567, 2)')).toBe(2.57);
    expect(val('ROUND(2.5)')).toBe(3);
    expect(val('MIN(4, 2, 9)')).toBe(2);
    expect(val('MAX(4, {x}, 9)', { x: 12 })).toBe(12);
    expect(val('ABS(-7.5)')).toBe(7.5);
    expect(val('CONCAT({a}, " - ", {b}, 1)', { a: 'x', b: null })).toBe('x - 1');
    expect(val('DAYS_BETWEEN("2026-01-01", "2026-01-31")')).toBe(30);
    expect(val('DAYS_BETWEEN({a}, {b})', { a: '2026-03-01T10:00:00.000Z', b: '2026-03-04T09:00:00.000Z' })).toBe(3);
    expect(val('round(1.4)')).toBe(1); // function names are case-insensitive
  });

  it('reports errors instead of throwing', () => {
    expect(run('1 / 0')).toEqual({ ok: false, error: 'Division by zero' });
    expect(run('5 % 0').ok).toBe(false);
    expect(run('"abc" * 2').ok).toBe(false);
    expect(run('{nope}', {}).ok).toBe(false);
    expect(run('1 +').ok).toBe(false);
    expect(run('').ok).toBe(false);
    expect(run('(1 + 2').ok).toBe(false);
    expect(run('FOO(1)')).toMatchObject({ ok: false, error: expect.stringContaining('Unknown function') });
    expect(run('ROUND(1, 99)').ok).toBe(false);
    expect(run('DAYS_BETWEEN("x", "y")').ok).toBe(false);
    expect(run('IF(1)').ok).toBe(false);
    expect(() => parseFormula('1 2')).toThrow(FormulaError);
  });

  describe('safety (malicious input)', () => {
    it('never evaluates JavaScript', () => {
      const g = globalThis as any;
      g.__pwned = false;
      const attacks = [
        'globalThis.__pwned = true',
        '(function(){ globalThis.__pwned = true })()',
        '__pwned = true',
        'constructor.constructor("globalThis.__pwned = true")()',
        '{constructor}', '{__proto__}', '{toString}',
        'this', 'process.exit(1)', 'eval("1")', 'Function("return 1")()', 'require("fs")', 'import("fs")',
        '`${globalThis.__pwned = true}`', '"; globalThis.__pwned = true; "', 'window', 'alert(1)',
        '1; globalThis.__pwned = true', '{value}.constructor', '[].constructor', '({}).constructor',
      ];
      for (const a of attacks) {
        const r = evaluateFormula(a, k => { if (k === 'value') return 1; throw new FormulaError(`Unknown field {${k}}`); });
        // either rejected or (for harmless literals) evaluated; but never executed
        expect(typeof r.ok).toBe('boolean');
      }
      expect(g.__pwned).toBe(false);
    });

    it('does not resolve prototype keys through the record context', () => {
      const out = computeFieldValues('deal', [
        { key: 'f1', type: 'formula', config: { formula: '{constructor}' } },
        { key: 'f2', type: 'formula', config: { formula: '{__proto__}' } },
        { key: 'f3', type: 'formula', config: { formula: '{toString}' } },
        { key: 'f4', type: 'formula', config: { formula: '{hasOwnProperty}' } },
      ], { value: 1 }, {});
      for (const k of ['f1', 'f2', 'f3', 'f4']) { expect(out[k].error).toMatch(/Unknown field/); }
      // a custom field literally named like a prototype member is just data
      const ok = computeFieldValues('deal', [
        { key: 'constructor', type: 'text' }, { key: 'f', type: 'formula', config: { formula: '{constructor}' } },
      ], {}, { constructor: 'safe' });
      expect(ok.f.value).toBe('safe');
    });

    it('rejects oversized and deeply nested input without blowing the stack', () => {
      expect(run('1+'.repeat(MAX_FORMULA_LENGTH) + '1').ok).toBe(false);
      const deep = '('.repeat(500) + '1' + ')'.repeat(500);
      expect(run(deep)).toMatchObject({ ok: false, error: expect.stringMatching(/deeply|complex|long/) });
      expect(run('-'.repeat(300) + '1').ok).toBe(false);
      expect(run('IF('.repeat(100) + '1' + ')'.repeat(100)).ok).toBe(false);
      expect(run('1,'.repeat(400)).ok).toBe(false);
    });

    it('rejects odd characters and unterminated strings', () => {
      for (const s of ['1 @ 2', '1 ? 2 : 3', '"abc', "'abc", '{a b}', '{1a}', '{a', '$x', '1 \\ 2', '[1]', '1 & 2', 'a.b']) {
        expect(run(s, { a: 1 }).ok).toBe(false);
      }
    });

    it('treats string contents as inert data', () => {
      expect(val('"{value}"', { value: 1 })).toBe('{value}');
      expect(val('"a" + "\'; DROP TABLE x; --"')).toBe("a'; DROP TABLE x; --");
      expect(val('"<script>alert(1)</script>"')).toBe('<script>alert(1)</script>');
    });

    it('rejects non-finite numbers and results', () => {
      expect(run('9'.repeat(400)).ok).toBe(false); // literal overflows to Infinity
      expect(run(`${'9'.repeat(150)} * ${'9'.repeat(150)} * ${'9'.repeat(150)}`).ok).toBe(false); // product overflows
    });
  });
});

describe('computeFieldValues', () => {
  const defs = [
    { key: 'tier', type: 'select' as const },
    { key: 'weighted', type: 'formula' as const, config: { formula: '{value} * {probability} / 100' } },
    { key: 'label', type: 'formula' as const, config: { formula: 'CONCAT({tier}, ": ", {weighted})' } },
    { key: 'open', type: 'rollup' as const, config: { metric: 'open_deal_count' as const } },
  ];

  it('computes formulas over built-ins, custom fields, other formulas and rollups', () => {
    const out = computeFieldValues('deal', defs, { value: 1000, probability: 25 }, { tier: 'Gold' }, { open: 3 });
    expect(out.weighted.value).toBe(250);
    expect(out.label.value).toBe('Gold: 250');
    expect(out.open.value).toBe(3);
    expect(computeFieldValues('deal', [...defs, { key: 'n', type: 'formula', config: { formula: '{open} * 2' } }], {}, {}, { open: 4 }).n.value).toBe(8);
  });

  it('detects cycles (direct, indirect and self) and reports them per field', () => {
    const out = computeFieldValues('deal', [
      { key: 'a', type: 'formula', config: { formula: '{b} + 1' } },
      { key: 'b', type: 'formula', config: { formula: '{c} + 1' } },
      { key: 'c', type: 'formula', config: { formula: '{a} + 1' } },
      { key: 's', type: 'formula', config: { formula: '{s}' } },
      { key: 'ok', type: 'formula', config: { formula: '1 + 1' } },
    ], {}, {});
    for (const k of ['a', 'b', 'c', 's']) expect(out[k].error).toMatch(/Circular reference/);
    expect(out.a.error).toContain('a -> b -> c -> a');
    expect(out.ok).toEqual({ value: 2 });
  });

  it('flags unknown references and propagates errors from referenced formulas', () => {
    const out = computeFieldValues('deal', [
      { key: 'bad', type: 'formula', config: { formula: '{nothing}' } },
      { key: 'uses', type: 'formula', config: { formula: '{bad} + 1' } },
    ], {}, {});
    expect(out.bad.error).toMatch(/Unknown field/);
    expect(out.uses.error).toMatch(/Unknown field/);
  });

  it('only exposes whitelisted built-ins per entity', () => {
    const d = builtinValues('deal', { value: 5, probability: 50, createdAt: new Date('2026-01-02T00:00:00Z'), password: 'x', tags: ['a', 'b'] });
    expect(d.value).toBe(5);
    expect(d.createdAt).toBe('2026-01-02T00:00:00.000Z');
    expect(d.tagCount).toBe(2);
    expect('password' in d).toBe(false);
    expect(builtinValues('contact', { name: 'Ada', value: 9 }).name).toBe('Ada');
    expect('value' in builtinValues('contact', { value: 9 })).toBe(false);
  });

  it('formats results (#ERR for failures, money for rollups)', () => {
    expect(formatComputed({ value: null, error: 'x' })).toBe('#ERR');
    expect(formatComputed({ value: 1234.5 })).toBe('1,234.5');
    expect(formatComputed({ value: 5000 }, { metric: 'open_deal_value' })).toBe('$5,000');
    expect(formatComputed({ value: true })).toBe('Yes');
    expect(formatComputed({ value: null })).toBe('');
  });
});
