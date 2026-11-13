/**
 * Agent control data layer: SDR agents, personas, per-contact autopilot settings and agent logs.
 * Reads/writes Supabase directly (tables agent_metadata, sdr_personas, agent_persona_selection,
 * contact_agent_settings, agent_logs). Demo / unconfigured mode never touches the network: it serves a bundled
 * catalog and keeps settings + logs in localStorage.
 */
import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';
import { authedFetch } from './aiClient';

export interface AgentOption { id: string; name: string }
export interface PersonaOption {
  id: string;
  name: string;
  short_id: string;
  description: string;
  tone: string;
  persona_prompt: string;
}
export interface AgentLogEntry { message: string; level?: string; created_at?: string }
export interface AgentSettingsInput {
  contactId: string;
  autopilotEnabled: boolean;
  selectedAgent?: string;
  selectedPersona?: string;
  sequenceLength?: string | number;
  channels?: Record<string, boolean>;
  skills?: Record<string, boolean>;
  quietHours?: { start: string; end: string };
}

const isRemote = () => isSupabaseConfigured && !isDemoMode();

/** Mirrors the specialists defined server-side in netlify/functions/_sdrAgents.ts (used when the DB has no agent_metadata rows). */
export const DEFAULT_AGENTS: AgentOption[] = [
  { id: 'sdr-cold-email', name: 'Cold Email SDR' },
  { id: 'sdr-follow-up', name: 'Follow-Up SDR' },
  { id: 'sdr-bump-message', name: 'Bump Message SDR' },
  { id: 'sdr-objection-handling', name: 'Objection Handling SDR' },
  { id: 'sdr-linkedin', name: 'LinkedIn SDR' },
  { id: 'sdr-whatsapp', name: 'WhatsApp SDR' },
  { id: 'sdr-winback', name: 'Winback SDR' },
  { id: 'sdr-reactivation', name: 'Reactivation SDR' },
  { id: 'sdr-competitor-aware', name: 'Competitor Aware SDR' },
  { id: 'sdr-high-intent', name: 'High-Intent SDR' },
  { id: 'sdr-event-based', name: 'Event-Based SDR' },
  { id: 'sdr-referral', name: 'Referral SDR' },
  { id: 'sdr-newsletter-lead-in', name: 'Newsletter Lead-In SDR' },
  { id: 'sdr-data-enrichment', name: 'Data-Enrichment SDR' },
];

export const DEFAULT_PERSONAS: PersonaOption[] = [
  { id: 'friendly', name: 'Friendly', short_id: 'friendly', tone: 'warm', description: 'Warm, approachable and conversational.', persona_prompt: 'Write in a warm, approachable, conversational tone.' },
  { id: 'professional', name: 'Professional', short_id: 'professional', tone: 'formal', description: 'Polished and business-like.', persona_prompt: 'Write in a polished, concise, business-like tone.' },
  { id: 'direct', name: 'Direct', short_id: 'direct', tone: 'direct', description: 'Short, to the point, outcome focused.', persona_prompt: 'Be brief and direct; lead with the outcome and the ask.' },
  { id: 'consultative', name: 'Consultative', short_id: 'consultative', tone: 'advisory', description: 'Asks questions and advises before pitching.', persona_prompt: 'Act as an advisor: ask thoughtful questions before recommending anything.' },
];

// ---- localStorage helpers (demo mode) ------------------------------------------------------------------
const LS_SETTINGS = 'agent_control_settings';
const LS_LOGS = 'agent_control_logs';
const LS_PERSONA = 'agent_persona_selection';
const readLS = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const writeLS = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };

// ---- agents / personas ---------------------------------------------------------------------------------
export async function listAgents(): Promise<AgentOption[]> {
  if (!isRemote()) return DEFAULT_AGENTS;
  const { data, error } = await supabase.from('agent_metadata').select('id,label').order('label', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r: any) => ({ id: String(r.id), name: String(r.label || r.id) }));
  return rows.length ? rows : DEFAULT_AGENTS;
}

const toPersona = (r: any): PersonaOption => ({
  id: String(r.id),
  name: r.name || String(r.id),
  short_id: String(r.id),
  description: r.description || '',
  tone: r.tone || '',
  persona_prompt: r.persona_prompt || '',
});

export async function listPersonas(): Promise<PersonaOption[]> {
  if (!isRemote()) return DEFAULT_PERSONAS;
  const { data, error } = await supabase.from('sdr_personas').select('id,name,description,tone,persona_prompt').order('name', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(toPersona);
  return rows.length ? rows : DEFAULT_PERSONAS;
}

/** Remembers which persona an agent uses. Remote: the selectPersona Netlify function (auth header attached); demo: localStorage. */
export async function savePersonaSelection(agentId: string, personaId: string): Promise<void> {
  if (!isRemote()) {
    writeLS(LS_PERSONA, { ...readLS<Record<string, string>>(LS_PERSONA, {}), [agentId]: personaId });
    return;
  }
  const res = await authedFetch('/.netlify/functions/selectPersona', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId, persona_id: personaId }),
  });
  if (!res.ok) throw new Error(`Failed to save persona selection (${res.status})`);
}

// ---- per-contact settings + logs ------------------------------------------------------------------------
export async function saveAgentSettings(input: AgentSettingsInput): Promise<{ preferencesSaved: boolean }> {
  const { contactId } = input;
  if (!contactId) throw new Error('Enter a contact ID first');
  const sequenceLength = Math.max(1, parseInt(String(input.sequenceLength ?? 30), 10) || 30);
  const prefs = { channels: input.channels, skills: input.skills, quietHours: input.quietHours };

  if (!isRemote()) {
    const all = readLS<Record<string, unknown>>(LS_SETTINGS, {});
    all[contactId] = { ...input, sequenceLength };
    writeLS(LS_SETTINGS, all);
    return { preferencesSaved: true };
  }

  const { error } = await supabase.from('contact_agent_settings').upsert({
    contact_id: contactId,
    agent_id: input.selectedAgent || null,
    persona_id: input.selectedPersona || null,
    sequence_length: sequenceLength,
    autopilot_enabled: !!input.autopilotEnabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'contact_id' });
  if (error) throw new Error(error.message);

  // channel / skill / quiet-hour preferences have no dedicated columns: keep them on the contact
  let preferencesSaved = false;
  try {
    const { data: contact } = await supabase.from('contacts').select('custom_fields').eq('id', contactId).maybeSingle();
    const custom = { ...((contact as any)?.custom_fields ?? {}), agent_preferences: prefs };
    const { error: e2 } = await supabase.from('contacts').update({ custom_fields: custom }).eq('id', contactId);
    preferencesSaved = !e2;
  } catch { /* best effort */ }
  return { preferencesSaved };
}

export async function getAgentLogs(contactId: string, limit = 50): Promise<AgentLogEntry[]> {
  if (!contactId) return [];
  if (!isRemote()) return readLS<Record<string, AgentLogEntry[]>>(LS_LOGS, {})[contactId] ?? [];
  const { data, error } = await supabase
    .from('agent_logs')
    .select('message,level,created_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentLogEntry[];
}
