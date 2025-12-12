// netlify/functions/run-agent.js
const { supabase } = require("./_supabaseClient");
const OpenAI = require("openai");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// TODO: Replace this with real OpenAI Agents SDK call
async function generateMessageWithAI({ agentId, personaId, sequenceLength, step, contact }) {
  try {
    // Use OpenAI to generate personalized SDR message
    const prompt = `
You are a ${personaId} SDR agent (${agentId}) sending step ${step} of a ${sequenceLength}-day sequence.

Contact: ${contact.name || 'Prospect'}
Company: ${contact.company || 'Unknown'}
Industry: ${contact.industry || 'General'}

Generate a personalized, professional outreach message that:
- Uses the ${personaId} communication style
- Is appropriate for step ${step} in the sequence
- Focuses on ${agentId.replace(/_/g, ' ')} objectives
- Is concise but compelling
- Includes a clear call-to-action

Message:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert SDR copywriter. Generate personalized, effective sales outreach messages."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    return completion.choices[0].message.content || "Generated message content";
  } catch (error) {
    console.error("OpenAI generation failed:", error);
    // Fallback to simple message
    return `
Hi ${contact?.name || "there"},

[AI ${agentId} / persona: ${personaId}] – This is step ${step} of your ${sequenceLength}-day sequence.

This is where your real SDR copy would go.
`;
  }
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

    // Load contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      console.error("[run-agent] contact error:", contactError);
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Contact not found" })
      };
    }

    // Load agent settings for this contact
    const { data: settings, error: settingsError } = await supabase
      .from("contact_agent_settings")
      .select("*")
      .eq("contact_id", contactId)
      .single();

    if (settingsError || !settings) {
      console.error("[run-agent] settings error:", settingsError);
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "No agent settings found for this contact" })
      };
    }

    if (!settings.autopilot_enabled) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ skipped: true, reason: "Autopilot disabled for this contact" })
      };
    }

    const agentId = settings.agent_id || "cold_email_sdr";
    const personaId = settings.persona_id || "friendly";
    const sequenceLength = settings.sequence_length || 30;
    const currentStep = settings.current_step || 0;
    const nextStep = currentStep + 1;

    if (nextStep > sequenceLength) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ done: true, message: "Sequence complete for this contact" })
      };
    }

    // Generate the outbound message using OpenAI
    const messageText = await generateMessageWithAI({
      agentId,
      personaId,
      sequenceLength,
      step: nextStep,
      contact
    });

    // TODO: integrate AgentMail here to actually SEND the email.
    // For now, we just log what would be sent.

    // Insert log entry
    await supabase.from("agent_logs").insert({
      contact_id: contactId,
      level: "info",
      message: `[${agentId}] Step ${nextStep}/${sequenceLength} prepared. Message preview:\n${messageText}`
    });

    // Update current step
    await supabase
      .from("contact_agent_settings")
      .update({ current_step: nextStep, updated_at: new Date().toISOString() })
      .eq("contact_id", contactId);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        agentId,
        personaId,
        sequenceLength,
        step: nextStep,
        preview: messageText
      })
    };
  } catch (err) {
    console.error("[run-agent] error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to run agent" })
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