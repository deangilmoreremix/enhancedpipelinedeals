import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));

import {
  __resetLocalTemplates, deleteTemplate, expandShortcut, extractVariables, isValidShortcut, listTemplates, renderTemplate, saveTemplate, validateTemplate,
  type EmailTemplateRow,
} from '../services/emailTemplateService';

const ctx = {
  deal: { title: 'Acme Renewal', company: 'Acme', value: 12000, contact: 'Jo Smith', assignedTo: 'Sam', stage: 'proposal' },
  contact: { name: 'Jo Smith', firstName: 'Jo' },
  now: new Date('2026-03-04T12:00:00Z'),
};
const snip = (shortcut: string, body = 'B'): EmailTemplateRow => ({ id: shortcut, name: shortcut, subject: '', body, category: 'general', is_snippet: true, shortcut, is_active: true });

describe('template variable substitution', () => {
  it('replaces contact, company, deal title, value and owner', () => {
    const r = renderTemplate('Hi {{first_name}} ({{ contact_name }}) at {{company}}: {{deal_title}} worth {{deal_value}}, owner {{owner}}', ctx);
    expect(r.text).toBe('Hi Jo (Jo Smith) at Acme: Acme Renewal worth $12,000, owner Sam');
    expect(r.unresolved).toEqual([]);
  });

  it('leaves unknown/empty variables visible and lists them', () => {
    const r = renderTemplate('{{first_name}} {{nope}} {{nope}} {{owner}}', { deal: { ...ctx.deal, assignedTo: '' }, contact: ctx.contact });
    expect(r.text).toBe('Jo {{nope}} {{nope}} {{owner}}');
    expect(r.unresolved).toEqual(['nope', 'owner']);
  });

  it('extracts unique variable names in order', () => {
    expect(extractVariables('{{a}} {{ b }} {{a}} {c}')).toEqual(['a', 'b']);
  });

  it('expands /shortcut only for an exact snippet match at the end of the typed text', () => {
    const list = [snip('meet'), snip('sig')];
    expect(expandShortcut('Hello\n/meet', list)?.before).toBe('Hello\n');
    expect(expandShortcut('Hello /sig', list)?.snippet.id).toBe('sig');
    expect(expandShortcut('Hello /mee', list)).toBeNull();
    expect(expandShortcut('a/meet', list)).toBeNull();
    expect(expandShortcut('/meet', [{ ...snip('meet'), is_snippet: false }])).toBeNull();
  });

  it('validates shortcuts and templates', () => {
    expect(isValidShortcut('/meet')).toBe(true);
    expect(isValidShortcut('bad shortcut')).toBe(false);
    const base = { name: 'N', subject: 'S', body: 'B', category: 'general', is_snippet: false, shortcut: '' };
    expect(validateTemplate({ ...base, name: '' }, [])).toMatch(/name/i);
    expect(validateTemplate({ ...base, subject: '' }, [])).toMatch(/subject/i);
    expect(validateTemplate({ ...base, is_snippet: true, shortcut: 'meet' }, [snip('meet')])).toMatch(/already used/);
    expect(validateTemplate({ ...base, is_snippet: true, shortcut: 'meet' }, [snip('meet')], 'meet')).toBeNull();
    expect(validateTemplate(base, [])).toBeNull();
  });
});

describe('template CRUD (demo store)', () => {
  beforeEach(() => __resetLocalTemplates());
  it('creates, updates and deletes', async () => {
    const before = (await listTemplates()).length;
    const t = await saveTemplate({ name: 'Hello', subject: 'Hi {{first_name}}', body: 'Body', category: 'outreach', is_snippet: false, shortcut: '' });
    expect((await listTemplates()).length).toBe(before + 1);
    await saveTemplate({ name: 'Hello 2', subject: 'S', body: 'Body', category: 'outreach', is_snippet: true, shortcut: '/Hi' }, t.id);
    const updated = (await listTemplates()).find(x => x.id === t.id)!;
    expect(updated.name).toBe('Hello 2');
    expect(updated.shortcut).toBe('hi');
    expect(updated.subject).toBe('');
    await deleteTemplate(t.id);
    expect((await listTemplates()).length).toBe(before);
  });
});
