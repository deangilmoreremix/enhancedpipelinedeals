import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class BumpMessageSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-bump-message',
      'Bump Message SDR',
      'Polite re-engagement messages for unresponsive prospects with value-driven follow-ups.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are a professional SDR specializing in polite, value-driven re-engagement messages.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Last Contact: ${context.metadata?.lastContact || 'Unknown'}
- Previous Attempts: ${context.metadata?.previousAttempts || 0}

${deal ? `Deal Context:
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Stage: ${deal.stage || 'Unknown'}` : ''}

Your task is to:
1) Craft a polite, value-driven re-engagement message
2) Reference previous conversation without being pushy
3) Offer new value or insight to rekindle interest
4) Keep it brief and professional

Return a JSON object with:
{
  "bump_strategy": {
    "tone": "polite/professional/value-driven",
    "approach": "reference previous conversation/offer new value/ask question",
    "timing_reasoning": "why this timing makes sense"
  },
  "outreach_email": {
    "subject": "Polite re-engagement subject line",
    "body": "Brief, value-driven re-engagement message",
    "value_hook": "specific value proposition offered",
    "call_to_action": "soft ask to re-engage"
  }
}

Focus on being helpful and non-intrusive while providing genuine value!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      const { contact, deal } = await this.loadData(context);

      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      let bumpData;
      try {
        bumpData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      if (!bumpData.outreach_email) {
        throw new Error('AI response missing required email data');
      }

      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: bumpData.outreach_email.subject,
        body: bumpData.outreach_email.body,
      }, context);

      await this.logActivity(contact.id, 'bump_message_sent', deal?.id, {
        bumpData,
        agentMailResult,
        previousAttempts: context.metadata?.previousAttempts || 0,
      });

      return {
        success: true,
        action: 'bump_message_sent',
        message: `Polite re-engagement message sent to ${contact.name}`,
        emailData: {
          to: contact.email,
          subject: bumpData.outreach_email.subject,
          body: bumpData.outreach_email.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          bump_strategy: bumpData.bump_strategy,
          value_hook: bumpData.outreach_email.value_hook,
          call_to_action: bumpData.outreach_email.call_to_action,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'bump_message_failed',
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
        description: `Bump message sent via SDR agent`,
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

export const bumpMessageSDRAgent = new BumpMessageSDRAgent();