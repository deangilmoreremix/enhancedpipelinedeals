import { supabase } from "../core/supabaseClient";
import { logger } from "../core/logger";

export async function getContactAndDeal(contactId: string) {
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .single();

  if (contactError) {
    logger.error("Failed to get contact", { contactId, error: contactError });
    throw contactError;
  }

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("*")
    .eq("contact_id", contactId)
    .single();

  if (dealError) {
    logger.error("Failed to get deal", { contactId, error: dealError });
    // Don't throw for deal error, just return null
  }

  return {
    contact: contact || null,
    deal: deal || null
  };
}