// Production-ready SDR agents with OpenAI Agents SDK and AgentMail integration

// ✅ PRODUCTION-READY AGENTS (5/5)
import { dataEnrichmentSDRAgent } from "./dataEnrichmentAgent";
import { competitorAwareSDRAgent } from "./competitorAwareAgent";
import { coldEmailSDRAgent } from "./coldEmailAgent";
import { followUpSDRAgent } from "./followUpAgent";
import { objectionHandlingSDRAgent } from "./objectionHandlingAgent";

// ✅ PLANNED AGENTS NOW IMPLEMENTED (9/9)
import { bumpMessageSDRAgent } from "./bumpMessageAgent";
import { reactivationSDRAgent } from "./reactivationAgent";
import { winbackSDRAgent } from "./winbackAgent";
import { linkedinSDRAgent } from "./linkedinAgent";
import { whatsappSDRAgent } from "./whatsappAgent";
import { eventBasedSDRAgent } from "./eventBasedAgent";
import { referralSDRAgent } from "./referralAgent";
import { newsletterLeadInSDRAgent } from "./newsletterLeadInAgent";
import { highIntentSDRAgent } from "./highIntentAgent";

export const sdrAgentRegistry: Record<string, any> = {
  // ✅ PRODUCTION-READY AGENTS (5/5)
  "sdr-data-enrichment": dataEnrichmentSDRAgent,
  "sdr-competitor-aware": competitorAwareSDRAgent,
  "sdr-cold-email": coldEmailSDRAgent,
  "sdr-follow-up": followUpSDRAgent,
  "sdr-objection-handling": objectionHandlingSDRAgent,

  // ✅ PLANNED AGENTS NOW IMPLEMENTED (9/9)
  "sdr-bump-message": bumpMessageSDRAgent,
  "sdr-reactivation": reactivationSDRAgent,
  "sdr-winback": winbackSDRAgent,
  "sdr-linkedin": linkedinSDRAgent,
  "sdr-whatsapp": whatsappSDRAgent,
  "sdr-event-based": eventBasedSDRAgent,
  "sdr-referral": referralSDRAgent,
  "sdr-newsletter-lead-in": newsletterLeadInSDRAgent,
  "sdr-high-intent": highIntentSDRAgent,
};