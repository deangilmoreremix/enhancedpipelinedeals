// netlify/functions/agentmail-webhook.js
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
    const payload = JSON.parse(event.body || "{}");

    // You can inspect AgentMail's exact webhook schema in their docs,
    // but generally you'll get something like:
    // {
    //   type: "message.received",
    //   data: {
    //     message_id,
    //     subject,
    //     text,
    //     html,
    //     from: [{ email, name }],
    //     to: [{ email, name }],
    //     thread_id,
    //     inbox_id,
    //     received_at
    //   }
    // }

    const { type, data } = payload;
    if (!type || !data) {
      console.error("[agentmail-webhook] Invalid payload:", payload);
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Invalid webhook payload" }),
      };
    }

    // Only handle inbound messages for now
    if (type !== "message.received") {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ignored: true, reason: "Unsupported event type" }),
      };
    }

    const fromEmail = data.from?.[0]?.email || null;
    const fromName = data.from?.[0]?.name || "";
    const subject = data.subject || "";
    const text = data.text || "";
    const html = data.html || "";
    const threadId = data.thread_id || null;
    const inboxId = data.inbox_id || null;

    if (!fromEmail) {
      console.error("[agentmail-webhook] Missing from email", data);
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ignored: true, reason: "No from email" }),
      };
    }

    // 1) Find contact by email
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .ilike("email", fromEmail)
      .single();

    if (contactError || !contact) {
      console.error("[agentmail-webhook] No contact for email:", fromEmail, contactError);
      // You *can* create a new contact here if you want.
      await supabase.from("agent_logs").insert({
        level: "warn",
        message: `[agentmail-webhook] Inbound email from unknown contact: ${fromEmail}`,
        contact_id: null,
        meta: { fromEmail, subject, text },
      });

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, unknown_contact: true }),
      };
    }

    const contactId = contact.id;

    // 2) Store inbound email in a log table (create `inbound_emails` if not exists)
    await supabase.from("inbound_emails").insert({
      contact_id: contactId,
      from_email: fromEmail,
      from_name: fromName,
      subject,
      text,
      html,
      thread_id: threadId,
      inbox_id: inboxId,
      received_at: data.received_at || new Date().toISOString(),
    });

    // 3) Log to agent_logs for debugging
    await supabase.from("agent_logs").insert({
      contact_id: contactId,
      level: "info",
      message: `[agentmail-webhook] Inbound reply received from ${fromEmail} - subject: "${subject}"`,
      meta: { inboxId, threadId },
    });

    // 4) Trigger Autopilot follow-up logic internally
    // We call another Netlify function: trigger-autopilot
    const baseUrl = process.env.URL || ""; // Netlify injects this in production
    const internalUrl = `${baseUrl}/.netlify/functions/trigger-autopilot`;

    // If you can't rely on URL env, you can call Supabase function instead
    // or just move the autopilot logic directly here.

    if (internalUrl) {
      try {
        await fetch(internalUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId,
            source: "agentmail-webhook",
            eventType: "inbound_reply",
            inbound: {
              subject,
              text,
              html,
              threadId,
              inboxId,
              fromEmail,
              fromName,
            },
          }),
        });
      } catch (e) {
        console.error("[agentmail-webhook] Failed to call trigger-autopilot:", e);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("[agentmail-webhook] error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Webhook processing failed" }),
    };
  }
};