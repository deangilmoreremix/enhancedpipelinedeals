import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type Call = [string, ...unknown[]];
let mockCalls: Call[] = [];
let mockResult: { data: unknown; error: unknown } = { data: [], error: null };

const mockBuilder = (): any => {
  const b: any = {};
  ['select', 'insert', 'update', 'eq', 'is', 'order', 'single'].forEach(m => {
    b[m] = (...args: unknown[]) => { mockCalls.push([m, ...args]); return b; };
  });
  b.then = (res: any, rej: any) => Promise.resolve(mockResult).then(res, rej);
  return b;
};

jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t: string) => { mockCalls.push(['from', t]); return mockBuilder(); },
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
  },
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));

import { createNote, deleteNote, listNotes, updateNote, isNotesLocalOnly } from '../services/dealNotesService';

const DEAL = '11111111-1111-4111-8111-111111111111';
const row = (over: Record<string, unknown> = {}) => ({
  id: 'n1', deal_id: DEAL, title: null, body: { type: 'doc' }, body_text: 'hello',
  created_by: 'user-1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...over,
});
const has = (...c: Call) => mockCalls.some(x => x.length === c.length && x.every((v, i) => JSON.stringify(v) === JSON.stringify(c[i])));

describe('dealNotesService (supabase)', () => {
  beforeEach(() => { mockCalls = []; mockResult = { data: [], error: null }; });

  it('lists non-deleted notes for the deal, newest first', async () => {
    mockResult = { data: [row()], error: null };
    const notes = await listNotes(DEAL);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ id: 'n1', dealId: DEAL, bodyText: 'hello' });
    expect(has('from', 'notes')).toBe(true);
    expect(has('eq', 'deal_id', DEAL)).toBe(true);
    expect(has('is', 'deleted_at', null)).toBe(true);
    expect(has('order', 'created_at', { ascending: false })).toBe(true);
  });

  it('creates a note with jsonb body, body_text and the current user', async () => {
    mockResult = { data: row({ body_text: 'new' }), error: null };
    const n = await createNote(DEAL, { body: { type: 'doc', content: [] }, bodyText: 'new' });
    expect(n.bodyText).toBe('new');
    const insert = mockCalls.find(c => c[0] === 'insert')![1] as Record<string, unknown>;
    expect(insert).toMatchObject({ deal_id: DEAL, body_text: 'new', created_by: 'user-1', body: { type: 'doc', content: [] } });
  });

  it('updates body + body_text and bumps updated_at', async () => {
    mockResult = { data: row({ body_text: 'edited' }), error: null };
    await updateNote(DEAL, 'n1', { body: { type: 'doc' }, bodyText: 'edited' });
    const patch = mockCalls.find(c => c[0] === 'update')![1] as Record<string, unknown>;
    expect(patch).toMatchObject({ body_text: 'edited' });
    expect(typeof patch.updated_at).toBe('string');
    expect(has('eq', 'id', 'n1')).toBe(true);
  });

  it('soft deletes by setting deleted_at (no hard delete)', async () => {
    await deleteNote(DEAL, 'n1');
    const patch = mockCalls.find(c => c[0] === 'update')![1] as Record<string, unknown>;
    expect(typeof patch.deleted_at).toBe('string');
    expect(mockCalls.some(c => c[0] === 'delete')).toBe(false);
  });

  it('propagates supabase errors', async () => {
    mockResult = { data: null, error: new Error('rls denied') };
    await expect(listNotes(DEAL)).rejects.toThrow('rls denied');
  });
});

describe('dealNotesService (local fallback)', () => {
  beforeEach(() => { mockCalls = []; });

  it('keeps notes in memory for non-uuid (local/demo) deals and never calls supabase', async () => {
    const id = 'deal-local-1';
    expect(isNotesLocalOnly(id)).toBe(true);
    const a = await createNote(id, { body: null, bodyText: 'first' });
    const b = await createNote(id, { body: null, bodyText: 'second' });
    expect((await listNotes(id)).map(n => n.id)).toEqual([b.id, a.id].sort((x, y) => (x === b.id ? -1 : 1)));
    await updateNote(id, a.id, { bodyText: 'first edited' });
    expect((await listNotes(id)).find(n => n.id === a.id)?.bodyText).toBe('first edited');
    await deleteNote(id, a.id);
    expect((await listNotes(id)).map(n => n.id)).toEqual([b.id]);
    expect(mockCalls).toHaveLength(0);
  });
});
