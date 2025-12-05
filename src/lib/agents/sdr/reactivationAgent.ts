import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class ReactivationSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-reactivation',
      'Reactivation SDR',
      'Re-engage dormant prospects with personalized reactivation campaigns based on time since last interaction.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are a reactivation specialist SDR focusing on re-engaging dormant prospects.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Industry: ${contact?.industry || 'Unknown'}
- Time Since Last Contact: ${context.metadata?.timeSince || 'Unknown'}
- Previous Engagement Level: ${context.metadata?.engagementLevel || 'Unknown'}

${deal ? `Deal Context:
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Stage: ${deal.stage || 'Unknown'}
- Last Activity: ${deal.updatedAt || 'Unknown'}` : ''}

Your task is to:
1) Analyze why the prospect went dormant
2) Craft a personalized reactivation message
3) Offer relevant value based on their situation
4) Create urgency without being pushy

Return a JSON object with:
{
  "reactivation_strategy": {
    "dormancy_reason": "inferred reason for going dormant",
    "value_proposition": "what makes this timing right for re-engagement",
    "engagement_hook": "personalized element to spark interest",
    "urgency_factor": "gentle urgency without pressure"
  },
  "outreach_email": {
    "subject": "Thoughtful reactivation subject line",
    "body": "Personalized reactivation message with value",
    "personalization_element": "specific reference to their situation",
    "call_to_action": "soft re-engagement ask"
  }
}

Focus on being genuinely helpful and timing-sensitive!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      const { contact, deal } = await this.loadData(context);

      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      let reactivationData;
      try {
        reactivationData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      if (!reactivationData.outreach_email) {
        throw new Error('AI response missing required email data');
      }

      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: reactivationData.outreach_email.subject,
        body: reactivationData.outreach_email.body,
      }, context);

      await this.logActivity(contact.id, 'reactivation_attempted', deal?.id, {
        reactivationData,
        agentMailResult,
        timeSinceLastContact: context.metadata?.timeSince,
        engagementLevel: context.metadata?.engagementLevel,
      });

      return {
        success: true,
        action: 'reactivation_sent',
        message: `Reactivation campaign initiated for ${contact.name}`,
        emailData: {
          to: contact.email,
          subject: reactivationData.outreach_email.subject,
          body: reactivationData.outreach_email.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          reactivation_strategy: reactivationData.reactivation_strategy,
          personalization_element: reactivationData.outreach_email.personalization_element,
          call_to_action: reactivationData.outreach_email.call_to_action,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'reactivation_failed',
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
        description: `Reactivation campaign initiated via SDR agent`,
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

export const reactivationSDRAgent = new ReactivationSDRAgent();