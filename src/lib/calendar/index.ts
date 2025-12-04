import { supabase } from "../core/supabaseClient";
import { executeTool } from "../core/mcpExecutor";
import { logger } from "../core/logger";

/**
 * Schedules a meeting for a contact at given ISO datetime.
 * - Creates a calendar_event row in Supabase
 * - Sends email via AgentMail (or other MCP tool)
 */
export async function scheduleMeeting(contactId: string, datetime: string) {
  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .single();

  if (cErr || !contact?.email) {
    logger.error("Calendar: contact not found or missing email", { contactId, cErr });
    throw new Error("Contact not found or missing email");
  }

  const { data: event, error: eErr } = await supabase
    .from("calendar_events")
    .insert({
      contact_id: contactId,
      datetime,
      status: "scheduled"
    })
    .select("*")
    .single();

  if (eErr) {
    logger.error("Calendar: failed to insert event", { eErr });
    throw eErr;
  }

  // Email confirmation (via AgentMail MCP)
  await executeTool("AgentMail", {
    action: "send_message",
    to: contact.email,
    subject: "Your meeting is scheduled 📅",
    body: `
Hi ${contact.name || ""},

Your meeting has been scheduled for:

${new Date(datetime).toLocaleString()}

If this time doesn't work, just reply to this email and we'll reschedule.

Best,
SmartCRM Calendar AI
    `.trim()
  });

  return event;
}