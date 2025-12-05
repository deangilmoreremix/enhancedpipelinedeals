import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class HighIntentSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-high-intent',
      'High-Intent SDR',
      'Handle high-intent prospects with accelerated sales process and priority response sequences.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are a high-intent prospect specialist SDR who accelerates the sales process for qualified, ready-to-buy leads.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}
- Decision Maker Status: ${context.metadata?.decisionMakerStatus || 'Unknown'}

Intent Signals:
- Intent Signals: ${context.metadata?.intentSignals?.join(', ') || 'Unknown'}
- Urgency Level: ${context.metadata?.urgency || 'Unknown'}
- Timeline: ${context.metadata?.timeline || 'Unknown'}
- Budget Indication: ${context.metadata?.budgetIndication || 'Unknown'}

${deal ? `Deal Context:
- Current Stage: ${deal.stage || 'Unknown'}
- Deal Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Competition Level: ${deal.customFields?.competitionLevel || 'Unknown'}` : ''}

Your task is to:
1) Recognize and validate high-intent signals
2) Accelerate the sales process appropriately
3) Provide immediate value and next steps
4) Create urgency without pressure

Return a JSON object with:
{
  "intent_acceleration": {
    "signal_validation": "confirmation of high-intent indicators",
    "process_acceleration": "how to speed up the sales cycle",
    "value_delivery": "immediate value to provide",
    "urgency_balance": "create appropriate urgency without pressure"
  },
  "outreach_email": {
    "subject": "High-intent priority subject line",
    "body": "Accelerated response addressing their specific intent signals",
    "intent_acknowledgment": "specific intent signal referenced",
    "priority_next_step": "accelerated next action for them"
  }
}

Move quickly but professionally - these prospects are ready to engage!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      const { contact, deal } = await this.loadData(context);

      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      let intentData;
      try {
        intentData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      if (!intentData.outreach_email) {
        throw new Error('AI response missing required email data');
      }

      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: intentData.outreach_email.subject,
        body: intentData.outreach_email.body,
      }, context);

      await this.logActivity(contact.id, 'high_intent_response', deal?.id, {
        intentData,
        agentMailResult,
        intentSignals: context.metadata?.intentSignals,
        urgency: context.metadata?.urgency,
        timeline: context.metadata?.timeline,
      });

      return {
        success: true,
        action: 'high_intent_response',
        message: `High-intent priority response sent to ${contact.name}`,
        emailData: {
          to: contact.email,
          subject: intentData.outreach_email.subject,
          body: intentData.outreach_email.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          intent_acceleration: intentData.intent_acceleration,
          intent_acknowledgment: intentData.outreach_email.intent_acknowledgment,
          priority_next_step: intentData.outreach_email.priority_next_step,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'high_intent_response_failed',
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
        description: `High-intent prospect priority response via SDR agent`,
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

export const highIntentSDRAgent = new HighIntentSDRAgent();