import { supabase } from '../lib/core/supabaseClient';
import { assertRowsAffected } from '../utils/rlsError';
import { canUseRemote, getCurrentUserId, localId } from './dealRecordShared';

export interface DealNote {
  id: string;
  dealId: string;
  title: string | null;
  /** Tiptap/ProseMirror JSON document. */
  body: unknown | null;
  bodyText: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title?: string | null;
  body: unknown | null;
  bodyText: string;
}

// In-memory fallback used in demo mode / when Supabase is not configured.
const localNotes = new Map<string, DealNote[]>();

/** True when notes for this deal are kept in memory only (not persisted). */
export const isNotesLocalOnly = (dealId: string): boolean => !canUseRemote(dealId);

const fromRow = (r: Record<string, any>): DealNote => ({
  id: r.id,
  dealId: r.deal_id,
  title: r.title ?? null,
  body: r.body ?? null,
  bodyText: r.body_text ?? '',
  createdBy: r.created_by ?? null,
  createdAt: r.created_at ?? new Date().toISOString(),
  updatedAt: r.updated_at ?? r.created_at ?? new Date().toISOString(),
});

const byNewest = (a: DealNote, b: DealNote) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

export async function listNotes(dealId: string): Promise<DealNote[]> {
  if (!canUseRemote(dealId)) return [...(localNotes.get(dealId) ?? [])].sort(byNewest);
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('deal_id', dealId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function createNote(dealId: string, input: NoteInput): Promise<DealNote> {
  const now = new Date().toISOString();
  if (!canUseRemote(dealId)) {
    const note: DealNote = {
      id: localId('note'), dealId, title: input.title ?? null, body: input.body,
      bodyText: input.bodyText, createdBy: null, createdAt: now, updatedAt: now,
    };
    localNotes.set(dealId, [note, ...(localNotes.get(dealId) ?? [])]);
    return note;
  }
  const { data, error } = await supabase
    .from('notes')
    .insert({
      deal_id: dealId,
      title: input.title ?? null,
      body: input.body,
      body_text: input.bodyText,
      created_by: await getCurrentUserId(),
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateNote(dealId: string, id: string, input: Partial<NoteInput>): Promise<DealNote> {
  const now = new Date().toISOString();
  if (!canUseRemote(dealId)) {
    const list = localNotes.get(dealId) ?? [];
    const existing = list.find(n => n.id === id);
    if (!existing) throw new Error('Note not found');
    const updated: DealNote = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.bodyText !== undefined ? { bodyText: input.bodyText } : {}),
      updatedAt: now,
    };
    localNotes.set(dealId, list.map(n => (n.id === id ? updated : n)));
    return updated;
  }
  const patch: Record<string, unknown> = { updated_at: now };
  if (input.title !== undefined) patch.title = input.title;
  if (input.body !== undefined) patch.body = input.body;
  if (input.bodyText !== undefined) patch.body_text = input.bodyText;
  const { data, error } = await supabase.from('notes').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}

/** Soft delete (sets deleted_at). */
export async function deleteNote(dealId: string, id: string): Promise<void> {
  if (!canUseRemote(dealId)) {
    localNotes.set(dealId, (localNotes.get(dealId) ?? []).filter(n => n.id !== id));
    return;
  }
  const { data, error } = await supabase.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) throw error;
  if (Array.isArray(data)) assertRowsAffected(data); // RLS filters silently (0 rows)
}

export const DealNotesService = { listNotes, createNote, updateNote, deleteNote, isNotesLocalOnly };
