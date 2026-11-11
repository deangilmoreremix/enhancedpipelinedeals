// netlify/functions/trigger-autopilot.js
import { supabase } from "./_supabaseClient";
import { authorize } from "./_openai";
import { SPECIALISTS, runSpecialistOnce } from "./_sdrAgents";

// Statuses (contacts.status check constraint: lead | prospect | customer | churned)
const OUTREACH_STATUSES = new Set(["lead", "prospect", "churned"]);

const aiSdrAvailable = () =>
  Boolean(process.env.OPENAI_API_KEY) &&
  Boolean(process.env.SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

async function writeLog(contactId, level, message, metadata) {
  await supabase.from("agent_logs").insert({ contact_id: contactId, level, message, ...(metadata ? { metadata } : {}) });
}

/**
 * Runs the AI SDR (OpenAI Agents SDK specialist from _sdrAgents.ts) for the next step of the contact's sequence and
 * stores the DRAFT in agent_logs. Nothing is sent or queued automatically: sending needs human approval.
 */
async function runSdrStepForContact(contact, settings) {
  const personaId = settings.persona_id || "friendly";
  const sequenceLength = settings.sequence_length || 30;
  const currentStep = settings.current_step || 0;
  const nextStep = currentStep + 1;
  const agentId = SPECIALISTS.some((s) => s.id === settings.agent_id) ? settings.agent_id : "auto";
  const label = settings.agent_id || agentId;

  if (nextStep > sequenceLength) {
    await writeLog(contact.id, "info", `[${label}] Sequence already complete. No further steps.`);
    return { done: true };
  }

  if (!aiSdrAvailable()) {
    await writeLog(contact.id, "warn", `[Autopilot -> ${label}] Step ${nextStep}/${sequenceLength} not run: AI SDR is not available (OPENAI_API_KEY / Supabase service credentials missing on the server). No draft was generated.`);
    return { skipped: true, reason: "AI SDR not available" };
  }

  const goal = `Autopilot step ${nextStep} of ${sequenceLength} for ${contact.name || "this contact"} (status: ${contact.status || "lead"}, persona: ${personaId}). Draft the next outreach message for this step. Do not send anything.`;

  let run;
  try {
    run = await runSpecialistOnce(agentId, contact.id, goal);
  } catch (err) {
    const reason = err?.message || String(err);
    await writeLog(contact.id, "error", `[Autopilot -> ${label}] Step ${nextStep}/${sequenceLength} failed: ${reason}`);
    return { error: reason };
  }

  if (run.status === "approval_required") {
    await writeLog(contact.id, "info", `[Autopilot -> ${label}] Step ${nextStep}/${sequenceLength} is waiting for human approval before anything is sent.`, {
      step: nextStep, agent_id: agentId, persona_id: personaId, requires_approval: true, approvals: run.approvals,
    });
    return { awaitingApproval: true, step: nextStep, approvals: run.approvals };
  }

  const draft = run.output;
  await writeLog(contact.id, "info", `[Autopilot -> ${label}] Step ${nextStep}/${sequenceLength} draft prepared (not sent: needs human approval).`, {
    step: nextStep, agent_id: agentId, persona_id: personaId, requires_approval: true, draft,
  });

  await supabase
    .from("contact_agent_settings")
    .update({ current_step: nextStep, updated_at: new Date().toISOString() })
    .eq("contact_id", contact.id);

  return { success: true, step: nextStep, draft };
}

export const handler = async (event, context) => {
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

  if (!(await authorize(event.headers?.authorization || event.headers?.Authorization))) {
    return {
      statusCode: 401,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Unauthorized" })
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

    const status = contact.status || "lead";

    let result;
    if (OUTREACH_STATUSES.has(status)) {
      result = await runSdrStepForContact(contact, settings);
    } else {
      await writeLog(contact.id, "info", `[Autopilot] No action for status '${status}'.`);
      result = { skipped: true, reason: `No action for status ${status}` };
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}