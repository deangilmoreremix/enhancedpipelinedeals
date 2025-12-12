// netlify/functions/update-autopilot-settings.js
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
    const { contactId, autopilot_enabled, escalated_to_ae } = body;

    if (!contactId) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "contactId is required" }),
      };
    }

    const update = {
      updated_at: new Date().toISOString(),
    };

    if (typeof autopilot_enabled === "boolean") {
      update.autopilot_enabled = autopilot_enabled;
    }

    if (typeof escalated_to_ae === "boolean") {
      update.escalated_to_ae = escalated_to_ae;
    }

    const { data, error } = await supabase
      .from("contact_agent_settings")
      .update(update)
      .eq("contact_id", contactId)
      .select()
      .single();

    if (error) {
      console.error("[update-autopilot-settings] error:", error);
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Failed to update settings" }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ success: true, settings: data }),
    };
  } catch (err) {
    console.error("[update-autopilot-settings] error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to update settings" }),
    };
  }
};