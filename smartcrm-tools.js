#!/usr/bin/env node

import { createServer } from "@modelcontextprotocol/server";
import fs from "fs/promises";
import path from "path";

const server = createServer({
  name: "SmartCRM-Tools",
  version: "1.0.0",
});

// -------------------------
// UPDATE CONTACT STATUS
// -------------------------
server.tool("update_contact_status", {
  description: "Update a contact's stage or status in SmartCRM",
  inputSchema: {
    type: "object",
    properties: {
      contact_id: { type: "string" },
      status: { type: "string" }
    },
    required: ["contact_id", "status"]
  },
  handler: async ({ contact_id, status }) => {
    return {
      ok: true,
      message: `Contact ${contact_id} would be updated to status ${status}.`
    };
  }
});

// -------------------------
// CREATE FOLLOW-UP TASK
// -------------------------
server.tool("create_followup", {
  description: "Create a follow-up task for a contact",
  inputSchema: {
    type: "object",
    properties: {
      contact_id: { type: "string" },
      due_date: { type: "string" },
      note: { type: "string" }
    },
    required: ["contact_id", "note"]
  },
  handler: async ({ contact_id, due_date, note }) => {
    return {
      ok: true,
      message: `Follow-up created for contact ${contact_id}`,
      due_date,
      note
    };
  }
});

// -------------------------
// FETCH PRODUCT DOCUMENTS
// -------------------------
server.tool("fetch_product_docs", {
  description: "Load product documentation from SmartCRM product folder",
  inputSchema: {
    type: "object",
    properties: {
      product_slug: { type: "string" }
    },
    required: ["product_slug"]
  },
  handler: async ({ product_slug }) => {
    const filePath = path.join("./docs/products/", `${product_slug}.md`);

    try {
      const content = await fs.readFile(filePath, "utf8");
      return { ok: true, content };
    } catch (e) {
      return { error: "Product docs not found", product_slug };
    }
  }
});

// -------------------------
// TRIGGER JOURNEY EVENT
// -------------------------
server.tool("trigger_event", {
  description: "Trigger an automation event inside SmartCRM Journeys",
  inputSchema: {
    type: "object",
    properties: {
      contact_id: { type: "string" },
      event_name: { type: "string" }
    },
    required: ["contact_id", "event_name"]
  },
  handler: async ({ contact_id, event_name }) => {
    return {
      ok: true,
      message: `Event '${event_name}' triggered for contact ${contact_id}.`
    };
  }
});

// -------------------------
// SCHEDULE STEP FOR JOURNEYS
// -------------------------
server.tool("schedule_step", {
  description: "Schedule a delayed automation step",
  inputSchema: {
    type: "object",
    properties: {
      contact_id: { type: "string" },
      step_name: { type: "string" },
      delay_hours: { type: "number" }
    },
    required: ["contact_id", "step_name"]
  },
  handler: async ({ contact_id, step_name, delay_hours }) => {
    return {
      ok: true,
      message: `Journey step '${step_name}' scheduled for contact ${contact_id}`,
      run_in_hours: delay_hours
    };
  }
});

server.start();