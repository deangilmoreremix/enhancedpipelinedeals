import { supabase } from "../lib/core/supabaseClient";
import { LoadedMemory } from "./types";
import { logger } from "../lib/core/logger";

export async function loadAgentMemory(contactId: string): Promise<LoadedMemory> {
  const { data, error } = await supabase
    .from("agent_memory")
    .select("*")
    .eq("contact_id", contactId)
    .order("updated_at", { ascending: false });

  if (error) {
    logger.error("Failed to load agent memory", { contactId, error });
    return { short: [], mid: [], long: [] };
  }

  return {
    short: (data || []).filter(d => d.memory_type === "short"),
    mid: (data || []).filter(d => d.memory_type === "mid"),
    long: (data || []).filter(d => d.memory_type === "long")
  };
}