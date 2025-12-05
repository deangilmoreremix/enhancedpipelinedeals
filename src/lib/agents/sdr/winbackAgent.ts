import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class WinbackSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-winback',
      'Winback SDR',
      'Attempt to win back lost deals with compelling value propositions and updated offerings.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are a winback specialist SDR focusing on recovering lost deals with compelling new value.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}

Lost Deal Context:
- Deal Value: $${deal?.value?.toLocaleString() || 'Unknown'}
- Loss Reason: ${context.metadata?.reasonLost || 'Unknown'}
- Time Since Loss: ${context.metadata?.timeSinceLoss || 'Unknown'}
- Competitor Chosen: ${context.metadata?.competitorChosen || 'Unknown'}

Your task is to:
1) Acknowledge the loss professionally
2) Highlight what's changed/improved since the loss
3) Offer compelling new value or incentives
4) Create urgency around the renewed opportunity

Return a JSON object with:
{
  "winback_strategy": {
    "loss_acknowledgment": "professional acknowledgment of the loss",
    "value_evolution": "what has changed/improved since loss",
    "competitive_advantage": "why now is the right time",
    "incentive_offered": "any special terms or incentives"
  },
  "outreach_email": {
    "subject": "Professional winback subject line",
    "body": "Compelling winback message with new value proposition",
    "key_differentiator": "main reason to reconsider",
    "call_to_action": "specific next step for reconsideration"
  }
}

Focus on being professional, value-driven, and solution-oriented!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      const { contact, deal } = await this.loadData(context);

      if (!deal) {
        throw new Error('Deal context is required for winback campaigns');
      }

      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      let winbackData;
      try {
        winbackData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      if (!winbackData.outreach_email) {
        throw new Error('AI response missing required email data');
      }

      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: winbackData.outreach_email.subject,
        body: winbackData.outreach_email.body,
      }, context);

      await this.logActivity(contact.id, 'winback_attempted', deal.id, {
        winbackData,
        agentMailResult,
        reasonLost: context.metadata?.reasonLost,
        timeSinceLoss: context.metadata?.timeSinceLoss,
        competitorChosen: context.metadata?.competitorChosen,
      });

      return {
        success: true,
        action: 'winback_attempted',
        message: `Winback campaign initiated for lost deal with ${contact.name}`,
        emailData: {
          to: contact.email,
          subject: winbackData.outreach_email.subject,
          body: winbackData.outreach_email.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal.id,
          winback_strategy: winbackData.winback_strategy,
          key_differentiator: winbackData.outreach_email.key_differentiator,
          call_to_action: winbackData.outreach_email.call_to_action,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'winback_failed',
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
        description: `Winback campaign initiated via SDR agent`,
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

export const winbackSDRAgent = new WinbackSDRAgent();