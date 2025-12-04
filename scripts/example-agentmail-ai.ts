/**
 * Example usage of AgentMail AI SDK integration with SmartCRM
 * This demonstrates how AI agents can autonomously manage emails
 */

import { createDealEmailAgent, createSupportEmailAgent, createQualificationEmailAgent, createEmailAgent, createOperationsEmailAgent, createProcurementEmailAgent, createRecruitingEmailAgent, createOmniChannelAgent, createCustomerSuccessAgent, createSalesDevelopmentAgent } from '../src/lib/agentmailClient';
import { outboundPersonas } from '../src/personas/outboundPersonas';

// Example 1: Deal Management Agent
async function exampleDealAgent() {
  console.log('🚀 Starting Deal Email Agent Example');

  const result = await createDealEmailAgent({
    dealId: 'deal-123',
    contactEmail: 'prospect@company.com',
    dealContext: 'Enterprise software deal worth $50K, currently in proposal stage',
    userQuery: 'Send a follow-up email to check on the proposal status and schedule a demo'
  });

  console.log('Deal Agent Result:', result);
}

// Example 2: Customer Support Agent
async function exampleSupportAgent() {
  console.log('🛠️ Starting Support Email Agent Example');

  const result = await createSupportEmailAgent({
    customerEmail: 'customer@company.com',
    customerContext: 'Premium customer experiencing login issues',
    userQuery: 'Analyze the customer login issue and provide troubleshooting steps'
  });

  console.log('Support Agent Result:', result);
}

// Example 3: Lead Qualification Agent
async function exampleQualificationAgent() {
  console.log('🎯 Starting Qualification Email Agent Example');

  const result = await createQualificationEmailAgent({
    leadEmail: 'lead@company.com',
    leadContext: 'New lead from website, interested in our product',
    userQuery: 'Send initial qualification questionnaire to assess budget and timeline'
  });

  console.log('Qualification Agent Result:', result);
}

// Example 4: Persona-Enhanced Deal Agent
async function examplePersonaDealAgent() {
  console.log('🚀 Starting Persona-Enhanced Deal Agent Example');

  const result = await createDealEmailAgent({
    dealId: 'deal-123',
    contactEmail: 'prospect@company.com',
    dealContext: 'Enterprise software deal worth $50K, currently in proposal stage',
    userQuery: 'Send a personalized follow-up email that sounds like founder-to-founder outreach',
    personaId: 'cold_saas_founder'
  });

  console.log('Persona Deal Agent Result:', result);
}

// Example 5: Operations Agent with Agency Persona
async function exampleOperationsAgent() {
  console.log('🏢 Starting Operations Agent Example');

  const result = await createOperationsEmailAgent({
    context: 'Managing vendor relationships for CRM automation tools',
    userQuery: 'Send onboarding emails to new automation vendors and coordinate with procurement team',
    personaId: 'agency_retainer_builder'
  });

  console.log('Operations Agent Result:', result);
}

// Example 6: Procurement Agent with Partnership Persona
async function exampleProcurementAgent() {
  console.log('📋 Starting Procurement Agent Example');

  const result = await createProcurementEmailAgent({
    vendorEmail: 'vendor@software.com',
    procurementContext: 'Negotiating enterprise license for AI automation tools',
    userQuery: 'Send RFP response to vendor and discuss partnership terms',
    personaId: 'software_affiliate_partnership'
  });

  console.log('Procurement Agent Result:', result);
}

// Example 7: Recruiting Agent with Influencer Persona
async function exampleRecruitingAgent() {
  console.log('👥 Starting Recruiting Agent Example');

  const result = await createRecruitingEmailAgent({
    candidateEmail: 'talent@developer.com',
    positionContext: 'Senior AI Engineer position with competitive salary',
    userQuery: 'Send initial outreach to candidate and schedule technical interview',
    personaId: 'influencer_collab_hunter'
  });

  console.log('Recruiting Agent Result:', result);
}

// Example 8: Direct AI SDK Usage (when toolkit is fully available)
async function exampleDirectAISDK() {
  console.log('🤖 Starting Direct AI SDK Example');

  try {
    const result = await createEmailAgent({
      systemPrompt: 'You are a sales agent managing customer emails. Use available tools to handle customer inquiries, update deal status, and send appropriate responses.',
      userQuery: 'Customer wants to schedule a demo. Check their availability and send a calendar invite.',
      model: 'gpt-4o'
    });

    console.log('AI SDK Result:', result);
  } catch (error) {
    console.log('AI SDK not fully available yet, but framework is ready:', error instanceof Error ? error.message : String(error));
  }
}

// Example 8: Comprehensive Persona Showcase
async function examplePersonaShowcase() {
  console.log('🎭 Starting Comprehensive Persona Showcase');

  // SaaS Founder Outreach
  console.log('\n--- SaaS Founder Outreach ---');
  try {
    const result1 = await createDealEmailAgent({
      dealId: 'deal-123',
      contactEmail: 'founder@startup.com',
      dealContext: 'Enterprise SaaS deal worth $100K, founder struggling with pipeline visibility',
      userQuery: 'Reach out founder-to-founder about our CRM automation that fixes pipeline visibility issues',
      personaId: 'cold_saas_founder'
    });
    console.log(`✅ SaaS Founder Outreach completed with persona: ${result1.persona}`);
  } catch (error) {
    console.log(`❌ SaaS Founder Outreach failed:`, error instanceof Error ? error.message : String(error));
  }

  // Agency Retainer Builder
  console.log('\n--- Agency Retainer Builder ---');
  try {
    const result2 = await createOperationsEmailAgent({
      context: 'B2B marketing automation services',
      userQuery: 'Pitch monthly retainer services to a manufacturing company struggling with lead generation',
      personaId: 'agency_retainer_builder'
    });
    console.log(`✅ Agency Retainer Builder completed with persona: ${result2.persona}`);
  } catch (error) {
    console.log(`❌ Agency Retainer Builder failed:`, error instanceof Error ? error.message : String(error));
  }

  // High-Ticket Coach Enrollment
  console.log('\n--- High-Ticket Coach Enrollment ---');
  try {
    const result3 = await createQualificationEmailAgent({
      leadEmail: 'ceo@scalingcompany.com',
      leadContext: 'CEO of scaling B2B SaaS company feeling overwhelmed',
      userQuery: 'Start a transformational conversation about leadership and scaling challenges',
      personaId: 'high_ticket_coach'
    });
    console.log(`✅ High-Ticket Coach Enrollment completed with persona: ${result3.persona}`);
  } catch (error) {
    console.log(`❌ High-Ticket Coach Enrollment failed:`, error instanceof Error ? error.message : String(error));
  }
}

// Example 9: Hyper-Intelligent Omni-Channel Agents
async function exampleOmniChannelAgents() {
  console.log('🚀 Starting Hyper-Intelligent Omni-Channel Agent Showcase');

  // Omni-Channel Agent - Full CRM Integration
  console.log('\n--- Omni-Channel Agent ---');
  try {
    const omniResult = await createOmniChannelAgent({
      contactId: 'contact-456',
      context: 'High-value enterprise customer experiencing product issues',
      userQuery: 'Handle customer complaint: login issues, high churn risk. Use all available channels to resolve and retain.',
      channels: ['email', 'voice', 'database', 'automation'],
      personaId: 'vip_concierge'
    });
    console.log(`✅ Omni-Channel Agent activated with persona: ${omniResult.persona}`);
    console.log(`📋 Channels available: ${omniResult.channels.join(', ')}`);
  } catch (error) {
    console.log(`❌ Omni-Channel Agent failed:`, error instanceof Error ? error.message : String(error));
  }

  // Customer Success Agent - Proactive Retention
  console.log('\n--- Customer Success Agent ---');
  try {
    const csResult = await createCustomerSuccessAgent({
      contactId: 'contact-789',
      userQuery: 'Customer usage dropped 40% this month. Analyze their behavior, identify issues, and execute retention campaign using email, database updates, and automation triggers.',
      personaId: 'churn_winback'
    });
    console.log(`✅ Customer Success Agent activated with persona: ${csResult.persona}`);
  } catch (error) {
    console.log(`❌ Customer Success Agent failed:`, error instanceof Error ? error.message : String(error));
  }

  // Sales Development Agent - Multi-Channel Outreach
  console.log('\n--- Sales Development Agent ---');
  try {
    const sdrResult = await createSalesDevelopmentAgent({
      contactId: 'contact-101',
      dealContext: 'B2B SaaS prospect, Director of Operations, budget approved, timeline: next quarter',
      userQuery: 'Execute full sales sequence: email outreach, voice call attempt, CRM updates, and follow-up automation for meeting booking.',
      personaId: 'b2b_saas_sdr'
    });
    console.log(`✅ Sales Development Agent activated with persona: ${sdrResult.persona}`);
  } catch (error) {
    console.log(`❌ Sales Development Agent failed:`, error instanceof Error ? error.message : String(error));
  }
}

// Run examples
async function main() {
  try {
    console.log('🤖 SmartCRM AgentMail AI Integration Examples with Personas\n');

    console.log('🚀 Example 1: Basic Deal Management Agent');
    await exampleDealAgent();
    console.log('');

    console.log('🛠️ Example 2: Customer Support Agent');
    await exampleSupportAgent();
    console.log('');

    console.log('🎯 Example 3: Lead Qualification Agent');
    await exampleQualificationAgent();
    console.log('');

    console.log('🚀 Example 4: Persona-Enhanced Deal Agent (SaaS Founder Style)');
    await examplePersonaDealAgent();
    console.log('');

    console.log('🏢 Example 5: Operations Agent (Agency Retainer Builder)');
    await exampleOperationsAgent();
    console.log('');

    console.log('📋 Example 6: Procurement Agent (Software Partnership)');
    await exampleProcurementAgent();
    console.log('');

    console.log('👥 Example 7: Recruiting Agent (Influencer Collaboration)');
    await exampleRecruitingAgent();
    console.log('');

    console.log('🎭 Example 8: Comprehensive Persona Showcase');
    await examplePersonaShowcase();
    console.log('');

    console.log('🚀 Example 9: Hyper-Intelligent Omni-Channel Agents');
    await exampleOmniChannelAgents();
    console.log('');

    console.log('🤖 Example 10: Direct AI SDK Integration');
    await exampleDirectAISDK();

    console.log('\n✅ All examples completed successfully!');
    console.log('\n💡 Note: Agents now support personas for contextually appropriate communication');
    console.log('🎭 Available personas:', Object.keys(outboundPersonas).join(', '));
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Run if this file is executed directly
main();

export {
  exampleDealAgent,
  exampleSupportAgent,
  exampleQualificationAgent,
  examplePersonaDealAgent,
  exampleOperationsAgent,
  exampleProcurementAgent,
  exampleRecruitingAgent,
  examplePersonaShowcase,
  exampleOmniChannelAgents,
  exampleDirectAISDK
};