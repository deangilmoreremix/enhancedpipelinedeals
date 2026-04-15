// Production-ready SDR agents with OpenAI Agents SDK

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

export interface SDRAgentMetadata {
  id: string;
  label: string;
  short: string;
  category: string;
  tags?: string[];
  usageCount?: number;
  lastUsed?: Date;
  favorite?: boolean;
  agent: any; // The actual agent implementation
}

// Agent registry with enhanced metadata
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

// Enhanced registry with metadata for the hub
export const sdrAgentMetadataRegistry: SDRAgentMetadata[] = [
  {
    id: "sdr-cold-email",
    label: "Cold Email SDR",
    short: "Prospect net-new cold leads with targeted emails.",
    category: "Top-of-funnel",
    tags: ["email", "outreach", "prospecting"],
    agent: sdrAgentRegistry["sdr-cold-email"]
  },
  {
    id: "sdr-follow-up",
    label: "Follow-Up SDR",
    short: "Automated follow-up sequences when leads go quiet.",
    category: "Follow-Up",
    tags: ["follow-up", "nurture", "sequence"],
    agent: sdrAgentRegistry["sdr-follow-up"]
  },
  {
    id: "sdr-objection-handling",
    label: "Objection-Handling SDR",
    short: "Handles objections and moves the deal forward.",
    category: "Objections",
    tags: ["objections", "closing", "handling"],
    agent: sdrAgentRegistry["sdr-objection-handling"]
  },
  {
    id: "sdr-bump-message",
    label: "Bump Message SDR",
    short: "Short bump nudges for threads that have stalled.",
    category: "Follow-Up",
    tags: ["bump", "nudge", "stalled"],
    agent: sdrAgentRegistry["sdr-bump-message"]
  },
  {
    id: "sdr-reactivation",
    label: "Re-Activation SDR",
    short: "Re-engages old or dormant leads.",
    category: "Revival",
    tags: ["reactivation", "dormant", "re-engage"],
    agent: sdrAgentRegistry["sdr-reactivation"]
  },
  {
    id: "sdr-winback",
    label: "Win-Back SDR",
    short: "Win back lost customers or churned accounts.",
    category: "Revival",
    tags: ["winback", "churn", "recovery"],
    agent: sdrAgentRegistry["sdr-winback"]
  },
  {
    id: "sdr-linkedin",
    label: "LinkedIn SDR",
    short: "Scripts for LinkedIn connection & follow-up.",
    category: "Social",
    tags: ["linkedin", "social", "connection"],
    agent: sdrAgentRegistry["sdr-linkedin"]
  },
  {
    id: "sdr-whatsapp",
    label: "WhatsApp SDR",
    short: "Conversational outreach optimized for WhatsApp.",
    category: "Social",
    tags: ["whatsapp", "messaging", "conversational"],
    agent: sdrAgentRegistry["sdr-whatsapp"]
  },
  {
    id: "sdr-event-based",
    label: "Event-Based SDR",
    short: "Outreach triggered by events (webinar, download, etc.).",
    category: "Event",
    tags: ["event", "triggered", "webinar"],
    agent: sdrAgentRegistry["sdr-event-based"]
  },
  {
    id: "sdr-referral",
    label: "Referral SDR",
    short: "Messages to generate and close referrals.",
    category: "Referrals",
    tags: ["referral", "networking", "generate"],
    agent: sdrAgentRegistry["sdr-referral"]
  },
  {
    id: "sdr-newsletter-lead-in",
    label: "Newsletter Lead-In SDR",
    short: "Turns newsletter subscribers into sales conversations.",
    category: "Warm",
    tags: ["newsletter", "subscriber", "conversion"],
    agent: sdrAgentRegistry["sdr-newsletter-lead-in"]
  },
  {
    id: "sdr-high-intent",
    label: "High-Intent SDR",
    short: "Fast follow-up for hot leads and demo requests.",
    category: "Hot",
    tags: ["high-intent", "demo", "qualified"],
    agent: sdrAgentRegistry["sdr-high-intent"]
  },
  {
    id: "sdr-data-enrichment",
    label: "Data-Enrichment SDR",
    short: "Enriches contact data and drafts smarter outreach.",
    category: "Intelligence",
    tags: ["data", "enrichment", "intelligence"],
    agent: sdrAgentRegistry["sdr-data-enrichment"]
  },
  {
    id: "sdr-competitor-aware",
    label: "Competitor-Aware SDR",
    short: "Handles competitor mentions and positions you to win.",
    category: "Competitive",
    tags: ["competitor", "positioning", "win"],
    agent: sdrAgentRegistry["sdr-competitor-aware"]
  }
];