import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class NewsletterLeadInSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-newsletter-lead-in',
      'Newsletter Lead-In SDR',
      'Convert newsletter subscribers to qualified prospects through personalized lead nurturing sequences.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are a newsletter conversion specialist SDR who turns passive subscribers into active prospects.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}

Newsletter Context:
- Subscription Duration: ${context.metadata?.subscriptionInfo || 'Unknown'}
- Engagement Level: ${context.metadata?.engagement || 'Unknown'}
- Content Interests: ${context.metadata?.contentInterests || 'Unknown'}
- Open Rate: ${context.metadata?.openRate || 'Unknown'}

${deal ? `Existing Deal Context:
- Deal Status: ${deal.stage || 'None'}
- Deal Value: $${deal.value?.toLocaleString() || 'N/A'}` : ''}

Your task is to:
1) Reference their newsletter engagement positively
2) Transition from educational content to solution discussion
3) Identify specific pain points they might be facing
4) Offer personalized value beyond the newsletter

Return a JSON object with:
{
  "conversion_strategy": {
    "engagement_leverage": "how to use their newsletter activity",
    "pain_point_identification": "specific challenges they might face",
    "value_transition": "moving from education to solution",
    "personalization_depth": "how deep to personalize the approach"
  },
  "outreach_email": {
    "subject": "Newsletter conversion subject line",
    "body": "Personalized message transitioning from subscriber to prospect",
    "engagement_reference": "specific newsletter element referenced",
    "value_proposition": "personalized solution offer"
  }
}

Be appreciative of their engagement and naturally transition to business discussion!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      const { contact, deal } = await this.loadData(context);

      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      let newsletterData;
      try {
        newsletterData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      if (!newsletterData.outreach_email) {
        throw new Error('AI response missing required email data');
      }

      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: newsletterData.outreach_email.subject,
        body: newsletterData.outreach_email.body,
      }, context);

      await this.logActivity(contact.id, 'newsletter_conversion', deal?.id, {
        newsletterData,
        agentMailResult,
        subscriptionInfo: context.metadata?.subscriptionInfo,
        engagement: context.metadata?.engagement,
        contentInterests: context.metadata?.contentInterests,
      });

      return {
        success: true,
        action: 'newsletter_conversion',
        message: `Newsletter conversion campaign initiated for ${contact.name}`,
        emailData: {
          to: contact.email,
          subject: newsletterData.outreach_email.subject,
          body: newsletterData.outreach_email.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          conversion_strategy: newsletterData.conversion_strategy,
          engagement_reference: newsletterData.outreach_email.engagement_reference,
          value_proposition: newsletterData.outreach_email.value_proposition,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'newsletter_conversion_failed',
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
        description: `Newsletter subscriber conversion via SDR agent`,
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

export const newsletterLeadInSDRAgent = new NewsletterLeadInSDRAgent();