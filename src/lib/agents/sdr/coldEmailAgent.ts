import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class ColdEmailSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-cold-email',
      'Cold Email SDR',
      'Sends personalized cold outreach emails to prospects with compelling value propositions and clear calls-to-action.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are an expert SDR crafting compelling cold outreach emails.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}
- Industry: ${contact?.industry || 'Unknown'}

${deal ? `Deal Context:
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Stage: ${deal.stage || 'Unknown'}
- Description: ${deal.description || 'Unknown'}` : ''}

Your task is to create a personalized cold email that:
1. Grabs attention with a compelling hook
2. Demonstrates value and relevance
3. Includes social proof or data
4. Has a clear, specific call-to-action
5. Is concise (under 150 words)

Return a JSON object with:
{
  "subject": "Compelling subject line",
  "body": "Full email body with proper formatting",
  "key_points": ["3-5 key points covered"],
  "call_to_action": "Specific action requested"
}

Make it highly personalized and compelling!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      // Load contact and deal data
      const { contact, deal } = await this.loadData(context);

      // Generate AI prompt and get completion
      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      // Parse AI response
      let emailData;
      try {
        emailData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      // Validate email data
      if (!emailData.subject || !emailData.body) {
        throw new Error('AI response missing required email fields');
      }

      // Send email via AgentMail
      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: emailData.subject,
        body: emailData.body,
      }, context);

      // Log activity in database
      await this.logActivity(contact.id, 'cold_email_sent', deal?.id, {
        subject: emailData.subject,
        agentMailResult,
        key_points: emailData.key_points,
        call_to_action: emailData.call_to_action,
      });

      return {
        success: true,
        action: 'cold_email_sent',
        message: `Cold email sent to ${contact.name} at ${contact.company}`,
        emailData: {
          to: contact.email,
          subject: emailData.subject,
          body: emailData.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          key_points: emailData.key_points,
          call_to_action: emailData.call_to_action,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'cold_email_failed',
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
        description: `Cold email sent via SDR agent`,
        metadata: {
          agent_id: this.agentId,
          ...metadata,
        },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      // Log but don't fail the main operation
      console.warn(`[${this.name}] Failed to log activity:`, error);
    }
  }
}

// Export instance for registry
export const coldEmailSDRAgent = new ColdEmailSDRAgent();