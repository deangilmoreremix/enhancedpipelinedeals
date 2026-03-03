import { executeTool } from "./mcpExecutor";

export async function openaiFunctionRouter(fnName: string, args: any) {
  switch (fnName) {
    case "save_activity":
      return executeTool("SmartCRMTools.save_activity", args);

    case "update_contact_status":
      return executeTool("SmartCRMTools.update_contact_status", args);

    case "write_score":
      return executeTool("SmartCRMTools.write_score", args);

    case "enrich_contact":
      return executeTool("SmartCRMTools.enrich_contact", args);

    case "assign_sdr_agent":
      return executeTool("SmartCRMTools.assign_sdr_agent", args);

    case "assign_ae_agent":
      return executeTool("SmartCRMTools.assign_ae_agent", args);

    case "update_pipeline_stage":
      return executeTool("SmartCRMTools.update_pipeline_stage", args);

    case "compute_deal_risk":
      return executeTool("SmartCRMTools.compute_deal_risk", args);

    case "record_next_action":
      return executeTool("SmartCRMTools.record_next_action", args);

    case "update_deal_summary":
      return executeTool("SmartCRMTools.update_deal_summary", args);

    case "set_persona":
      return executeTool("PersonaEngine.set_persona", args);

    case "get_persona":
      return executeTool("PersonaEngine.get_persona", args);

    case "list_personas":
      return executeTool("PersonaEngine.list_personas", args);

    case "trigger_sdr_agent":
      return executeTool("MultiAgent.trigger_sdr_agent", args);

    case "trigger_ae_agent":
      return executeTool("MultiAgent.trigger_ae_agent", args);

    case "trigger_pipeline_ai":
      return executeTool("MultiAgent.trigger_pipeline_ai", args);

    case "trigger_enrichment_agent":
      return executeTool("MultiAgent.trigger_enrichment_agent", args);

    case "schedule_step":
      return executeTool("SequenceAutomation.schedule_step", args);

    case "run_sequence_step":
      return executeTool("SequenceAutomation.run_sequence_step", args);

    case "cancel_sequence":
      return executeTool("SequenceAutomation.cancel_sequence", args);

    case "browser_search":
      return executeTool("Browser.browser_search", args);

    case "browser_open":
      return executeTool("Browser.browser_open", args);

    default:
      throw new Error(`Unknown OpenAI function: ${fnName}`);
  }
}