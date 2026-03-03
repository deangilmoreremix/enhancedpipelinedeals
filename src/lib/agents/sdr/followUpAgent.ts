import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class FollowUpSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-follow-up',
      'Follow-Up SDR',
      'Sends strategic follow-up emails based on previous interactions, timing, and engagement patterns.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are an expert SDR crafting strategic follow-up emails.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}

${deal ? `Deal Context:
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Stage: ${deal.stage || 'Unknown'}
- Last Activity: ${deal.updatedAt || 'Unknown'}` : ''}

Previous Interactions: ${context.metadata?.previousInteractions || 'None recorded'}

Your task is to create a follow-up email that:
1. References the previous interaction
2. Provides additional value or information
3. Creates urgency or next steps
4. Has a clear call-to-action
5. Is concise and personalized

Return a JSON object with:
{
  "subject": "Strategic follow-up subject line",
  "body": "Full email body with proper formatting",
  "value_add": "What additional value you're providing",
  "urgency_element": "What creates urgency",
  "next_step": "Specific action requested"
}

Make it timely and relevant to move the deal forward!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      // Load contact and deal data
      const { contact, deal } = await this.loadData(context);

      // Get previous interactions
      const previousInteractions = await this.getPreviousInteractions(contact.id, deal?.id);

      // Generate AI prompt and get completion
      const prompt = this.generatePrompt({
        ...context,
        contact,
        deal,
        metadata: { ...context.metadata, previousInteractions }
      });
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

      // Send email (stub - AgentMail removed)
      const emailResult = await this.sendEmail({
        to: contact.email,
        subject: emailData.subject,
        body: emailData.body,
      }, context);

      // Log activity in database
      await this.logActivity(contact.id, 'follow_up_sent', deal?.id, {
        subject: emailData.subject,
        emailResult,
        value_add: emailData.value_add,
        urgency_element: emailData.urgency_element,
        next_step: emailData.next_step,
        previousInteractions: previousInteractions.length,
      });

      return {
        success: true,
        action: 'follow_up_sent',
        message: `Follow-up email prepared for ${contact.name} at ${contact.company}`,
        emailData: {
          to: contact.email,
          subject: emailData.subject,
          body: emailData.body,
        },
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          emailResult,
          value_add: emailData.value_add,
          urgency_element: emailData.urgency_element,
          next_step: emailData.next_step,
          previousInteractionsCount: previousInteractions.length,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'follow_up_failed',
        error: error.message,
        metadata: {
          contactId: context.contactId,
          dealId: context.dealId,
        },
      };
    }
  }

  private async getPreviousInteractions(contactId: string, dealId?: string): Promise<any[]> {
    try {
      let query = supabase
        .from('activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (dealId) {
        query = query.eq('deal_id', dealId);
      }

      const { data, error } = await query;
      return error ? [] : data || [];
    } catch (error) {
      console.warn(`[${this.name}] Failed to get previous interactions:`, error);
      return [];
    }
  }

  private async logActivity(contactId: string, activityType: string, dealId?: string, metadata: any = {}): Promise<void> {
    try {
      await supabase.from('activities').insert({
        contact_id: contactId,
        deal_id: dealId,
        type: activityType,
        description: `Follow-up email sent via SDR agent`,
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
export const followUpSDRAgent = new FollowUpSDRAgent();