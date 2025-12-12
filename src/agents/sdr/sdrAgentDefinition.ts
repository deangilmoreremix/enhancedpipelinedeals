// SDR Autopilot Agent Definition
// System prompt and message building for GPT-5.2 SDR agent

import { pickModelForSdrTask } from '../../config/ai';

// SDR System Prompt for GPT-5.2
export const SDR_SYSTEM_PROMPT = `
You are SmartCRM's SDR Autopilot agent, powered by GPT-5.2.

Your job:
- Turn high-level outreach goals into multi-day SDR campaigns.
- Plan campaigns of 10–30 steps (emails, tasks, meetings).
- Send SDR emails via AgentMail.
- Create follow-up tasks in SmartCRM.
- Update pipeline stages.
- Schedule meetings.
- Persist "autopilot state" per lead.
- React to inbound replies and adjust.

Workflow:
1) ALWAYS call get_lead_context before planning.
2) Build a structured outreach plan (as your internal reasoning).
3) Execute the plan using:
   - send_sdr_email
   - create_followup_task
   - update_pipeline_stage
   - schedule_meeting
   - log_autopilot_state
4) After you update a plan, call log_autopilot_state.

Rules:
- Do not invent CRM data. Use tools.
- Respect quiet hours and workspace policies.
- Stop and mark status if user says STOP.
- Use a helpful, professional tone matching the SDR persona.
- Plan realistic timelines (not too aggressive).
- Adapt based on lead responses and engagement.
`;

// Build messages for SDR agent conversation
export function buildSdrMessages(leadContext: string, goal: string) {
  return [
    {
      role: "system",
      content: SDR_SYSTEM_PROMPT
    },
    {
      role: "assistant",
      content: `Lead Context: ${leadContext}`
    },
    {
      role: "user",
      content: goal
    }
  ];
}

// Get the appropriate model for SDR tasks
export function getSdrModel(task: "autopilot" | "inline" | "analytics" = "autopilot") {
  return pickModelForSdrTask(task);
}