import { createClient } from "@supabase/supabase-js";
import { callOpenAI } from "../llm/callOpenAI";
import { executeMCPTool } from "../mcp/executeTool";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// -------------------------------------------------------
// MAIN SDR ORCHESTRATOR
// -------------------------------------------------------
export async function runSDR({
  contactId,
  incomingMessage,
  agentId,
}: {
  contactId: string;
  incomingMessage: string;
  agentId: string;
}) {
  // 1. Load agent metadata
  const { data: agent } = await supabase
    .from("agent_metadata")
    .select("*")
    .eq("id", agentId)
    .single();

  if (!agent) throw new Error("Agent not found");

  // 2. Load selected persona
  const { data: personaLink } = await supabase
    .from("agent_persona_selection")
    .select("*")
    .eq("agent_id", agentId)
    .single();

  const personaId = personaLink?.persona_id;

  let personaPrompt = "";
  if (personaId) {
    const { data: persona } = await supabase
      .from("sdr_personas")
      .select("*")
      .eq("id", personaId)
      .single();
    personaPrompt = persona?.persona_prompt || "";
  }

  // 3. Load contact record
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .single();

  // 4. Load recent activity history
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(5);

  // 5. Load deal context
  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("contact_id", contactId)
    .single();

  // 6. Construct final prompt
  const finalPrompt = `
${personaPrompt}

Role: ${agent.name}
Objectives: ${JSON.stringify(agent.objectives)}
Workflow: ${JSON.stringify(agent.workflow)}

Contact Context:
- Name: ${contact?.name || 'Unknown'}
- Company: ${contact?.company || 'N/A'}
- Email: ${contact?.email || 'N/A'}
- Lead Score: ${contact?.lead_score || 'N/A'}
- Status: ${contact?.status || 'N/A'}

Deal Context:
- Deal Name: ${deal?.deal_name || 'No active deal'}
- Value: ${deal?.value ? `$${deal.value.toLocaleString()}` : 'N/A'}
- Stage: ${deal?.stage || 'N/A'}
- Risk Score: ${deal?.risk_score || 'N/A'}

Recent Activity History:
${activities?.map(a => `- ${a.type}: ${a.message}`).join('\n') || 'No recent activity'}

Incoming Prospect Message:
"${incomingMessage}"

Instructions:
- Respond according to your persona, tone, and role
- Keep the message 4-7 sentences maximum
- Always propose the next specific step
- Reference relevant context from their history
- Use the assigned persona's communication style
- End with a clear call-to-action

Generate the best possible SDR reply:`;

  // 7. Run LLM
  const llmResponse = await callOpenAI(finalPrompt);

  // 8. Save SDR activity
  await executeMCPTool("SmartCRMTools.save_activity", {
    contact_id: contactId,
    type: "SDR_EMAIL_RESPONSE",
    message: `Responded to: "${incomingMessage.substring(0, 100)}..." with: "${llmResponse?.substring(0, 100)}..."`,
  });

  // 9. Update contact status if needed (based on response)
  if (incomingMessage.toLowerCase().includes('demo') || incomingMessage.toLowerCase().includes('meeting')) {
    await executeMCPTool("SmartCRMTools.update_contact_status", {
      contact_id: contactId,
      status: "qualified"
    });
  }

  // 10. Send email using AgentMail
  await executeMCPTool("AgentMail.reply_to_message", {
    message: llmResponse,
    contact_email: contact?.email,
    inbox_id: "smartcrm-main" // This would be configured per contact
  });

  return {
    response: llmResponse,
    agent: agent.name,
    persona: personaId,
    actions_taken: [
      "activity_logged",
      "email_sent",
      ...(incomingMessage.toLowerCase().includes('demo') ? ["status_updated_to_qualified"] : [])
    ]
  };
}

// -------------------------------------------------------
// BATCH SDR PROCESSING
// -------------------------------------------------------
export async function processSDREmailBatch({
  emails,
  defaultAgentId = "sdr_email_primary"
}: {
  emails: Array<{
    from: string;
    subject: string;
    body: string;
    contactId?: string;
  }>;
  defaultAgentId?: string;
}) {
  const results = [];

  for (const email of emails) {
    try {
      // Find or create contact
      let contactId = email.contactId;
      if (!contactId) {
        const { data: existingContact } = await supabase
          .from("contacts")
          .select("id")
          .eq("email", email.from)
          .single();

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          // Create new contact
          const { data: newContact } = await supabase
            .from("contacts")
            .insert({
              email: email.from,
              name: email.from.split('@')[0], // Basic name extraction
              status: "new"
            })
            .select("id")
            .single();

          contactId = newContact.id;
        }
      }

      // Get assigned agent or use default
      const { data: assignment } = await supabase
        .from("contact_agent_assignment")
        .select("agent_id")
        .eq("contact_id", contactId)
        .single();

      const agentId = assignment?.agent_id || defaultAgentId;

      // Process email
      const result = await runSDR({
        contactId,
        incomingMessage: `${email.subject}\n\n${email.body}`,
        agentId
      });

      results.push({
        email: email.from,
        success: true,
        result
      });

    } catch (error) {
      console.error(`Failed to process email from ${email.from}:`, error);
      results.push({
        email: email.from,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}

// -------------------------------------------------------
// SDR AGENT RECOMMENDATION ENGINE
// -------------------------------------------------------
export async function recommendSDRAgent({
  contactId,
  dealStage,
  leadScore,
  recentActivity
}: {
  contactId: string;
  dealStage?: string;
  leadScore?: number;
  recentActivity?: string[];
}) {
  // Simple rule-based recommendation engine
  // In production, this would use ML/AI

  if (dealStage === 'negotiation' || leadScore && leadScore > 80) {
    return 'sdr_handoff_hybrid'; // Prepare for AE handoff
  }

  if (recentActivity?.some(a => a.includes('objection'))) {
    return 'sdr_objection_crusher'; // Handle objections
  }

  if (dealStage === 'new' || !dealStage) {
    return 'sdr_cold_outreach'; // Initial outreach
  }

  if (recentActivity?.length === 0 || recentActivity?.every(a => a.includes('no response'))) {
    return 'sdr_followup'; // Convert silence to conversations
  }

  return 'sdr_email_primary'; // Default conversational SDR
}