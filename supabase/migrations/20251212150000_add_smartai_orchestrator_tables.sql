-- =====================================================
-- SMARTAI ORCHESTRATOR - ADDITIONAL TABLES
-- Migration for SmartAIOrchestrator advanced features
-- =====================================================

-- =====================================================
-- CUSTOM PERSONAS (PersonaService)
-- =====================================================

CREATE TABLE IF NOT EXISTS custom_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  tone text NOT NULL,
  ideal_segments text[] DEFAULT '{}',
  email_style text NOT NULL,
  communication_focus text[] DEFAULT '{}',
  is_default boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT custom_personas_user_name_unique UNIQUE (user_id, name),
  CONSTRAINT custom_personas_single_default_per_user
    EXCLUDE (user_id WITH =) WHERE (is_default = true)
);

-- Indexes for custom_personas
CREATE INDEX IF NOT EXISTS idx_custom_personas_user_id ON custom_personas(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_personas_is_default ON custom_personas(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_custom_personas_usage_count ON custom_personas(usage_count DESC);

-- =====================================================
-- AI FEEDBACK (FeedbackLoopService)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task text NOT NULL,
  feature text NOT NULL,
  score integer NOT NULL CHECK (score >= 1 AND score <= 5),
  feedback text NOT NULL CHECK (feedback IN ('good', 'bad', 'neutral')),
  comments text,
  context jsonb DEFAULT '{}',
  session_id text,
  timestamp timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT ai_feedback_score_range CHECK (score >= 1 AND score <= 5),
  CONSTRAINT ai_feedback_feedback_type CHECK (feedback IN ('good', 'bad', 'neutral'))
);

-- Indexes for ai_feedback
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_id ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_task ON ai_feedback(task);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_timestamp ON ai_feedback(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_score ON ai_feedback(score);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_feedback ON ai_feedback(feedback);

-- =====================================================
-- DEAL HISTORY (AdvancedAnalyticsService)
-- =====================================================

CREATE TABLE IF NOT EXISTS deal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  changed_by uuid,
  changed_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT deal_history_field_not_empty CHECK (length(field) > 0)
);

-- Indexes for deal_history
CREATE INDEX IF NOT EXISTS idx_deal_history_deal_id ON deal_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_history_changed_at ON deal_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_history_field ON deal_history(field);

-- =====================================================
-- APP SETTINGS (SupabaseService)
-- =====================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT app_settings_key_not_empty CHECK (length(setting_key) > 0),
  CONSTRAINT app_settings_unique_user_key UNIQUE (user_id, setting_key),
  CONSTRAINT app_settings_unique_global_key EXCLUDE (setting_key WITH =) WHERE (user_id IS NULL)
);

-- Indexes for app_settings
CREATE INDEX IF NOT EXISTS idx_app_settings_user_id ON app_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_app_settings_user_key ON app_settings(user_id, setting_key);

-- =====================================================
-- MONITORING TABLES (MonitoringService)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_name text NOT NULL,
  operation text NOT NULL,
  model_used text,
  tokens_used integer,
  cost_usd numeric(10,6),
  duration_ms integer,
  success boolean DEFAULT true,
  error_message text,
  metadata jsonb DEFAULT '{}',
  timestamp timestamptz DEFAULT now()
);

-- Indexes for ai_usage_metrics
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_service ON ai_usage_metrics(service_name);
CREATE INDEX IF NOT EXISTS idx_ai_usage_timestamp ON ai_usage_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_success ON ai_usage_metrics(success);

-- =====================================================
-- PREDICTION MODEL METADATA (AdvancedAnalyticsService)
-- =====================================================

CREATE TABLE IF NOT EXISTS prediction_models (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('regression', 'classification', 'time_series', 'clustering')),
  target text NOT NULL,
  features text[] DEFAULT '{}',
  accuracy numeric(5,4) DEFAULT 0,
  last_trained timestamptz,
  status text DEFAULT 'inactive' CHECK (status IN ('active', 'training', 'inactive')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for prediction_models
CREATE INDEX IF NOT EXISTS idx_prediction_models_status ON prediction_models(status);
CREATE INDEX IF NOT EXISTS idx_prediction_models_type ON prediction_models(type);
CREATE INDEX IF NOT EXISTS idx_prediction_models_accuracy ON prediction_models(accuracy DESC);

-- =====================================================
-- RPC FUNCTIONS FOR SMARTAI FEATURES
-- =====================================================

-- Increment persona usage count
CREATE OR REPLACE FUNCTION increment_persona_usage(persona_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE custom_personas
  SET usage_count = usage_count + 1, updated_at = now()
  WHERE id = persona_id;
END;
$$;

-- Get persona usage statistics
CREATE OR REPLACE FUNCTION get_persona_usage_stats(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_personas', COUNT(*),
    'total_usage', SUM(usage_count),
    'most_used', (
      SELECT jsonb_build_object('id', id, 'name', name, 'usage_count', usage_count)
      FROM custom_personas
      WHERE user_id = $1
      ORDER BY usage_count DESC
      LIMIT 1
    ),
    'default_persona', (
      SELECT jsonb_build_object('id', id, 'name', name)
      FROM custom_personas
      WHERE user_id = $1 AND is_default = true
      LIMIT 1
    )
  ) INTO result
  FROM custom_personas
  WHERE user_id = $1;

  RETURN result;
END;
$$;

-- Get AI feedback analytics
CREATE OR REPLACE FUNCTION get_ai_feedback_analytics(user_id uuid DEFAULT NULL, days_back integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  start_date timestamptz;
BEGIN
  start_date := now() - interval '1 day' * days_back;

  SELECT jsonb_build_object(
    'total_feedback', COUNT(*),
    'average_score', ROUND(AVG(score)::numeric, 2),
    'feedback_distribution', jsonb_build_object(
      'good', COUNT(*) FILTER (WHERE feedback = 'good'),
      'bad', COUNT(*) FILTER (WHERE feedback = 'bad'),
      'neutral', COUNT(*) FILTER (WHERE feedback = 'neutral')
    ),
    'task_breakdown', (
      SELECT jsonb_object_agg(task, stats)
      FROM (
        SELECT
          task,
          jsonb_build_object(
            'count', COUNT(*),
            'avg_score', ROUND(AVG(score)::numeric, 2),
            'good_rate', ROUND((COUNT(*) FILTER (WHERE feedback = 'good'))::numeric / COUNT(*) * 100, 1)
          ) as stats
        FROM ai_feedback
        WHERE (user_id IS NULL OR ai_feedback.user_id = user_id)
          AND timestamp >= start_date
        GROUP BY task
      ) t
    ),
    'trend', CASE
      WHEN AVG(score) > 3.5 THEN 'improving'
      WHEN AVG(score) < 3.0 THEN 'declining'
      ELSE 'stable'
    END
  ) INTO result
  FROM ai_feedback
  WHERE (user_id IS NULL OR ai_feedback.user_id = user_id)
    AND timestamp >= start_date;

  RETURN result;
END;
$$;

-- Get deal velocity metrics
CREATE OR REPLACE FUNCTION get_deal_velocity_metrics(deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  total_days integer;
  stage_changes integer;
BEGIN
  SELECT
    EXTRACT(EPOCH FROM (now() - MIN(changed_at))) / 86400,
    COUNT(*)
  INTO total_days, stage_changes
  FROM deal_history
  WHERE deal_id = $1 AND field = 'stage';

  SELECT jsonb_build_object(
    'total_days', total_days,
    'stage_changes', stage_changes,
    'avg_days_per_stage', CASE WHEN stage_changes > 0 THEN total_days / stage_changes ELSE NULL END,
    'current_stage', (
      SELECT new_value
      FROM deal_history
      WHERE deal_id = $1 AND field = 'stage'
      ORDER BY changed_at DESC
      LIMIT 1
    ),
    'stage_timeline', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'stage', new_value,
          'entered_at', changed_at,
          'days_in_stage', EXTRACT(EPOCH FROM (LEAD(changed_at) OVER (ORDER BY changed_at) - changed_at)) / 86400
        )
      )
      FROM deal_history
      WHERE deal_id = $1 AND field = 'stage'
      ORDER BY changed_at
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- =====================================================
-- AUTO-TRIGGERS FOR NEW TABLES
-- =====================================================

-- Auto-update timestamps for custom_personas
CREATE TRIGGER custom_personas_update_timestamp
BEFORE UPDATE ON custom_personas
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Auto-update timestamps for prediction_models
CREATE TRIGGER prediction_models_update_timestamp
BEFORE UPDATE ON prediction_models
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Deal history trigger (auto-log changes)
CREATE OR REPLACE FUNCTION log_deal_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Log stage changes
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
      INSERT INTO deal_history (deal_id, field, old_value, new_value, changed_by)
      VALUES (NEW.id, 'stage', OLD.stage, NEW.stage, NEW.updated_by);
    END IF;

    -- Log value changes
    IF OLD.value IS DISTINCT FROM NEW.value THEN
      INSERT INTO deal_history (deal_id, field, old_value, new_value, changed_by)
      VALUES (NEW.id, 'value', OLD.value::text, NEW.value::text, NEW.updated_by);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER deals_change_log
AFTER UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION log_deal_changes();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Custom personas: Users can only access their own personas
ALTER TABLE custom_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY custom_personas_user_access ON custom_personas
FOR ALL USING (auth.uid() = user_id);

-- AI feedback: Users can only access their own feedback
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_feedback_user_access ON ai_feedback
FOR ALL USING (auth.uid() = user_id);

-- App settings: Users can access their own settings, or global settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_settings_user_access ON app_settings
FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- AI usage metrics: Users can only access their own metrics
ALTER TABLE ai_usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_usage_metrics_user_access ON ai_usage_metrics
FOR ALL USING (auth.uid() = user_id);

-- Prediction models: Read-only for all authenticated users
ALTER TABLE prediction_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY prediction_models_read_access ON prediction_models
FOR SELECT USING (auth.role() = 'authenticated');

-- Deal history: Users can access history for deals they have access to
ALTER TABLE deal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_history_access ON deal_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM deals
    WHERE deals.id = deal_history.deal_id
    AND deals.contact_id IN (
      SELECT id FROM contacts WHERE contacts.user_id = auth.uid()
    )
  )
);

-- =====================================================
-- INITIAL DATA SEEDING
-- =====================================================

-- Insert default prediction models
INSERT INTO prediction_models (id, name, type, target, features, accuracy, status) VALUES
('sales_velocity', 'Sales Velocity Predictor', 'regression', 'deal_close_time', ARRAY['deal_size', 'stage', 'engagement_score', 'stakeholder_count'], 0.78, 'active'),
('churn_risk', 'Customer Churn Predictor', 'classification', 'churn_probability', ARRAY['engagement_score', 'last_interaction', 'contract_value', 'support_tickets'], 0.82, 'active'),
('deal_success', 'Deal Success Predictor', 'classification', 'win_probability', ARRAY['competitor_pressure', 'budget_approval', 'stakeholder_alignment', 'timeline_fit'], 0.75, 'active'),
('market_trends', 'Market Trend Analyzer', 'time_series', 'market_demand', ARRAY['industry_news', 'economic_indicators', 'competitor_activity', 'customer_sentiment'], 0.71, 'active')
ON CONFLICT (id) DO NOTHING;

-- Insert default app settings
INSERT INTO app_settings (setting_key, setting_value) VALUES
('default_deal_view', '"kanban"'),
('table_columns', '["title", "company", "value", "stage", "probability"]'),
('list_sort_by', '"updated"'),
('list_sort_order', '"desc"'),
('ai_model_preference', '"gpt-5.2-thinking"'),
('persona_usage_tracking', 'true'),
('feedback_collection_enabled', 'true')
ON CONFLICT (setting_key) DO NOTHING;