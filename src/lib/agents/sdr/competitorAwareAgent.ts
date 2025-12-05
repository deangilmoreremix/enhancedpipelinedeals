import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class CompetitorAwareSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-competitor-aware',
      'Competitor Aware SDR',
      'Analyzes competitive landscape and crafts positioning-focused outreach emails.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are a competitive intelligence SDR specializing in positioning against competitors.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}
- Industry: ${contact?.industry || 'Unknown'}

${deal ? `Deal Context:
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Stage: ${deal.stage || 'Unknown'}
- Current Solution: ${deal.customFields?.current_solution || 'Unknown'}` : ''}

Your task is to:
1) Analyze the competitive landscape for this deal
2) Identify key competitors and positioning opportunities
3) Craft an email that addresses competitive concerns
4) Position your solution as the superior choice

Return a JSON object with:
{
  "competitor_analysis": {
    "primary_competitor": "main competitor name",
    "competitor_weaknesses": ["key weaknesses to exploit"],
    "market_positioning": "how to position against them",
    "differentiation_points": ["unique value propositions"]
  },
  "positioning_strategy": {
    "key_messages": ["3-5 positioning messages"],
    "objection_handling": ["anticipated objections and responses"],
    "social_proof": ["case studies or testimonials to use"]
  },
  "outreach_email": {
    "subject": "Competition-aware subject line",
    "body": "Full email addressing competitive concerns",
    "competitive_angle": "how the email addresses competition",
    "call_to_action": "specific competitive differentiator"
  }
}

Make the competitive analysis sharp and the positioning compelling!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      // Load contact and deal data
      const { contact, deal } = await this.loadData(context);

      if (!deal) {
        throw new Error('Deal context is required for competitor analysis');
      }

      // Generate AI prompt and get completion
      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      // Parse AI response
      let analysisData;
      try {
        analysisData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      // Validate response
      if (!analysisData.competitor_analysis || !analysisData.outreach_email) {
        throw new Error('AI response missing required competitor analysis or email data');
      }

      // Update deal with competitor information
      const competitorUpdates: any = {
        competitor_name: analysisData.competitor_analysis.primary_competitor,
        competitor_analysis: analysisData,
        competitor_positioning: analysisData.positioning_strategy.key_messages.join('. '),
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('deals')
        .update(competitorUpdates)
        .eq('id', deal.id);

      // Send positioning-focused email via AgentMail
      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: analysisData.outreach_email.subject,
        body: analysisData.outreach_email.body,
      }, context);

      // Log activity
      await this.logActivity(contact.id, 'competitor_analysis_completed', deal.id, {
        analysisData,
        agentMailResult,
        competitor_updates: competitorUpdates,
      });

      return {
        success: true,
        action: 'competitor_analysis_result',
        message: `Competitor analysis completed and positioning email sent to ${contact.name}`,
        emailData: {
          to: contact.email,
          subject: analysisData.outreach_email.subject,
          body: analysisData.outreach_email.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal.id,
          competitor_analysis: analysisData.competitor_analysis,
          positioning_strategy: analysisData.positioning_strategy,
          competitive_angle: analysisData.outreach_email.competitive_angle,
          call_to_action: analysisData.outreach_email.call_to_action,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'competitor_analysis_failed',
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
        description: `Competitor analysis and positioning completed via SDR agent`,
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
export const competitorAwareSDRAgent = new CompetitorAwareSDRAgent();