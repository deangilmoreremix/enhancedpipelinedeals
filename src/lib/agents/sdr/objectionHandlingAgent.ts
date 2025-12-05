import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class ObjectionHandlingSDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      'sdr-objection-handling',
      'Objection Handling SDR',
      'Addresses prospect objections with empathetic, value-focused responses that overcome concerns.'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;
    const objection = context.metadata?.objection || 'General pricing concerns';

    return `You are an expert SDR handling prospect objections professionally.

Contact Information:
- Name: ${contact?.name || 'Unknown'}
- Email: ${contact?.email || 'Unknown'}
- Company: ${contact?.company || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}

${deal ? `Deal Context:
- Value: $${deal.value?.toLocaleString() || 'Unknown'}
- Stage: ${deal.stage || 'Unknown'}` : ''}

Objection Raised: "${objection}"

Your task is to create an objection-handling email that:
1. Acknowledges the concern empathetically
2. Provides evidence-based responses
3. Offers alternatives or compromises
4. Includes social proof or case studies
5. Ends with a clear next step

Return a JSON object with:
{
  "subject": "Professional objection-handling subject",
  "body": "Full email addressing the objection",
  "key_points": ["3-5 key response points"],
  "evidence_provided": ["Case studies, testimonials, data points"],
  "alternative_offered": "What compromise or alternative you're suggesting",
  "next_step": "Specific action to move forward"
}

Be empathetic, professional, and focused on value!`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      // Load contact and deal data
      const { contact, deal } = await this.loadData(context);

      const objection = context.metadata?.objection;
      if (!objection) {
        throw new Error('Objection text is required in metadata.objection');
      }

      // Generate AI prompt and get completion
      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      // Parse AI response
      let emailData;
      try {
        emailData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(`Failed to parse AI response: ${aiResponse}`);
      }

      // Validate email data
      if (!emailData.subject || !emailData.body) {
        throw new Error('AI response missing required email fields');
      }

      // Send email via AgentMail
      const agentMailResult = await this.sendEmail({
        to: contact.email,
        subject: emailData.subject,
        body: emailData.body,
      }, context);

      // Log activity in database
      await this.logActivity(contact.id, 'objection_handled', deal?.id, {
        subject: emailData.subject,
        agentMailResult,
        objection: objection,
        key_points: emailData.key_points,
        evidence_provided: emailData.evidence_provided,
        alternative_offered: emailData.alternative_offered,
        next_step: emailData.next_step,
      });

      return {
        success: true,
        action: 'objection_handled',
        message: `Objection-handling email sent to ${contact.name} addressing: "${objection}"`,
        emailData: {
          to: contact.email,
          subject: emailData.subject,
          body: emailData.body,
        },
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          objection: objection,
          key_points: emailData.key_points,
          evidence_provided: emailData.evidence_provided,
          alternative_offered: emailData.alternative_offered,
          next_step: emailData.next_step,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: 'objection_handling_failed',
        error: error.message,
        metadata: {
          contactId: context.contactId,
          dealId: context.dealId,
          objection: context.metadata?.objection,
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
        description: `Objection-handling email sent via SDR agent`,
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
export const objectionHandlingSDRAgent = new ObjectionHandlingSDRAgent();