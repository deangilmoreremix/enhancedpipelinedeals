import type { PipelineStage } from '../types';
import {
  NEW_STAGE,
  autoMapHeaders,
  buildErrorCsv,
  buildTemplateCsv,
  matchStage,
  normalizeRow,
  parseDateValue,
  parseMoney,
  parsePriority,
  parseProbability,
  saveMappingPreference
} from '../components/import/dealImportMapping';
import { parseCsv } from '../utils/csv';

const stage = (key: string, name: string, position: number, probability = 0): PipelineStage => ({
  id: key, key, name, color: 'blue', position, visible: true, probability, isWon: false, isLost: false, wipLimit: null
});
const STAGES = [stage('lead', 'Lead', 0, 10), stage('qualified', 'Qualified Lead', 1, 30), stage('closed-won', 'Closed Won', 2, 100)];

describe('autoMapHeaders', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (global as any).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; }
    };
  });

  it('maps common header spellings to deal fields', () => {
    const m = autoMapHeaders(['Deal Name', 'Account', 'Contact Name', 'Amount ($)', 'Deal Stage', 'Win Probability', 'Priority', 'Expected Close Date', 'Comments', 'Tags', 'Internal ID']);
    expect(m).toEqual(['title', 'company', 'contact', 'value', 'stage', 'probability', 'priority', 'dueDate', 'notes', 'tags', '']);
  });

  it('uses each field only once', () => {
    const m = autoMapHeaders(['Name', 'Title']);
    expect(m.filter(f => f === 'title')).toHaveLength(1);
  });

  it('prefers a saved mapping over guesses', () => {
    saveMappingPreference(['Weird Col', 'Name'], ['title', '']);
    const m = autoMapHeaders(['Weird Col', 'Name']);
    expect(m).toEqual(['title', '']);
  });
});

describe('value parsers', () => {
  it('parses money formats', () => {
    expect(parseMoney('$1,200.50')).toBe(1200.5);
    expect(parseMoney('1.5k')).toBe(1500);
    expect(parseMoney('2M')).toBe(2_000_000);
    expect(parseMoney('(300)')).toBe(-300);
    expect(parseMoney('1.234,56')).toBe(1234.56);
    expect(parseMoney('')).toBe(0);
    expect(parseMoney('abc')).toBeNaN();
  });

  it('parses probability', () => {
    expect(parseProbability('75%')).toBe(75);
    expect(parseProbability('0.4')).toBe(40);
    expect(parseProbability('')).toBeUndefined();
    expect(parseProbability('x')).toBeNaN();
  });

  it('parses dates', () => {
    expect(parseDateValue('2026-03-05')?.getMonth()).toBe(2);
    expect(parseDateValue('3/5/2026')?.getDate()).toBe(5);
    expect(parseDateValue('31.12.2026')?.getMonth()).toBe(11);
    expect(parseDateValue('2026-02-31')).toBeNull();
    expect(parseDateValue('not a date')).toBeNull();
    expect(parseDateValue('')).toBeUndefined();
  });

  it('parses priority', () => {
    expect(parsePriority('HIGH')).toBe('high');
    expect(parsePriority('med')).toBe('medium');
    expect(parsePriority('whatever')).toBeNull();
  });

  it('matches stages by key or name ignoring case and punctuation', () => {
    expect(matchStage('qualified lead', STAGES)).toBe('qualified');
    expect(matchStage('CLOSED-WON', STAGES)).toBe('closed-won');
    expect(matchStage('closed won', STAGES)).toBe('closed-won');
    expect(matchStage('Negotiation', STAGES)).toBeNull();
  });
});

describe('normalizeRow', () => {
  const mapping = ['title', 'company', 'value', 'stage', 'dueDate', 'probability'] as const;
  const ctx = { stages: STAGES, stageResolution: {}, defaultStage: 'lead' };

  it('builds a deal from a valid row', () => {
    const r = normalizeRow(['Big deal', 'Acme', '$5,000', 'Qualified Lead', '2026-05-01', '55'], 1, [...mapping], ctx);
    expect(r.errors).toEqual([]);
    expect(r.deal).toMatchObject({ title: 'Big deal', company: 'Acme', value: 5000, stage: 'qualified', probability: 55, priority: 'medium' });
    expect(r.deal?.dueDate).toBeInstanceOf(Date);
  });

  it('falls back to the stage probability and default stage', () => {
    const r = normalizeRow(['T', '', '', '', '', ''], 1, [...mapping], ctx);
    expect(r.deal).toMatchObject({ stage: 'lead', probability: 10, value: 0 });
  });

  it('reports a missing title, bad number and bad date', () => {
    expect(normalizeRow(['', 'Acme', '1', '', '', ''], 2, [...mapping], ctx).errors).toEqual(['Missing title']);
    const bad = normalizeRow(['T', '', 'twelve', '', 'someday', '150'], 3, [...mapping], ctx);
    expect(bad.deal).toBeUndefined();
    expect(bad.errors).toHaveLength(3);
    expect(bad.errors[0]).toMatch(/Invalid number/);
    expect(bad.errors[1]).toMatch(/Invalid probability/);
    expect(bad.errors[2]).toMatch(/Invalid date/);
  });

  it('flags unknown stages and honours the chosen resolution', () => {
    const unresolved = normalizeRow(['T', '', '', 'Negotiation', '', ''], 1, [...mapping], ctx);
    expect(unresolved.unknownStage).toBe('Negotiation');
    expect(unresolved.deal?.stage).toBe(`${NEW_STAGE}:negotiation`);
    const mapped = normalizeRow(['T', '', '', 'Negotiation', '', ''], 1, [...mapping], { ...ctx, stageResolution: { negotiation: 'qualified' } });
    expect(mapped.deal?.stage).toBe('qualified');
  });
});

describe('templates', () => {
  it('builds a template CSV that maps cleanly back to fields', () => {
    const [headers, ...rows] = parseCsv(buildTemplateCsv(STAGES));
    expect(autoMapHeaders(headers, false)).toEqual(['title', 'company', 'contact', 'value', 'stage', 'probability', 'priority', 'dueDate', 'notes', 'tags']);
    expect(rows).toHaveLength(2);
  });

  it('builds an error CSV with an error column', () => {
    const csv = buildErrorCsv(['title', 'value'], [{ raw: ['A', 'x'], error: 'Invalid number' }]);
    expect(parseCsv(csv)).toEqual([['title', 'value', 'error'], ['A', 'x', 'Invalid number']]);
  });
});
