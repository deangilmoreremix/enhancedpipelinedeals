import type { Handler } from "@netlify/functions";
import { scheduleMeeting } from "../../lib/calendar";

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
    const datetime = body.datetime as string | undefined;

    if (!contactId || !datetime) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "contactId and datetime (ISO string) are required"
        })
      };
    }

    const eventRecord = await scheduleMeeting(contactId, datetime);

    return {
      statusCode: 200,
      body: JSON.stringify({ event: eventRecord })
    };
  } catch (error: any) {
    console.error("[calendar-schedule] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};