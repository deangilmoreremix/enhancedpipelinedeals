import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class EventBasedSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-event-based',
      'Event-Based SDR',
      'Trigger timely outreach based on company events like funding announcements, hires, or product launches.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are an event-driven SDR specialist who capitalizes on timely company news and developments.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Industry: ${contact?.industry || 'Unknown'}

Event Context:
- Trigger Event: ${context.metadata?.triggerEvent || 'Unknown'}
- Event Details: ${context.metadata?.eventContext || 'Unknown'}
- Event Date: ${context.metadata?.eventDate || 'Recent'}
- Event Impact: ${context.metadata?.eventImpact || 'Unknown'}

${deal ? `Deal Context:
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Stage: ${deal.stage || 'Unknown'}
- Current Status: ${deal.customFields?.status || 'Active'}` : ''}

Your task is to:
1) Reference the specific company event
2) Connect the event to your solution's value
3) Time the outreach for maximum relevance
4) Show genuine interest in their success

Return a JSON object with:
{
  "event_strategy": {
    "event_relevance": "why this event matters for outreach timing",
    "value_connection": "how your solution relates to the event",
    "timing_optimization": "why now is the perfect moment",
    "congratulatory_tone": "balance celebration with business value"
  },
  "outreach_email": {
    "subject": "Timely event-based subject line",
    "body": "Congratulatory message connecting event to your value proposition",
    "event_reference": "specific event element referenced",
    "call_to_action": "relevant next step tied to the event"
  }
}

Be timely, relevant, and genuinely interested in their success!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      const { contact, deal } = await this.loadData(context);

      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      let eventData;
      try {
        eventData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      if (!eventData.outreach_email) {
        throw new Error('AI response missing required email data');
      }

      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: eventData.outreach_email.subject,
        body: eventData.outreach_email.body,
      }, context);

      await this.logActivity(contact.id, 'event_based_outreach', deal?.id, {
        eventData,
        agentMailResult,
        triggerEvent: context.metadata?.triggerEvent,
        eventContext: context.metadata?.eventContext,
        eventDate: context.metadata?.eventDate,
        eventImpact: context.metadata?.eventImpact,
      });

      return {
        success: true,
        action: 'event_based_outreach',
        message: `Event-based outreach sent to ${contact.name} regarding ${context.metadata?.triggerEvent}`,
        emailData: {
          to: contact.email,
          subject: eventData.outreach_email.subject,
          body: eventData.outreach_email.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          event_strategy: eventData.event_strategy,
          event_reference: eventData.outreach_email.event_reference,
          call_to_action: eventData.outreach_email.call_to_action,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'event_based_outreach_failed',
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
        description: `Event-based outreach triggered via SDR agent`,
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

export const eventBasedSDRAgent = new EventBasedSDRAgent();