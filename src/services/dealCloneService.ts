import { supabase } from '../lib/core/supabaseClient';
import type { Deal } from '../types';
import { listNotes, createNote } from './dealNotesService';
import { listTasks, createTask } from './dealTasksService';

export const cloneTitle = (title: string | undefined | null): string => `${(title ?? '').trim() || 'Untitled deal'} (copy)`;

/** `clone_deal(p_id, p_include_related)`: returns the new deal id. */
export async function cloneDealRemote(id: string, includeRelated = false): Promise<string> {
  const { data, error } = await supabase.rpc('clone_deal', { p_id: id, p_include_related: includeRelated });
  if (error) throw error;
  const newId = Array.isArray(data) ? data[0] : data;
  if (!newId || typeof newId !== 'string') throw new Error('Clone failed: no deal was created');
  return newId;
}

/** Fields of `deal` that carry over to a copy (no id/timestamps/ownership/favorite/deletion state). */
export function buildCloneDraft(deal: Deal): Omit<Deal, 'id' | 'createdAt' | 'updatedAt'> {
  const { id: _id, createdAt: _c, updatedAt: _u, createdBy: _cb, workspaceId: _w, isFavorite: _f, deletedAt: _d, timeline: _t, ...rest } = deal;
  return { ...rest, title: cloneTitle(deal.title), customFields: deal.customFields ? { ...deal.customFields } : undefined };
}

/** Demo/local copy of notes and tasks (in-memory services). Open tasks only keep their data, status resets to open. */
export async function copyRelatedLocal(fromId: string, toId: string): Promise<{ notes: number; tasks: number }> {
  const [notes, tasks] = await Promise.all([listNotes(fromId), listTasks(fromId)]);
  for (const n of [...notes].reverse()) await createNote(toId, { title: n.title, body: n.body, bodyText: n.bodyText });
  for (const t of [...tasks].reverse()) await createTask(toId, { title: t.title, dueDate: t.dueDate, notes: t.notes });
  return { notes: notes.length, tasks: tasks.length };
}

export const DealCloneService = { cloneDealRemote, buildCloneDraft, copyRelatedLocal, cloneTitle };
