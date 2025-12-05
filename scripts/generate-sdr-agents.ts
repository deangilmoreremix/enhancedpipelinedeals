#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

interface SDRAgentConfig {
  id: string;
  name: string;
  description: string;
  prompt: string;
  responseFields: string[];
  activityType: string;
  action: string;
}

const sdrAgents: SDRAgentConfig[] = [
  {
    id: 'sdr-bump-message',
    name: 'Bump Message SDR',
    description: 'Sends polite follow-up messages to re-engage prospects who haven\'t responded.',
    prompt: `You are crafting a "bump" message to re-engage a prospect who hasn't responded to previous outreach.

Contact: {contactInfo}
Previous Attempts: {previousAttempts}

Create a short, value-adding message that references previous communication and provides new insight or value.`,
    responseFields: ['subject', 'body', 'value_add', 'reference_point'],
    activityType: 'bump_message_sent',
    action: 'bump_message_sent'
  },
  {
    id: 'sdr-reactivation',
    name: 'Reactivation SDR',
    description: 'Re-engages dormant prospects with personalized reactivation campaigns.',
    prompt: `You are reactivating a dormant prospect who previously showed interest but went quiet.

Contact: {contactInfo}
Last Activity: {lastActivity}
Time Since: {timeSince}

Create a reactivation email that acknowledges the gap, references their previous interest, and reignites the conversation.`,
    responseFields: ['subject', 'body', 'previous_interest', 'new_hook', 'call_to_action'],
    activityType: 'reactivation_sent',
    action: 'reactivation_sent'
  },
  {
    id: 'sdr-winback',
    name: 'Winback SDR',
    description: 'Attempts to win back lost deals with compelling value propositions.',
    prompt: `You are trying to win back a lost deal by addressing previous objections and offering new value.

Contact: {contactInfo}
Previous Deal: {dealInfo}
Reason Lost: {reasonLost}

Create a winback email that acknowledges the loss, addresses concerns, and presents a compelling new proposition.`,
    responseFields: ['subject', 'body', 'objection_addressed', 'new_value', 'incentive'],
    activityType: 'winback_attempted',
    action: 'winback_attempted'
  },
  {
    id: 'sdr-linkedin',
    name: 'LinkedIn SDR',
    description: 'Manages LinkedIn outreach and connection requests with personalized messaging.',
    prompt: `You are crafting a LinkedIn connection request and initial message.

Contact: {contactInfo}
Their Profile: {profileInfo}

Create a personalized connection request and follow-up message that demonstrates research and value.`,
    responseFields: ['connection_message', 'followup_message', 'value_proposition', 'research_points'],
    activityType: 'linkedin_outreach',
    action: 'linkedin_outreach'
  },
  {
    id: 'sdr-whatsapp',
    name: 'WhatsApp SDR',
    description: 'Manages WhatsApp business messaging for immediate, personal communication.',
    prompt: `You are sending a WhatsApp message for immediate, personal communication.

Contact: {contactInfo}
Context: {context}

Create a concise, conversational WhatsApp message that builds rapport and moves the conversation forward.`,
    responseFields: ['message', 'tone', 'purpose', 'followup_plan'],
    activityType: 'whatsapp_message',
    action: 'whatsapp_message'
  },
  {
    id: 'sdr-event-based',
    name: 'Event-Based SDR',
    description: 'Triggers outreach based on prospect events like job changes, funding, or company news.',
    prompt: `You are reaching out based on a trigger event that indicates the prospect might be interested.

Contact: {contactInfo}
Trigger Event: {triggerEvent}
Event Context: {eventContext}

Create timely outreach that references the event and provides relevant value.`,
    responseFields: ['subject', 'body', 'event_reference', 'value_connection', 'timing_reason'],
    activityType: 'event_based_outreach',
    action: 'event_based_outreach'
  },
  {
    id: 'sdr-referral',
    name: 'Referral SDR',
    description: 'Manages referral requests and follow-up with existing contacts.',
    prompt: `You are asking for referrals from satisfied contacts or customers.

Contact: {contactInfo}
Relationship: {relationship}
Success Story: {successStory}

Create a referral request that leverages their satisfaction and provides clear next steps.`,
    responseFields: ['subject', 'body', 'relationship_leverage', 'success_reference', 'ask_structure'],
    activityType: 'referral_request',
    action: 'referral_request'
  },
  {
    id: 'sdr-newsletter-lead-in',
    name: 'Newsletter Lead-In SDR',
    description: 'Converts newsletter subscribers into qualified sales prospects.',
    prompt: `You are converting a newsletter subscriber into a qualified prospect.

Contact: {contactInfo}
Subscription: {subscriptionInfo}
Content Engaged: {engagement}

Create a lead-nurturing email that transitions from content to conversation.`,
    responseFields: ['subject', 'body', 'content_reference', 'transition_strategy', 'qualification_question'],
    activityType: 'newsletter_conversion',
    action: 'newsletter_conversion'
  },
  {
    id: 'sdr-high-intent',
    name: 'High-Intent SDR',
    description: 'Handles prospects showing strong buying signals with accelerated sales process.',
    prompt: `You are responding to a high-intent prospect who shows strong buying signals.

Contact: {contactInfo}
Intent Signals: {intentSignals}
Urgency Indicators: {urgency}

Create an accelerated response that matches their buying readiness and moves them quickly through the process.`,
    responseFields: ['subject', 'body', 'intent_acknowledgment', 'process_acceleration', 'next_meeting'],
    activityType: 'high_intent_response',
    action: 'high_intent_response'
  }
];

function generateSDRAgent(config: SDRAgentConfig): string {
  const responseFieldsStr = config.responseFields.map(field => `"${field}"`).join(', ');

  return `import { BaseSDRAgent, SDRContext, SDRAgentResult } from './base';
import { supabase } from '../../core/supabaseClient';

export class ${config.name.replace(/\s+/g, '')}SDRAgent extends BaseSDRAgent {
  constructor() {
    super(
      '${config.id}',
      '${config.name}',
      '${config.description}'
    );
  }

  protected generatePrompt(context: SDRContext): string {
    const { contact, deal } = context as any;

    const contactInfo = \`- Name: \${contact?.name || 'Unknown'}
- Email: \${contact?.email || 'Unknown'}
- Company: \${contact?.company || 'Unknown'}
- Title: \${contact?.title || 'Unknown'}\`;

    const dealInfo = deal ? \`
Deal Context:
- Value: $\${deal.value?.toLocaleString() || 'Unknown'}
- Stage: \${deal.stage || 'Unknown'}\` : '';

    const prompt = \`${config.prompt}\`
      .replace('{contactInfo}', contactInfo)
      .replace('{dealInfo}', dealInfo)
      .replace('{previousAttempts}', context.metadata?.previousAttempts || 'None')
      .replace('{lastActivity}', context.metadata?.lastActivity || 'Unknown')
      .replace('{timeSince}', context.metadata?.timeSince || 'Unknown')
      .replace('{reasonLost}', context.metadata?.reasonLost || 'Unknown')
      .replace('{profileInfo}', context.metadata?.profileInfo || 'Unknown')
      .replace('{context}', context.metadata?.context || 'General outreach')
      .replace('{triggerEvent}', context.metadata?.triggerEvent || 'Unknown')
      .replace('{eventContext}', context.metadata?.eventContext || 'Unknown')
      .replace('{relationship}', context.metadata?.relationship || 'Unknown')
      .replace('{successStory}', context.metadata?.successStory || 'Unknown')
      .replace('{subscriptionInfo}', context.metadata?.subscriptionInfo || 'Unknown')
      .replace('{engagement}', context.metadata?.engagement || 'Unknown')
      .replace('{intentSignals}', context.metadata?.intentSignals || 'Unknown')
      .replace('{urgency}', context.metadata?.urgency || 'Unknown');

    return prompt + \`

Return a JSON object with:
{
  ${config.responseFields.map(field => `"${field}": ""`).join(',\\n  ')}
}

Make it highly personalized and effective!\`;
  }

  async execute(context: SDRContext): Promise<SDRAgentResult> {
    try {
      // Load contact and deal data
      const { contact, deal } = await this.loadData(context);

      // Generate AI prompt and get completion
      const prompt = this.generatePrompt({ ...context, contact, deal });
      const aiResponse = await this.getCompletion(prompt);

      // Parse AI response
      let responseData;
      try {
        responseData = JSON.parse(aiResponse);
      } catch (parseError) {
        throw new Error(\`Failed to parse AI response: \${aiResponse}\`);
      }

      // Validate response data
      const requiredFields = [${responseFieldsStr}];
      const missingFields = requiredFields.filter(field => !responseData[field]);
      if (missingFields.length > 0) {
        throw new Error(\`AI response missing required fields: \${missingFields.join(', ')}\`);
      }

      // Send communication via AgentMail (email for most, but could be adapted)
      let agentMailResult = null;
      if (responseData.subject && responseData.body) {
        agentMailResult = await this.sendEmail({
          to: contact.email,
          subject: responseData.subject,
          body: responseData.body,
        }, context);
      }

      // Log activity in database
      await this.logActivity(contact.id, '${config.activityType}', deal?.id, {
        agentMailResult,
        responseData,
      });

      return {
        success: true,
        action: '${config.action}',
        message: \`${config.name} communication sent to \${contact.name} at \${contact.company}\`,
        emailData: responseData.subject && responseData.body ? {
          to: contact.email,
          subject: responseData.subject,
          body: responseData.body,
        } : undefined,
        agentMailResult,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id,
          ...responseData,
        },
      };

    } catch (error: any) {
      return {
        success: false,
        action: '${config.action.replace('_sent', '_failed').replace('_attempted', '_failed')}',
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
        description: \`${config.name} communication sent via SDR agent\`,
        metadata: {
          agent_id: this.agentId,
          ...metadata,
        },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      // Log but don't fail the main operation
      console.warn(\`[\${this.name}] Failed to log activity:\`, error);
    }
  }
}

// Export instance for registry
export const ${config.name.replace(/\s+/g, '').toLowerCase()}SDRAgent = new ${config.name.replace(/\s+/g, '')}SDRAgent();
`;
}

function generateRegistryUpdate(): string {
  const imports = sdrAgents.map(agent =>
    `import { ${agent.name.replace(/\s+/g, '').toLowerCase()}SDRAgent } from "./${agent.name.replace(/\s+/g, '').toLowerCase()}Agent";`
  ).join('\n');

  const registryEntries = sdrAgents.map(agent =>
    `  "${agent.id}": ${agent.name.replace(/\s+/g, '').toLowerCase()}SDRAgent,`
  ).join('\n');

  return `${imports}

export const sdrAgentRegistry: Record<string, any> = {
  // Existing agents
  "sdr-cold-email": coldEmailSDRAgent,
  "sdr-follow-up": followUpSDRAgent,
  "sdr-objection-handling": objectionHandlingSDRAgent,
  "sdr-data-enrichment": dataEnrichmentSDRAgent,
  "sdr-competitor-aware": competitorAwareSDRAgent,

  // Generated agents
${registryEntries}
};`;
}

// Generate all agent files
console.log('Generating SDR agents...');

for (const config of sdrAgents) {
  const fileName = `${config.name.replace(/\s+/g, '').toLowerCase()}Agent.ts`;
  const filePath = path.join(__dirname, '..', 'src', 'lib', 'agents', 'sdr', fileName);

  const content = generateSDRAgent(config);
  fs.writeFileSync(filePath, content);
  console.log(`✅ Generated ${fileName}`);
}

// Update registry
const registryPath = path.join(__dirname, '..', 'src', 'lib', 'agents', 'sdr', 'registry.ts');
const registryContent = generateRegistryUpdate();
fs.writeFileSync(registryPath, registryContent);
console.log('✅ Updated registry.ts');

console.log('\\n🎉 All SDR agents generated successfully!');
console.log('📊 Generated agents:', sdrAgents.length);
console.log('📁 Files created in: src/lib/agents/sdr/');