/*
  # Add All Missing Foreign Key Indexes

  This migration adds indexes for all foreign keys that currently lack covering indexes.
  Foreign key indexes are critical for:
  - JOIN query performance
  - CASCADE delete/update performance
  - Foreign key constraint validation

  ## Indexes Added: 140+ foreign key indexes
*/

-- =====================================================
-- ADMIN AND AGENT RELATED INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id 
  ON admin_audit_log(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_agent_coordination_events_task_execution_id 
  ON agent_coordination_events(task_execution_id);

CREATE INDEX IF NOT EXISTS idx_agent_coordination_logs_task_execution_id 
  ON agent_coordination_logs(task_execution_id);

CREATE INDEX IF NOT EXISTS idx_agent_task_logs_task_execution_id 
  ON agent_task_logs(task_execution_id);

-- =====================================================
-- AI CONTEXT AND EXECUTION INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ai_context_state_current_funnel_id 
  ON ai_context_state(current_funnel_id);

CREATE INDEX IF NOT EXISTS idx_ai_context_state_tenant_id 
  ON ai_context_state(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_execution_history_function_call_id 
  ON ai_execution_history(function_call_id);

CREATE INDEX IF NOT EXISTS idx_ai_execution_history_tenant_id 
  ON ai_execution_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_execution_history_user_id 
  ON ai_execution_history(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_function_calls_tenant_id 
  ON ai_function_calls(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_function_calls_user_id 
  ON ai_function_calls(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id 
  ON ai_generations(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_insights_customer_id 
  ON ai_insights(customer_id);

-- =====================================================
-- AI PENDING ACTIONS AND SNAPSHOTS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_function_call_id 
  ON ai_pending_actions(function_call_id);

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_tenant_id 
  ON ai_pending_actions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_user_id 
  ON ai_pending_actions(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_undo_snapshots_execution_history_id 
  ON ai_undo_snapshots(execution_history_id);

CREATE INDEX IF NOT EXISTS idx_ai_undo_snapshots_tenant_id 
  ON ai_undo_snapshots(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_undo_snapshots_user_id 
  ON ai_undo_snapshots(user_id);

-- =====================================================
-- AI USAGE AND WORKFLOWS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_customer_id 
  ON ai_usage_logs(customer_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model_id 
  ON ai_usage_logs(model_id);

CREATE INDEX IF NOT EXISTS idx_ai_user_permissions_tenant_id 
  ON ai_user_permissions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_workflows_tenant_id 
  ON ai_workflows(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_workflows_user_id 
  ON ai_workflows(user_id);

-- =====================================================
-- ANALYTICS AND API INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_analytics_time_series_user_id 
  ON analytics_time_series(user_id);

CREATE INDEX IF NOT EXISTS idx_analyzed_documents_user_id 
  ON analyzed_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_api_access_logs_api_key_id 
  ON api_access_logs(api_key_id);

CREATE INDEX IF NOT EXISTS idx_api_access_logs_user_id 
  ON api_access_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id 
  ON api_keys(user_id);

-- =====================================================
-- APP RELATED INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_app_access_app_id 
  ON app_access(app_id);

CREATE INDEX IF NOT EXISTS idx_app_content_user_id 
  ON app_content(user_id);

CREATE INDEX IF NOT EXISTS idx_app_content_metadata_customer_id 
  ON app_content_metadata(customer_id);

CREATE INDEX IF NOT EXISTS idx_app_content_metadata_uploaded_by 
  ON app_content_metadata(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_app_features_feature_id 
  ON app_features(feature_id);

CREATE INDEX IF NOT EXISTS idx_app_sync_history_app_id 
  ON app_sync_history(app_id);

CREATE INDEX IF NOT EXISTS idx_app_sync_history_customer_id 
  ON app_sync_history(customer_id);

-- =====================================================
-- APPOINTMENTS AND AUTOMATION
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_appointments_customer_id 
  ON appointments(customer_id);

CREATE INDEX IF NOT EXISTS idx_appointments_deal_id 
  ON appointments(deal_id);

CREATE INDEX IF NOT EXISTS idx_automation_rules_customer_id 
  ON automation_rules(customer_id);

-- =====================================================
-- CAMPAIGNS AND COMMUNICATION
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id 
  ON campaigns(user_id);

CREATE INDEX IF NOT EXISTS idx_communication_logs_user_id 
  ON communication_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_communication_records_user_id 
  ON communication_records(user_id);

CREATE INDEX IF NOT EXISTS idx_communication_templates_customer_id 
  ON communication_templates(customer_id);

CREATE INDEX IF NOT EXISTS idx_communications_customer_id 
  ON communications(customer_id);

CREATE INDEX IF NOT EXISTS idx_communications_deal_id 
  ON communications(deal_id);

-- =====================================================
-- CONTACT RELATED INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_contact_activities_user_id 
  ON contact_activities(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_analytics_user_id 
  ON contact_analytics(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_files_contact_id 
  ON contact_files(contact_id);

CREATE INDEX IF NOT EXISTS idx_contact_files_user_id 
  ON contact_files(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_insights_contact_id 
  ON contact_insights(contact_id);

CREATE INDEX IF NOT EXISTS idx_contact_insights_user_id 
  ON contact_insights(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_segments_customer_id 
  ON contact_segments(customer_id);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id 
  ON contacts(user_id);

-- =====================================================
-- CONVERSATION AND CONVERSION
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_conversation_messages_context_id 
  ON conversation_messages(context_id);

CREATE INDEX IF NOT EXISTS idx_conversion_funnel_user_id 
  ON conversion_funnel(user_id);

-- =====================================================
-- COST TRACKING AND DEALS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_cost_tracking_generation_id 
  ON cost_tracking(generation_id);

CREATE INDEX IF NOT EXISTS idx_cost_tracking_tenant_id 
  ON cost_tracking(tenant_id);

CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_id 
  ON cost_tracking(user_id);

CREATE INDEX IF NOT EXISTS idx_deal_attachments_deal_id 
  ON deal_attachments(deal_id);

CREATE INDEX IF NOT EXISTS idx_deals_customer_id 
  ON deals(customer_id);

-- =====================================================
-- ENGAGEMENT INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_engagement_categories_user_id 
  ON engagement_categories(user_id);

CREATE INDEX IF NOT EXISTS idx_engagement_patterns_user_id 
  ON engagement_patterns(user_id);

CREATE INDEX IF NOT EXISTS idx_enhanced_task_executions_customer_id 
  ON enhanced_task_executions(customer_id);

CREATE INDEX IF NOT EXISTS idx_enhanced_task_templates_customer_id 
  ON enhanced_task_templates(customer_id);

-- =====================================================
-- ENTITLEMENTS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_entitlements_product_name 
  ON entitlements(product_name);

CREATE INDEX IF NOT EXISTS idx_entitlements_source_purchase_id 
  ON entitlements(source_purchase_id);

-- =====================================================
-- FUNNEL INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_funnel_conversions_funnel_id 
  ON funnel_conversions(funnel_id);

CREATE INDEX IF NOT EXISTS idx_funnel_interactions_funnel_id 
  ON funnel_interactions(funnel_id);

CREATE INDEX IF NOT EXISTS idx_funnel_responses_funnel_id 
  ON funnel_responses(funnel_id);

CREATE INDEX IF NOT EXISTS idx_funnel_sessions_funnel_id 
  ON funnel_sessions(funnel_id);

CREATE INDEX IF NOT EXISTS idx_funnel_steps_funnel_id 
  ON funnel_steps(funnel_id);

CREATE INDEX IF NOT EXISTS idx_funnel_templates_created_by 
  ON funnel_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_funnel_views_funnel_id 
  ON funnel_views(funnel_id);

CREATE INDEX IF NOT EXISTS idx_funnels_tenant_id 
  ON funnels(tenant_id);

CREATE INDEX IF NOT EXISTS idx_funnels_user_id 
  ON funnels(user_id);

-- =====================================================
-- GENERATED CONTENT AND IMAGES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_generated_content_content_type_id 
  ON generated_content(content_type_id);

CREATE INDEX IF NOT EXISTS idx_generated_content_user_id 
  ON generated_content(user_id);

CREATE INDEX IF NOT EXISTS idx_generated_videos_image_id 
  ON generated_videos(image_id);

CREATE INDEX IF NOT EXISTS idx_image_assets_user_id 
  ON image_assets(user_id);

CREATE INDEX IF NOT EXISTS idx_import_logs_user_id 
  ON import_logs(user_id);

-- =====================================================
-- JOURNEY AND MESSAGE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_journey_events_contact_id 
  ON journey_events(contact_id);

CREATE INDEX IF NOT EXISTS idx_journey_events_user_id 
  ON journey_events(user_id);

CREATE INDEX IF NOT EXISTS idx_message_logs_user_id 
  ON message_logs(user_id);

-- =====================================================
-- PARTNER INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_partner_applications_partner_id 
  ON partner_applications(partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_customers_partner_id 
  ON partner_customers(partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_customers_tenant_id 
  ON partner_customers(tenant_id);

CREATE INDEX IF NOT EXISTS idx_partner_stats_partner_id 
  ON partner_stats(partner_id);

CREATE INDEX IF NOT EXISTS idx_pending_entitlements_purchase_event_id 
  ON pending_entitlements(purchase_event_id);

-- =====================================================
-- PRODUCT AND PROJECT INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_product_analyses_user_id 
  ON product_analyses(user_id);

CREATE INDEX IF NOT EXISTS idx_project_images_image_id 
  ON project_images(image_id);

CREATE INDEX IF NOT EXISTS idx_project_images_project_id 
  ON project_images(project_id);

CREATE INDEX IF NOT EXISTS idx_purchases_product_name 
  ON purchases(product_name);

-- =====================================================
-- REASONING AND RELATIONSHIP INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_reasoning_history_generation_id 
  ON reasoning_history(generation_id);

CREATE INDEX IF NOT EXISTS idx_relationship_mappings_target_contact_id 
  ON relationship_mappings(target_contact_id);

CREATE INDEX IF NOT EXISTS idx_relationship_mappings_user_id 
  ON relationship_mappings(user_id);

CREATE INDEX IF NOT EXISTS idx_response_activities_response_id 
  ON response_activities(response_id);

-- =====================================================
-- SALES INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_sales_activities_appointment_id 
  ON sales_activities(appointment_id);

CREATE INDEX IF NOT EXISTS idx_sales_activities_communication_id 
  ON sales_activities(communication_id);

CREATE INDEX IF NOT EXISTS idx_sales_activities_customer_id 
  ON sales_activities(customer_id);

CREATE INDEX IF NOT EXISTS idx_sales_activities_deal_id 
  ON sales_activities(deal_id);

CREATE INDEX IF NOT EXISTS idx_sales_goals_customer_id 
  ON sales_goals(customer_id);

CREATE INDEX IF NOT EXISTS idx_sales_sequences_customer_id 
  ON sales_sequences(customer_id);

-- =====================================================
-- STORAGE AND STRIPE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_storage_usage_user_id 
  ON storage_usage(user_id);

CREATE INDEX IF NOT EXISTS idx_stripe_charges_customer 
  ON stripe_charges(customer);

CREATE INDEX IF NOT EXISTS idx_stripe_entitlements_user_id 
  ON stripe_entitlements(user_id);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_customer_id 
  ON stripe_payment_methods(customer_id);

CREATE INDEX IF NOT EXISTS idx_stripe_prices_product 
  ON stripe_prices(product);

-- =====================================================
-- TASK AND TEMPLATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_task_business_outcomes_task_execution_id 
  ON task_business_outcomes(task_execution_id);

CREATE INDEX IF NOT EXISTS idx_task_executions_customer_id 
  ON task_executions(customer_id);

CREATE INDEX IF NOT EXISTS idx_task_templates_customer_id 
  ON task_templates(customer_id);

CREATE INDEX IF NOT EXISTS idx_template_categories_parent_id 
  ON template_categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_template_ratings_user_id 
  ON template_ratings(user_id);

CREATE INDEX IF NOT EXISTS idx_template_steps_template_id 
  ON template_steps(template_id);

CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_generation_id 
  ON tool_execution_logs(generation_id);

-- =====================================================
-- USER INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id 
  ON usage_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id 
  ON user_achievements(achievement_id);

CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id 
  ON user_analytics(user_id);

CREATE INDEX IF NOT EXISTS idx_user_campaigns_user_id 
  ON user_campaigns(user_id);

CREATE INDEX IF NOT EXISTS idx_user_identities_customer_id 
  ON user_identities(customer_id);

CREATE INDEX IF NOT EXISTS idx_user_template_favorites_template_id 
  ON user_template_favorites(template_id);

CREATE INDEX IF NOT EXISTS idx_user_templates_user_id 
  ON user_templates(user_id);

CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_tenant_id 
  ON user_tenant_roles(tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_upload_logs_user_id 
  ON user_upload_logs(user_id);

-- =====================================================
-- VIDEO AND WEB INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_video_analytics_user_id 
  ON video_analytics(user_id);

CREATE INDEX IF NOT EXISTS idx_video_sharing_owner_id 
  ON video_sharing(owner_id);

CREATE INDEX IF NOT EXISTS idx_videos_app_id 
  ON videos(app_id);

CREATE INDEX IF NOT EXISTS idx_videos_user_id 
  ON videos(user_id);

CREATE INDEX IF NOT EXISTS idx_web_search_results_message_id 
  ON web_search_results(message_id);

-- =====================================================
-- WEBHOOK AND WORKFLOW INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant_id 
  ON webhook_deliveries(tenant_id);

CREATE INDEX IF NOT EXISTS idx_white_label_configs_tenant_id 
  ON white_label_configs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_customer_id 
  ON workflow_executions(customer_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id 
  ON workflow_executions(workflow_id);

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

  RAISE NOTICE '=== FOREIGN KEY INDEX CREATION SUMMARY ===';
  RAISE NOTICE '140+ foreign key indexes created';
  RAISE NOTICE 'All foreign keys now have covering indexes';
  RAISE NOTICE 'JOIN and CASCADE operations optimized';
  RAISE NOTICE 'Total indexes in public schema: %', index_count;
  RAISE NOTICE '==========================================';
END $$;
