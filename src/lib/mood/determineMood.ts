import { MoodId, MoodContextContact, MoodContextDeal } from "./types";

/**
 * Very simple rule-based mood engine.
 * You can make this more advanced later (e.g. learned model, config-driven).
 */
export function determineMood(
  contact: MoodContextContact | null,
  deal: MoodContextDeal | null
): MoodId {
  const risk = deal?.risk_score ?? 0;
  const stage = (deal?.stage || "").toLowerCase();
  const status = (contact?.status || "").toLowerCase();
  const objectionLevel = deal?.objection_level ?? 0;

  // If the deal is risky or stalling → urgent
  if (risk >= 70 || objectionLevel >= 7) {
    return "urgent";
  }

  // If contact is unhappy / angry / churny → calm
  if (status === "angry" || status === "upset" || status === "churn_risk") {
    return "calm";
  }

  // Proposal / negotiation stages → precision
  if (stage === "proposal" || stage === "negotiation") {
    return "precision";
  }

  // Discovery / research / early stage → insight
  if (stage === "discovery" || stage === "research") {
    return "insight";
  }

  // Default mode
  return "friendly";
}