import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class LinkedInSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-linkedin',
      'LinkedIn SDR',
      'LinkedIn outreach management with email follow-ups to connection requests and profile engagement.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are a LinkedIn outreach specialist SDR coordinating social selling with email follow-ups.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}
- LinkedIn Profile: ${context.metadata?.profileInfo || 'Unknown'}

${deal ? `Deal Context:
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Stage: ${deal.stage || 'Unknown'}` : ''}

LinkedIn Context:
- Connection Status: ${context.metadata?.connectionStatus || 'Not connected'}
- Recent Activity: ${context.metadata?.recentActivity || 'Unknown'}
- Shared Connections: ${context.metadata?.sharedConnections || 0}

Your task is to:
1) Craft an email follow-up to LinkedIn outreach
2) Reference the LinkedIn connection/activity
3) Provide value that complements the social interaction
4) Encourage further engagement

Return a JSON object with:
{
  "linkedin_strategy": {
    "connection_context": "reference to LinkedIn interaction",
    "value_add": "additional value beyond LinkedIn connection",
    "engagement_hook": "reason for email follow-up",
    "social_proof": "LinkedIn-based credibility elements"
  },
  "outreach_email": {
    "subject": "LinkedIn follow-up subject line",
    "body": "Email that references LinkedIn interaction with added value",
    "linkedin_reference": "specific LinkedIn element referenced",
    "call_to_action": "next step leveraging social connection"
  }
}

Make it feel natural and socially-driven!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      const { contact, deal } = await this.loadData(context);

      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      let linkedinData;
      try {
        linkedinData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      if (!linkedinData.outreach_email) {
        throw new Error('AI response missing required email data');
      }

      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: linkedinData.outreach_email.subject,
        body: linkedinData.outreach_email.body,
      }, context);

      await this.logActivity(contact.id, 'linkedin_outreach', deal?.id, {
        linkedinData,
        agentMailResult,
        connectionStatus: context.metadata?.connectionStatus,
        profileInfo: context.metadata?.profileInfo,
        sharedConnections: context.metadata?.sharedConnections,
      });

      return {
        success: true,
        action: 'linkedin_outreach',
        message: `LinkedIn follow-up email sent to ${contact.name}`,
        emailData: {
          to: contact.email,
          subject: linkedinData.outreach_email.subject,
          body: linkedinData.outreach_email.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          linkedin_strategy: linkedinData.linkedin_strategy,
          linkedin_reference: linkedinData.outreach_email.linkedin_reference,
          call_to_action: linkedinData.outreach_email.call_to_action,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'linkedin_outreach_failed',
        error: error.message,
        metadata: {
          contactId: context.contactId,
          dealId: context.dealId,
        },
      };
    }
  }

  private async logActivity(contactId: string, activityType: string, dealId?: string, metadata: any = {}): Promise<void> {
    try {
      await supabase.from('activities').insert({
        contact_id: contactId,
        deal_id: dealId,
        type: activityType,
        description: `LinkedIn outreach follow-up via SDR agent`,
        metadata: {
          agent_id: this.agentId,
          ...metadata,
        },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn(`[${this.name}] Failed to log activity:`, error);
    }
  }
}

export const linkedinSDRAgent = new LinkedInSDRAgent();