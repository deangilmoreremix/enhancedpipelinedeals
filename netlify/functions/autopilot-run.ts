import type { Handler } from "@netlify/functions";
import { runAutopilot } from "../../../src/lib/autopilot/helpers";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const contactId = body.contactId as string | undefined;

    if (!contactId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "contactId is required" })
      };
    }

    const result = await runAutopilot(contactId);

    return {
      statusCode: 200,
      body: JSON.stringify({ contactId, result })
    };
  } catch (error: any) {
    console.error("[autopilot-run] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};