import { supabase } from "../../core/supabaseClient";
import { callOpenAI } from "../../core/callOpenAI";
import { logger } from "../../core/logger";

// SDR 13 – Data-Enrichment SDR
// Goal: Expand contact profile (industry, company size, role focus, pain points)
// and generate a better SDR intro email using enriched context.

export const dataEnrichmentSDRAgent: any = {
  id: "sdr-data-enrichment",
  name: "Data-Enrichment SDR",
  description:
    "Enriches contact + deal data (industry, size, pain points) and drafts an outreach email using the enriched context.",

  /**
   * args: { contactId?: string, contact?: any, deal?: any, context?: any }
   * You can call this via your SDR runner / MCP / Netlify function.
   */
  run: async (args: any) => {
    const contactId: string | undefined =
      args.contactId || args.contact?.id || args.contact_id;

    if (!contactId) {
      throw new Error("dataEnrichmentSDRAgent: contactId is required in args");
    }

    // 1) Load contact
    const { data: contact, error: cErr } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (cErr || !contact) {
      logger.error("[DataEnrichmentSDR] Contact not found", { contactId, cErr });
      throw new Error("Contact not found for data enrichment");
    }

    // 2) Load related deal if one exists (optional)
    let deal: any = null;
    if (args.dealId || contact.active_deal_id) {
      const dealId = args.dealId || contact.active_deal_id;
      const { data: dealData, error: dErr } = await supabase
        .from("deals")
        .select("*")
        .eq("id", dealId)
        .single();
      if (!dErr && dealData) {
        deal = dealData;
      }
    }

    // 3) Ask OpenAI to infer enrichment from what we have
    const prompt = `
You are a B2B data enrichment specialist and SDR strategist.

We have a CRM contact and (optionally) a deal. You will:
1) Infer missing context (industry, company size, role focus, buying power, core pain points) from the data.
2) Suggest a concise set of enrichment fields to store back in the CRM.
3) Draft a highly targeted SDR intro email using the enriched profile.

Return JSON ONLY in this format:
{
  "enrichment": {
    "inferred_industry": "",
    "inferred_company_size": "",
    "inferred_role_focus": "",
    "inferred_buying_power": "",
    "primary_pains": [],
    "secondary_pains": [],
    "priority_level": "low | medium | high"
  },
  "email": {
    "subject": "",
    "body": ""
  }
}

Contact:
${JSON.stringify(contact, null, 2)}

Deal (may be null):
${JSON.stringify(deal, null, 2)}
    `.trim();

    const raw = await callOpenAI(prompt, []);

    let parsed: any;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      logger.error("[DataEnrichmentSDR] Failed to parse JSON", { raw, e });
      throw new Error("Failed to parse enrichment JSON");
    }

    const enrichment = parsed.enrichment || {};
    const email = parsed.email || {};

    // 4) Write enrichment back to contacts table (add/merge columns as needed)
    const updatePayload: any = {
      inferred_industry: enrichment.inferred_industry || null,
      inferred_company_size: enrichment.inferred_company_size || null,
      inferred_role_focus: enrichment.inferred_role_focus || null,
      inferred_buying_power: enrichment.inferred_buying_power || null,
      primary_pains: enrichment.primary_pains || [],
      secondary_pains: enrichment.secondary_pains || [],
      priority_level: enrichment.priority_level || null,
      // Optional generic JSON blob for future features:
      enrichment_json: enrichment
    };

    const { error: uErr } = await supabase
      .from("contacts")
      .update(updatePayload)
      .eq("id", contactId);

    if (uErr) {
      logger.error("[DataEnrichmentSDR] Failed to update contact", {
        contactId,
        uErr
      });
    }

    // 5) Return enriched contact + email draft
    return {
      type: "sdr-data-enrichment-result",
      contactId,
      enrichment,
      email,
      debug: {
        wroteToContacts: !uErr,
        updatePayload
      }
    };
  }
};