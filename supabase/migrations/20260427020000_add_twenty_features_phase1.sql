-- =====================================================
-- TWENTY CRM FEATURES INTEGRATION - PHASE 1 FOUNDATION
-- Migration: Add tables for custom columns, templates, workflows, and enhanced deals
-- =====================================================

-- Custom pipeline columns (user-defined pipeline stages)
CREATE TABLE IF NOT EXISTS custom_pipeline_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text, -- Will be updated when multi-tenant support is added
  name text NOT NULL,
  position integer DEFAULT 0,
  config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Deal templates system
CREATE TABLE IF NOT EXISTS deal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  template_data jsonb NOT NULL,
  is_public boolean DEFAULT false,
  created_by text, -- User ID
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Deal workflows for automation
CREATE TABLE IF NOT EXISTS deal_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  stages jsonb DEFAULT '[]',
  triggers jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_by text, -- User ID
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Saved pipeline views
CREATE TABLE IF NOT EXISTS saved_pipeline_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  view_type text DEFAULT 'kanban', -- kanban, table, calendar, etc.
  filters jsonb DEFAULT '{}',
  sorting jsonb DEFAULT '{}',
  columns jsonb DEFAULT '[]',
  is_default boolean DEFAULT false,
  created_by text, -- User ID
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Deal health and probability enhancements
ALTER TABLE deals ADD COLUMN IF NOT EXISTS health_score integer CHECK (health_score >= 0 AND health_score <= 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS win_probability decimal(5,2) CHECK (win_probability >= 0 AND win_probability <= 100);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES deal_templates(id);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS workflow_id uuid REFERENCES deal_workflows(id);

-- Deal timeline activities (enhanced activities for deals)
CREATE TABLE IF NOT EXISTS deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  type text NOT NULL, -- created, updated, stage_changed, comment, etc.
  description text,
  metadata jsonb DEFAULT '{}',
  created_by text, -- User ID
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_columns_user ON custom_pipeline_columns(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_templates_public ON deal_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_deal_workflows_active ON deal_workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_saved_views_user ON saved_pipeline_views(created_by);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deals_health ON deals(health_score);
CREATE INDEX IF NOT EXISTS idx_deals_probability ON deals(win_probability);

-- Feature flags table for gradual rollout
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  enabled boolean DEFAULT false,
  rollout_percentage integer DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert initial feature flags for Twenty features
INSERT INTO feature_flags (feature_key, enabled, rollout_percentage, description) VALUES
  ('twenty_kanban_aggregation', false, 0, 'Column aggregation with counts, sums, averages'),
  ('twenty_wip_limits', false, 0, 'Work in progress limits per column'),
  ('twenty_custom_columns', false, 0, 'User-defined pipeline stages'),
  ('twenty_deal_health', false, 0, 'Deal health indicators and scoring'),
  ('twenty_win_probability', false, 0, 'Advanced win probability calculations'),
  ('twenty_deal_templates', false, 0, 'Pre-built deal templates'),
  ('twenty_bulk_actions', false, 0, 'Multi-deal operations'),
  ('twenty_deal_timeline', false, 0, 'Activity tracking per deal'),
  ('twenty_analytics_enhanced', false, 0, 'Enhanced analytics with forecasting'),
  ('twenty_workflow_automation', false, 0, 'Deal workflow automation'),
  ('twenty_calendar_integration', false, 0, 'Deep calendar integration'),
  ('twenty_ai_enhancements', false, 0, 'Additional AI features from Twenty'),
  ('twenty_views_reporting', false, 0, 'Enhanced views and reporting'),
  ('twenty_api_integration', false, 0, 'Unified API endpoints'),
  ('twenty_security_compliance', false, 0, 'Advanced security features')
ON CONFLICT (feature_key) DO NOTHING;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_pipeline_columns_update_timestamp
  BEFORE UPDATE ON custom_pipeline_columns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER deal_templates_update_timestamp
  BEFORE UPDATE ON deal_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER deal_workflows_update_timestamp
  BEFORE UPDATE ON deal_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER saved_pipeline_views_update_timestamp
  BEFORE UPDATE ON saved_pipeline_views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER feature_flags_update_timestamp
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();