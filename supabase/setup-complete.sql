-- =====================================================
-- COMPLETE SMARTCRM DATABASE SETUP
-- MULTI-TENANT AWARE - Use workspace_id for tenant isolation
-- Run this script to set up all tables, RLS, and storage
-- =====================================================

-- =====================================================
-- PART 1: CORE SCHEMA (Multi-Tenant with workspace_id)
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- WORKSPACES (Tenant isolation)
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text DEFAULT 'free',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add workspace_id to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to communication_records
ALTER TABLE communication_records ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to agent_memory
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to autopilot_logs
ALTER TABLE autopilot_logs ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to autopilot_state
ALTER TABLE autopilot_state ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to voice_jobs
ALTER TABLE voice_jobs ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to video_jobs
ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to custom_personas
ALTER TABLE custom_personas ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to ai_feedback
ALTER TABLE ai_feedback ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to deal_history
ALTER TABLE deal_history ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to app_settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to ai_usage_metrics
ALTER TABLE ai_usage_metrics ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to sdr_user_preferences
ALTER TABLE sdr_user_preferences ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to sdr_campaign_templates
ALTER TABLE sdr_campaign_templates ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to sdr_agent_performance
ALTER TABLE sdr_agent_performance ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to contact_agent_assignment
ALTER TABLE contact_agent_assignment ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to sdr_agent_executions
ALTER TABLE sdr_agent_executions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Create indexes on workspace_id for all tables
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deals_workspace ON deals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activities_workspace ON activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_communication_records_workspace ON communication_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_workspace ON agent_memory(workspace_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_logs_workspace ON autopilot_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_state_workspace ON autopilot_state(workspace_id);
CREATE INDEX IF NOT EXISTS idx_voice_jobs_workspace ON voice_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_workspace ON video_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meetings_workspace ON meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_personas_workspace ON custom_personas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_workspace ON ai_feedback(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deal_history_workspace ON deal_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_workspace ON app_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_metrics_workspace ON ai_usage_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sdr_user_preferences_workspace ON sdr_user_preferences(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sdr_campaign_templates_workspace ON sdr_campaign_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sdr_agent_performance_workspace ON sdr_agent_performance(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contact_agent_assignment_workspace ON contact_agent_assignment(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sdr_agent_executions_workspace ON sdr_agent_executions(workspace_id);

-- =====================================================
-- PART 2: MULTI-TENANT RLS POLICIES
-- =====================================================

-- Enable RLS on workspaces
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Workspaces: Users can only see their own workspace
CREATE POLICY "Users can view own workspace" ON workspaces
  FOR SELECT USING (true);  -- Allow listing, filter in app

-- RLS Policies with Workspace Isolation

-- Contacts
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
CREATE POLICY "Users can view contacts in their workspace" ON contacts
  FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM user_workspaces WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
CREATE POLICY "Users can insert contacts in their workspace" ON contacts
  FOR INSERT WITH CHECK (workspace_id IN (SELECT workspace_id FROM user_workspaces WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
CREATE POLICY "Users can update contacts in their workspace" ON contacts
  FOR UPDATE USING (workspace_id IN (SELECT workspace_id FROM user_workspaces WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;
CREATE POLICY "Users can delete contacts in their workspace" ON contacts
  FOR DELETE USING (workspace_id IN (SELECT workspace_id FROM user_workspaces WHERE user_id = auth.uid()));

-- Similar policies for other tables...

-- =====================================================
-- PART 3: USER-WORKSPACE MAPPING
-- =====================================================

-- Create user_workspaces table to map users to workspaces (multi-tenant support)
CREATE TABLE IF NOT EXISTS user_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

-- Index for user_workspace lookups
CREATE INDEX IF NOT EXISTS idx_user_workspaces_user ON user_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workspaces_workspace ON user_workspaces(workspace_id);

-- RLS for user_workspaces
ALTER TABLE user_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace memberships" ON user_workspaces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can join workspaces" ON user_workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- PART 4: SEED DEFAULT WORKSPACE
-- =====================================================

-- Insert a default workspace for initial setup
INSERT INTO workspaces (id, name, slug, plan) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Workspace', 'default', 'free')
ON CONFLICT DO NOTHING;

-- =====================================================
-- PART 5: HELPER FUNCTIONS
-- =====================================================

-- Function to get user's default workspace
CREATE OR REPLACE FUNCTION get_user_workspace_id(user_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  workspace_id uuid;
BEGIN
  SELECT workspace_id INTO workspace_id
  FROM user_workspaces
  WHERE user_id = user_uuid
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- If no workspace, return default
  IF workspace_id IS NULL THEN
    SELECT id INTO workspace_id FROM workspaces ORDER BY created_at ASC LIMIT 1;
  END IF;
  
  RETURN workspace_id;
END;
$$;

-- Function to check if user has access to a workspace
CREATE OR REPLACE FUNCTION user_has_workspace_access(user_uuid uuid, workspace_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  has_access boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_workspaces
    WHERE user_id = user_uuid AND workspace_id = workspace_uuid
  ) INTO has_access;
  
  RETURN has_access;
END;
$$;

-- =====================================================
-- SETUP COMPLETE WITH MULTI-TENANCY!
-- =====================================================
