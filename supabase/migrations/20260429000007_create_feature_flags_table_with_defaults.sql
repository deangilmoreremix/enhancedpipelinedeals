-- Create feature_flags table
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null unique,
  enabled boolean not null default false,
  rollout_percentage integer not null default 0 check (rollout_percentage >= 0 and rollout_percentage <= 100),
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.feature_flags enable row level security;

-- Allow authenticated users to read feature flags
create policy "Allow authenticated users to read feature flags"
  on public.feature_flags for select
  to authenticated
  using (true);

-- Allow service role to manage feature flags
create policy "Allow service role full access"
  on public.feature_flags for all
  to service_role
  using (true);

-- Insert default Twenty CRM Phase 1-6 feature flags
insert into public.feature_flags (feature_key, enabled, rollout_percentage, description)
values
  -- Phase 1: Advanced Kanban Features
  ('twenty_kanban_aggregation', true, 100, 'Show aggregation metrics (count, sum, avg) in kanban column headers'),
  ('twenty_wip_limits', true, 100, 'Enable Work-in-Progress limits on kanban columns'),
  ('twenty_custom_columns', true, 100, 'Allow users to create and customize pipeline columns'),

  -- Phase 2: Deal Management Enhancements
  ('deal_health_indicators', true, 100, 'Display deal health scores and factors'),
  ('win_probability_calculator', true, 100, 'Show win probability calculations and factors'),
  ('deal_templates_phase3', true, 100, 'Deal templates system with create-from-current'),
  ('bulk_deal_actions', true, 100, 'Bulk operations on multiple deals'),
  ('deal_timeline', true, 100, 'Visual timeline of deal activities and milestones'),

  -- Phase 3: Analytics & Forecasting
  ('advanced_table_view', true, 100, 'Advanced table view with custom columns, filtering, sorting'),
  ('advanced_kanban_view', true, 100, 'Enhanced kanban with drag-drop and WIP limits'),
  ('advanced_dashboard', true, 100, 'Customizable dashboard with real-time widgets'),
  ('advanced_calendar_view', true, 100, 'Calendar view for date-based deal visualization'),
  ('saved_views', true, 100, 'Save and share custom view configurations'),
  ('custom_metrics', true, 100, 'User-defined KPI calculations'),
  ('advanced_export', true, 100, 'Enhanced export capabilities (Excel, PDF, XML)'),
  ('advanced_filtering', true, 100, 'Complex filtering with AND/OR logic'),
  ('export_templates', false, 0, 'Save and reuse export configurations'),
  ('scheduled_reports', false, 0, 'Automated report generation and delivery'),

  -- Phase 4: Workflow Integration
  ('twenty_workflow_automation', true, 100, 'Automated deal progression workflows'),
  ('twenty_workflow_phase5', false, 0, 'Advanced Phase 5 workflow features (visual builder, AI agents)'),
  ('twenty_sla_monitoring', false, 0, 'Service Level Agreement tracking and alerts'),

  -- Phase 5: Calendar Integration
  ('twenty_calendar_integration', true, 100, 'Calendar integration for meetings, deadlines, and reminders'),

  -- Phase 6: AI Enhancements (most disabled by default, can be enabled via initializePhase7FeatureFlags)
  ('ai_deal_scoring', false, 0, 'AI-powered deal qualification and scoring'),
  ('ai_deal_scoring_auto_refresh', false, 0, 'Auto-refresh deal scores based on activity'),
  ('ai_competitor_analysis', false, 0, 'AI analysis of competitive landscape'),
  ('ai_competitor_alerts', false, 0, 'Real-time alerts for competitive threats'),
  ('ai_deal_insights', false, 0, 'AI-generated recommendations for deal progression'),
  ('ai_predictive_analytics', false, 0, 'Predictive metrics and forecasting'),
  ('ai_automated_notes', false, 0, 'AI summarization of deal communications'),
  ('ai_action_item_extraction', false, 0, 'Extract action items from communications'),
  ('ai_chatbot', false, 0, 'Conversational assistant with CRM data access'),
  ('ai_context_awareness', false, 0, 'Page context awareness in AI interactions'),
  ('ai_natural_language_queries', false, 0, 'Natural language queries without navigation'),
  ('ai_workflow_agents', false, 0, 'Autonomous agents for multi-step workflow tasks'),
  ('ai_agent_collaboration', false, 0, 'Multi-agent collaboration in workflows'),
  ('ai_data_enrichment', false, 0, 'Enrich records from public sources'),
  ('ai_social_enrichment', false, 0, 'Social media and professional profile enrichment'),
  ('ai_firmographic_enrichment', false, 0, 'Company size, revenue, and industry data'),
  ('ai_record_classification', false, 0, 'Automatic categorization and classification'),
  ('ai_custom_classification', false, 0, 'Custom classification schemas'),
  ('ai_summary_generation', false, 0, 'AI-generated summaries and insights'),
  ('ai_executive_summaries', false, 0, 'Executive-level summaries and reports'),
  ('ai_custom_prompts', false, 0, 'Define custom AI prompts and templates'),
  ('ai_prompt_versioning', false, 0, 'Version control and performance tracking for prompts'),
  ('ai_performance_optimization', true, 100, 'Performance optimization for AI operations'),
  ('ai_privacy_protection', true, 100, 'Privacy and security for AI data processing'),
  ('ai_rate_limiting', true, 100, 'Rate limiting for AI API calls'),

  -- Phase 7 & 8: Additional features
  ('twenty_views_reporting', true, 100, 'Saved views and reporting features'),
  ('twenty_deal_templates', true, 100, 'Deal templates panel in deals section'),
  ('twenty_workflow_phase5_features', false, 0, 'Enhanced workflow panel with visual builder');

-- Create indexes
create index idx_feature_flags_feature_key on public.feature_flags(feature_key);
create index idx_feature_flags_enabled on public.feature_flags(enabled);

-- Function to initialize all feature flags (useful for fresh deployments)
create or replace function public.initialize_all_feature_flags()
returns void as $$
begin
  -- The INSERT ... ON CONFLICT will update existing flags and insert new ones
  -- This is safe to run multiple times
  insert into public.feature_flags (feature_key, enabled, rollout_percentage, description)
  values
    -- Twenty CRM Phase 1-6 (same as above)
    ('twenty_kanban_aggregation', true, 100, 'Show aggregation metrics in kanban column headers'),
    ('twenty_wip_limits', true, 100, 'Enable Work-in-Progress limits on kanban columns'),
    ('twenty_custom_columns', true, 100, 'Allow users to create and customize pipeline columns'),
    ('deal_health_indicators', true, 100, 'Display deal health scores and factors'),
    ('win_probability_calculator', true, 100, 'Show win probability calculations and factors'),
    ('deal_templates_phase3', true, 100, 'Deal templates system with create-from-current'),
    ('bulk_deal_actions', true, 100, 'Bulk operations on multiple deals'),
    ('deal_timeline', true, 100, 'Visual timeline of deal activities and milestones'),
    ('advanced_table_view', true, 100, 'Advanced table view with custom columns, filtering, sorting'),
    ('advanced_kanban_view', true, 100, 'Enhanced kanban with drag-drop and WIP limits'),
    ('advanced_dashboard', true, 100, 'Customizable dashboard with real-time widgets'),
    ('advanced_calendar_view', true, 100, 'Calendar view for date-based deal visualization'),
    ('saved_views', true, 100, 'Save and share custom view configurations'),
    ('custom_metrics', true, 100, 'User-defined KPI calculations'),
    ('advanced_export', true, 100, 'Enhanced export capabilities (Excel, PDF, XML)'),
    ('advanced_filtering', true, 100, 'Complex filtering with AND/OR logic'),
    ('export_templates', false, 0, 'Save and reuse export configurations'),
    ('scheduled_reports', false, 0, 'Automated report generation and delivery'),
    ('twenty_workflow_automation', true, 100, 'Automated deal progression workflows'),
    ('twenty_workflow_phase5', false, 0, 'Advanced Phase 5 workflow features (visual builder, AI agents)'),
    ('twenty_sla_monitoring', false, 0, 'Service Level Agreement tracking and alerts'),
    ('twenty_calendar_integration', true, 100, 'Calendar integration for meetings, deadlines, and reminders'),
    ('ai_deal_scoring', false, 0, 'AI-powered deal qualification and scoring'),
    ('ai_deal_scoring_auto_refresh', false, 0, 'Auto-refresh deal scores based on activity'),
    ('ai_competitor_analysis', false, 0, 'AI analysis of competitive landscape'),
    ('ai_competitor_alerts', false, 0, 'Real-time alerts for competitive threats'),
    ('ai_deal_insights', false, 0, 'AI-generated recommendations for deal progression'),
    ('ai_predictive_analytics', false, 0, 'Predictive metrics and forecasting'),
    ('ai_automated_notes', false, 0, 'AI summarization of deal communications'),
    ('ai_action_item_extraction', false, 0, 'Extract action items from communications'),
    ('ai_chatbot', false, 0, 'Conversational assistant with CRM data access'),
    ('ai_context_awareness', false, 0, 'Page context awareness in AI interactions'),
    ('ai_natural_language_queries', false, 0, 'Natural language queries without navigation'),
    ('ai_workflow_agents', false, 0, 'Autonomous agents for multi-step workflow tasks'),
    ('ai_agent_collaboration', false, 0, 'Multi-agent collaboration in workflows'),
    ('ai_data_enrichment', false, 0, 'Enrich records from public sources'),
    ('ai_social_enrichment', false, 0, 'Social media and professional profile enrichment'),
    ('ai_firmographic_enrichment', false, 0, 'Company size, revenue, and industry data'),
    ('ai_record_classification', false, 0, 'Automatic categorization and classification'),
    ('ai_custom_classification', false, 0, 'Custom classification schemas'),
    ('ai_summary_generation', false, 0, 'AI-generated summaries and insights'),
    ('ai_executive_summaries', false, 0, 'Executive-level summaries and reports'),
    ('ai_custom_prompts', false, 0, 'Define custom AI prompts and templates'),
    ('ai_prompt_versioning', false, 0, 'Version control and performance tracking for prompts'),
    ('ai_performance_optimization', true, 100, 'Performance optimization for AI operations'),
    ('ai_privacy_protection', true, 100, 'Privacy and security for AI data processing'),
    ('ai_rate_limiting', true, 100, 'Rate limiting for AI API calls'),
    ('twenty_views_reporting', true, 100, 'Saved views and reporting features'),
    ('twenty_deal_templates', true, 100, 'Deal templates panel in deals section'),
    ('twenty_workflow_phase5_features', false, 0, 'Enhanced workflow panel with visual builder')
  on conflict (feature_key) do update set
    enabled = excluded.enabled,
    rollout_percentage = excluded.rollout_percentage,
    description = excluded.description,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- Grant execute to authenticated users (they need to check flags)
grant execute on function public.initialize_all_feature_flags to authenticated;
grant execute on function public.initialize_all_feature_flags to service_role;
