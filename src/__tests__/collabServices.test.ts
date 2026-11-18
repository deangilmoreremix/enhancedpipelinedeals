import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { chain } from '../test-utils/chain';

let mockResults: Record<string, { data?: any; error?: any; count?: number }> = {};
let mockCalls: Array<{ table: string; c: any }> = [];
let mockDemo = false;
const mockFrom = (t: string) => { const c = chain((mockResults[t] ?? { data: [], error: null }) as any); mockCalls.push({ table: t, c }); return c; };
const mockChannel: any = { on: jest.fn(() => mockChannel), subscribe: jest.fn(() => mockChannel) };

jest.mock('../lib/core/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t: string) => mockFrom(t),
    channel: () => mockChannel,
    removeChannel: jest.fn(),
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
  },
}));
jest.mock('../services/supabaseService', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1', user_metadata: { name: 'Me' } } } } }) } },
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => mockDemo }));

import { extractMentions, diffMentionIds, syncNoteMentions, __resetLocalMentions } from '../services/mentionService';
import {
  listNotifications, countUnread, markRead, markAllRead, addLocalNotification, subscribeToNotifications, notificationLink,
  __resetLocalNotifications,
} from '../services/notificationService';
import { fetchTargets, findLinkedItemIds, replaceTargets, matchSource, primaryColumns } from '../services/recordTargetsService';
import { searchUsers, userNameById } from '../services/userDirectoryService';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const ops = (table: string) => mockCalls.filter(x => x.table === table).flatMap(x => x.c.calls as Array<[string, any[]]>);
const doc = (...ids: string[]) => ({ type: 'doc', content: [{ type: 'paragraph', content: ids.map(id => ({ type: 'mention', attrs: { id, label: `L${id.slice(0, 2)}` } })) }] });

beforeEach(() => {
  mockResults = {}; mockCalls = []; mockDemo = false;
  __resetLocalMentions(); __resetLocalNotifications();
});

describe('mention helpers', () => {
  it('extracts distinct mentions at any depth', () => {
    const d = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'a', label: 'A' } }, { type: 'mention', attrs: { id: 'a', label: 'A' } }] }] }] }] };
    expect(extractMentions(d)).toEqual([{ id: 'a', label: 'A' }]);
    expect(extractMentions(null)).toEqual([]);
  });
  it('diffs added and removed', () => {
    expect(diffMentionIds(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
  });
});

describe('syncNoteMentions (remote)', () => {
  it('inserts only the added and deletes the removed', async () => {
    mockResults.note_mentions = { data: [{ mentioned_user_id: U1 }], error: null };
    const out = await syncNoteMentions({ noteId: 'n1', dealId: U1, body: doc(U2), remote: true });
    expect(out).toEqual({ added: [U2], removed: [U1] });
    expect(ops('note_mentions').find(([o]) => o === 'upsert')![1][0]).toEqual([{ note_id: 'n1', mentioned_user_id: U2, created_by: 'user-1' }]);
    const eqs = ops('note_mentions').filter(([o]) => o === 'in');
    expect(eqs[0][1]).toEqual(['mentioned_user_id', [U1]]);
  });

  it('a delete filtered by RLS (0 rows) is a permission denial', async () => {
    let n = 0;
    mockResults.note_mentions = { data: [{ mentioned_user_id: U1 }], error: null };
    // first query (select) returns the stored row; the delete returns the same rows in this double, so force 0 rows:
    const orig = mockResults.note_mentions;
    Object.defineProperty(mockResults, 'note_mentions', { get: () => (n++ === 0 ? orig : { data: [], error: null }), configurable: true });
    await expect(syncNoteMentions({ noteId: 'n1', dealId: U1, body: doc(), remote: true })).rejects.toMatchObject({ code: '42501' });
  });

  it('skips non-uuid (local) user ids when remote', async () => {
    mockResults.note_mentions = { data: [], error: null };
    const out = await syncNoteMentions({ noteId: 'n1', dealId: U1, body: doc('local-user-x'), remote: true });
    expect(out.added).toEqual([]);
    expect(ops('note_mentions').some(([o]) => o === 'upsert')).toBe(false);
  });
});

describe('notificationService', () => {
  it('lists, counts, marks read and marks all read (remote)', async () => {
    mockResults.user_notifications = { data: [{ id: 'n1', user_id: U1, type: 'mention', title: 'Hi', body: 'b', link: '/deals/d', data: { dealId: 'd' }, read_at: null, created_at: '2026-01-01T00:00:00Z' }], error: null, count: 3 };
    const list = await listNotifications();
    expect(list[0]).toMatchObject({ id: 'n1', title: 'Hi', readAt: null });
    expect(await countUnread()).toBe(3);
    await markRead('n1');
    const upd = ops('user_notifications').filter(([o]) => o === 'update');
    expect(upd[0][1][0]).toHaveProperty('read_at');
    await markAllRead();
    expect(ops('user_notifications').filter(([o]) => o === 'update')).toHaveLength(2);
  });

  it('marking a row the user cannot see is a permission denial', async () => {
    mockResults.user_notifications = { data: [], error: null };
    await expect(markRead('nope')).rejects.toMatchObject({ code: '42501' });
  });

  it('subscribes to realtime filtered by the user', async () => {
    const un = await subscribeToNotifications(() => undefined);
    expect(mockChannel.on).toHaveBeenCalledWith('postgres_changes', expect.objectContaining({ table: 'user_notifications', filter: 'user_id=eq.user-1' }), expect.any(Function));
    un();
  });

  it('demo mode keeps notifications in memory and emits changes', async () => {
    mockDemo = true;
    const seen: string[] = [];
    await subscribeToNotifications(c => seen.push(c.event));
    const n = addLocalNotification({ title: 'x', data: { dealId: 'd1' } });
    expect(await countUnread()).toBe(1);
    expect(notificationLink(n)).toBe('/deals/d1');
    await markRead(n.id);
    expect(await countUnread()).toBe(0);
    expect(seen).toEqual(['INSERT', 'UPDATE']);
    expect(mockCalls).toHaveLength(0);
  });
});

describe('recordTargetsService', () => {
  it('finds linked items with an OR filter over uuid scope entries only', async () => {
    mockResults.note_targets = { data: [{ note_id: 'n1', target_type: 'company', target_id: U2 }], error: null };
    const m = await findLinkedItemIds('note', { deal: U1, company: U2, contact: 'not-a-uuid' });
    const or = ops('note_targets').find(([o]) => o === 'or')![1][0] as string;
    expect(or).toBe(`and(target_type.eq.deal,target_id.eq.${U1}),and(target_type.eq.company,target_id.eq.${U2})`);
    expect(m.get('n1')).toEqual([{ type: 'company', id: U2 }]);
  });

  it('groups targets by item and tolerates a missing table', async () => {
    mockResults.task_targets = { data: [{ task_id: 't1', target_type: 'deal', target_id: U1 }, { task_id: 't1', target_type: 'contact', target_id: U2 }], error: null };
    expect((await fetchTargets('task', ['t1']))['t1']).toHaveLength(2);
    mockResults.task_targets = { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } };
    expect(await fetchTargets('task', ['t1'])).toEqual({});
  });

  it('delete that matches nothing is a permission denial', async () => {
    mockResults.note_targets = { data: [], error: null };
    await expect(replaceTargets('note', 'n1', [], [{ type: 'deal', id: U1 }])).rejects.toMatchObject({ code: '42501' });
  });

  it('matchSource prefers deal, then contact, then company; primaryColumns takes first deal/contact', () => {
    const t = [{ type: 'company' as const, id: 'c' }, { type: 'contact' as const, id: 'p' }];
    expect(matchSource(t, { deal: 'd', contact: 'p', company: 'c' })).toEqual({ type: 'contact', id: 'p' });
    expect(matchSource(t, { deal: 'd' })).toBeNull();
    expect(primaryColumns([{ type: 'contact', id: U2 }])).toEqual({ deal_id: null, contact_id: U2 });
  });
});

describe('userDirectoryService helpers', () => {
  const users = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Annie' }];
  it('searches by name with a limit and resolves names', () => {
    expect(searchUsers(users, 'ann').map(u => u.id)).toEqual(['a', 'c']);
    expect(searchUsers(users, '', 2)).toHaveLength(2);
    expect(userNameById(users, 'b')).toBe('Bob');
    expect(userNameById(users, 'zzz')).toBeNull();
  });
});
