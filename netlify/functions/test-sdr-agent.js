// netlify/functions/test-sdr-agent.js
import { buildSdrAgent } from "./_aiClients";
import { CORS_HEADERS, rateLimited, json } from "./_openai";
import { authenticate } from "./_agentAuth";

const corsHeaders = () => CORS_HEADERS;

export const handler = async (event, context) => {
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

  const auth = await authenticate(event);
  if (auth.error) return auth.error;
  if (rateLimited(`test-sdr:${auth.user.id}`, 20)) return json(429, { error: "Rate limit exceeded" });

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      agentId = "cold_email_sdr",
      personaId = "friendly",
      sequenceLength = 10,
      step = 1,
      contact = {},
      prompt = "",
    } = body;

    const { agent, runner } = buildSdrAgent({
      agentId,
      personaId,
      sequenceLength,
      step,
      contact,
    });

    const userMessage = {
      role: "user",
      content: `
You are testing SDR agent "${agentId}".
Contact:
- Name: ${contact.name || ""}
- Email: ${contact.email || ""}
- Company: ${contact.company || ""}

Task:
${prompt || `Write a cold outreach email for step ${step} of a ${sequenceLength}-day sequence AND (if possible) call the AgentMail "send_message" tool.`}
      `,
    };

    const result = await runner.run({
      agent,
      messages: [userMessage],
    });

    let finalText = "";
    if (result && result.output) {
      finalText = result.output;
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        agentId,
        personaId,
        step,
        output: finalText,
        raw: result,
      }),
    };
  } catch (err) {
    console.error("[test-sdr-agent] error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Test SDR agent failed" }),
    };
  }
};