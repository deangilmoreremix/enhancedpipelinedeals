import { mockDb } from '../test-utils/mockSupabase';

let demo = false;
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: require('../test-utils/mockSupabase').mockDb.client }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => demo }));
const mockAuthedFetch = jest.fn();
jest.mock('../services/aiClient', () => ({ authedFetch: (...a: unknown[]) => mockAuthedFetch(...a) }));

import { listAgents, listPersonas, savePersonaSelection, saveAgentSettings, getAgentLogs, DEFAULT_AGENTS, DEFAULT_PERSONAS } from '../services/agentControlService';

const op = (table: string, name: string) => mockDb.calls.filter((c) => c.table === table).flatMap((c) => c.ops).filter((o) => o[0] === name);

describe('agentControlService (supabase)', () => {
  const fetchSpy = jest.fn();
  beforeEach(() => {
    mockDb.reset(); demo = false; mockAuthedFetch.mockReset(); fetchSpy.mockReset();
    (global as any).fetch = fetchSpy;
    localStorage.clear();
  });

  it('lists agents from agent_metadata (label -> name) and falls back to the built-in catalog when empty', async () => {
    mockDb.on('agent_metadata', { data: [{ id: 'a1', label: 'Alpha' }, { id: 'a2', label: null }], error: null });
    expect(await listAgents()).toEqual([{ id: 'a1', name: 'Alpha' }, { id: 'a2', name: 'a2' }]);
    mockDb.on('agent_metadata', { data: [], error: null });
    expect(await listAgents()).toEqual(DEFAULT_AGENTS);
    mockDb.on('agent_metadata', { data: null, error: { message: 'rls' } });
    await expect(listAgents()).rejects.toThrow('rls');
  });

  it('lists personas from sdr_personas with short_id = id', async () => {
    mockDb.on('sdr_personas', { data: [{ id: 'p1', name: 'Bold', description: 'd', tone: 't', persona_prompt: 'pp' }], error: null });
    expect(await listPersonas()).toEqual([{ id: 'p1', name: 'Bold', short_id: 'p1', description: 'd', tone: 't', persona_prompt: 'pp' }]);
    expect(mockDb.tables()).toEqual(['sdr_personas']);
  });

  it('saves the persona through the authenticated selectPersona function', async () => {
    mockAuthedFetch.mockResolvedValue({ ok: true, status: 200 });
    await savePersonaSelection('agent-1', 'p1');
    const [url, init] = mockAuthedFetch.mock.calls[0];
    expect(url).toBe('/.netlify/functions/selectPersona');
    expect(JSON.parse(init.body)).toEqual({ agent_id: 'agent-1', persona_id: 'p1' });
    mockAuthedFetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(savePersonaSelection('agent-1', 'p1')).rejects.toThrow('401');
  });

  it('upserts contact_agent_settings (on contact_id) and stores channel/skill prefs on the contact', async () => {
    mockDb.on('contacts', (c) => ({ data: c.ops.some((o) => o[0] === 'maybeSingle') ? { custom_fields: { keep: 1 } } : null, error: null }));
    const r = await saveAgentSettings({ contactId: 'c1', autopilotEnabled: true, selectedAgent: 'sdr-cold-email', selectedPersona: 'friendly', sequenceLength: '45', channels: { email: true }, skills: { research: true }, quietHours: { start: '20:00', end: '08:00' } });
    expect(r.preferencesSaved).toBe(true);
    const [upsertRow, opts] = op('contact_agent_settings', 'upsert')[0].slice(1) as any[];
    expect(upsertRow).toMatchObject({ contact_id: 'c1', agent_id: 'sdr-cold-email', persona_id: 'friendly', sequence_length: 45, autopilot_enabled: true });
    expect(opts).toEqual({ onConflict: 'contact_id' });
    const patch = op('contacts', 'update')[0][1] as any;
    expect(patch.custom_fields).toEqual({ keep: 1, agent_preferences: { channels: { email: true }, skills: { research: true }, quietHours: { start: '20:00', end: '08:00' } } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('surfaces database errors and requires a contact id', async () => {
    mockDb.on('contact_agent_settings', { data: null, error: { message: 'violates foreign key' } });
    await expect(saveAgentSettings({ contactId: 'nope', autopilotEnabled: false })).rejects.toThrow('violates foreign key');
    await expect(saveAgentSettings({ contactId: '', autopilotEnabled: false })).rejects.toThrow('contact ID');
  });

  it('reads the newest agent_logs for a contact', async () => {
    mockDb.on('agent_logs', { data: [{ message: 'm1' }], error: null });
    expect(await getAgentLogs('c1')).toEqual([{ message: 'm1' }]);
    expect(op('agent_logs', 'eq')[0].slice(1)).toEqual(['contact_id', 'c1']);
    expect(op('agent_logs', 'order')[0].slice(1)).toEqual(['created_at', { ascending: false }]);
    expect(await getAgentLogs('')).toEqual([]);
  });

  it('demo mode: bundled catalog + localStorage, no network and no Supabase', async () => {
    demo = true;
    expect(await listAgents()).toEqual(DEFAULT_AGENTS);
    expect(await listPersonas()).toEqual(DEFAULT_PERSONAS);
    await saveAgentSettings({ contactId: 'c1', autopilotEnabled: true, sequenceLength: '10' });
    expect(JSON.parse(localStorage.getItem('agent_control_settings') || '{}').c1.sequenceLength).toBe(10);
    await savePersonaSelection('a', 'p');
    expect(await getAgentLogs('c1')).toEqual([]);
    expect(mockDb.calls).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockAuthedFetch).not.toHaveBeenCalled();
  });
});
