import { supabase } from "../../core/supabaseClient";
import { callOpenAI } from "../../core/callOpenAI";
import { logger } from "../../core/logger";

// SDR 14 – Competitor-Aware SDR
// Goal: Craft emails that position you against named competitors,
// handle "we're already using X", and avoid bashing.

export const competitorAwareSDRAgent: any = {
  id: "sdr-competitor-aware",
  name: "Competitor-Aware SDR",
  description:
    "Writes competitor-aware outreach and objection-handling emails when a prospect mentions a competitor in notes or deal fields.",

  /**
   * args: { contactId?: string, dealId?: string, contact?: any, deal?: any, context?: any }
   */
  run: async (args: any) => {
    const contactId: string | undefined =
      args.contactId || args.contact?.id || args.contact_id;
    const dealId: string | undefined = args.dealId || args.deal?.id || args.deal_id;

    if (!contactId) {
      throw new Error("competitorAwareSDRAgent: contactId is required in args");
    }

    // 1) Load contact
    const { data: contact, error: cErr } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (cErr || !contact) {
      logger.error("[CompetitorAwareSDR] Contact not found", { contactId, cErr });
      throw new Error("Contact not found");
    }

    // 2) Load deal (competitor usually lives here)
    let deal: any = null;
    if (dealId) {
      const { data: dealData, error: dErr } = await supabase
        .from("deals")
        .select("*")
        .eq("id", dealId)
        .single();
      if (!dErr && dealData) {
        deal = dealData;
      }
    }

    // Try to find any competitor hints
    const competitorName: string | null =
      (deal && (deal.competitor_name || deal.competitor)) ||
      contact.competitor_name ||
      null;

    const competitorContext = {
      competitorName,
      known_tools: deal?.competitor_tools || null,
      notes: deal?.notes || contact.notes || null
    };

    const prompt = `
You are an expert B2B SDR who specializes in **competitor-aware** messaging.

We have a contact and (optionally) a deal, with potential competitor mentions.

Your tasks:
1) Analyze the situation and infer how the competitor is being used.
2) Draft:
   - A primary outreach email that acknowledges the competitor respectfully and positions us on strengths (not bashing).
   - A follow-up email specifically for the objection: "We're happy with [competitor]."
3) Provide a short bullet list of positioning angles (value, risk reduction, capabilities, support, pricing flexibility, etc.)

IMPORTANT:
- Do NOT insult or trash the competitor.
- Focus on: better fit, gaps, extra capabilities, support, ease, and ROI.
- Use short, punchy, easy-to-send copy.

Return JSON ONLY in this format:
{
  "analysis": {
    "competitor_name": "",
    "summary": "",
    "key_risks_of_staying": [],
    "key_reasons_to_switch": []
  },
  "primary_email": {
    "subject": "",
    "body": ""
  },
  "objection_email": {
    "subject": "",
    "body": ""
  },
  "positioning": {
    "angles": []
  }
}

Contact:
${JSON.stringify(contact, null, 2)}

Deal (may be null):
${JSON.stringify(deal, null, 2)}

Competitor context (parsed guess):
${JSON.stringify(competitorContext, null, 2)}
    `.trim();

    const raw = await callOpenAI(prompt, []);

    let parsed: any;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      logger.error("[CompetitorAwareSDR] Failed to parse JSON", { raw, e });
      throw new Error("Failed to parse competitor-aware JSON");
    }

    const analysis = parsed.analysis || {};
    const primary_email = parsed.primary_email || {};
    const objection_email = parsed.objection_email || {};
    const positioning = parsed.positioning || {};

    // (Optional) persist last competitor analysis on the deal
    if (deal && deal.id) {
      const { error: uErr } = await supabase
        .from("deals")
        .update({
          competitor_name: analysis.competitor_name || competitorName,
          competitor_analysis: analysis,
          competitor_positioning: positioning
        })
        .eq("id", deal.id);

      if (uErr) {
        logger.error("[CompetitorAwareSDR] Failed to update deal competitor info", {
          dealId: deal.id,
          uErr
        });
      }
    }

    return {
      type: "sdr-competitor-aware-result",
      contactId,
      dealId: deal?.id || null,
      analysis,
      primary_email,
      objection_email,
      positioning
    };
  }
};