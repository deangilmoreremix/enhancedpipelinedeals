-- Seed Agent Metadata
INSERT INTO agent_metadata (id, name, persona, objectives, workflow, tools) VALUES
(
  'sdr_ai_core',
  'AI SDR (Core Outbound Agent)',
  'direct_closer',
  '["outreach", "followup", "objection_handling"]'::jsonb,
  '["research_prospect", "personalize_message", "send_outreach", "log_activity", "update_status"]'::jsonb,
  '["AgentMail.send_message", "Browser.search", "Browser.open", "Supabase.update", "SmartCRMTools.save_activity", "SmartCRMTools.update_contact_status"]'::jsonb
),
(
  'sdr_email_primary',
  'Primary SDR Email Agent',
  'soft_convo',
  '["email_conversations", "response_handling", "nurturing"]'::jsonb,
  '["read_inbox", "analyze_message", "craft_response", "send_reply", "update_crm"]'::jsonb,
  '["AgentMail.reply_to_message", "SmartCRMTools.save_activity", "Supabase.query", "SmartCRMTools.update_contact_status"]'::jsonb
),
(
  'sdr_objection_crusher',
  'Objection Crusher SDR',
  'challenger',
  '["handle_objections", "reduce_friction", "move_deals_forward"]'::jsonb,
  '["identify_objection", "validate_concern", "provide_reframing", "ask_micro_question", "log_intent"]'::jsonb,
  '["AgentMail.reply_to_message", "SmartCRMTools.save_activity", "SmartCRMTools.create_followup"]'::jsonb
),
(
  'sdr_cold_outreach',
  'Cold Outreach SDR',
  'humor_opener',
  '["generate_replies", "warm_prospects", "start_conversations"]'::jsonb,
  '["research_target", "personalize_opener", "send_cold_email", "log_outreach"]'::jsonb,
  '["AgentMail.send_message", "Browser.search", "SmartCRMTools.save_activity"]'::jsonb
),
(
  'sdr_followup',
  'Follow-Up SDR',
  'minimalist',
  '["convert_silence", "move_warm_to_hot", "pattern_disruption"]'::jsonb,
  '["check_last_activity", "send_bump", "ask_micro_question", "log_result"]'::jsonb,
  '["AgentMail.send_message", "SmartCRMTools.create_followup", "SmartCRMTools.save_activity"]'::jsonb
),
(
  'sdr_journeys',
  'Automated Journeys SDR',
  'storyteller',
  '["execute_sequences", "maintain_drip", "drive_replies"]'::jsonb,
  '["send_sequence_email", "schedule_next_step", "log_message", "check_reply"]'::jsonb,
  '["SmartCRMTools.schedule_step", "AgentMail.send_message", "SmartCRMTools.save_activity"]'::jsonb
),
(
  'sdr_handoff_hybrid',
  'SDR/AE Handoff Hybrid',
  'strategic_partner',
  '["qualify_prospects", "prepare_handoff", "coordinate_transition"]'::jsonb,
  '["gather_qualification", "summarize_context", "assign_ae", "log_handoff"]'::jsonb,
  '["AgentMail.reply_to_message", "Supabase.update", "SmartCRMTools.save_activity"]'::jsonb
),
(
  'sdr_enrichment',
  'Lead Enrichment SDR',
  'data_detective',
  '["enrich_contacts", "gather_intelligence", "update_profiles"]'::jsonb,
  '["search_online", "extract_insights", "update_crm", "log_enrichment"]'::jsonb,
  '["Browser.search", "Browser.open", "Supabase.update", "SmartCRMTools.save_activity"]'::jsonb
),
(
  'sdr_lead_scoring',
  'Lead Scoring SDR',
  'empirical_analyst',
  '["calculate_scores", "update_crm", "improve_quality"]'::jsonb,
  '["read_contact_data", "compute_score", "write_to_crm"]'::jsonb,
  '["Supabase.query", "SmartCRMTools.write_score", "SmartCRMTools.save_activity"]'::jsonb
),
(
  'sdr_contact_intel',
  'Contact Intelligence SDR',
  'insight_consultant',
  '["produce_profiles", "support_ae", "provide_context"]'::jsonb,
  '["pull_all_data", "summarize_insights", "save_intelligence"]'::jsonb,
  '["Supabase.query", "SmartCRMTools.save_activity", "SmartCRMTools.fetch_deals"]'::jsonb
),
(
  'sdr_appointment',
  'Appointment Setter SDR',
  'calm_professional',
  '["book_meetings", "confirm_availability", "update_pipeline"]'::jsonb,
  '["send_timeslots", "confirm_time", "log_appointment", "update_status"]'::jsonb,
  '["AgentMail.send_message", "SmartCRMTools.update_contact_status", "SmartCRMTools.save_activity"]'::jsonb
),
(
  'sdr_upsell',
  'Upsell / Ascension SDR',
  'roi_calc',
  '["identify_opportunities", "increase_ltv", "upgrade_tiers"]'::jsonb,
  '["analyze_current_plan", "identify_fit", "explain_value_gap", "log_attempt"]'::jsonb,
  '["AgentMail.send_message", "Supabase.query", "SmartCRMTools.save_activity"]'::jsonb
),
(
  'sdr_reactivation',
  'Reactivation SDR',
  'warm_mentor',
  '["re_engage_leads", "restart_conversations", "warm_pipeline"]'::jsonb,
  '["review_past_activity", "reference_context", "send_reactivation", "log_interaction"]'::jsonb,
  '["AgentMail.send_message", "Supabase.query", "SmartCRMTools.save_activity"]'::jsonb
),
(
  'sdr_nurture',
  'Nurture SDR',
  'friendly_neighbor',
  '["build_relationships", "provide_value", "warm_slowly"]'::jsonb,
  '["send_insights", "share_case_study", "follow_periodically", "track_engagement"]'::jsonb,
  '["AgentMail.send_message", "SmartCRMTools.create_followup", "SmartCRMTools.save_activity"]'::jsonb
),
(
  'deal_intelligence_ai',
  'Deal Intelligence AI',
  'problem_finder',
  '["analyze_deals", "predict_outcomes", "recommend_actions"]'::jsonb,
  '["pull_deal_data", "analyze_patterns", "calculate_probability", "recommend_next_steps", "update_intelligence"]'::jsonb,
  '["Supabase.query", "Supabase.update", "SmartCRMTools.save_activity", "SmartCRMTools.update_contact_status", "SmartCRMTools.write_score", "AgentMail.list_messages"]'::jsonb
);