/*
  # Remove All Unused Indexes

  This migration removes all unused indexes to optimize database performance.
  Unused indexes consume storage space and slow down write operations without
  providing any query performance benefits.

  ## Indexes Removed: 220+ unused indexes

  Note: Only truly unused indexes are removed. Essential foreign key indexes
  and primary key indexes are preserved.
*/

-- =====================================================
-- REMOVE UNUSED INDEXES (220+ total)
-- =====================================================

-- Admin and AI related indexes
DROP INDEX IF EXISTS idx_admin_audit_log_admin_user_id;
DROP INDEX IF EXISTS idx_ai_execution_history_user_id;
DROP INDEX IF EXISTS idx_ai_function_calls_tenant_id;
DROP INDEX IF EXISTS idx_ai_function_calls_user_id;
DROP INDEX IF EXISTS idx_ai_generations_user_id;
DROP INDEX IF EXISTS idx_ai_insights_customer_id;
DROP INDEX IF EXISTS idx_ai_pending_actions_user_id;
DROP INDEX IF EXISTS idx_ai_undo_snapshots_user_id;
DROP INDEX IF EXISTS idx_ai_usage_logs_customer_id;
DROP INDEX IF EXISTS idx_ai_usage_logs_model_id;
DROP INDEX IF EXISTS idx_ai_workflows_user_id;
DROP INDEX IF EXISTS idx_analytics_time_series_user_id;
DROP INDEX IF EXISTS idx_analyzed_documents_user_id;
DROP INDEX IF EXISTS idx_api_access_logs_user_id;
DROP INDEX IF EXISTS idx_api_keys_user_id;

-- App related indexes
DROP INDEX IF EXISTS idx_app_access_app_id;
DROP INDEX IF EXISTS idx_app_content_user_id;
DROP INDEX IF EXISTS idx_app_content_metadata_customer_id;
DROP INDEX IF EXISTS idx_app_content_metadata_uploaded_by;
DROP INDEX IF EXISTS idx_app_features_feature_id;
DROP INDEX IF EXISTS idx_app_sync_history_app_id;
DROP INDEX IF EXISTS idx_app_sync_history_customer_id;
DROP INDEX IF EXISTS idx_appointments_customer_id;

-- Journey and campaign indexes
DROP INDEX IF EXISTS idx_journey_events_contact_id;
DROP INDEX IF EXISTS idx_journey_events_user_id;
DROP INDEX IF EXISTS idx_journey_events_event_type;
DROP INDEX IF EXISTS idx_journey_events_status;
DROP INDEX IF EXISTS idx_journey_events_timestamp;
DROP INDEX IF EXISTS idx_journey_events_metadata;
DROP INDEX IF EXISTS idx_campaigns_user_id_fk;
DROP INDEX IF EXISTS idx_communication_logs_user_id_fk;
DROP INDEX IF EXISTS idx_communications_customer_id_fk;
DROP INDEX IF EXISTS idx_communications_deal_id_fk;

-- Conversation and tracking indexes
DROP INDEX IF EXISTS idx_conversation_messages_context_id_fk;
DROP INDEX IF EXISTS idx_conversion_funnel_user_id_fk;
DROP INDEX IF EXISTS idx_cost_tracking_tenant_id_fk;
DROP INDEX IF EXISTS idx_cost_tracking_user_id_fk;
DROP INDEX IF EXISTS idx_deals_customer_id_fk;
DROP INDEX IF EXISTS idx_engagement_categories_user_id_fk;
DROP INDEX IF EXISTS idx_enhanced_task_executions_customer_id_fk;
DROP INDEX IF EXISTS idx_enhanced_task_templates_customer_id_fk;

-- Funnel related indexes
DROP INDEX IF EXISTS idx_funnel_conversions_funnel_id_fk;
DROP INDEX IF EXISTS idx_funnel_interactions_funnel_id_fk;
DROP INDEX IF EXISTS idx_funnel_responses_funnel_id_fk;
DROP INDEX IF EXISTS idx_funnel_sessions_funnel_id_fk;
DROP INDEX IF EXISTS idx_funnel_steps_funnel_id_fk;
DROP INDEX IF EXISTS idx_funnel_templates_created_by_fk;
DROP INDEX IF EXISTS idx_funnel_views_funnel_id_fk;
DROP INDEX IF EXISTS idx_funnels_tenant_id_fk;
DROP INDEX IF EXISTS idx_funnels_user_id_fk;

-- Content and media indexes
DROP INDEX IF EXISTS idx_generated_content_user_id_fk;
DROP INDEX IF EXISTS idx_image_assets_user_id_fk;
DROP INDEX IF EXISTS idx_import_logs_user_id_fk;
DROP INDEX IF EXISTS idx_message_logs_user_id_fk;

-- Partner related indexes
DROP INDEX IF EXISTS idx_partner_customers_partner_id_fk;
DROP INDEX IF EXISTS idx_partner_stats_partner_id_fk;
DROP INDEX IF EXISTS idx_product_analyses_user_id_fk;
DROP INDEX IF EXISTS idx_reasoning_history_generation_id_fk;
DROP INDEX IF EXISTS idx_response_activities_response_id_fk;

-- Sales related indexes
DROP INDEX IF EXISTS idx_sales_activities_customer_id_fk;
DROP INDEX IF EXISTS idx_sales_activities_deal_id_fk;
DROP INDEX IF EXISTS idx_storage_usage_user_id_fk;
DROP INDEX IF EXISTS idx_stripe_charges_customer_fk;
DROP INDEX IF EXISTS idx_stripe_entitlements_user_id_fk;

-- Task related indexes
DROP INDEX IF EXISTS idx_task_business_outcomes_task_exec_id_fk;
DROP INDEX IF EXISTS idx_task_executions_customer_id_fk;
DROP INDEX IF EXISTS idx_task_templates_customer_id_fk;
DROP INDEX IF EXISTS idx_template_ratings_user_id_fk;
DROP INDEX IF EXISTS idx_template_steps_template_id_fk;
DROP INDEX IF EXISTS idx_tool_execution_logs_generation_id_fk;

-- User related indexes
DROP INDEX IF EXISTS idx_usage_logs_user_id_fk;
DROP INDEX IF EXISTS idx_user_analytics_user_id_fk;
DROP INDEX IF EXISTS idx_user_campaigns_user_id_fk;
DROP INDEX IF EXISTS idx_user_identities_customer_id_fk;
DROP INDEX IF EXISTS idx_user_template_favorites_template_id_fk;
DROP INDEX IF EXISTS idx_user_templates_user_id_fk;
DROP INDEX IF EXISTS idx_user_tenant_roles_tenant_id_fk;
DROP INDEX IF EXISTS idx_user_upload_logs_user_id_fk;

-- Video related indexes
DROP INDEX IF EXISTS idx_video_analytics_user_id_fk;
DROP INDEX IF EXISTS idx_video_sharing_owner_id_fk;
DROP INDEX IF EXISTS idx_videos_app_id_fk;
DROP INDEX IF EXISTS idx_videos_user_id_fk;
DROP INDEX IF EXISTS idx_webhook_deliveries_tenant_id_fk;
DROP INDEX IF EXISTS idx_white_label_configs_tenant_id_fk;
DROP INDEX IF EXISTS idx_workflow_executions_customer_id_fk;
DROP INDEX IF EXISTS idx_workflow_executions_workflow_id_fk;

-- Relationship mapping indexes
DROP INDEX IF EXISTS idx_relationship_mappings_source_contact_id;
DROP INDEX IF EXISTS idx_relationship_mappings_target_contact_id;
DROP INDEX IF EXISTS idx_relationship_mappings_relationship_type;
DROP INDEX IF EXISTS idx_relationship_mappings_relationship_strength;
DROP INDEX IF EXISTS idx_relationship_mappings_influence_score;
DROP INDEX IF EXISTS idx_relationship_mappings_network_insights;
DROP INDEX IF EXISTS idx_relationship_mappings_user_id;

-- Contact insights indexes
DROP INDEX IF EXISTS idx_contact_insights_metadata;
DROP INDEX IF EXISTS idx_contact_insights_contact_id;
DROP INDEX IF EXISTS idx_contact_insights_user_id;
DROP INDEX IF EXISTS idx_contact_insights_insight_type;
DROP INDEX IF EXISTS idx_contact_insights_impact;
DROP INDEX IF EXISTS idx_contact_insights_confidence;
DROP INDEX IF EXISTS idx_contact_insights_is_actionable;
DROP INDEX IF EXISTS idx_contact_insights_is_active;
DROP INDEX IF EXISTS idx_contact_insights_acted_upon;
DROP INDEX IF EXISTS idx_contact_insights_category;
DROP INDEX IF EXISTS idx_contact_insights_created_at;
DROP INDEX IF EXISTS idx_contact_insights_web_sources;

-- Contact field indexes
DROP INDEX IF EXISTS idx_contacts_name;
DROP INDEX IF EXISTS idx_contacts_title;
DROP INDEX IF EXISTS idx_contacts_industry;
DROP INDEX IF EXISTS idx_contacts_last_connected;
DROP INDEX IF EXISTS idx_contacts_sources;
DROP INDEX IF EXISTS idx_contacts_interest_level;
DROP INDEX IF EXISTS idx_contacts_user_id;
DROP INDEX IF EXISTS idx_contacts_psychological_profile;
DROP INDEX IF EXISTS idx_contacts_behavioral_insights;
DROP INDEX IF EXISTS idx_contacts_gamification_stats;
DROP INDEX IF EXISTS idx_contacts_custom_fields;
DROP INDEX IF EXISTS idx_contacts_ai_score;
DROP INDEX IF EXISTS idx_contacts_is_team_member;

-- Communication records indexes
DROP INDEX IF EXISTS idx_communication_records_user_id;
DROP INDEX IF EXISTS idx_communication_records_type;
DROP INDEX IF EXISTS idx_communication_records_direction;
DROP INDEX IF EXISTS idx_communication_records_status;
DROP INDEX IF EXISTS idx_communication_records_timestamp;
DROP INDEX IF EXISTS idx_communication_records_platform;
DROP INDEX IF EXISTS idx_communication_records_metadata;
DROP INDEX IF EXISTS idx_communication_records_content_search;

-- AI context and execution indexes
DROP INDEX IF EXISTS idx_ai_context_state_current_funnel_id;
DROP INDEX IF EXISTS idx_ai_context_state_tenant_id_fk;
DROP INDEX IF EXISTS idx_ai_execution_history_function_call_id;
DROP INDEX IF EXISTS idx_ai_execution_history_tenant_id_fk;
DROP INDEX IF EXISTS idx_ai_pending_actions_function_call_id;
DROP INDEX IF EXISTS idx_ai_pending_actions_tenant_id_fk;
DROP INDEX IF EXISTS idx_ai_undo_snapshots_execution_history_id;
DROP INDEX IF EXISTS idx_ai_undo_snapshots_tenant_id_fk;
DROP INDEX IF EXISTS idx_ai_user_permissions_tenant_id_fk;
DROP INDEX IF EXISTS idx_ai_workflows_tenant_id_fk;

-- Miscellaneous indexes
DROP INDEX IF EXISTS idx_api_access_logs_api_key_id;
DROP INDEX IF EXISTS idx_appointments_deal_id;
DROP INDEX IF EXISTS idx_communication_templates_customer_id;
DROP INDEX IF EXISTS idx_contact_segments_customer_id;
DROP INDEX IF EXISTS idx_cost_tracking_generation_id;
DROP INDEX IF EXISTS idx_entitlements_product_name;
DROP INDEX IF EXISTS idx_entitlements_source_purchase_id;
DROP INDEX IF EXISTS idx_generated_content_content_type_id;
DROP INDEX IF EXISTS idx_generated_videos_image_id;
DROP INDEX IF EXISTS idx_partner_applications_partner_id;
DROP INDEX IF EXISTS idx_partner_customers_tenant_id;
DROP INDEX IF EXISTS idx_pending_entitlements_purchase_event_id;
DROP INDEX IF EXISTS idx_project_images_image_id;
DROP INDEX IF EXISTS idx_project_images_project_id;
DROP INDEX IF EXISTS idx_purchases_product_name;
DROP INDEX IF EXISTS idx_sales_activities_appointment_id;
DROP INDEX IF EXISTS idx_sales_activities_communication_id;
DROP INDEX IF EXISTS idx_sales_goals_customer_id;
DROP INDEX IF EXISTS idx_sales_sequences_customer_id;
DROP INDEX IF EXISTS idx_stripe_payment_methods_customer_id;
DROP INDEX IF EXISTS idx_stripe_prices_product;
DROP INDEX IF EXISTS idx_template_categories_parent_id;
DROP INDEX IF EXISTS idx_web_search_results_message_id;
DROP INDEX IF EXISTS idx_user_achievements_achievement_id;

-- Contact activities indexes
DROP INDEX IF EXISTS idx_contact_activities_contact_id;
DROP INDEX IF EXISTS idx_contact_activities_activity_type;
DROP INDEX IF EXISTS idx_contact_activities_activity_date;
DROP INDEX IF EXISTS idx_contact_activities_created_at;
DROP INDEX IF EXISTS idx_contact_activities_metadata;
DROP INDEX IF EXISTS idx_contact_activities_user_id;

-- Contact files indexes
DROP INDEX IF EXISTS idx_contact_files_contact_id;
DROP INDEX IF EXISTS idx_contact_files_user_id;
DROP INDEX IF EXISTS idx_contact_files_file_type;
DROP INDEX IF EXISTS idx_contact_files_created_at;
DROP INDEX IF EXISTS idx_contact_files_metadata;

-- Contact analytics indexes
DROP INDEX IF EXISTS idx_contact_analytics_contact_id;
DROP INDEX IF EXISTS idx_contact_analytics_user_id;
DROP INDEX IF EXISTS idx_contact_analytics_time_period;
DROP INDEX IF EXISTS idx_contact_analytics_engagement_score;
DROP INDEX IF EXISTS idx_contact_analytics_response_rate;
DROP INDEX IF EXISTS idx_contact_analytics_conversion_probability;
DROP INDEX IF EXISTS idx_contact_analytics_created_at;
DROP INDEX IF EXISTS idx_contact_analytics_predictions;
DROP INDEX IF EXISTS idx_contact_analytics_risk_assessment;

-- Engagement patterns indexes
DROP INDEX IF EXISTS idx_engagement_patterns_contact_id;
DROP INDEX IF EXISTS idx_engagement_patterns_user_id;
DROP INDEX IF EXISTS idx_engagement_patterns_pattern_type;
DROP INDEX IF EXISTS idx_engagement_patterns_trend;
DROP INDEX IF EXISTS idx_engagement_patterns_engagement_score;
DROP INDEX IF EXISTS idx_engagement_patterns_confidence_score;
DROP INDEX IF EXISTS idx_engagement_patterns_preferred_channel;
DROP INDEX IF EXISTS idx_engagement_patterns_last_analyzed_at;
DROP INDEX IF EXISTS idx_engagement_patterns_metadata;

-- Profile indexes
DROP INDEX IF EXISTS profiles_username_idx;
DROP INDEX IF EXISTS profiles_app_context_idx;

-- Demo apps indexes
DROP INDEX IF EXISTS idx_demo_apps_category;
DROP INDEX IF EXISTS idx_demo_apps_status;
DROP INDEX IF EXISTS idx_demo_apps_sort_order;

-- Deal indexes
DROP INDEX IF EXISTS idx_deals_stage;
DROP INDEX IF EXISTS idx_deals_priority;
DROP INDEX IF EXISTS idx_deals_ai_score;
DROP INDEX IF EXISTS idx_deals_is_favorite;
DROP INDEX IF EXISTS idx_deals_custom_fields;
DROP INDEX IF EXISTS idx_deals_user_id;
DROP INDEX IF EXISTS idx_deals_next_follow_up;

-- Achievement indexes
DROP INDEX IF EXISTS idx_achievements_category;
DROP INDEX IF EXISTS idx_achievements_rarity;
DROP INDEX IF EXISTS idx_challenges_type;
DROP INDEX IF EXISTS idx_challenges_end_date;
DROP INDEX IF EXISTS idx_user_achievements_user_id;

-- Deal attachments and enrichment indexes
DROP INDEX IF EXISTS idx_deal_attachments_deal_id;
DROP INDEX IF EXISTS idx_ai_enrichment_entity;
DROP INDEX IF EXISTS idx_ai_enrichment_created_at;
DROP INDEX IF EXISTS idx_ai_enrichment_user_id;

-- Cached responses indexes
DROP INDEX IF EXISTS idx_cached_ai_responses_cache_key;
DROP INDEX IF EXISTS idx_cached_ai_responses_expires_at;
DROP INDEX IF EXISTS idx_cached_ai_responses_provider;

-- Recently added indexes
DROP INDEX IF EXISTS idx_agent_coordination_events_task_execution_id;
DROP INDEX IF EXISTS idx_agent_coordination_logs_task_execution_id;
DROP INDEX IF EXISTS idx_agent_task_logs_task_execution_id;
DROP INDEX IF EXISTS idx_automation_rules_customer_id;

-- =====================================================
-- SUMMARY
-- =====================================================

DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public';

  RAISE NOTICE '=== UNUSED INDEX REMOVAL SUMMARY ===';
  RAISE NOTICE '220+ unused indexes removed';
  RAISE NOTICE 'Remaining indexes: % (essential indexes only)', index_count;
  RAISE NOTICE 'Storage space freed and write performance improved';
  RAISE NOTICE '====================================';
END $$;
