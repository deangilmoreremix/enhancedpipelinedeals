import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class WhatsAppSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-whatsapp',
      'WhatsApp SDR',
      'WhatsApp business messaging for high-touch prospects with coordinated email follow-ups.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are a WhatsApp business messaging specialist SDR for high-touch prospect engagement.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Phone: ${contact?.phone || 'Unknown'}
- Mobile Preference: ${context.metadata?.mobilePreference || 'Unknown'}

${deal ? `Deal Context:
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Stage: ${deal.stage || 'Unknown'}
- Urgency: ${deal.customFields?.urgency || 'Standard'}` : ''}

WhatsApp Context:
- Previous WhatsApp Engagement: ${context.metadata?.whatsappHistory || 'None'}
- Response Rate: ${context.metadata?.responseRate || 'Unknown'}
- Time Zone: ${context.metadata?.timeZone || 'Unknown'}

Your task is to:
1) Craft a WhatsApp message for high-touch engagement
2) Coordinate with email campaigns for multi-channel approach
3) Respect mobile preferences and timing
4) Create personal, conversational messaging

Return a JSON object with:
{
  "whatsapp_strategy": {
    "engagement_level": "high-touch/personal/conversational",
    "timing_optimization": "best time for WhatsApp messaging",
    "multi_channel_sync": "how it coordinates with email",
    "conversation_starter": "engaging opening message element"
  },
  "whatsapp_message": {
    "content": "WhatsApp message content (keep under 160 characters)",
    "follow_up_email": "coordinated email subject and body",
    "urgency_level": "timing and priority for sending",
    "fallback_strategy": "what to do if no WhatsApp response"
  }
}

Keep it conversational, personal, and mobile-friendly!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      const { contact, deal } = await this.loadData(context);

      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      let whatsappData;
      try {
        whatsappData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      if (!whatsappData.whatsapp_message) {
        throw new Error('AI response missing required WhatsApp message data');
      }

      // For WhatsApp, we send a coordinated email since WhatsApp API integration would be separate
      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: whatsappData.whatsapp_message.follow_up_email?.subject || 'Following up on our conversation',
        body: whatsappData.whatsapp_message.follow_up_email?.body || whatsappData.whatsapp_message.content,
      }, context);

      await this.logActivity(contact.id, 'whatsapp_message', deal?.id, {
        whatsappData,
        agentMailResult,
        whatsappContent: whatsappData.whatsapp_message.content,
        mobilePreference: context.metadata?.mobilePreference,
        timeZone: context.metadata?.timeZone,
      });

      return {
        success: true,
        action: 'whatsapp_message',
        message: `WhatsApp campaign initiated for ${contact.name} with email coordination`,
        emailData: {
          to: contact.email,
          subject: whatsappData.whatsapp_message.follow_up_email?.subject || 'Following up on our conversation',
          body: whatsappData.whatsapp_message.follow_up_email?.body || whatsappData.whatsapp_message.content,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          whatsapp_strategy: whatsappData.whatsapp_strategy,
          whatsapp_content: whatsappData.whatsapp_message.content,
          urgency_level: whatsappData.whatsapp_message.urgency_level,
          fallback_strategy: whatsappData.whatsapp_message.fallback_strategy,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'whatsapp_message_failed',
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
        description: `WhatsApp business messaging campaign via SDR agent`,
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

export const whatsappSDRAgent = new WhatsAppSDRAgent();