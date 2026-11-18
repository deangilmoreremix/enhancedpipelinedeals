import { supabase } from '../lib/core/supabaseClient';
import { assertRowsAffected } from '../utils/rlsError';
import { canUseRemote, getCurrentUserId, localId } from './dealRecordShared';
import {
  RecordTarget, TargetScope, fetchTargets, findLinkedItemIds, isMissingRelation, matchSource, primaryColumns,
  replaceTargets, uniqueTargets,
} from './recordTargetsService';
import { syncNoteMentions } from './mentionService';
import { pushToast } from '../store/dealRecordStore';

export interface DealNote {
  id: string;
  /** Primary deal (legacy notes.deal_id); null for notes created on a contact/company only. */
  dealId: string | null;
  title: string | null;
  /** Tiptap/ProseMirror JSON document. */
  body: unknown | null;
  bodyText: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Every record this note is linked to (note_targets). */
  targets: RecordTarget[];
  /** Why this note shows on the viewed deal: linked to the deal itself, or to its contact/company. */
  source?: RecordTarget | null;
}

export interface NoteInput {
  title?: string | null;
  body: unknown | null;
  bodyText: string;
  /** Defaults to the deal the note is created on. */
  targets?: RecordTarget[];
}

export type NoteUpdate = Partial<NoteInput>;

// In-memory fallback used in demo mode / when Supabase is not configured.
let localNotes: DealNote[] = [];
export const __resetLocalNotes = (): void => { localNotes = []; };

/** True when notes for this deal are kept in memory only (not persisted). */
export const isNotesLocalOnly = (dealId: string): boolean => !canUseRemote(dealId);

const fromRow = (r: Record<string, any>, targets: RecordTarget[] = []): DealNote => ({
  id: r.id,
  dealId: r.deal_id ?? null,
  title: r.title ?? null,
  body: r.body ?? null,
  bodyText: r.body_text ?? '',
  createdBy: r.created_by ?? null,
  createdAt: r.created_at ?? new Date().toISOString(),
  updatedAt: r.updated_at ?? r.created_at ?? new Date().toISOString(),
  targets,
});

const byNewest = (a: DealNote, b: DealNote) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

const toScope = (dealId: string, scope: { contactId?: string; companyId?: string }): TargetScope => ({
  deal: dealId, contact: scope.contactId, company: scope.companyId,
});

/** Notes linked to the deal, or to its contact / company (each labelled with its `source`). */
export async function listNotes(
  dealId: string,
  scope: { contactId?: string; companyId?: string } = {},
): Promise<DealNote[]> {
  const ts = toScope(dealId, scope);
  if (!canUseRemote(dealId)) {
    return localNotes
      .map(n => ({ ...n, source: matchSource(n.targets, ts) }))
      .filter(n => n.source)
      .sort(byNewest);
  }
  const linked = await findLinkedItemIds('note', ts);
  const filters = [`deal_id.eq.${dealId}`];
  if (scope.contactId) filters.push(`contact_id.eq.${scope.contactId}`);
  if (linked.size) filters.push(`id.in.(${[...linked.keys()].join(',')})`);
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .or(filters.join(','))
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Array<Record<string, any>>;
  const all = await fetchTargets('note', rows.map(r => r.id)).catch(e => {
    if (isMissingRelation(e)) return {} as Record<string, RecordTarget[]>;
    throw e;
  });
  return rows.map(r => {
    const base = all[r.id] ?? [
      ...(r.deal_id ? [{ type: 'deal' as const, id: r.deal_id as string }] : []),
      ...(r.contact_id ? [{ type: 'contact' as const, id: r.contact_id as string }] : []),
    ];
    const n = fromRow(r, base);
    return { ...n, source: matchSource(base, ts) };
  });
}

async function saveMentions(note: DealNote, body: unknown): Promise<void> {
  try {
    await syncNoteMentions({
      noteId: note.id,
      dealId: note.dealId,
      body,
      excerpt: note.bodyText,
      remote: !!note.dealId && canUseRemote(note.dealId),
    });
  } catch (e) {
    // The note itself is saved; tell the user the mention step failed instead of failing silently.
    pushToast('error', `Note saved, but mentions could not be saved: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
}

export async function createNote(dealId: string, input: NoteInput): Promise<DealNote> {
  const now = new Date().toISOString();
  const targets = uniqueTargets(input.targets?.length ? input.targets : [{ type: 'deal', id: dealId }]);
  if (!canUseRemote(dealId)) {
    const note: DealNote = {
      id: localId('note'), dealId: targets.find(t => t.type === 'deal')?.id ?? null,
      title: input.title ?? null, body: input.body, bodyText: input.bodyText, createdBy: null,
      createdAt: now, updatedAt: now, targets,
    };
    localNotes = [note, ...localNotes];
    await saveMentions(note, input.body);
    return note;
  }
  const cols = primaryColumns(targets);
  const { data, error } = await supabase
    .from('notes')
    .insert({
      deal_id: cols.deal_id,
      contact_id: cols.contact_id,
      title: input.title ?? null,
      body: input.body,
      body_text: input.bodyText,
      created_by: await getCurrentUserId(),
    })
    .select()
    .single();
  if (error) throw error;
  let stored = targets;
  try {
    stored = await replaceTargets('note', data.id, targets, []);
  } catch (e) {
    if (!isMissingRelation(e)) throw e; // note_targets not deployed yet: legacy columns still link it
  }
  const note = fromRow(data, stored);
  await saveMentions(note, input.body);
  return note;
}

export async function updateNote(dealId: string, id: string, input: NoteUpdate): Promise<DealNote> {
  const now = new Date().toISOString();
  if (!canUseRemote(dealId)) {
    const existing = localNotes.find(n => n.id === id);
    if (!existing) throw new Error('Note not found');
    const targets = input.targets ? uniqueTargets(input.targets) : existing.targets;
    const updated: DealNote = {
      ...existing,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.bodyText !== undefined ? { bodyText: input.bodyText } : {}),
      targets,
      dealId: input.targets ? targets.find(t => t.type === 'deal')?.id ?? null : existing.dealId,
      updatedAt: now,
    };
    localNotes = localNotes.map(n => (n.id === id ? updated : n));
    if (input.body !== undefined) await saveMentions(updated, input.body);
    return updated;
  }
  const patch: Record<string, unknown> = { updated_at: now };
  if (input.title !== undefined) patch.title = input.title;
  if (input.body !== undefined) patch.body = input.body;
  if (input.bodyText !== undefined) patch.body_text = input.bodyText;
  if (input.targets) Object.assign(patch, primaryColumns(uniqueTargets(input.targets)));
  const { data, error } = await supabase.from('notes').update(patch).eq('id', id).select();
  if (error) throw error;
  assertRowsAffected(data); // RLS filters silently (0 rows)
  let targets: RecordTarget[] = [];
  if (input.targets) {
    targets = await replaceTargets('note', id, input.targets);
  } else {
    targets = (await fetchTargets('note', [id]).catch(() => ({} as Record<string, RecordTarget[]>)))[id] ?? [];
  }
  const note = fromRow(data[0], targets);
  if (input.body !== undefined) await saveMentions(note, input.body);
  return note;
}

/** Replace the records a note is linked to. */
export async function setNoteTargets(dealId: string, id: string, targets: RecordTarget[]): Promise<DealNote> {
  if (targets.length === 0) throw new Error('A note must stay linked to at least one record');
  return updateNote(dealId, id, { targets });
}

/** Soft delete (sets deleted_at). */
export async function deleteNote(dealId: string, id: string): Promise<void> {
  if (!canUseRemote(dealId)) {
    localNotes = localNotes.filter(n => n.id !== id);
    return;
  }
  const { data, error } = await supabase.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data); // RLS filters silently (0 rows)
}

export const DealNotesService = { listNotes, createNote, updateNote, setNoteTargets, deleteNote, isNotesLocalOnly };
