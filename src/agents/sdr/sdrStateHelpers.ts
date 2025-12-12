// SDR Autopilot State Management Helpers
// Manages OpenAI threads and autopilot state persistence

import { supabase } from '../../lib/core/supabaseClient';

// Get or create a thread for the lead
export async function getOrCreateThreadForLead(leadId: string): Promise<string> {
  // Check if thread already exists
  const { data: existingThread } = await supabase
    .from('agent_threads')
    .select('thread_id')
    .eq('lead_id', leadId)
    .eq('agent_type', 'sdr_autopilot')
    .single();

  if (existingThread?.thread_id) {
    return existingThread.thread_id;
  }

  // Create new OpenAI thread (placeholder - would use actual OpenAI API)
  const threadId = `thread_${Date.now()}_${leadId}`;

  // Save to database
  const { error } = await supabase
    .from('agent_threads')
    .insert({
      lead_id: leadId,
      thread_id: threadId,
      agent_type: 'sdr_autopilot'
    });

  if (error) {
    throw new Error(`Failed to create thread: ${error.message}`);
  }

  return threadId;
}

// Save autopilot state for a lead
export async function saveAutopilotState(params: {
  leadId: string;
  stateJson: string;
  status?: string;
}): Promise<void> {
  const { leadId, stateJson, status = 'active' } = params;

  const { error } = await supabase
    .from('autopilot_state')
    .upsert({
      lead_id: leadId,
      agent_type: 'sdr_autopilot',
      state_json: JSON.parse(stateJson), // Store as JSONB
      status,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'lead_id,agent_type'
    });

  if (error) {
    throw new Error(`Failed to save autopilot state: ${error.message}`);
  }
}

// Get current autopilot state for a lead
export async function getAutopilotState(leadId: string): Promise<any> {
  const { data, error } = await supabase
    .from('autopilot_state')
    .select('state_json, status')
    .eq('lead_id', leadId)
    .eq('agent_type', 'sdr_autopilot')
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    throw new Error(`Failed to get autopilot state: ${error.message}`);
  }

  return data ? { ...data.state_json, status: data.status } : null;
}