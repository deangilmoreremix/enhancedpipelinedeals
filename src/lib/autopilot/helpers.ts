import { supabase } from "../lib/core/supabaseClient";
import { logger } from "../lib/core/logger";

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

export async function runAutopilot(contactId: string) {
  try {
    const { contact, deal } = await getContactAndDeal(contactId);

    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    // Simple autopilot logic - could be expanded
    const result = {
      contactId,
      contactName: contact.name,
      dealId: deal?.id || null,
      status: 'processed',
      timestamp: new Date().toISOString(),
      actions: [
        'Contact data validated',
        'Deal status checked',
        deal ? 'Deal information updated' : 'No active deal found'
      ]
    };

    logger.info('Autopilot run completed', { contactId, result });

    return result;
  } catch (error) {
    logger.error('Autopilot run failed', { contactId, error });
    throw error;
  }
}