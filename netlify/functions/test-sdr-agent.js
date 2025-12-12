// netlify/functions/test-sdr-agent.js
const { buildSdrAgent } = require("./_aiClients");

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