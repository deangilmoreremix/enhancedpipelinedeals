import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { chain } from '../test-utils/chain';

type Res = { data?: any; error?: any };
let mockResults: Record<string, Res> = {};
let mockCalls: Array<{ table: string; c: any }> = [];
const mockFrom = (t: string) => { const c = chain(mockResults[t] ?? { data: [], error: null }); mockCalls.push({ table: t, c }); return c; };

jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t: string) => mockFrom(t),
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
  },
}));
jest.mock('../services/supabaseService', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) } },
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));

import { createNote, deleteNote, listNotes, updateNote, setNoteTargets, isNotesLocalOnly, __resetLocalNotes } from '../services/dealNotesService';
import { __resetLocalMentions } from '../services/mentionService';
import { __resetLocalNotifications, listNotifications } from '../services/notificationService';
import { useDealRecordStore } from '../store/dealRecordStore';

const DEAL = '11111111-1111-4111-8111-111111111111';
const CONTACT = '22222222-2222-4222-8222-222222222222';
const USER2 = '33333333-3333-4333-8333-333333333333';
const row = (over: Record<string, unknown> = {}) => ({
  id: 'n1', deal_id: DEAL, contact_id: null, title: null, body: { type: 'doc' }, body_text: 'hello',
  created_by: 'user-1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...over,
});
const callsOn = (table: string) => mockCalls.filter(x => x.table === table);
const ops = (table: string) => callsOn(table).flatMap(x => x.c.calls as Array<[string, unknown[]]>);
const hasOp = (table: string, op: string) => ops(table).some(([o]) => o === op);

beforeEach(() => {
  mockResults = {}; mockCalls = [];
  __resetLocalNotes(); __resetLocalMentions(); __resetLocalNotifications();
  useDealRecordStore.setState({ toasts: [] });
});

describe('dealNotesService (supabase)', () => {
  it('lists notes linked to the deal or its contact, labelling the source', async () => {
    mockResults.note_targets = { data: [{ note_id: 'n2', target_type: 'contact', target_id: CONTACT }], error: null };
    mockResults.notes = { data: [row(), row({ id: 'n2', deal_id: null, contact_id: CONTACT })], error: null };
    const notes = await listNotes(DEAL, { contactId: CONTACT });
    const or = ops('notes').find(([o]) => o === 'or')![1][0] as string;
    expect(or).toContain(`deal_id.eq.${DEAL}`);
    expect(or).toContain(`contact_id.eq.${CONTACT}`);
    expect(or).toContain('id.in.(n2)');
    expect(ops('notes').some(([o, a]) => o === 'is' && a[0] === 'deleted_at')).toBe(true);
    expect(notes.find(n => n.id === 'n2')?.source).toEqual({ type: 'contact', id: CONTACT });
    expect(notes.find(n => n.id === 'n1')?.source).toEqual({ type: 'deal', id: DEAL });
  });

  it('keeps working before note_targets is deployed', async () => {
    mockResults.note_targets = { data: null, error: { code: '42P01', message: 'relation "note_targets" does not exist' } };
    mockResults.notes = { data: [row()], error: null };
    const notes = await listNotes(DEAL);
    expect(notes).toHaveLength(1);
    expect(notes[0].targets).toEqual([{ type: 'deal', id: DEAL }]);
  });

  it('creates a note with its default deal target and the current user', async () => {
    mockResults.notes = { data: row({ body_text: 'new' }), error: null };
    const n = await createNote(DEAL, { body: { type: 'doc', content: [] }, bodyText: 'new' });
    expect(n.targets).toEqual([{ type: 'deal', id: DEAL }]);
    const insert = ops('notes').find(([o]) => o === 'insert')![1][0] as Record<string, unknown>;
    expect(insert).toMatchObject({ deal_id: DEAL, body_text: 'new', created_by: 'user-1' });
    const tIns = ops('note_targets').find(([o]) => o === 'insert')![1][0] as any[];
    expect(tIns).toEqual([{ note_id: 'n1', target_type: 'deal', target_id: DEAL }]);
  });

  it('saves mentions found in the body to note_mentions', async () => {
    mockResults.notes = { data: row(), error: null };
    mockResults.note_mentions = { data: [], error: null };
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: USER2, label: 'Sam' } }] }] };
    await createNote(DEAL, { body, bodyText: '@Sam' });
    const up = ops('note_mentions').find(([o]) => o === 'upsert')![1][0] as any[];
    expect(up).toEqual([{ note_id: 'n1', mentioned_user_id: USER2, created_by: 'user-1' }]);
  });

  it('toasts (but still returns the note) when saving mentions fails', async () => {
    mockResults.notes = { data: row(), error: null };
    mockResults.note_mentions = { data: [], error: { message: 'boom' } };
    const body = { type: 'doc', content: [{ type: 'mention', attrs: { id: USER2, label: 'Sam' } }] };
    const n = await createNote(DEAL, { body, bodyText: '@Sam' });
    expect(n.id).toBe('n1');
    expect(useDealRecordStore.getState().toasts[0].message).toMatch(/mentions could not be saved/);
  });

  it('updates body and bumps updated_at', async () => {
    mockResults.notes = { data: [row({ body_text: 'edited' })], error: null };
    const n = await updateNote(DEAL, 'n1', { bodyText: 'edited' });
    expect(n.bodyText).toBe('edited');
    const patch = ops('notes').find(([o]) => o === 'update')![1][0] as Record<string, unknown>;
    expect(patch).toMatchObject({ body_text: 'edited' });
    expect(typeof patch.updated_at).toBe('string');
  });

  it('treats an update that matched zero rows as a permission denial', async () => {
    mockResults.notes = { data: [], error: null };
    await expect(updateNote(DEAL, 'n1', { bodyText: 'x' })).rejects.toMatchObject({ code: '42501' });
  });

  it('replaces note targets: inserts added, deletes removed, syncs legacy columns', async () => {
    mockResults.notes = { data: [row()], error: null };
    mockResults.note_targets = { data: [{ note_id: 'n1', target_type: 'deal', target_id: DEAL }], error: null };
    await setNoteTargets(DEAL, 'n1', [{ type: 'contact', id: CONTACT }]);
    const patch = ops('notes').find(([o]) => o === 'update')![1][0] as any;
    expect(patch).toMatchObject({ deal_id: null, contact_id: CONTACT });
    expect(ops('note_targets').find(([o]) => o === 'insert')![1][0]).toEqual([{ note_id: 'n1', target_type: 'contact', target_id: CONTACT }]);
    expect(hasOp('note_targets', 'delete')).toBe(true);
  });

  it('refuses to unlink a note from every record', async () => {
    await expect(setNoteTargets(DEAL, 'n1', [])).rejects.toThrow(/at least one/);
  });

  it('soft deletes by setting deleted_at (no hard delete)', async () => {
    mockResults.notes = { data: [{ id: 'n1' }], error: null };
    await deleteNote(DEAL, 'n1');
    const patch = ops('notes').find(([o]) => o === 'update')![1][0] as Record<string, unknown>;
    expect(typeof patch.deleted_at).toBe('string');
    expect(hasOp('notes', 'delete')).toBe(false);
  });

  it('treats a delete that matched zero rows (RLS) as a permission denial', async () => {
    mockResults.notes = { data: [], error: null };
    await expect(deleteNote(DEAL, 'n1')).rejects.toMatchObject({ code: '42501' });
  });

  it('propagates supabase errors', async () => {
    mockResults.notes = { data: null, error: new Error('rls denied') };
    await expect(listNotes(DEAL)).rejects.toThrow('rls denied');
  });
});

describe('dealNotesService (local fallback)', () => {
  it('keeps notes in memory for non-uuid deals and never calls supabase', async () => {
    const id = 'deal-local-1';
    expect(isNotesLocalOnly(id)).toBe(true);
    const a = await createNote(id, { body: null, bodyText: 'first' });
    const b = await createNote(id, { body: null, bodyText: 'second' });
    expect((await listNotes(id)).map(n => n.id).sort()).toEqual([a.id, b.id].sort());
    await updateNote(id, a.id, { bodyText: 'first edited' });
    expect((await listNotes(id)).find(n => n.id === a.id)?.bodyText).toBe('first edited');
    await deleteNote(id, a.id);
    expect((await listNotes(id)).map(n => n.id)).toEqual([b.id]);
    expect(mockCalls).toHaveLength(0);
  });

  it('shows a note linked to a contact on another deal of that contact, labelled by source', async () => {
    const n = await createNote('deal-a', { body: null, bodyText: 'shared', targets: [{ type: 'deal', id: 'deal-a' }, { type: 'contact', id: 'c-1' }] });
    expect(await listNotes('deal-b')).toHaveLength(0);
    const onB = await listNotes('deal-b', { contactId: 'c-1' });
    expect(onB.map(x => x.id)).toEqual([n.id]);
    expect(onB[0].source).toEqual({ type: 'contact', id: 'c-1' });
    await setNoteTargets('deal-a', n.id, [{ type: 'deal', id: 'deal-a' }]);
    expect(await listNotes('deal-b', { contactId: 'c-1' })).toHaveLength(0);
  });

  it('creates an in-memory notification per newly mentioned user, and not again on re-save', async () => {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'local-user-sam', label: 'Sam' } }] }] };
    const n = await createNote('deal-m', { body, bodyText: '@Sam hi' });
    let list = await listNotifications();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'mention', link: '/deals/deal-m', userId: 'local-user-sam' });
    await updateNote('deal-m', n.id, { body, bodyText: '@Sam hi again' });
    expect(await listNotifications()).toHaveLength(1);
    await updateNote('deal-m', n.id, { body: { type: 'doc', content: [] }, bodyText: '' });
    await updateNote('deal-m', n.id, { body, bodyText: '@Sam' });
    list = await listNotifications();
    expect(list).toHaveLength(2);
  });
});
