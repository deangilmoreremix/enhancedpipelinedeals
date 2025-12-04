#!/usr/bin/env node

import { createServer } from "@modelcontextprotocol/server";
import { PostgrestClient } from "@supabase/postgrest-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = new PostgrestClient(process.env.SUPABASE_URL, {
  headers: {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  },
});

const server = createServer({
  name: "Supabase-MCP",
  version: "1.0.0",
});

// -------------------------
// GENERIC QUERY TOOL
// -------------------------
server.tool("query", {
  description: "Run a SQL-equivalent query on a Supabase table",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" },
      filters: { type: "object" },
    },
    required: ["table"],
  },
  handler: async ({ table, filters }) => {
    let q = supabase.from(table).select("*");

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        q = q.eq(key, value);
      });
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return data;
  },
});

// -------------------------
// INSERT
// -------------------------
server.tool("insert", {
  description: "Insert a row into a Supabase table",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" },
      row: { type: "object" },
    },
    required: ["table", "row"],
  },
  handler: async ({ table, row }) => {
    const { data, error } = await supabase.from(table).insert(row).select();
    if (error) throw new Error(error.message);

    return data;
  },
});

// -------------------------
// UPDATE
// -------------------------
server.tool("update", {
  description: "Update a row in a Supabase table",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" },
      match: { type: "object" },
      values: { type: "object" },
    },
    required: ["table", "match", "values"],
  },
  handler: async ({ table, match, values }) => {
    let q = supabase.from(table).update(values);

    Object.entries(match).forEach(([key, value]) => {
      q = q.eq(key, value);
    });

    const { data, error } = await q.select();
    if (error) throw new Error(error.message);

    return data;
  },
});

// -------------------------
// DELETE
// -------------------------
server.tool("delete", {
  description: "Delete rows from a Supabase table",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" },
      filters: { type: "object" },
    },
    required: ["table", "filters"],
  },
  handler: async ({ table, filters }) => {
    let q = supabase.from(table).delete();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        q = q.eq(key, value);
      });
    }

    const { data, error } = await q.select();
    if (error) throw new Error(error.message);

    return data;
  },
});

// -------------------------
// CRM-SPECIFIC FUNCTIONS
// -------------------------
server.tool("get_contact", {
  description: "Fetch a single SmartCRM contact by ID",
  inputSchema: {
    type: "object",
    properties: {
      contact_id: { type: "string" }
    },
    required: ["contact_id"],
  },
  handler: async ({ contact_id }) => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contact_id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },
});

server.tool("write_score", {
  description: "Write lead score to SmartCRM contacts table",
  inputSchema: {
    type: "object",
    properties: {
      contact_id: { type: "string" },
      score: { type: "number" }
    },
    required: ["contact_id", "score"],
  },
  handler: async ({ contact_id, score }) => {
    const { data, error } = await supabase
      .from("contacts")
      .update({ lead_score: score })
      .eq("id", contact_id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },
});

server.tool("save_activity", {
  description: "Save activity log for a contact",
  inputSchema: {
    type: "object",
    properties: {
      contact_id: { type: "string" },
      type: { type: "string" },
      message: { type: "string" }
    },
    required: ["contact_id", "type", "message"],
  },
  handler: async ({ contact_id, type, message }) => {
    const { data, error } = await supabase
      .from("activities")
      .insert({
        contact_id,
        type,
        message,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) throw new Error(error.message);
    return data;
  },
});

server.tool("fetch_deals", {
  description: "Fetch all deals linked to a contact",
  inputSchema: {
    type: "object",
    properties: {
      contact_id: { type: "string" }
    },
    required: ["contact_id"],
  },
  handler: async ({ contact_id }) => {
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .eq("contact_id", contact_id);

    if (error) throw new Error(error.message);
    return data;
  },
});

// -------------------------
server.start();