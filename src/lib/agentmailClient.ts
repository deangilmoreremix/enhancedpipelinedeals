import { AgentMailClient, AgentMailError } from "agentmail";
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { AgentMailToolkit } from 'agentmail-toolkit';
import { outboundPersonas, OutboundPersonaId } from '../personas/outboundPersonas';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY! });

export const agentmailClient = client;

export async function createInbox(params: any): Promise<any> {
  try {
    return await client.inboxes.create(params);
  } catch (error) {
    if (error instanceof AgentMailError) {
      console.error("Failed to create inbox", error);
    }
    throw error;
  }
}

export async function createWebhook(params: any): Promise<any> {
  try {
    return await client.webhooks.create(params);
  } catch (error) {
    if (error instanceof AgentMailError) {
      console.error("Failed to create webhook", error);
    }
    throw error;
  }
}

export async function replyToMessage({
  inboxId,
  messageId,
  to,
  text
}: {
  inboxId: string;
  messageId: string;
  to: string;
  text: string;
}): Promise<void> {
  try {
    await client.inboxes.messages.reply(inboxId, messageId, { to, text });
  } catch (error) {
    if (error instanceof AgentMailError) {
      console.error("Failed to reply to message", error);
    }
    throw error;
  }
}

// AI-powered email agent using AgentMail toolkit
export async function createEmailAgent({
  systemPrompt,
  userQuery,
  model = 'gpt-4o'
}: {
  systemPrompt: string;
  userQuery: string;
  model?: string;
}) {
  try {
    const toolkit = new AgentMailToolkit(client);

    const result = await streamText({
      model: openai(model),
      system: systemPrompt,
      tools: toolkit.getTools() as any,
      messages: [{
        role: 'user',
        content: userQuery
      }]
    });

    return result;
  } catch (error) {
    console.error("Failed to create email agent", error);
    throw error;
  }
}

// Specialized agent for deal management emails
export async function createDealEmailAgent({
  dealId,
  contactEmail,
  dealContext,
  userQuery,
  personaId
}: {
  dealId: string;
  contactEmail: string;
  dealContext: string;
  userQuery: string;
  personaId?: OutboundPersonaId;
}) {
  const baseSystemPrompt = `You are an intelligent email agent managing deal communications for SmartCRM.

Deal Context: ${dealContext}
Contact Email: ${contactEmail}
Deal ID: ${dealId}

You can:
- Send personalized emails to contacts
- Create and manage email inboxes
- Read and analyze incoming emails
- Schedule follow-ups and meetings
- Update deal status based on email interactions
- Extract insights from email conversations

Always maintain professional communication and focus on moving the deal forward.`;

  // Combine with persona if specified
  const persona = personaId ? outboundPersonas[personaId] : null;
  const systemPrompt = persona
    ? `${persona.systemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  try {
    const result = await createEmailAgent({
      systemPrompt,
      userQuery,
      model: 'gpt-4o'
    });

    return {
      agentType: 'deal-management',
      dealId,
      contactEmail,
      persona: persona?.label,
      systemPrompt,
      userQuery,
      aiResult: result,
      status: 'ai-powered'
    };
  } catch (error) {
    console.log('Deal Email Agent would process:', { systemPrompt, userQuery });

    return {
      agentType: 'deal-management',
      dealId,
      contactEmail,
      persona: persona?.label,
      systemPrompt,
      userQuery,
      status: 'fallback-mode',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Specialized agent for customer support emails
export async function createSupportEmailAgent({
  customerEmail,
  customerContext,
  userQuery,
  personaId
}: {
  customerEmail: string;
  customerContext: string;
  userQuery: string;
  personaId?: OutboundPersonaId;
}) {
  const baseSystemPrompt = `You are a customer support email agent for SmartCRM.

Customer Email: ${customerEmail}
Customer Context: ${customerContext}

You can:
- Send support responses and updates
- Create support ticket inboxes
- Analyze customer inquiries for urgency and type
- Schedule support callbacks
- Provide troubleshooting guidance
- Escalate complex issues appropriately

Always be helpful, empathetic, and focused on resolving customer issues efficiently.`;

  // Combine with persona if specified
  const persona = personaId ? outboundPersonas[personaId] : null;
  const systemPrompt = persona
    ? `${persona.systemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  try {
    const result = await createEmailAgent({
      systemPrompt,
      userQuery,
      model: 'gpt-4o'
    });

    return {
      agentType: 'customer-support',
      customerEmail,
      persona: persona?.label,
      systemPrompt,
      userQuery,
      aiResult: result,
      status: 'ai-powered'
    };
  } catch (error) {
    console.log('Support Email Agent would process:', { systemPrompt, userQuery });

    return {
      agentType: 'customer-support',
      customerEmail,
      persona: persona?.label,
      systemPrompt,
      userQuery,
      status: 'fallback-mode',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Specialized agent for sales qualification emails
export async function createQualificationEmailAgent({
  leadEmail,
  leadContext,
  userQuery,
  personaId
}: {
  leadEmail: string;
  leadContext: string;
  userQuery: string;
  personaId?: OutboundPersonaId;
}) {
  const baseSystemPrompt = `You are a lead qualification email agent for SmartCRM.

Lead Email: ${leadEmail}
Lead Context: ${leadContext}

You can:
- Send qualification questionnaires
- Assess lead quality through email interaction
- Gather budget and timeline information
- Identify decision-makers and stakeholders
- Score leads based on responses
- Nurture leads with relevant content

Focus on gathering key qualification information while building rapport and trust.`;

  // Combine with persona if specified
  const persona = personaId ? outboundPersonas[personaId] : null;
  const systemPrompt = persona
    ? `${persona.systemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  try {
    const result = await createEmailAgent({
      systemPrompt,
      userQuery,
      model: 'gpt-4o'
    });

    return {
      agentType: 'lead-qualification',
      leadEmail,
      persona: persona?.label,
      systemPrompt,
      userQuery,
      aiResult: result,
      status: 'ai-powered'
    };
  } catch (error) {
    console.log('Qualification Email Agent would process:', { systemPrompt, userQuery });

    return {
      agentType: 'lead-qualification',
      leadEmail,
      persona: persona?.label,
      systemPrompt,
      userQuery,
      status: 'fallback-mode',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Operations agent for internal workflows and vendor coordination
export async function createOperationsEmailAgent({
  context,
  userQuery,
  personaId = 'agency_retainer_builder'
}: {
  context: string;
  userQuery: string;
  personaId?: OutboundPersonaId;
}) {
  const baseSystemPrompt = `You are an operations agent that automates internal workflows for SmartCRM.

Context: ${context}

You can:
- Automate vendor onboarding emails and contract negotiations
- Send cross-team coordination updates
- Manage RFP responses and vendor communications
- Handle purchase order confirmations and status updates
- Coordinate internal project communications

Focus on streamlining operations and improving team efficiency.`;

  const persona = outboundPersonas[personaId];
  const systemPrompt = persona
    ? `${persona.systemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  try {
    const result = await createEmailAgent({
      systemPrompt,
      userQuery,
      model: 'gpt-4o'
    });

    return {
      agentType: 'operations',
      persona: persona.label,
      systemPrompt,
      userQuery,
      aiResult: result,
      status: 'ai-powered'
    };
  } catch (error) {
    return {
      agentType: 'operations',
      persona: persona.label,
      systemPrompt,
      userQuery,
      status: 'fallback-mode',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Procurement agent for vendor management and RFP processes
export async function createProcurementEmailAgent({
  vendorEmail,
  procurementContext,
  userQuery,
  personaId = 'software_affiliate_partnership'
}: {
  vendorEmail: string;
  procurementContext: string;
  userQuery: string;
  personaId?: OutboundPersonaId;
}) {
  const baseSystemPrompt = `You are a procurement agent managing vendor relationships for SmartCRM.

Vendor Email: ${vendorEmail}
Procurement Context: ${procurementContext}

You can:
- Automate vendor onboarding sequences
- Send RFP invitations to multiple vendors
- Track and organize RFP responses
- Manage purchase order communications and confirmations
- Handle contract negotiations and renewals

Focus on efficient vendor management and cost optimization.`;

  const persona = outboundPersonas[personaId];
  const systemPrompt = persona
    ? `${persona.systemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  try {
    const result = await createEmailAgent({
      systemPrompt,
      userQuery,
      model: 'gpt-4o'
    });

    return {
      agentType: 'procurement',
      vendorEmail,
      persona: persona.label,
      systemPrompt,
      userQuery,
      aiResult: result,
      status: 'ai-powered'
    };
  } catch (error) {
    return {
      agentType: 'procurement',
      vendorEmail,
      persona: persona.label,
      systemPrompt,
      userQuery,
      status: 'fallback-mode',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Recruiting agent for candidate outreach and coordination
export async function createRecruitingEmailAgent({
  candidateEmail,
  positionContext,
  userQuery,
  personaId = 'influencer_collab_hunter'
}: {
  candidateEmail: string;
  positionContext: string;
  userQuery: string;
  personaId?: OutboundPersonaId;
}) {
  const baseSystemPrompt = `You are a recruiting agent handling candidate communications for SmartCRM.

Candidate Email: ${candidateEmail}
Position Context: ${positionContext}

You can:
- Automate candidate outreach campaigns
- Send interview scheduling confirmations
- Handle candidate questions and negotiations
- Coordinate interview feedback and updates
- Send offer letters and onboarding information

Focus on attracting top talent and providing excellent candidate experience.`;

  const persona = outboundPersonas[personaId];
  const systemPrompt = persona
    ? `${persona.systemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  try {
    const result = await createEmailAgent({
      systemPrompt,
      userQuery,
      model: 'gpt-4o'
    });

    return {
      agentType: 'recruiting',
      candidateEmail,
      persona: persona.label,
      systemPrompt,
      userQuery,
      aiResult: result,
      status: 'ai-powered'
    };
  } catch (error) {
    return {
      agentType: 'recruiting',
      candidateEmail,
      persona: persona.label,
      systemPrompt,
      userQuery,
      status: 'fallback-mode',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ============================================================================
// 🚀 HYPER-INTELLIGENT AGENTS WITH MCP INTEGRATION
// ============================================================================

// Comprehensive agent that combines email, database, business logic, and voice
export async function createOmniChannelAgent({
  contactId,
  context,
  userQuery,
  channels = ['email', 'voice', 'database'],
  personaId
}: {
  contactId: string;
  context: string;
  userQuery: string;
  channels?: ('email' | 'voice' | 'database' | 'automation')[];
  personaId?: OutboundPersonaId;
}) {
  const baseSystemPrompt = `You are an omni-channel AI agent with access to multiple communication and data tools.

Contact ID: ${contactId}
Context: ${context}

Available Channels & Capabilities:
${channels.includes('email') ? '📧 EMAIL: send_message, reply_to_message, create_inbox, list_threads' : ''}
${channels.includes('voice') ? '📞 VOICE: call_start, call_end, say, listen, stream' : ''}
${channels.includes('database') ? '💾 DATABASE: query, insert, update, delete, get_contact, write_score, save_activity, fetch_deals' : ''}
${channels.includes('automation') ? '⚙️ AUTOMATION: update_contact_status, create_followup, trigger_event, schedule_step' : ''}

You can coordinate across all channels to provide seamless customer experiences. Always choose the most appropriate channel for each interaction and maintain context across channels.`;

  const persona = personaId ? outboundPersonas[personaId] : null;
  const systemPrompt = persona
    ? `${persona.systemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  try {
    const result = await createEmailAgent({
      systemPrompt,
      userQuery,
      model: 'gpt-4o'
    });

    return {
      agentType: 'omni-channel',
      contactId,
      channels,
      persona: persona?.label,
      systemPrompt,
      userQuery,
      aiResult: result,
      status: 'ai-powered'
    };
  } catch (error) {
    return {
      agentType: 'omni-channel',
      contactId,
      channels,
      persona: persona?.label,
      systemPrompt,
      userQuery,
      status: 'fallback-mode',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Customer success agent with full CRM integration
export async function createCustomerSuccessAgent({
  contactId,
  userQuery,
  personaId = 'vip_concierge'
}: {
  contactId: string;
  userQuery: string;
  personaId?: OutboundPersonaId;
}) {
  const baseSystemPrompt = `You are a customer success agent with full access to SmartCRM systems.

Contact ID: ${contactId}

Your capabilities include:
📧 EMAIL: Send personalized communications, handle inquiries, schedule meetings
💾 DATABASE: Update contact status, write lead scores, save activities, fetch deal history
⚙️ AUTOMATION: Create follow-ups, trigger journey events, schedule automation steps
📞 VOICE: Make proactive check-in calls, handle support conversations

Focus on:
- Proactive customer engagement
- Reducing churn through personalized attention
- Upselling based on usage and needs
- Coordinating across email, voice, and automation channels

Always maintain detailed activity logs and update contact status appropriately.`;

  const persona = outboundPersonas[personaId];
  const systemPrompt = persona
    ? `${persona.systemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  try {
    const result = await createEmailAgent({
      systemPrompt,
      userQuery,
      model: 'gpt-4o'
    });

    return {
      agentType: 'customer-success',
      contactId,
      persona: persona.label,
      systemPrompt,
      userQuery,
      aiResult: result,
      status: 'ai-powered'
    };
  } catch (error) {
    return {
      agentType: 'customer-success',
      contactId,
      persona: persona.label,
      systemPrompt,
      userQuery,
      status: 'fallback-mode',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Sales development agent with multi-channel outreach
export async function createSalesDevelopmentAgent({
  contactId,
  dealContext,
  userQuery,
  personaId = 'b2b_saas_sdr'
}: {
  contactId: string;
  dealContext: string;
  userQuery: string;
  personaId?: OutboundPersonaId;
}) {
  const baseSystemPrompt = `You are a sales development representative with multi-channel capabilities.

Contact ID: ${contactId}
Deal Context: ${dealContext}

Your toolkit includes:
📧 EMAIL: Personalized outreach, follow-up sequences, meeting booking
📞 VOICE: Cold calls, voicemail drops, conversation qualification
💾 DATABASE: Lead scoring, activity tracking, deal updates
⚙️ AUTOMATION: Sequence management, follow-up scheduling, status updates

Sales Methodology:
- Qualify prospects across multiple touchpoints
- Use data to personalize outreach
- Coordinate email + voice + automation sequences
- Update CRM with every interaction
- Focus on booking qualified meetings

Always log activities and update lead scores based on engagement.`;

  const persona = outboundPersonas[personaId];
  const systemPrompt = persona
    ? `${persona.systemPrompt}\n\n${baseSystemPrompt}`
    : baseSystemPrompt;

  try {
    const result = await createEmailAgent({
      systemPrompt,
      userQuery,
      model: 'gpt-4o'
    });

    return {
      agentType: 'sales-development',
      contactId,
      dealContext,
      persona: persona.label,
      systemPrompt,
      userQuery,
      aiResult: result,
      status: 'ai-powered'
    };
  } catch (error) {
    return {
      agentType: 'sales-development',
      contactId,
      dealContext,
      persona: persona.label,
      systemPrompt,
      userQuery,
      status: 'fallback-mode',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}