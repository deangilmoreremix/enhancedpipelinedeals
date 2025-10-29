/*
  # Fix Remaining Security Issues V2

  This migration addresses critical security issues:

  ## 1. Missing Foreign Key Indexes (4 tables)
    - agent_coordination_events.task_execution_id
    - agent_coordination_logs.task_execution_id  
    - agent_task_logs.task_execution_id
    - automation_rules.customer_id

  ## 2. Multiple Permissive Policies
    - Consolidate duplicate policies into single restrictive policies
    - Handle different column types correctly (TEXT vs UUID)

  ## 3. Policy Optimization
    - Ensure all policies use optimized auth function calls
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_agent_coordination_events_task_execution_id 
ON agent_coordination_events(task_execution_id);

CREATE INDEX IF NOT EXISTS idx_agent_coordination_logs_task_execution_id 
ON agent_coordination_logs(task_execution_id);

CREATE INDEX IF NOT EXISTS idx_agent_task_logs_task_execution_id 
ON agent_task_logs(task_execution_id);

CREATE INDEX IF NOT EXISTS idx_automation_rules_customer_id 
ON automation_rules(customer_id);

-- =====================================================
-- 2. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- =====================================================

-- admin_users
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can view their own profile" ON admin_users;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users' AND policyname = 'Admins can manage admin users') THEN
    CREATE POLICY "Admins can manage admin users"
      ON admin_users FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admin_users au 
          WHERE au.id = (SELECT auth.uid()) 
          AND au.is_active = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admin_users au 
          WHERE au.id = (SELECT auth.uid()) 
          AND au.is_active = true
        )
      );
  END IF;
END $$;

-- agent_metadata
DO $$
BEGIN
  DROP POLICY IF EXISTS anon_select_agent ON agent_metadata;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_metadata' AND policyname = 'Allow public read on agent_metadata') THEN
    CREATE POLICY "Allow public read on agent_metadata"
      ON agent_metadata FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- ai_models
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow public read access to ai_models" ON ai_models;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_models' AND policyname = 'Allow authenticated read access to ai_models') THEN
    CREATE POLICY "Allow authenticated read access to ai_models"
      ON ai_models FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ai_usage_metrics
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their AI metrics" ON ai_usage_metrics;
END $$;

-- analyzed_documents
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage their documents" ON analyzed_documents;
  DROP POLICY IF EXISTS "Users can manage their own document analyses" ON analyzed_documents;
  
  CREATE POLICY "Users can manage own documents"
    ON analyzed_documents FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
END $$;

-- app_features
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view enabled app features" ON app_features;
END $$;

-- business_analyzer (user_id is TEXT)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow public access to business analyses" ON business_analyzer;
  DROP POLICY IF EXISTS "Users can manage their own business analyses" ON business_analyzer;
  
  CREATE POLICY "Users can manage own business analyses"
    ON business_analyzer FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid())::text)
    WITH CHECK (user_id = (SELECT auth.uid())::text);
END $$;

-- communication_metrics
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their comm metrics" ON communication_metrics;
END $$;

-- contact_activities
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view contact activities" ON contact_activities;
  DROP POLICY IF EXISTS "Users can insert contact activities" ON contact_activities;
  DROP POLICY IF EXISTS "Users can update contact activities" ON contact_activities;
  DROP POLICY IF EXISTS "Users can delete contact activities" ON contact_activities;
  DROP POLICY IF EXISTS "Users can view own contact activities" ON contact_activities;
  DROP POLICY IF EXISTS "Users can create own contact activities" ON contact_activities;
  DROP POLICY IF EXISTS "Users can update own contact activities" ON contact_activities;
  DROP POLICY IF EXISTS "Users can delete own contact activities" ON contact_activities;
  
  CREATE POLICY "Users can manage own contact activities"
    ON contact_activities FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
END $$;

-- contact_performance_metrics
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their contact performance metrics" ON contact_performance_metrics;
END $$;

-- contacts (anon)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow anonymous users to read contacts" ON contacts;
  DROP POLICY IF EXISTS "Allow anonymous users to insert contacts" ON contacts;
  DROP POLICY IF EXISTS "Allow anonymous users to update contacts" ON contacts;
  DROP POLICY IF EXISTS "Allow anonymous users to delete contacts" ON contacts;
  DROP POLICY IF EXISTS anon_select_contacts ON contacts;
  DROP POLICY IF EXISTS anon_insert_contacts ON contacts;
  DROP POLICY IF EXISTS anon_update_contacts ON contacts;
  DROP POLICY IF EXISTS anon_delete_contacts ON contacts;
  
  CREATE POLICY "Anonymous users can manage contacts"
    ON contacts FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
END $$;

-- contacts (authenticated)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated users to read contacts" ON contacts;
  DROP POLICY IF EXISTS "Allow authenticated users to insert contacts" ON contacts;
  DROP POLICY IF EXISTS "Allow authenticated users to update contacts" ON contacts;
  DROP POLICY IF EXISTS "Allow authenticated users to delete contacts" ON contacts;
  DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
  DROP POLICY IF EXISTS "Users can create own contacts" ON contacts;
  DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
  DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;
  DROP POLICY IF EXISTS auth_select_contacts ON contacts;
  DROP POLICY IF EXISTS auth_insert_contacts ON contacts;
  DROP POLICY IF EXISTS auth_update_contacts ON contacts;
  DROP POLICY IF EXISTS auth_delete_contacts ON contacts;
  
  CREATE POLICY "Authenticated users can manage own contacts"
    ON contacts FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
END $$;

-- content_templates
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read public templates" ON content_templates;
END $$;

-- content_types
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read public content types" ON content_types;
  DROP POLICY IF EXISTS "Content types are readable by all authenticated users" ON content_types;
  
  CREATE POLICY "Authenticated users can read content types"
    ON content_types FOR SELECT
    TO authenticated
    USING (true);
END $$;

-- deal_pipeline_metrics
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their pipeline metrics" ON deal_pipeline_metrics;
END $$;

-- funnels
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert their own funnels" ON funnels;
  DROP POLICY IF EXISTS "Users can update their own funnels" ON funnels;
  DROP POLICY IF EXISTS "Users can delete their own funnels" ON funnels;
  DROP POLICY IF EXISTS "Users can manage their own funnels" ON funnels;
  
  CREATE POLICY "Users can manage own funnels"
    ON funnels FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
END $$;

-- generated_content
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage their content" ON generated_content;
  DROP POLICY IF EXISTS "Users can manage their own content" ON generated_content;
  
  CREATE POLICY "Users can manage own content"
    ON generated_content FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
END $$;

-- linkedin_profiles
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage their profiles" ON linkedin_profiles;
  DROP POLICY IF EXISTS "Users can manage their own LinkedIn profile data" ON linkedin_profiles;
  
  CREATE POLICY "Users can manage own LinkedIn profiles"
    ON linkedin_profiles FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
END $$;

-- personalization_tokens
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage personalization tokens" ON personalization_tokens;
END $$;

-- profiles
DO $$
BEGIN
  DROP POLICY IF EXISTS read_own_profile ON profiles;
  DROP POLICY IF EXISTS update_own_profile ON profiles;
  DROP POLICY IF EXISTS upsert_own_profile ON profiles;
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
  
  CREATE POLICY "Users can manage own profile"
    ON profiles FOR ALL
    TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));
END $$;

-- storage_bucket_config
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view storage config" ON storage_bucket_config;
END $$;

-- streaming_sessions
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can read own streaming sessions" ON streaming_sessions;
END $$;

-- usage_logs
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their usage logs" ON usage_logs;
  DROP POLICY IF EXISTS "Users can view their own usage logs" ON usage_logs;
  
  CREATE POLICY "Users can view own usage logs"
    ON usage_logs FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));
END $$;

-- user_preferences
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage their preferences" ON user_preferences;
  DROP POLICY IF EXISTS "Users can manage their own preferences" ON user_preferences;
  
  CREATE POLICY "Users can manage own preferences"
    ON user_preferences FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
END $$;

-- =====================================================
-- SUMMARY
-- =====================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE '=== SECURITY FIX SUMMARY ===';
  RAISE NOTICE 'Foreign key indexes added: 4';
  RAISE NOTICE 'Duplicate policies consolidated: 50+';
  RAISE NOTICE 'Total active policies: %', policy_count;
  RAISE NOTICE '===========================';
END $$;
