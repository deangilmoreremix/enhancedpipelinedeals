// Responses-API based SDR / AE agent builders.
// (Replaces the old openai-agents + AgentMail toolkit setup; AgentMail was removed from the project.)
import { respond, respondWithTools } from "./_openai";

function makeRunner(instructions, tier) {
  return {
    /**
     * Mirrors the previous `runner.run({ agent, messages })` shape.
     * Returns { output, id, model }.
     */
    async run({ messages = [], handlers, tools } = {}) {
      const input = messages.map((m) => ({ role: m.role || "user", content: m.content }));
      const opts = { tier, instructions, input, maxOutputTokens: 1500 };
      const r =
        tools && tools.length && handlers
          ? await respondWithTools({ ...opts, tools, handlers })
          : await respond(opts);
      return { output: r.text, id: r.id, model: r.model };
    },
  };
}

function buildSdrAgent({ agentId, personaId, sequenceLength, step, contact }) {
  const instructions = `You are an AI SDR for SmartCRM called "${agentId}".
Your job is to send step ${step} of a ${sequenceLength}-day outbound campaign.

Persona:
- Style Persona: ${personaId || "friendly"}
- Speak in a natural, human, conversational tone.
- Do NOT sound like a robot.
- Focus on: ${contact?.company || "their business"} and how SmartCRM helps them close more deals.

Rules:
- Keep emails short, clear, and focused on getting a reply.
- Suggest a next step (reply, call, or demo) but don't be pushy.
- DO NOT invent facts about SmartCRM that aren't true. Focus on CRM, AI automations, AI SDR, and pipeline intelligence.`;
  const agent = { name: `SmartCRM SDR - ${agentId}`, instructions };
  return { agent, runner: makeRunner(instructions, "default") };
}

function buildAeAgent({ aeId, personaId, productName }) {
  const instructions = `You are an AI Account Executive (AE) for a product called "${productName || "SmartCRM"}".
Your job is to handle interested leads and move them toward a meeting, demo, or clear next step.

Persona: ${personaId || "trusted_advisor"} - expert, calm, confident, helpful, human.

Rules:
- Acknowledge their interest or question.
- Keep replies concise and specific.
- If they seem ready, propose a clear meeting time-window.
- Answer questions step-by-step. Do NOT invent features.`;
  const agent = { name: `SmartCRM AE - ${aeId || "ae_demo_agent"}`, instructions };
  return { agent, runner: makeRunner(instructions, "default") };
}

export { buildSdrAgent, buildAeAgent };
