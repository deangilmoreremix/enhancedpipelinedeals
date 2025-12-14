import type { Handler } from "@netlify/functions";
import { determineMood } from "../../../src/lib/mood/determineMood";
import { getContactAndDeal } from "../../../src/lib/autopilot/helpers";

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

    const { contact, deal } = await getContactAndDeal(contactId);
    const mood = determineMood(contact, deal);

    return {
      statusCode: 200,
      body: JSON.stringify({ contactId, mood, contact, deal })
    };
  } catch (error: any) {
    console.error("[mood-preview] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};