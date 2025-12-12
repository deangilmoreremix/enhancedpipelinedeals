// netlify/functions/trigger-autopilot.js
const { supabase } = require("./_supabaseClient");

// Reuse the same sequence-running logic as run-agent (but scoped as helper)
async function runSdrStepForContact(contact, settings) {
  const agentId = settings.agent_id || "cold_email_sdr";
  const personaId = settings.persona_id || "friendly";
  const sequenceLength = settings.sequence_length || 30;
  const currentStep = settings.current_step || 0;
  const nextStep = currentStep + 1;

  if (nextStep > sequenceLength) {
    await supabase.from("agent_logs").insert({
      contact_id: contact.id,
      level: "info",
      message: `[${agentId}] Sequence already complete. No further steps.`
    });

    return { done: true };
  }

  const messageText = `
[Autopilot] Agent: ${agentId}, Persona: ${personaId}
Step ${nextStep}/${sequenceLength} for ${contact.name || "contact"}.

(This is where the real AI-generated message would go.)
`;

  await supabase.from("agent_logs").insert({
    contact_id: contact.id,
    level: "info",
    message: `[Autopilot → ${agentId}] Step ${nextStep}/${sequenceLength} prepared.\n${messageText}`
  });

  await supabase
    .from("contact_agent_settings")
    .update({ current_step: nextStep, updated_at: new Date().toISOString() })
    .eq("contact_id", contact.id);

  return { success: true, step: nextStep, messageText };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { contactId } = body;

    if (!contactId) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "contactId is required" })
      };
    }

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      console.error("[trigger-autopilot] contact error:", contactError);
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Contact not found" })
      };
    }

    const { data: settings, error: settingsError } = await supabase
      .from("contact_agent_settings")
      .select("*")
      .eq("contact_id", contactId)
      .single();

    if (settingsError || !settings) {
      console.error("[trigger-autopilot] settings error:", settingsError);
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "No agent settings found for this contact" })
      };
    }

    if (!settings.autopilot_enabled) {
      await supabase.from("agent_logs").insert({
        contact_id: contact.id,
        level: "info",
        message: "[Autopilot] Skipped: Autopilot disabled for this contact."
      });

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ skipped: true, reason: "Autopilot disabled" })
      };
    }

    const status = contact.lead_status || "new";

    let result;
    switch (status) {
      case "new":
      case "cold":
      case "nurture":
        // SDR outreach mode
        result = await runSdrStepForContact(contact, settings);
        break;

      case "engaged":
      case "interested":
      case "meeting_scheduled":
      case "proposal":
        // TODO: later switch to AE agent, calendar AI, etc.
        result = await runSdrStepForContact(contact, settings);
        break;

      default:
        await supabase.from("agent_logs").insert({
          contact_id: contact.id,
          level: "info",
          message: `[Autopilot] No action for status '${status}'.`
        });
        result = { skipped: true, reason: `No action for status ${status}` };
        break;
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ status, result })
    };
  } catch (err) {
    console.error("[trigger-autopilot] error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to trigger autopilot" })
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}