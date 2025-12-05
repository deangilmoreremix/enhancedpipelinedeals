import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class ReferralSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-referral',
      'Referral SDR',
      'Request referrals from satisfied contacts and customers to expand network and generate qualified leads.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are a referral specialist SDR who helps satisfied contacts expand their professional networks.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}
- Relationship Status: ${context.metadata?.relationship || 'Unknown'}

Success Context:
- Success Story: ${context.metadata?.successStory || 'Unknown'}
- Satisfaction Level: ${context.metadata?.satisfactionLevel || 'High'}
- Partnership Duration: ${context.metadata?.partnershipDuration || 'Unknown'}

${deal ? `Deal Context:
- Deal Status: ${deal.stage || 'Unknown'}
- Deal Value: $${deal.value?.toLocaleString() || 'Unknown'}` : ''}

Your task is to:
1) Acknowledge their success and satisfaction
2) Explain the value of their professional network
3) Make a specific, easy-to-fulfill referral request
4) Offer incentives or mutual benefit

Return a JSON object with:
{
  "referral_strategy": {
    "relationship_leverage": "how to leverage the existing relationship",
    "network_value": "benefit of expanding their professional network",
    "incentive_structure": "what they gain from successful referrals",
    "ease_of_request": "make the ask simple and low-pressure"
  },
  "outreach_email": {
    "subject": "Referral request subject line",
    "body": "Gracious referral request highlighting mutual benefits",
    "success_acknowledgment": "specific success element referenced",
    "referral_ask": "clear, specific referral request"
  }
}

Be appreciative, professional, and focused on mutual benefit!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      const { contact, deal } = await this.loadData(context);

      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      let referralData;
      try {
        referralData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      if (!referralData.outreach_email) {
        throw new Error('AI response missing required email data');
      }

      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: referralData.outreach_email.subject,
        body: referralData.outreach_email.body,
      }, context);

      await this.logActivity(contact.id, 'referral_request', deal?.id, {
        referralData,
        agentMailResult,
        relationship: context.metadata?.relationship,
        successStory: context.metadata?.successStory,
        satisfactionLevel: context.metadata?.satisfactionLevel,
      });

      return {
        success: true,
        action: 'referral_request',
        message: `Referral request sent to satisfied contact ${contact.name}`,
        emailData: {
          to: contact.email,
          subject: referralData.outreach_email.subject,
          body: referralData.outreach_email.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          referral_strategy: referralData.referral_strategy,
          success_acknowledgment: referralData.outreach_email.success_acknowledgment,
          referral_ask: referralData.outreach_email.referral_ask,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'referral_request_failed',
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
        description: `Referral request campaign via SDR agent`,
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

export const referralSDRAgent = new ReferralSDRAgent();