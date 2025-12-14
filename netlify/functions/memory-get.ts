import type { Handler } from "@netlify/functions";
import { loadAgentMemory } from "../../../src/lib/memory/loadMemory";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const contactId = event.queryStringParameters?.contactId;
    if (!contactId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "contactId is required" })
      };
    }

    const memory = await loadAgentMemory(contactId);

    return {
      statusCode: 200,
      body: JSON.stringify({ contactId, memory })
    };
  } catch (error: any) {
    console.error("[memory-get] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};