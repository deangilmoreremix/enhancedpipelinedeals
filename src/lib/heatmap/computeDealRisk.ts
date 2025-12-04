import { supabase } from "../core/supabaseClient";
import { callOpenAI } from "../core/callOpenAI";
import { logger } from "../core/logger";

export async function computeDealRisk(dealId: string) {
  // Load deal and contact
  const { data: deal, error: dErr } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .single();

  if (dErr || !deal) {
    logger.error("Heatmap: deal not found", { dealId, dErr });
    throw new Error("Deal not found");
  }

  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", deal.contact_id)
    .single();

  if (cErr || !contact) {
    logger.error("Heatmap: contact not found", { dealId, cErr });
    throw new Error("Contact not found for deal");
  }

  // Build AI prompt for risk analysis
  const prompt = `
You are a deal risk analyst for an AI-powered CRM.

Contact: ${JSON.stringify(contact, null, 2)}
Deal: ${JSON.stringify(deal, null, 2)}

Task: Assign a RISK_SCORE from 0-100, provide reason, suggest next action.
Return JSON: {"risk_score": 0, "reason": "...", "next_action": "..."}
  `;

  const res = await callOpenAI(prompt, []);
  const parsed = typeof res === "string" ? JSON.parse(res) : res;

  return {
    deal,
    contact,
    risk_score: Number(parsed.risk_score ?? deal.risk_score ?? 0),
    reason: parsed.reason || "",
    next_action: parsed.next_action || ""
  };
}