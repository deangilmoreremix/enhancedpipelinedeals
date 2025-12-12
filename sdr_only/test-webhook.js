// netlify/functions/test-webhook.js
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
    const { contactId, messageType = "positive_reply", customPayload } = body;

    if (!contactId) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "contactId is required" }),
      };
    }

    // Get contact info
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

    // Create test webhook payload based on message type
    let testPayload;

    if (customPayload) {
      testPayload = customPayload;
    } else {
      const basePayload = {
        type: "message.received",
        data: {
          message_id: `test_${Date.now()}`,
          subject: "Re: Quick question about your sales pipeline",
          from: [{ email: contact.email, name: contact.name || "Test User" }],
          to: [{ email: "sdr@yourcompany.com", name: "SDR Team" }],
          thread_id: `thread_${Date.now()}`,
          inbox_id: "inbox_123",
          received_at: new Date().toISOString(),
        }
      };

      // Customize message based on type
      switch (messageType) {
        case "positive_reply":
          basePayload.data.text = "Hi there, thanks for reaching out. I'd love to learn more about how SmartCRM can help our sales team. When would be a good time for a quick demo?";
          basePayload.data.html = "<p>Hi there, thanks for reaching out. I'd love to learn more about how SmartCRM can help our sales team. When would be a good time for a quick demo?</p>";
          break;
        case "positive_meeting":
          basePayload.data.text = "That sounds interesting! Can we schedule a demo next Tuesday at 2 PM?";
          basePayload.data.html = "<p>That sounds interesting! Can we schedule a demo next Tuesday at 2 PM?</p>";
          break;
        case "not_interested":
          basePayload.data.text = "Thanks for the info, but we're not looking for new CRM solutions right now.";
          basePayload.data.html = "<p>Thanks for the info, but we're not looking for new CRM solutions right now.</p>";
          break;
        case "unsubscribe":
          basePayload.data.text = "Please remove me from your email list. I don't want to receive these messages.";
          basePayload.data.html = "<p>Please remove me from your email list. I don't want to receive these messages.</p>";
          break;
        case "out_of_office":
          basePayload.data.text = "I'm currently out of office and will return next Monday. For urgent matters, please contact my colleague at colleague@company.com.";
          basePayload.data.html = "<p>I'm currently out of office and will return next Monday. For urgent matters, please contact my colleague at colleague@company.com.</p>";
          break;
        default:
          basePayload.data.text = "Thanks for your email. I'll review this and get back to you.";
          basePayload.data.html = "<p>Thanks for your email. I'll review this and get back to you.</p>";
      }

      testPayload = basePayload;
    }

    // Call the actual webhook handler
    const webhookUrl = `${process.env.URL || "https://contacts.smartcrm.vip"}/.netlify/functions/agentmail-webhook`;

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });

    const webhookResult = await webhookResponse.json();

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        testPayload,
        webhookResponse: {
          status: webhookResponse.status,
          result: webhookResult,
        },
        message: `Test webhook sent for contact ${contact.name} (${contact.email}) with message type: ${messageType}`,
      }),
    };
  } catch (err) {
    console.error("[test-webhook] error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Test webhook failed", details: err.message }),
    };
  }
};