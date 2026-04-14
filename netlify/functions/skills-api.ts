import type { Handler } from "@netlify/functions";
import { sdrAgentRegistry } from "../../src/lib/agents/sdr/registry";
import { getContactAndDeal } from "../../src/lib/autopilot/helpers";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      // List skills
      const skills = Object.values(sdrAgentRegistry).map((s: any) => ({
        id: s.id,
        description: s.description || ""
      }));

      return {
        statusCode: 200,
        body: JSON.stringify({ skills })
      };
    }

    if (event.httpMethod === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      const { skillId, contactId } = body as {
        skillId?: string;
        contactId?: string;
      };

      if (!skillId || !contactId) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "skillId and contactId are required"
          })
        };
      }

      const skill = (sdrAgentRegistry as any)[skillId];
      if (!skill) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Skill not found" })
        };
      }

      const { contact, deal } = await getContactAndDeal(contactId);

      const result = await skill.run({
        contact,
        deal,
        context: {}
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ skillId, contactId, result })
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  } catch (error: any) {
    console.error("[skills-api] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};