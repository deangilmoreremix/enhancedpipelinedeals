import type { Handler } from "@netlify/functions";
import { SPECIALISTS, runSpecialistOnce } from "./_sdrAgents";
import { authorize, json } from "./_openai";
import { superpowersSkillRegistry } from "../../skills/registry";

export const handler: Handler = async (event) => {
  try {
    if (!(await authorize(event.headers.authorization || event.headers.Authorization))) return json(401, { error: "Unauthorized" });
    if (event.httpMethod === "GET") {
      // List skills - combine SDR agents and superpowers skills
      const sdrSkills = SPECIALISTS.map((s) => ({
        id: s.id,
        description: s.description,
        category: "sdr"
      }));

      const superpowerSkills = Object.values(superpowersSkillRegistry).map((s: any) => ({
        id: s.id,
        description: s.description,
        category: s.category
      }));

      const skills = [...sdrSkills, ...superpowerSkills];

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

      // SDR agents run server-side with the OpenAI Agents SDK
      if (SPECIALISTS.some((a) => a.id === skillId)) {
        const result = await runSpecialistOnce(skillId, contactId, body.goal);
        return {
          statusCode: 200,
          body: JSON.stringify({ skillId, contactId, result })
        };
      }

      // Check superpowers skills
      let skill: any;
      skill = superpowersSkillRegistry[skillId];
      if (skill) {
        // Superpowers skill - workflow guidance
        const result = await skill.run({
          contactId,
          context: body.context || {}
        });

        return {
          statusCode: 200,
          body: JSON.stringify({ skillId, contactId, result })
        };
      }

      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Skill not found" })
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