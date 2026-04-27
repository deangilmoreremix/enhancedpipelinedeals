-- =====================================================
-- PHASE 4: ANALYTICS & FORECASTING TABLES
-- Enhanced analytics, forecasting, and dashboard tables
-- =====================================================

-- =====================================================
-- ANALYTICS DASHBOARDS
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}',
  is_public boolean DEFAULT false,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT analytics_dashboards_user_name_unique UNIQUE (user_id, name),
  CONSTRAINT analytics_dashboards_single_default_per_user
    EXCLUDE (user_id WITH =) WHERE (is_default = true)
);

-- =====================================================
-- DASHBOARD WIDGETS
-- =====================================================

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid REFERENCES analytics_dashboards(id) ON DELETE CASCADE,
  widget_type text NOT NULL,
  title text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  position jsonb NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 4, "h": 3}',
  data_source text,
  refresh_interval integer DEFAULT 300, -- seconds
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- ANALYTICS METRICS CACHE
-- =====================================================

CREATE TABLE IF NOT EXISTS analytics_metrics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,
  user_id uuid NOT NULL,
  date_range jsonb NOT NULL DEFAULT '{"start": null, "end": null}',
  filters jsonb NOT NULL DEFAULT '{}',
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),

  UNIQUE(metric_key, user_id, date_range, filters)
);

-- =====================================================
-- FORECASTING MODELS
-- =====================================================

CREATE TABLE IF NOT EXISTS forecasting_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  model_type text NOT NULL CHECK (model_type IN ('linear', 'exponential', 'seasonal', 'ml')),
  target_metric text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}',
  accuracy numeric(5,4),
  last_trained timestamptz,
  status text DEFAULT 'inactive' CHECK (status IN ('active', 'training', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- FORECAST RESULTS
-- =====================================================

CREATE TABLE IF NOT EXISTS forecast_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES forecasting_models(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  predicted_value numeric NOT NULL,
  confidence_interval jsonb NOT NULL DEFAULT '{"lower": 0, "upper": 0}',
  actual_value numeric,
  accuracy numeric(5,4),
  factors jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- KPI DEFINITIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  formula text NOT NULL,
  data_source text NOT NULL,
  target_value numeric,
  target_direction text CHECK (target_direction IN ('higher', 'lower')),
  calculation_period text DEFAULT 'monthly' CHECK (calculation_period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(user_id, name)
);

-- =====================================================
-- KPI VALUES
-- =====================================================

CREATE TABLE IF NOT EXISTS kpi_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid REFERENCES kpi_definitions(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  value numeric NOT NULL,
  target_value numeric,
  status text NOT NULL CHECK (status IN ('on_track', 'at_risk', 'off_track')),
  calculated_at timestamptz DEFAULT now()
);

-- =====================================================
-- SALES VELOCITY METRICS
-- =====================================================

CREATE TABLE IF NOT EXISTS sales_velocity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  stage text NOT NULL,
  entered_at timestamptz NOT NULL,
  exited_at timestamptz,
  days_in_stage integer,
  velocity_score numeric(3,2), -- 0.00 to 5.00
  bottleneck_risk text CHECK (bottleneck_risk IN ('low', 'medium', 'high')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- PREDICTIVE ANALYTICS RESULTS
-- =====================================================

CREATE TABLE IF NOT EXISTS predictive_analytics_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  analysis_type text NOT NULL,
  target_entity text NOT NULL, -- deal_id, contact_id, etc.
  prediction jsonb NOT NULL,
  confidence numeric(3,2) NOT NULL,
  factors jsonb NOT NULL DEFAULT '{}',
  recommendations jsonb NOT NULL DEFAULT '[]',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Analytics dashboards
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_user_id ON analytics_dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_is_default ON analytics_dashboards(user_id, is_default) WHERE is_default = true;

-- Dashboard widgets
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard_id ON dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_widget_type ON dashboard_widgets(widget_type);

-- Analytics cache
CREATE INDEX IF NOT EXISTS idx_analytics_cache_user_id ON analytics_metrics_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires_at ON analytics_metrics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_metric_key ON analytics_metrics_cache(metric_key);

-- Forecasting
CREATE INDEX IF NOT EXISTS idx_forecasting_models_user_id ON forecasting_models(user_id);
CREATE INDEX IF NOT EXISTS idx_forecasting_models_status ON forecasting_models(status);
CREATE INDEX IF NOT EXISTS idx_forecast_results_model_id ON forecast_results(model_id);
CREATE INDEX IF NOT EXISTS idx_forecast_results_forecast_date ON forecast_results(forecast_date);

-- KPIs
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_user_id ON kpi_definitions(user_id);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_active ON kpi_definitions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kpi_values_kpi_id ON kpi_values(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_values_period ON kpi_values(period_start, period_end);

-- Sales velocity
CREATE INDEX IF NOT EXISTS idx_sales_velocity_deal_id ON sales_velocity_metrics(deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_velocity_stage ON sales_velocity_metrics(stage);
CREATE INDEX IF NOT EXISTS idx_sales_velocity_bottleneck ON sales_velocity_metrics(bottleneck_risk);

-- Predictive analytics
CREATE INDEX IF NOT EXISTS idx_predictive_analytics_user_id ON predictive_analytics_results(user_id);
CREATE INDEX IF NOT EXISTS idx_predictive_analytics_type ON predictive_analytics_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_predictive_analytics_expires_at ON predictive_analytics_results(expires_at);

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- Calculate sales velocity for a deal
CREATE OR REPLACE FUNCTION calculate_deal_velocity(deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  total_time integer;
  stages_count integer;
  avg_velocity numeric;
BEGIN
  SELECT
    SUM(days_in_stage),
    COUNT(*),
    AVG(velocity_score)
  INTO total_time, stages_count, avg_velocity
  FROM sales_velocity_metrics
  WHERE sales_velocity_metrics.deal_id = $1;

  SELECT jsonb_build_object(
    'total_days', COALESCE(total_time, 0),
    'stages_completed', COALESCE(stages_count, 0),
    'average_velocity_score', COALESCE(avg_velocity, 0),
    'current_stage', (
      SELECT stage FROM sales_velocity_metrics
      WHERE sales_velocity_metrics.deal_id = $1
      ORDER BY entered_at DESC
      LIMIT 1
    ),
    'bottleneck_risks', (
      SELECT jsonb_agg(bottleneck_risk)
      FROM sales_velocity_metrics
      WHERE sales_velocity_metrics.deal_id = $1
        AND bottleneck_risk IN ('medium', 'high')
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Get pipeline health score
CREATE OR REPLACE FUNCTION get_pipeline_health_score(user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  health_score numeric := 50; -- Base score
  total_deals integer;
  active_deals integer;
  conversion_rate numeric;
  avg_velocity numeric;
BEGIN
  -- Get basic metrics
  SELECT COUNT(*), COUNT(*) FILTER (WHERE stage NOT IN ('closed-won', 'closed-lost'))
  INTO total_deals, active_deals
  FROM deals;

  IF total_deals = 0 THEN
    RETURN 0;
  END IF;

  -- Conversion rate factor
  SELECT (COUNT(*) FILTER (WHERE stage = 'closed-won')::numeric / total_deals) * 100
  INTO conversion_rate;

  health_score := health_score + LEAST(conversion_rate * 0.5, 25);

  -- Velocity factor (simplified)
  SELECT AVG(days_in_stage)
  INTO avg_velocity
  FROM sales_velocity_metrics
  WHERE exited_at IS NOT NULL;

  IF avg_velocity IS NOT NULL THEN
    -- Better velocity = higher score
    IF avg_velocity < 14 THEN
      health_score := health_score + 15;
    ELSIF avg_velocity < 30 THEN
      health_score := health_score + 10;
    ELSE
      health_score := health_score - 5;
    END IF;
  END IF;

  -- Distribution factor
  IF active_deals > 0 THEN
    health_score := health_score + LEAST(active_deals::numeric / total_deals * 20, 10);
  END IF;

  RETURN LEAST(GREATEST(health_score, 0), 100);
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update timestamps
CREATE TRIGGER analytics_dashboards_update_timestamp
  BEFORE UPDATE ON analytics_dashboards
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER dashboard_widgets_update_timestamp
  BEFORE UPDATE ON dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER forecasting_models_update_timestamp
  BEFORE UPDATE ON forecasting_models
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER kpi_definitions_update_timestamp
  BEFORE UPDATE ON kpi_definitions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER sales_velocity_metrics_update_timestamp
  BEFORE UPDATE ON sales_velocity_metrics
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Auto-calculate days in stage
CREATE OR REPLACE FUNCTION update_days_in_stage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.exited_at IS NOT NULL AND OLD.exited_at IS NULL THEN
    NEW.days_in_stage := EXTRACT(EPOCH FROM (NEW.exited_at - NEW.entered_at)) / 86400;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sales_velocity_metrics_update_days
  BEFORE UPDATE ON sales_velocity_metrics
  FOR EACH ROW EXECUTE FUNCTION update_days_in_stage();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Analytics dashboards
ALTER TABLE analytics_dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_dashboards_user_access ON analytics_dashboards
  FOR ALL USING (auth.uid() = user_id);

-- Dashboard widgets
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY dashboard_widgets_dashboard_access ON dashboard_widgets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM analytics_dashboards
      WHERE id = dashboard_widgets.dashboard_id
      AND user_id = auth.uid()
    )
  );

-- Analytics cache
ALTER TABLE analytics_metrics_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_cache_user_access ON analytics_metrics_cache
  FOR ALL USING (auth.uid() = user_id);

-- Forecasting models
ALTER TABLE forecasting_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY forecasting_models_user_access ON forecasting_models
  FOR ALL USING (auth.uid() = user_id);

-- Forecast results
ALTER TABLE forecast_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY forecast_results_model_access ON forecast_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM forecasting_models
      WHERE id = forecast_results.model_id
      AND user_id = auth.uid()
    )
  );

-- KPI definitions
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_definitions_user_access ON kpi_definitions
  FOR ALL USING (auth.uid() = user_id);

-- KPI values
ALTER TABLE kpi_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_values_kpi_access ON kpi_values
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM kpi_definitions
      WHERE id = kpi_values.kpi_id
      AND user_id = auth.uid()
    )
  );

-- Sales velocity metrics (based on deal access)
ALTER TABLE sales_velocity_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_velocity_deal_access ON sales_velocity_metrics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = sales_velocity_metrics.deal_id
      AND deals.contact_id IN (
        SELECT id FROM contacts WHERE contacts.user_id = auth.uid()
      )
    )
  );

-- Predictive analytics results
ALTER TABLE predictive_analytics_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY predictive_analytics_user_access ON predictive_analytics_results
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- INITIAL DATA SEEDING
-- =====================================================

-- Insert sample KPI definitions
INSERT INTO kpi_definitions (user_id, name, description, formula, data_source, target_value, target_direction, calculation_period) VALUES
('00000000-0000-0000-0000-000000000000', 'Monthly Revenue', 'Total revenue from closed deals', 'SUM(deals.value WHERE stage = ''closed-won'')', 'deals', 50000, 'higher', 'monthly'),
('00000000-0000-0000-0000-000000000000', 'Conversion Rate', 'Percentage of deals that close', '(COUNT(deals WHERE stage = ''closed-won'') / COUNT(deals)) * 100', 'deals', 25, 'higher', 'monthly'),
('00000000-0000-0000-0000-000000000000', 'Average Deal Size', 'Average value of closed deals', 'AVG(deals.value WHERE stage = ''closed-won'')', 'deals', 15000, 'higher', 'monthly'),
('00000000-0000-0000-0000-000000000000', 'Sales Velocity', 'Average days to close deals', 'AVG(days_in_stage FROM sales_velocity_metrics)', 'sales_velocity_metrics', 45, 'lower', 'monthly')
ON CONFLICT DO NOTHING;

-- Insert Phase 4 feature flags
INSERT INTO feature_flags (feature_key, enabled, rollout_percentage, description) VALUES
('twenty_phase4_analytics', false, 0, 'Phase 4: Analytics & Forecasting - Pipeline analytics, forecasting, custom dashboards'),
('twenty_pipeline_analytics', false, 0, 'Advanced pipeline analytics with revenue forecasting and conversion rates'),
('twenty_deal_stage_analytics', false, 0, 'Deal stage analytics with time tracking and bottleneck identification'),
('twenty_sales_velocity', false, 0, 'Sales velocity metrics and deal progression analysis'),
('twenty_predictive_analytics', false, 0, 'AI-powered predictive analytics for deal outcomes'),
('twenty_custom_dashboards', false, 0, 'Custom dashboards with real-time widgets'),
('twenty_kpi_monitoring', false, 0, 'Configurable KPIs and performance monitoring'),
('twenty_interactive_filters', false, 0, 'Interactive dashboard filters and drill-down capabilities'),
('twenty_advanced_charts', false, 0, 'Multiple chart types and data visualization options'),
('twenty_analytics_export', false, 0, 'Export capabilities for analytics data and reports')
ON CONFLICT (feature_key) DO NOTHING;

-- Insert default dashboard
INSERT INTO analytics_dashboards (user_id, name, description, config, is_default) VALUES
('00000000-0000-0000-0000-000000000000', 'Sales Performance Dashboard', 'Comprehensive sales analytics and forecasting', '{
  "theme": "default",
  "auto_refresh": true,
  "refresh_interval": 300
}', true)
ON CONFLICT DO NOTHING;