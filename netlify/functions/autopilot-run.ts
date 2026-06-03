import type { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { contactId } = body;

    if (!contactId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "contactId is required" })
      };
    }

    // Forward to trigger-autopilot function
    const triggerResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/trigger-autopilot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contactId })
    });

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text();
      return {
        statusCode: triggerResponse.status,
        body: errorText
      };
    }

    const result = await triggerResponse.json();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        contactId,
        result
      })
    };
  } catch (error: any) {
    console.error("[autopilot-run] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};
