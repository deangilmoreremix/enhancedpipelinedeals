export const toolMap: Record<string, { server: string; method: string }> = {
  // SmartCRM Tools
  "SmartCRMTools.save_activity": { server: "supabase", method: "save_activity" },
  "SmartCRMTools.update_contact_status": { server: "supabase", method: "update_contact_status" },
  "SmartCRMTools.write_score": { server: "supabase", method: "write_score" },
  "SmartCRMTools.enrich_contact": { server: "supabase", method: "enrich_contact" },
  "SmartCRMTools.assign_sdr_agent": { server: "supabase", method: "assign_sdr_agent" },
  "SmartCRMTools.assign_ae_agent": { server: "supabase", method: "assign_ae_agent" },
  "SmartCRMTools.update_pipeline_stage": { server: "supabase", method: "update_pipeline_stage" },
  "SmartCRMTools.compute_deal_risk": { server: "supabase", method: "compute_deal_risk" },
  "SmartCRMTools.record_next_action": { server: "supabase", method: "record_next_action" },
  "SmartCRMTools.update_deal_summary": { server: "supabase", method: "update_deal_summary" },

  // AgentMail Tools
  "AgentMail.send_message": { server: "agentmail", method: "send_message" },
  "AgentMail.reply_to_message": { server: "agentmail", method: "reply_to_message" },
  "AgentMail.list_messages": { server: "agentmail", method: "list_messages" },
  "AgentMail.generate_email": { server: "agentmail", method: "generate_email" },

  // Persona Engine Tools
  "PersonaEngine.set_persona": { server: "supabase", method: "set_persona" },
  "PersonaEngine.get_persona": { server: "supabase", method: "get_persona" },
  "PersonaEngine.list_personas": { server: "supabase", method: "list_personas" },

  // Multi-Agent Tools
  "MultiAgent.trigger_sdr_agent": { server: "agents", method: "trigger_sdr_agent" },
  "MultiAgent.trigger_ae_agent": { server: "agents", method: "trigger_ae_agent" },
  "MultiAgent.trigger_pipeline_ai": { server: "agents", method: "trigger_pipeline_ai" },
  "MultiAgent.trigger_enrichment_agent": { server: "agents", method: "trigger_enrichment_agent" },

  // Sequence Automation Tools
  "SequenceAutomation.schedule_step": { server: "supabase", method: "schedule_step" },
  "SequenceAutomation.run_sequence_step": { server: "supabase", method: "run_sequence_step" },
  "SequenceAutomation.cancel_sequence": { server: "supabase", method: "cancel_sequence" },

  // Browser Tools
  "Browser.browser_search": { server: "browser", method: "search" },
  "Browser.browser_open": { server: "browser", method: "open" },

  // Voice Agent Tools
  "VoiceAgent.call_start": { server: "voice", method: "call_start" },
  "VoiceAgent.say": { server: "voice", method: "say" },
  "VoiceAgent.listen": { server: "voice", method: "listen" },
  "VoiceAgent.send_voice_message": { server: "voice", method: "send_voice_message" },

  // Calendar Tools
  "CalendarTools.schedule_meeting": { server: "calendar", method: "schedule_meeting" },
  "CalendarTools.check_availability": { server: "calendar", method: "check_availability" },

  // Video Tools
  "VideoAgent.create_video": { server: "video", method: "create_video" },
  "VideoAgent.send_video": { server: "video", method: "send_video" },

  // Analytics Tools
  "Analytics.compute_deal_risk": { server: "analytics", method: "compute_deal_risk" },
  "Analytics.predict_close": { server: "analytics", method: "predict_close" },

  // Agents Tools
  "Agents.autopilot": { server: "agents", method: "autopilot" },
  "Agents.get_agent": { server: "agents", method: "get_agent" },
  "Agents.list_agents": { server: "agents", method: "list_agents" }
};