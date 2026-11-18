import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));

import {
  __resetLocalVersions, badgeFor, diffSnapshots, getLiveMeta, listVersions, publishVersion, restoreVersion, setWebhook, getWebhook, snapshotOf, stableStringify,
  summarizeDiff, webhookCurl, webhookUrl,
} from '../services/workflowVersionService';

const step = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, type: 'action', position: { x: 0, y: 0 }, ...extra });

describe('workflow version diff', () => {
  it('counts added, removed and changed steps by id', () => {
    const a = { name: 'W', stages: [step('1', 'Start'), step('2', 'Email'), step('3', 'Wait')] };
    const b = { name: 'W', stages: [step('1', 'Start'), step('2', 'Email', { delay: 5 }), step('4', 'Notify')] };
    const d = diffSnapshots(a, b);
    expect(d.added).toEqual(['Notify']);
    expect(d.removed).toEqual(['Wait']);
    expect(d.changed).toEqual(['Email']);
    expect(d.identical).toBe(false);
    expect(summarizeDiff(d)).toBe('1 step added, 1 removed, 1 changed');
  });

  it('ignores canvas position and key order', () => {
    const a = { stages: [step('1', 'A', { config: { x: 1, y: 2 } })] };
    const b = { stages: [{ config: { y: 2, x: 1 }, name: 'A', id: '1', type: 'action', position: { x: 99, y: 99 } }] };
    expect(diffSnapshots(a, b).identical).toBe(true);
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('reports rename, trigger and settings changes', () => {
    const d = diffSnapshots({ name: 'A', triggers: [], settings: { a: 1 } }, { name: 'B', triggers: [{ id: 't' }], settings: { a: 2 } });
    expect(d.nameChanged && d.triggersChanged && d.settingsChanged).toBe(true);
    expect(summarizeDiff(d)).toBe('renamed, triggers changed, settings changed');
    expect(summarizeDiff(diffSnapshots(null, null))).toBe('No changes');
  });

  it('badge: Draft until published, then Published vN unless dirty or the live row moved on', () => {
    const snap = { name: 'W', stages: [step('1', 'A')] };
    expect(badgeFor(null, snap, null, false)).toEqual({ label: 'Draft', kind: 'draft' });
    expect(badgeFor(2, snap, snap, false)).toEqual({ label: 'Published v2', kind: 'published' });
    expect(badgeFor(2, snap, snap, true).kind).toBe('draft');
    expect(badgeFor(2, { name: 'W', stages: [] }, snap, false)).toEqual({ label: 'Draft (published v2)', kind: 'draft' });
  });

  it('snapshotOf maps steps onto stages like the SQL snapshot', () => {
    expect(snapshotOf({ name: 'W', steps: [step('1', 'A')], triggers: [], settings: {} }).stages).toHaveLength(1);
  });

  it('inbound webhook helpers', () => {
    const url = webhookUrl('https://x.test', 'tok');
    expect(url).toBe('https://x.test/api/workflow/hook/tok');
    expect(webhookCurl(url)).toContain('curl -X POST "https://x.test/api/workflow/hook/tok"');
  });
});

describe('local fallback store (demo mode)', () => {
  beforeEach(() => __resetLocalVersions());

  it('publishes increasing versions, archives the previous one and restores only existing versions', async () => {
    expect(await publishVersion('w1', 'first', { name: 'one' })).toBe(1);
    expect(await publishVersion('w1', '', { name: 'two' })).toBe(2);
    const list = await listVersions('w1');
    expect(list.map(v => [v.version, v.status])).toEqual([[2, 'published'], [1, 'archived']]);
    expect((await getLiveMeta('w1')).published_version).toBe(2);
    await expect(restoreVersion('w1', 1)).resolves.toBeUndefined();
    await expect(restoreVersion('w1', 9)).rejects.toThrow(/not found/);
  });

  it('webhook enable returns a token, rotate changes it, disable clears the enabled flag', async () => {
    const t1 = await setWebhook('w2', true);
    const t2 = await setWebhook('w2', true);
    expect(t1).toBeTruthy(); expect(t2).not.toBe(t1);
    expect((await getLiveMeta('w2')).webhook_enabled).toBe(true);
    expect(await getWebhook('w2')).toEqual({ token: t2, enabled: true });
    expect(JSON.stringify(await getLiveMeta('w2'))).not.toContain(String(t2));
    expect(await setWebhook('w2', false)).toBeNull();
    expect((await getLiveMeta('w2')).webhook_enabled).toBe(false);
  });
});
