// sdr_only/run-ae-agent.js
const { supabase } = require("./_supabaseClient");
const { buildAeAgent } = require("./_aiClients");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { contactId, inbound } = body;

    if (!contactId) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "contactId is required" }),
      };
    }

    // 1) Load contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      console.error("[run-ae-agent] contact error:", contactError);
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Contact not found" }),
      };
    }

    // 2) Optionally load settings (for persona, flags, etc.)
    const { data: settings, error: settingsError } = await supabase
      .from("contact_agent_settings")
      .select("*")
      .eq("contact_id", contactId)
      .single();

    if (settingsError) {
      console.warn("[run-ae-agent] settings error (non-fatal):", settingsError);
    }

    const aeId = settings?.ae_agent_id || "ae_demo_agent";
    const personaId = settings?.ae_persona_id || "trusted_advisor";
    const productName = settings?.product_name || "SmartCRM";

    const { agent, runner } = buildAeAgent({
      aeId,
      personaId,
      productName,
      contact,
    });

    const inboundText = inbound?.text || "";
    const inboundSubject = inbound?.subject || "";
    const threadId = inbound?.threadId || null;
    const inboxId = inbound?.inboxId || null;
    const fromEmail = inbound?.fromEmail || contact.email;

    // 3) AE user message
    const userMessage = {
      role: "user",
      content: `
You are replying as the AE to an interested lead.

Contact:
- Name: ${contact.name || ""}
- Email: ${fromEmail || contact.email || ""}
- Company: ${contact.company || ""}

Their last message:
Subject: ${inboundSubject}
Body:
${inboundText}

Task:
1. Craft a short, specific AE reply that:
   - acknowledges their interest or question,
   - proposes a clear next step (e.g., a quick 15-20 minute demo),
   - keeps tone helpful, expert, and human.
2. If thread_id (${threadId}) is available, use the AgentMail "reply_to_message" tool to respond in-thread.
   Otherwise, use "send_message" to send a new email to ${fromEmail || contact.email}.
3. Do NOT oversell or sound spammy. You're a trusted advisor.
`,
    };

    // 4) Run AE agent
    const result = await runner.run({
      agent,
      messages: [userMessage],
    });

    let finalText = "";
    if (result && result.output) {
      finalText = result.output;
    }

    // 5) Log AE action
    await supabase.from("agent_logs").insert({
      contact_id: contactId,
      level: "info",
      message: `[run-ae-agent] AE "${aeId}" handled an interested reply. Output:\n${finalText}`,
      meta: {
        aeId,
        personaId,
        productName,
        inbound,
      },
    });

    // Flag that AE has taken over
    await supabase
      .from("contact_agent_settings")
      .update({
        escalated_to_ae: true,
        ae_last_ran_at: new Date().toISOString(),
      })
      .eq("contact_id", contactId);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        aeId,
        personaId,
        output: finalText,
      }),
    };
  } catch (err) {
    console.error("[run-ae-agent] error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "AE agent failed" }),
    };
  }
};