// Production-ready SDR agents with OpenAI Agents SDK and AgentMail integration

// ✅ PRODUCTION-READY AGENTS
import { dataEnrichmentSDRAgent } from "./dataEnrichmentAgent";
import { competitorAwareSDRAgent } from "./competitorAwareAgent";

// 🚧 WORK IN PROGRESS - Need to implement these agents
// import { coldEmailSDRAgent } from "./coldEmailAgent";
// import { followUpSDRAgent } from "./followUpAgent";
// import { objectionHandlingSDRAgent } from "./objectionHandlingAgent";
// TODO: Implement remaining agents with same pattern

export const sdrAgentRegistry: Record<string, any> = {
  // ✅ PRODUCTION-READY AGENTS
  "sdr-data-enrichment": dataEnrichmentSDRAgent,
  "sdr-competitor-aware": competitorAwareSDRAgent,

  // 🚧 TODO: Implement these agents using BaseSDRAgent pattern
  // "sdr-cold-email": coldEmailSDRAgent,
  // "sdr-follow-up": followUpSDRAgent,
  // "sdr-objection-handling": objectionHandlingSDRAgent,
  // "sdr-bump-message": bumpMessageSDRAgent,
  // "sdr-reactivation": reactivationSDRAgent,
  // "sdr-winback": winbackSDRAgent,
  // "sdr-linkedin": linkedinSDRAgent,
  // "sdr-whatsapp": whatsappSDRAgent,
  // "sdr-event-based": eventBasedSDRAgent,
  // "sdr-referral": referralSDRAgent,
  // "sdr-newsletter-lead-in": newsletterLeadInSDRAgent,
  // "sdr-high-intent": highIntentSDRAgent,
};