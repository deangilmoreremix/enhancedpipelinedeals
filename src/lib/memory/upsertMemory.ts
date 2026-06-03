import { supabase } from "../core/supabaseClient";
import { MemoryType } from "./types";
import { logger } from "../core/logger";

export async function upsertMemory(
  contactId: string,
  type: MemoryType,
  data: any
) {
  const { data: existing, error: selectError } = await supabase
    .from("agent_memory")
    .select("id")
    .eq("contact_id", contactId)
    .eq("memory_type", type)
    .limit(1);

  if (selectError) {
    logger.error("Failed to check existing memory", { contactId, type, selectError });
    return { error: selectError };
  }

  if (existing && existing.length > 0) {
    const id = existing[0].id;

    const { error: updateError } = await supabase
      .from("agent_memory")
      .update({ data, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      logger.error("Failed to update memory", { contactId, type, updateError });
    }

    return { error: updateError };
  } else {
    const { error: insertError } = await supabase.from("agent_memory").insert({
      contact_id: contactId,
      memory_type: type,
      data
    });

    if (insertError) {
      logger.error("Failed to insert memory", { contactId, type, insertError });
    }

    return { error: insertError };
  }
}