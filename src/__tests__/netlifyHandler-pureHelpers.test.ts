/** @jest-environment node */
import { BadRequest, reviveDates } from '../../netlify/functions/_dates';
import { storageFolder } from '../../netlify/functions/_storagePath';
import { describeContact } from '../../netlify/functions/_prompts';

describe('reviveDates (calendar-api: JSON strings -> Date before services call .toISOString())', () => {
  it('turns ISO strings into Dates and leaves other fields alone', () => {
    const out = reviveDates({ title: 'x', startTime: '2027-03-01T15:00:00.000Z', endTime: '2027-03-01T16:00:00.000Z' }, ['startTime', 'endTime']);
    expect(out.startTime).toBeInstanceOf(Date);
    expect(out.startTime.toISOString()).toBe('2027-03-01T15:00:00.000Z');
    expect(out.title).toBe('x');
  });

  it('skips undefined/null keys and keeps existing Dates', () => {
    const d = new Date('2027-01-01T00:00:00Z');
    const out = reviveDates({ a: undefined, b: null, c: d } as any, ['a', 'b', 'c']);
    expect(out.a).toBeUndefined();
    expect(out.b).toBeNull();
    expect(out.c).toBe(d);
  });

  it('throws BadRequest (HTTP 400) for an unparsable date instead of a later TypeError', () => {
    expect(() => reviveDates({ startTime: 'garbage' }, ['startTime'])).toThrow(BadRequest);
    expect(() => reviveDates({ startTime: 'garbage' }, ['startTime'])).toThrow('startTime is not a valid date');
  });

  it('does not mutate its input', () => {
    const input = { startTime: '2027-03-01T15:00:00.000Z' };
    reviveDates(input, ['startTime']);
    expect(typeof input.startTime).toBe('string');
  });
});

describe('storageFolder (ai-image: returned path must equal the stored path)', () => {
  it('sanitises per segment and drops empty segments (no "//")', () => {
    expect(storageFolder('deal', 'd 1/../x')).toBe('deal/d1x');
    expect(storageFolder('deal', '../..')).toBe('deal');
  });
  it('falls back to misc', () => {
    expect(storageFolder(undefined, null)).toBe('misc');
    expect(storageFolder('', '///')).toBe('misc');
  });
  it('keeps normal ids', () => {
    expect(storageFolder('contact', '3f2b-aa_01')).toBe('contact/3f2b-aa_01');
  });
});

describe('describeContact (composeEmail prompt)', () => {
  it('never leaks "undefined"', () => {
    for (const c of [null, undefined, {}, { name: 'Ada' }, { company: 'X' }, { name: null, company: null }]) {
      expect(describeContact(c as any)).not.toMatch(/undefined|null/);
    }
  });
  it('formats name and company', () => {
    expect(describeContact({ name: 'Ada', company: 'Engines' })).toBe('Contact: Ada at Engines');
    expect(describeContact({ name: 'Ada' })).toBe('Contact: Ada');
  });
  it('tells the model not to invent details when the contact is unknown', () => {
    expect(describeContact(null)).toMatch(/do not invent/);
  });
});
