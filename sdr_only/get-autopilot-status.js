// netlify/functions/get-autopilot-status.js
const { supabase } = require("./_supabaseClient");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { contactId } = body;

    if (!contactId) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "contactId is required" }),
      };
    }

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Contact not found" }),
      };
    }

    const { data: settings, error: settingsError } = await supabase
      .from("contact_agent_settings")
      .select("*")
      .eq("contact_id", contactId)
      .single();

    if (settingsError) {
      console.warn("[get-autopilot-status] settings error:", settingsError);
    }

    const { data: logs, error: logsError } = await supabase
      .from("agent_logs")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (logsError) {
      console.warn("[get-autopilot-status] logs error:", logsError);
    }

    const lastLog = logs && logs.length > 0 ? logs[0] : null;

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          company: contact.company,
          lead_status: contact.lead_status,
        },
        settings,
        lastLog,
      }),
    };
  } catch (err) {
    console.error("[get-autopilot-status] error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to load autopilot status" }),
    };
  }
};