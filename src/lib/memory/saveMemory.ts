import { supabase } from "../lib/core/supabaseClient";
import { MemoryType } from "./types";
import { logger } from "../lib/core/logger";

export async function saveMemory(
  contactId: string,
  type: MemoryType,
  data: any
) {
  const { error } = await supabase.from("agent_memory").insert({
    contact_id: contactId,
    memory_type: type,
    data
  });

  if (error) {
    logger.error("Failed to save memory", { contactId, type, error });
  }

  return { error };
}