import { supabase } from '../lib/core/supabaseClient';
import { assertRowsAffected } from '../utils/rlsError';
import { canUseRemote, getCurrentUserId, isUuid } from './dealRecordShared';
import { addLocalNotification } from './notificationService';
import { getCurrentDirectoryUser } from './userDirectoryService';

export interface MentionRef { id: string; label: string }

/** Every distinct @mention node in a Tiptap/ProseMirror JSON document. */
export function extractMentions(doc: unknown): MentionRef[] {
  const out = new Map<string, MentionRef>();
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'mention' && node.attrs?.id) {
      const id = String(node.attrs.id);
      if (!out.has(id)) out.set(id, { id, label: String(node.attrs.label ?? '') });
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return [...out.values()];
}

export function diffMentionIds(prev: string[], next: string[]): { added: string[]; removed: string[] } {
  const p = new Set(prev);
  const n = new Set(next);
  return { added: [...n].filter(id => !p.has(id)), removed: [...p].filter(id => !n.has(id)) };
}

// Demo mode: mentions per note, in memory.
const localMentions = new Map<string, Set<string>>();
export const __resetLocalMentions = (): void => localMentions.clear();

const remoteFor = (dealId: string | null): boolean => (dealId ? canUseRemote(dealId) : false);

export async function listMentionedUserIds(noteId: string, remote: boolean): Promise<string[]> {
  if (!remote) return [...(localMentions.get(noteId) ?? [])];
  const { data, error } = await supabase.from('note_mentions').select('mentioned_user_id').eq('note_id', noteId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.mentioned_user_id as string);
}

export interface SyncMentionsInput {
  noteId: string;
  /** Deal the note is viewed from; decides remote vs in-memory and the notification link. */
  dealId: string | null;
  body: unknown;
  /** Plain-text excerpt for the demo notification body. */
  excerpt?: string;
  /** Force in-memory/remote mode (defaults to the deal's mode). */
  remote?: boolean;
}

/**
 * Save the mentions of a note: diff against what is stored, insert the added, delete the removed.
 * Remote: note_mentions rows (a DB trigger creates the user_notifications). Demo: in-memory
 * mentions plus a local notification per newly mentioned user.
 */
export async function syncNoteMentions(input: SyncMentionsInput): Promise<{ added: string[]; removed: string[] }> {
  const remote = input.remote ?? remoteFor(input.dealId);
  const wanted = extractMentions(input.body);
  const labels = new Map(wanted.map(m => [m.id, m.label]));
  const nextIds = wanted.map(m => m.id).filter(id => !remote || isUuid(id));

  if (!remote) {
    const prev = [...(localMentions.get(input.noteId) ?? [])];
    const { added, removed } = diffMentionIds(prev, nextIds);
    localMentions.set(input.noteId, new Set(nextIds));
    if (added.length) {
      const me = await getCurrentDirectoryUser();
      const actor = me?.name ?? 'Someone';
      const excerpt = (input.excerpt ?? '').trim().slice(0, 140);
      for (const userId of added) {
        if (me && userId === me.id) continue; // no self-notification
        addLocalNotification({
          userId,
          type: 'mention',
          title: `${actor} mentioned ${labels.get(userId) ? `@${labels.get(userId)}` : 'you'} in a note`,
          body: excerpt || null,
          link: input.dealId ? `/deals/${input.dealId}` : null,
          data: { noteId: input.noteId, dealId: input.dealId, mentionedUserId: userId },
        });
      }
    }
    return { added, removed };
  }

  const prev = await listMentionedUserIds(input.noteId, true);
  const { added, removed } = diffMentionIds(prev, nextIds);
  if (added.length) {
    const createdBy = await getCurrentUserId();
    const { error } = await supabase
      .from('note_mentions')
      .upsert(
        added.map(id => ({ note_id: input.noteId, mentioned_user_id: id, created_by: createdBy })),
        { onConflict: 'note_id,mentioned_user_id', ignoreDuplicates: true },
      );
    if (error) throw error;
  }
  if (removed.length) {
    const { data, error } = await supabase
      .from('note_mentions')
      .delete()
      .eq('note_id', input.noteId)
      .in('mentioned_user_id', removed)
      .select('id');
    if (error) throw error;
    assertRowsAffected(data as unknown[]); // RLS filters silently (0 rows)
  }
  return { added, removed };
}

export const MentionService = { extractMentions, diffMentionIds, syncNoteMentions, listMentionedUserIds };
