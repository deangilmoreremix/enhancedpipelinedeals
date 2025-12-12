// SDR Autopilot Inbound Email Handler
// Processes replies from AgentMail and resumes SDR campaigns

import { runSdrAutopilot } from './runSdrAutopilot';
import { supabase } from '../../lib/core/supabaseClient';

// HTTP handler for AgentMail inbound webhooks
export async function handleInboundEmail(req: any, res: any) {
  try {
    const { from, to, subject, body_html, message_id } = req.body;

    // Find the lead by sender email
    const { data: lead } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', from)
      .single();

    if (!lead) {
      console.log(`[INBOUND] No lead found for email: ${from}`);
      return res.json({ ok: true, note: 'Lead not found' });
    }

    const leadId = lead.id;

    // Map recipient email to mailbox key
    const mailboxMap: Record<string, string> = {
      'deansales@agentmail.to': 'deansales',
      'sarahsales@agentmail.to': 'sarahsales',
      // Add more mappings as needed
    };

    const mailboxKey = mailboxMap[to] || 'default';

    // Format inbound email for GPT-5.2
    const inboundEmailContext = `
New inbound email from lead:

From: ${from}
To: ${to}
Subject: ${subject}
Message ID: ${message_id}

Body:
${body_html}
    `.trim();

    // Resume SDR Autopilot with the inbound email
    const goal = `Process this inbound reply from the lead and decide next actions:
- If they show interest: Schedule meeting or send follow-up
- If they have questions: Reply with answers
- If they say stop/no: Update status and stop campaign
- If they're not interested: Mark as unqualified
- Always update the autopilot state with your decisions

Inbound Email:
${inboundEmailContext}`;

    console.log(`[INBOUND] Processing reply from ${from} for lead ${leadId}`);

    const result = await runSdrAutopilot({
      leadId,
      goal,
      mailboxKey
    });

    if (result.success) {
      console.log(`[INBOUND] Successfully processed reply for lead ${leadId}`);
    } else {
      console.error(`[INBOUND] Failed to process reply for lead ${leadId}:`, result.error);
    }

    res.json({
      ok: true,
      leadId,
      processed: result.success,
      threadId: result.threadId
    });

  } catch (error) {
    console.error('[INBOUND] Error processing inbound email:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to process inbound email',
      details: (error as Error).message
    });
  }
}

// Helper function to extract lead ID from email context (alternative approach)
export async function findLeadByEmailContext(emailFrom: string, emailTo: string): Promise<string | null> {
  try {
    // Try to find by sender email
    const { data: lead } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', emailFrom)
      .single();

    return lead?.id || null;
  } catch (error) {
    console.error('Error finding lead by email:', error);
    return null;
  }
}