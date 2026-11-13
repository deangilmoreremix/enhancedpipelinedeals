import { parseCsv, parseCsvTable, sniffDelimiter, toCsv } from '../utils/csv';

describe('parseCsv', () => {
  it('parses simple rows and ignores trailing newlines', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles quoted fields with delimiters, escaped quotes and embedded newlines', () => {
    const text = 'name,notes\n"Smith, John","He said ""hi""\nsecond line"\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'notes'],
      ['Smith, John', 'He said "hi"\nsecond line']
    ]);
  });

  it('supports CRLF and bare CR row endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
    expect(parseCsv('a,b\r1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('strips a UTF-8 BOM', () => {
    expect(parseCsv('﻿title,value\nA,1')[0][0]).toBe('title');
  });

  it('keeps empty fields and skips fully empty rows', () => {
    expect(parseCsv('a,,c\n\n,,\n1,2,')).toEqual([['a', '', 'c'], ['1', '2', '']]);
    expect(parseCsv('a,b\n\n1,2', { keepEmptyRows: true })).toEqual([['a', 'b'], [''], ['1', '2']]);
  });

  it('keeps an explicitly quoted empty string as a row field', () => {
    expect(parseCsv('a,b\n"",x')).toEqual([['a', 'b'], ['', 'x']]);
  });

  it('sniffs semicolon, tab and pipe delimiters', () => {
    expect(sniffDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(sniffDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(sniffDelimiter('a|b|c\n1|2|3')).toBe('|');
    expect(sniffDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(parseCsv('title;value\nA;1')).toEqual([['title', 'value'], ['A', '1']]);
  });

  it('does not mistake commas inside quotes for the delimiter', () => {
    expect(sniffDelimiter('"a,b";"c,d"\n"1,2";"3,4"')).toBe(';');
  });
});

describe('parseCsvTable', () => {
  it('uses the first row as headers and pads/truncates ragged rows', () => {
    const t = parseCsvTable('a,b,c\n1,2\n1,2,3,4\n');
    expect(t.headers).toEqual(['a', 'b', 'c']);
    expect(t.rows).toEqual([['1', '2', ''], ['1', '2', '3']]);
  });

  it('returns an empty table for empty input', () => {
    expect(parseCsvTable('')).toMatchObject({ headers: [], rows: [] });
  });
});

describe('toCsv', () => {
  it('quotes fields that need it and round-trips through parseCsv', () => {
    const rows = [['title', 'notes'], ['A, B', 'say "x"\nnext'], ['plain', '']];
    const text = toCsv(rows);
    expect(text).toContain('"A, B"');
    expect(parseCsv(text)).toEqual(rows);
  });

  it('neutralises spreadsheet formulas but not negative numbers', () => {
    const text = toCsv([['=SUM(A1:A2)', '-5', '@cmd', 7, new Date('2026-01-02T00:00:00Z')]]);
    expect(text).toBe("'=SUM(A1:A2),-5,'@cmd,7,2026-01-02T00:00:00.000Z");
  });
});
