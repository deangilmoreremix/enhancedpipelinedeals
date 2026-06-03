import type { Handler } from "@netlify/functions";
import { sdrAgentRegistry, sdrAgentMetadataRegistry } from "../../src/lib/agents/sdr/registry";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const action = body.action || 'run'; // 'run', 'batch', 'metadata'

    switch (action) {
      case 'run': {
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
            result,
            timestamp: new Date().toISOString()
          })
        };
      }

      case 'batch': {
        const agentIds = body.agentIds as string[] | undefined;
        const contactId = body.contactId as string | undefined;
        const dealId = body.dealId as string | undefined;
        const extraContext = body.context || {};

        if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "agentIds array is required and must not be empty" })
          };
        }

        if (!contactId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "contactId is required" })
          };
        }

        const results = [];
        const errors = [];

        for (const agentId of agentIds) {
          try {
            const agent = sdrAgentRegistry[agentId];
            if (!agent) {
              errors.push({ agentId, error: `Unknown SDR agent: ${agentId}` });
              continue;
            }

            const result = await agent.run({
              contactId,
              dealId,
              context: extraContext
            });

            results.push({
              agentId,
              contactId,
              dealId: dealId || null,
              result,
              timestamp: new Date().toISOString(),
              success: true
            });
          } catch (error: any) {
            console.error(`[sdr-run] Error running agent ${agentId}:`, error);
            errors.push({
              agentId,
              error: error.message || "Internal Server Error",
              timestamp: new Date().toISOString()
            });
          }
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            results,
            errors,
            summary: {
              total: agentIds.length,
              successful: results.length,
              failed: errors.length
            }
          })
        };
      }

      case 'metadata': {
        // Return agent metadata for the hub
        const metadata = sdrAgentMetadataRegistry.map(({ agent, ...meta }) => meta);

        return {
          statusCode: 200,
          body: JSON.stringify({
            agents: metadata,
            categories: [...new Set(metadata.map(m => m.category))].sort(),
            total: metadata.length
          })
        };
      }

      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Unknown action: ${action}` })
        };
    }
  } catch (error: any) {
    console.error("[sdr-run] Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};