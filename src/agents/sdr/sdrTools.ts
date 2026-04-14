// SDR Autopilot Tools Specification
// Function tools that GPT-5.2 can call for SDR automation

export const sdrTools = [
  {
    type: "function",
    function: {
      name: "get_lead_context",
      description: "Fetch full CRM data (profile, emails, tasks, deals, notes) for a lead.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "SmartCRM lead ID" }
        },
        required: ["lead_id"]
      }
    }
  },
  {
    type: "function",
    function: {
    }
  },
  {
    type: "function",
    function: {
      name: "create_followup_task",
      description: "Create a follow-up task in SmartCRM for this lead.",
      parameters: {
        type: "object",
        properties: {
          lead_id:     { type: "string" },
          description: { type: "string" },
          due_date:    { type: "string", description: "ISO 8601 date string" }
        },
        required: ["lead_id", "description", "due_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_pipeline_stage",
      description: "Update the deal's pipeline stage and reason.",
      parameters: {
        type: "object",
        properties: {
          deal_id:   { type: "string" },
          new_stage: { type: "string" },
          reason:    { type: "string" }
        },
        required: ["deal_id", "new_stage"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_meeting",
      description: "Book a meeting with the lead on the connected calendar.",
      parameters: {
        type: "object",
        properties: {
          lead_id:  { type: "string" },
          timeslot: { type: "string", description: "Preferred time window or constraints." }
        },
        required: ["lead_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_autopilot_state",
      description: "Store the current SDR Autopilot state for this lead.",
      parameters: {
        type: "object",
        properties: {
          lead_id:   { type: "string" },
          state_json:{ type: "string", description: "Serialized JSON state of plan and progress." }
        },
        required: ["lead_id", "state_json"]
      }
    }
  }
];