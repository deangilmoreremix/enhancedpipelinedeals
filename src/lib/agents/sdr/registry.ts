// Import previously-created SDR agents (names here are examples; match your real file names)
import { coldEmailSDRAgent } from "./coldEmailAgent";
import { followUpSDRAgent } from "./followUpAgent";
import { objectionHandlingSDRAgent } from "./objectionHandlingAgent";
import { bumpMessageSDRAgent } from "./bumpMessageAgent";
import { reactivationSDRAgent } from "./reactivationAgent";
import { winbackSDRAgent } from "./winbackAgent";
import { linkedinSDRAgent } from "./linkedinAgent";
import { whatsappSDRAgent } from "./whatsappAgent";
import { eventBasedSDRAgent } from "./eventBasedAgent";
import { referralSDRAgent } from "./referralAgent";
import { newsletterLeadInSDRAgent } from "./newsletterLeadInAgent";
import { highIntentSDRAgent } from "./highIntentAgent";

// NEW – the 2 missing agents
import { dataEnrichmentSDRAgent } from "./dataEnrichmentAgent";
import { competitorAwareSDRAgent } from "./competitorAwareAgent";

export const sdrAgentRegistry: Record<string, any> = {
  // 1–12 existing
  "sdr-cold-email": coldEmailSDRAgent,
  "sdr-follow-up": followUpSDRAgent,
  "sdr-objection-handling": objectionHandlingSDRAgent,
  "sdr-bump-message": bumpMessageSDRAgent,
  "sdr-reactivation": reactivationSDRAgent,
  "sdr-winback": winbackSDRAgent,
  "sdr-linkedin": linkedinSDRAgent,
  "sdr-whatsapp": whatsappSDRAgent,
  "sdr-event-based": eventBasedSDRAgent,
  "sdr-referral": referralSDRAgent,
  "sdr-newsletter-lead-in": newsletterLeadInSDRAgent,
  "sdr-high-intent": highIntentSDRAgent,

  // 13–14 now added
  "sdr-data-enrichment": dataEnrichmentSDRAgent,
  "sdr-competitor-aware": competitorAwareSDRAgent
};