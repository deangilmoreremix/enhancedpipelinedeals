import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { chain } from '../test-utils/chain';

let mockResults: Record<string, { data?: any; error?: any }> = {};
let mockCalls: Array<{ table: string; c: any }> = [];
const mockSigned = jest.fn<(...a: any[]) => Promise<any>>();
const mockFrom = (t: string) => { const c = chain(mockResults[t] ?? { data: [], error: null }); mockCalls.push({ table: t, c }); return c; };

jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t: string) => mockFrom(t),
    storage: { from: () => ({ createSignedUrl: (...a: any[]) => mockSigned(...a), getPublicUrl: () => ({ data: { publicUrl: 'https://pub/x' } }), remove: async () => ({ error: null }) }) },
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
  },
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));

import { DealFile, fetchTextPreview, getFileUrl, previewKind, renameFile, uploadFile, listFiles } from '../services/dealFilesService';

const DEAL = '11111111-1111-4111-8111-111111111111';
const file = (over: Partial<DealFile> = {}): DealFile => ({
  id: 'f1', dealId: DEAL, name: 'a.pdf', path: `${DEAL}/1-a.pdf`, size: 10, mimeType: 'application/pdf', uploadedBy: 'user-1', createdAt: '2026-01-01T00:00:00Z', ...over,
});
const ops = (table: string) => mockCalls.filter(x => x.table === table).flatMap(x => x.c.calls as Array<[string, any[]]>);

beforeEach(() => { mockResults = {}; mockCalls = []; mockSigned.mockReset(); (globalThis as any).fetch = undefined; });

describe('previewKind', () => {
  it('classifies images, pdf, text/csv and others', () => {
    expect(previewKind({ name: 'x.png', mimeType: 'image/png' })).toBe('image');
    expect(previewKind({ name: 'x.pdf', mimeType: null })).toBe('pdf');
    expect(previewKind({ name: 'x.csv', mimeType: 'text/csv' })).toBe('text');
    expect(previewKind({ name: 'notes.md', mimeType: null })).toBe('text');
    expect(previewKind({ name: 'x.zip', mimeType: 'application/zip' })).toBeNull();
  });
});

describe('dealFilesService', () => {
  it('uses a signed URL, with a download name when asked', async () => {
    mockSigned.mockResolvedValue({ data: { signedUrl: 'https://signed/a' } });
    expect(await getFileUrl(file())).toBe('https://signed/a');
    expect(mockSigned).toHaveBeenLastCalledWith(file().path, 3600, undefined);
    await getFileUrl(file(), { download: true });
    expect(mockSigned).toHaveBeenLastCalledWith(file().path, 3600, { download: 'a.pdf' });
  });

  it('falls back to the public URL when signing fails', async () => {
    mockSigned.mockRejectedValue(new Error('nope'));
    expect(await getFileUrl(file())).toBe('https://pub/x');
  });

  it('renames only the row (storage path untouched)', async () => {
    mockResults.deal_files = { data: [{ id: 'f1', deal_id: DEAL, name: 'b.pdf', path: file().path, size: 10, mime_type: 'application/pdf' }], error: null };
    const out = await renameFile(file(), '  b.pdf ');
    expect(out).toMatchObject({ name: 'b.pdf', path: file().path });
    expect(ops('deal_files').find(([o]) => o === 'update')![1][0]).toEqual({ name: 'b.pdf' });
  });

  it('rejects empty names and RLS-filtered renames', async () => {
    await expect(renameFile(file(), '   ')).rejects.toThrow('empty');
    mockResults.deal_files = { data: [], error: null };
    await expect(renameFile(file(), 'c.pdf')).rejects.toMatchObject({ code: '42501' });
  });

  it('renames local files in memory', async () => {
    (URL as any).createObjectURL = () => 'blob:x';
    const local = await uploadFile('deal-local', new File(['hi'], 'l.txt', { type: 'text/plain' }));
    const renamed = await renameFile(local, 'm.txt');
    expect(renamed.name).toBe('m.txt');
    expect((await listFiles('deal-local'))[0].name).toBe('m.txt');
  });

  it('fetches only the first lines of a text file', async () => {
    mockSigned.mockResolvedValue({ data: { signedUrl: 'https://signed/t' } });
    (globalThis as any).fetch = jest.fn(async () => ({ ok: true, status: 206, text: async () => Array.from({ length: 100 }, (_, i) => `row${i}`).join('\n') }));
    const r = await fetchTextPreview(file({ name: 't.csv', mimeType: 'text/csv' }), 5);
    expect(r.text.split('\n')).toHaveLength(5);
    expect(r.truncated).toBe(true);
    expect((globalThis as any).fetch).toHaveBeenCalledWith('https://signed/t', { headers: { Range: 'bytes=0-65535' } });
  });
});
