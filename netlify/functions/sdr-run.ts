import type { Handler } from "@netlify/functions";
import { sdrAgentRegistry } from "../../../src/lib/agents/sdr/registry";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const agentId = body.agentId as string | undefined;
    const contactId = body.contactId as string | undefined;
    const dealId = body.dealId as string | undefined;
    const extraContext = body.context || {};

    if (!agentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "agentId is required" })
      };
    }

    if (!contactId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "contactId is required" })
      };
    }

    const agent = sdrAgentRegistry[agentId];
    if (!agent) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Unknown SDR agent: ${agentId}` })
      };
    }

    const result = await agent.run({
      contactId,
      dealId,
      context: extraContext
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        agentId,
        contactId,
        dealId: dealId || null,
        result
      })
    };
  } catch (error: any) {
    console.error("[sdr-run] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};