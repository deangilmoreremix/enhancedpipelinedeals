/*
  # Fix Function Search Paths V3

  This migration sets explicit search_path for all existing functions to prevent
  potential SQL injection vulnerabilities via search_path manipulation.

  All functions are updated to use:
  SET search_path = public, pg_temp

  ## Functions Updated: 54 functions (excluding procedures)
*/

-- =====================================================
-- FIX FUNCTION SEARCH PATHS - BATCH 1
-- =====================================================

ALTER FUNCTION bulk_import_contacts(jsonb[], uuid) SET search_path = public, pg_temp;
ALTER FUNCTION bulk_import_deals(jsonb[], uuid) SET search_path = public, pg_temp;
ALTER FUNCTION bulk_import_users(jsonb[], uuid) SET search_path = public, pg_temp;
ALTER FUNCTION calculate_gpt5_cost(text, integer, integer, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION check_api_rate_limit(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_expired_cache() SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_expired_context() SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_expired_snapshots() SET search_path = public, pg_temp;
ALTER FUNCTION create_api_key(text, text[], integer) SET search_path = public, pg_temp;
ALTER FUNCTION create_default_ai_permissions() SET search_path = public, pg_temp;
ALTER FUNCTION create_default_deal_stages() SET search_path = public, pg_temp;
ALTER FUNCTION expire_pending_actions() SET search_path = public, pg_temp;
ALTER FUNCTION generate_api_key() SET search_path = public, pg_temp;

-- =====================================================
-- FIX FUNCTION SEARCH PATHS - BATCH 2
-- =====================================================

ALTER FUNCTION get_popular_content_types(integer, text) SET search_path = public, pg_temp;
ALTER FUNCTION get_user_action_counts(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION get_user_analytics_data(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION increment_template_use_count(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION insert_sample_analytics_data(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION is_admin(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION log_admin_action() SET search_path = public, pg_temp;
ALTER FUNCTION log_api_access(uuid, uuid, text, text, text, text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION log_api_request(uuid, text, text, text, text, text, jsonb, integer, text) SET search_path = public, pg_temp;
ALTER FUNCTION log_import(uuid, text, text, integer, integer, integer, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION log_response_status_change() SET search_path = public, pg_temp;

-- =====================================================
-- FIX FUNCTION SEARCH PATHS - BATCH 3
-- =====================================================

ALTER FUNCTION match_documents(vector, double precision, integer, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION refresh_all_materialized_views() SET search_path = public, pg_temp;
ALTER FUNCTION refresh_analytics_views() SET search_path = public, pg_temp;
ALTER FUNCTION set_tenant_claims() SET search_path = public, pg_temp;
ALTER FUNCTION set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION uid() SET search_path = public, pg_temp;

-- =====================================================
-- FIX PROCEDURE SEARCH PATHS (different syntax)
-- =====================================================

ALTER PROCEDURE sp_get_import_status(text, OUT json) SET search_path = public, pg_temp;
ALTER PROCEDURE sp_import_users_from_csv(text, uuid, OUT json) SET search_path = public, pg_temp;

-- =====================================================
-- FIX FUNCTION SEARCH PATHS - UPDATE FUNCTIONS
-- =====================================================

ALTER FUNCTION update_ai_models_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_app_content_metadata_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_app_settings_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_conversation_contexts_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_dashboard_layouts_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_demo_apps_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_enhanced_task_executions_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_funnel_responses_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_funnel_sessions_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_model_metrics(text, text, integer, integer, integer, boolean) SET search_path = public, pg_temp;
ALTER FUNCTION update_personalized_goal_recommendations_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_product_analyses_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_storage_usage() SET search_path = public, pg_temp;
ALTER FUNCTION update_template_rating() SET search_path = public, pg_temp;
ALTER FUNCTION update_template_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION update_user_business_profiles_updated_at() SET search_path = public, pg_temp;

-- =====================================================
-- FIX FUNCTION SEARCH PATHS - VALIDATE FUNCTIONS
-- =====================================================

ALTER FUNCTION validate_api_key(text) SET search_path = public, pg_temp;
ALTER FUNCTION validate_api_key(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION validate_contact_import_data(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION validate_deal_import_data(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION validate_jwt_token(text) SET search_path = public, pg_temp;
ALTER FUNCTION validate_user_import_data(jsonb) SET search_path = public, pg_temp;

-- =====================================================
-- SUMMARY
-- =====================================================

DO $$
DECLARE
  function_count INTEGER;
  procedure_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.prokind = 'f';
  
  SELECT COUNT(*) INTO procedure_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.prokind = 'p';

  RAISE NOTICE '=== FUNCTION SEARCH PATH FIX SUMMARY ===';
  RAISE NOTICE '54 functions updated with explicit search_path';
  RAISE NOTICE '2 procedures updated with explicit search_path';
  RAISE NOTICE 'All functions/procedures now use: SET search_path = public, pg_temp';
  RAISE NOTICE 'Protection against search_path manipulation attacks';
  RAISE NOTICE 'Total public functions: %', function_count;
  RAISE NOTICE 'Total public procedures: %', procedure_count;
  RAISE NOTICE '========================================';
END $$;
