import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class DataEnrichmentSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-data-enrichment',
      'Data-Enrichment SDR',
      'Enriches contact + deal data (industry, size, pain points) and drafts an outreach email using the enriched context.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    return `You are a B2B data enrichment specialist and SDR strategist.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}
- Current Industry: ${contact?.industry || 'Unknown'}

${deal ? `Deal Context:
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Stage: ${deal.stage || 'Unknown'}
- Description: ${deal.description || 'Unknown'}` : ''}

Your task is to:
1) Infer missing context (industry, company size, role focus, buying power, core pain points) from the data
2) Suggest enrichment fields to store back in the CRM
3) Draft a highly targeted SDR intro email using the enriched profile

Return a JSON object with:
{
  "enriched_profile": {
    "industry": "inferred industry",
    "company_size": "estimated size",
    "role_focus": "role responsibilities",
    "buying_power": "decision making authority",
    "pain_points": ["key challenges"],
    "enrichment_confidence": "high/medium/low"
  },
  "suggested_updates": {
    "industry": "value to update",
    "company_size": "value to update",
    "notes": "additional insights"
  },
  "outreach_email": {
    "subject": "Personalized subject line",
    "body": "Full email body using enriched context",
    "key_value_props": ["3-5 key points"],
    "call_to_action": "Specific next step"
  }
}

Make the enrichment intelligent and the email compelling!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      // Load contact and deal data
      const { contact, deal } = await this.loadData(context);

      // Generate AI prompt and get completion
      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      // Parse AI response
      let enrichmentData;
      try {
        enrichmentData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      // Validate response
      if (!enrichmentData.enriched_profile || !enrichmentData.outreach_email) {
        throw new Error('AI response missing required enrichment or email data');
      }

      // Apply enrichment updates to contact
      const updates: any = {};
      if (enrichmentData.suggested_updates) {
        if (enrichmentData.suggested_updates.industry && !contact.industry) {
          updates.industry = enrichmentData.suggested_updates.industry;
        }
        if (enrichmentData.suggested_updates.company_size) {
          updates.company_size = enrichmentData.suggested_updates.company_size;
        }
        if (enrichmentData.suggested_updates.notes) {
          updates.notes = contact.notes ?
            `${contact.notes}\n\nAI Enrichment: ${enrichmentData.suggested_updates.notes}` :
            `AI Enrichment: ${enrichmentData.suggested_updates.notes}`;
        }
      }

      // Update contact with enrichment data
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('contacts')
          .update(updates)
          .eq('id', contact.id);
      }

      // Send outreach email via AgentMail
      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: enrichmentData.outreach_email.subject,
        body: enrichmentData.outreach_email.body,
      }, context);

      // Log activity
      await this.logActivity(contact.id, 'data_enrichment_completed', deal?.id, {
        enrichmentData,
        agentMailResult,
        updates_applied: Object.keys(updates),
      });

      return {
        success: true,
        action: 'data_enrichment_result',
        message: `Contact profile enriched and outreach email sent to ${contact.name}`,
        emailData: {
          to: contact.email,
          subject: enrichmentData.outreach_email.subject,
          body: enrichmentData.outreach_email.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          enriched_profile: enrichmentData.enriched_profile,
          updates_applied: updates,
          key_value_props: enrichmentData.outreach_email.key_value_props,
          call_to_action: enrichmentData.outreach_email.call_to_action,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'data_enrichment_failed',
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
        description: `Data enrichment and outreach completed via SDR agent`,
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
export const dataEnrichmentSDRAgent = new DataEnrichmentSDRAgent();