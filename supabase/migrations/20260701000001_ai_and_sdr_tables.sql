-- AI / SDR agent / analytics / workflow / enterprise (security, GDPR, export, integrations) tables.
-- Idempotent: safe to re-run. RLS follows 20260613000000_fix_rls_for_anon_access.sql:
--   'crm'     = anon select+insert, authenticated all, service_role all
--   'private' = authenticated all, service_role all (no anon)

create or replace function public._apply_std_rls(tbl text, mode text) returns void
language plpgsql as $fn$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format('drop policy if exists "Allow authenticated access" on public.%I', tbl);
  execute format('create policy "Allow authenticated access" on public.%I for all to authenticated using (true) with check (true)', tbl);
  execute format('drop policy if exists "Allow service role full access" on public.%I', tbl);
  execute format('create policy "Allow service role full access" on public.%I for all to service_role using (true) with check (true)', tbl);
  execute format('drop policy if exists "Allow anon read access" on public.%I', tbl);
  execute format('drop policy if exists "Allow anon insert" on public.%I', tbl);
  if mode = 'crm' then
    execute format('create policy "Allow anon read access" on public.%I for select to anon using (true)', tbl);
    execute format('create policy "Allow anon insert" on public.%I for insert to anon with check (true)', tbl);
  end if;
end
$fn$;

-- ---------------------------------------------------------------------------
-- SDR agent runtime (netlify/functions/_sdrAgents.ts, src/agents/sdr/*)
-- ---------------------------------------------------------------------------
create table if not exists public.autopilot_state (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.contacts(id) on delete cascade,
  agent_type text not null default 'sdr_autopilot',
  state jsonb default '{}',
  state_json jsonb,
  status text,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (lead_id),
  unique (lead_id, agent_type)
);

create table if not exists public.agent_threads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.contacts(id) on delete cascade,
  agent_type text default 'sdr_autopilot',
  thread_id text,
  openai_conversation_id text,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (lead_id)
);

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  memory_type text,
  data jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_agent_memory_contact on public.agent_memory(contact_id, memory_type);

create table if not exists public.agent_metrics (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null unique,
  total_runs integer default 0,
  successful_runs integer default 0,
  failed_runs integer default 0,
  average_response_time numeric default 0,
  last_run_at timestamptz,
  error_rate numeric default 0,
  updated_at timestamptz default now()
);

create table if not exists public.agent_metadata (
  id text primary key,
  label text,
  short text,
  category text,
  tags text[] default '{}',
  usage_count integer default 0,
  last_used timestamptz,
  favorite boolean default false,
  config jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sdr_personas (
  id text primary key default gen_random_uuid()::text,
  user_id uuid,
  name text,
  description text,
  persona_prompt text,
  tone text,
  config jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agent_persona_selection (
  agent_id text primary key,
  persona_id text,
  updated_at timestamptz default now()
);

create table if not exists public.contact_agent_assignment (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  agent_id text,
  assigned_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sdr_agent_executions (
  id uuid primary key default gen_random_uuid(),
  agent_id text,
  context_id text,
  success boolean,
  action text,
  execution_time numeric,
  result_data jsonb,
  executed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.voice_jobs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  script text,
  status text default 'pending',
  audio_base64 text,
  audio_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_voice_jobs_status on public.voice_jobs(status);

create table if not exists public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  template text default 'default',
  props jsonb default '{}',
  status text default 'pending',
  video_base64 text,
  video_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_video_jobs_status on public.video_jobs(status);

create table if not exists public.ai_usage_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  service_name text,
  operation text,
  model_used text,
  tokens_used integer,
  cost_usd numeric,
  duration_ms integer,
  success boolean default true,
  error_message text,
  metadata jsonb default '{}',
  "timestamp" timestamptz default now()
);
create index if not exists idx_ai_usage_metrics_ts on public.ai_usage_metrics("timestamp" desc);

create table if not exists public.pipeline_analysis (
  id uuid primary key default gen_random_uuid(),
  analysis_data jsonb,
  created_at timestamptz default now()
);

create table if not exists public.ai_agent_configurations (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  model text,
  prompt text,
  tools jsonb default '[]',
  max_tokens integer,
  temperature numeric,
  context_window integer,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Workflows / triggers / webhook configs
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_executions (
  id text primary key default gen_random_uuid()::text,
  workflow_id text,
  trigger_id text,
  trigger_type text,
  status text,
  started_at timestamptz,
  completed_at timestamptz,
  duration numeric,
  context jsonb,
  steps jsonb,
  logs jsonb,
  error_message text,
  error_step_id text,
  error_stack_trace text,
  created_at timestamptz default now()
);
create index if not exists idx_workflow_executions_wf on public.workflow_executions(workflow_id, started_at desc);

create table if not exists public.workflow_analytics (
  id uuid primary key default gen_random_uuid(),
  workflow_id text not null unique,
  total_executions integer default 0,
  successful_executions integer default 0,
  failed_executions integer default 0,
  average_execution_time numeric default 0,
  step_performance jsonb default '{}',
  trigger_frequency jsonb default '{}',
  action_frequency jsonb default '{}',
  last_updated timestamptz default now()
);

create table if not exists public.scheduled_triggers (
  id uuid primary key default gen_random_uuid(),
  workflow_id text,
  name text,
  schedule_config jsonb default '{}',
  is_active boolean default true,
  last_run timestamptz,
  next_run timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.webhook_configurations (
  id uuid primary key default gen_random_uuid(),
  name text,
  url text,
  method text default 'POST',
  headers jsonb default '{}',
  secret text,
  events text[] default '{}',
  is_active boolean default true,
  retry_policy jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.activity_templates (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  activity_type text,
  default_metadata jsonb default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Analytics / KPIs / dashboards / views
-- ---------------------------------------------------------------------------
create table if not exists public.kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  formula text,
  data_source text,
  target_value numeric,
  target_direction text,
  calculation_period text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.kpi_values (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid references public.kpi_definitions(id) on delete cascade,
  period_start date,
  period_end date,
  value numeric,
  target_value numeric,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_kpi_values_kpi on public.kpi_values(kpi_id, period_end desc);

create table if not exists public.sales_velocity_metrics (
  id uuid primary key default gen_random_uuid(),
  period_start date,
  period_end date,
  metrics jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists public.forecast_results (
  id uuid primary key default gen_random_uuid(),
  model_id text,
  forecast_date date,
  predicted_value numeric,
  actual_value numeric,
  confidence numeric,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_forecast_results_model on public.forecast_results(model_id, forecast_date desc);

create table if not exists public.custom_metrics (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  formula text,
  parameters jsonb default '{}',
  data_type text,
  category text,
  visualization text,
  is_active boolean default true,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.metric_values (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid references public.custom_metrics(id) on delete cascade,
  value numeric,
  "timestamp" timestamptz default now(),
  period text,
  filters jsonb default '{}',
  metadata jsonb default '{}'
);
create index if not exists idx_metric_values_metric on public.metric_values(metric_id, period, "timestamp" desc);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  view_type text,
  filters jsonb default '[]',
  sorting jsonb default '[]',
  columns jsonb default '[]',
  group_by text[] default '{}',
  is_default boolean default false,
  is_public boolean default false,
  created_by uuid,
  usage_count integer default 0,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  widgets jsonb default '[]',
  layout text default 'grid',
  theme text,
  is_default boolean default false,
  is_public boolean default false,
  created_by uuid,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.analytics_dashboards (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  config jsonb default '{}',
  is_public boolean default false,
  is_default boolean default false,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid references public.analytics_dashboards(id) on delete cascade,
  widget_type text,
  title text,
  config jsonb default '{}',
  position jsonb default '{}',
  data_source text,
  refresh_interval integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_dashboard_widgets_dashboard on public.dashboard_widgets(dashboard_id);

create table if not exists public.report_history (
  id uuid primary key default gen_random_uuid(),
  report_id text,
  generated_at timestamptz default now(),
  generated_by uuid,
  parameters jsonb default '{}',
  result jsonb,
  file_url text
);

create table if not exists public.export_templates (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  entity_type text,
  fields text[] default '{}',
  format text,
  config jsonb default '{}',
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- SLA
create table if not exists public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  record_type text,
  conditions jsonb default '{}',
  metrics jsonb default '{}',
  actions jsonb default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sla_instances (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.sla_policies(id) on delete cascade,
  record_id uuid,
  record_type text,
  target_at timestamptz,
  status text default 'active',
  current_value numeric default 0,
  notifications jsonb default '[]',
  last_checked timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_sla_instances_status on public.sla_instances(status);

-- ---------------------------------------------------------------------------
-- Enterprise / backend tables
-- ---------------------------------------------------------------------------
create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  name text,
  url text,
  events text[] default '{}',
  secret text,
  is_active boolean default true,
  last_triggered timestamptz,
  failure_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_webhooks_workspace_id on public.webhooks(workspace_id);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  name text,
  type text,
  config jsonb default '{}',
  is_active boolean default true,
  last_sync timestamptz,
  sync_status text default 'idle',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_integrations_workspace_id on public.integrations(workspace_id);

create table if not exists public.sync_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  name text,
  source jsonb,
  target jsonb,
  mapping jsonb default '{}',
  schedule jsonb default '{}',
  is_active boolean default true,
  last_sync timestamptz,
  sync_status text default 'idle',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.api_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  user_id uuid,
  endpoint text,
  method text,
  status_code integer,
  response_time integer,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text,
  user_id uuid,
  workspace_id uuid,
  resource text,
  resource_id text,
  action text,
  details jsonb default '{}',
  ip_address text,
  user_agent text,
  "timestamp" timestamptz default now(),
  session_id text,
  compliance_flags text[] default '{}'
);
create index if not exists idx_audit_events_workspace on public.audit_events(workspace_id, "timestamp" desc);

create table if not exists public.sso_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  provider text default 'supabase',
  config jsonb default '{}',
  is_active boolean default false,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.gdpr_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  workspace_id uuid,
  request_type text check (request_type in ('access','rectification','erasure','restriction','portability','objection')),
  status text default 'pending' check (status in ('pending','processing','completed','rejected')),
  data jsonb,
  requested_at timestamptz default now(),
  completed_at timestamptz,
  completed_by uuid,
  notes text
);

create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  entity_type text,
  retention_period integer,
  deletion_method text default 'hard_delete',
  conditions jsonb default '{}',
  is_active boolean default true,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.data_processing_records (
  id uuid primary key default gen_random_uuid(),
  purpose text,
  legal_basis text,
  data_categories text[] default '{}',
  recipients text[] default '{}',
  retention_period text,
  security_measures text[] default '{}',
  workspace_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  workspace_id uuid,
  entity_type text,
  filters jsonb default '[]',
  fields text[] default '{}',
  format text check (format in ('csv','json','xlsx','pdf')),
  status text default 'pending' check (status in ('pending','processing','completed','failed')),
  file_url text,
  expires_at timestamptz,
  requested_at timestamptz default now(),
  completed_at timestamptz,
  record_count integer,
  file_size integer
);

create table if not exists public.export_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  name text,
  description text,
  entity_type text,
  max_records integer,
  max_file_size integer,
  allowed_formats text[] default '{}',
  requires_approval boolean default false,
  approval_roles text[] default '{}',
  retention_period integer,
  rate_limit jsonb default '{}',
  is_active boolean default true,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  type text,
  severity text check (severity in ('low','medium','high','critical')),
  workspace_id uuid,
  user_id uuid,
  details jsonb default '{}',
  detected_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  actions text[] default '{}'
);

create table if not exists public.security_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  name text,
  description text,
  rules jsonb default '[]',
  actions jsonb default '[]',
  is_active boolean default true,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.data_classifications (
  id uuid primary key default gen_random_uuid(),
  level text check (level in ('public','internal','confidential','restricted')),
  name text,
  description text,
  handling_requirements text[] default '{}',
  retention_period integer,
  encryption_required boolean default false,
  access_requirements text[] default '{}'
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
select public._apply_std_rls(t, 'crm') from unnest(array[
  'autopilot_state','agent_threads','agent_memory','agent_metrics','agent_metadata','sdr_personas',
  'agent_persona_selection','contact_agent_assignment','sdr_agent_executions','voice_jobs','video_jobs',
  'ai_usage_metrics','pipeline_analysis','ai_agent_configurations','workflow_executions','workflow_analytics',
  'scheduled_triggers','webhook_configurations','activity_templates','kpi_definitions','kpi_values',
  'sales_velocity_metrics','forecast_results','custom_metrics','metric_values','saved_views','dashboards',
  'analytics_dashboards','dashboard_widgets','report_history','export_templates','sla_policies','sla_instances'
]) as t;

select public._apply_std_rls(t, 'private') from unnest(array[
  'webhooks','integrations','sync_configs','api_logs','audit_events','sso_configs','gdpr_requests',
  'data_retention_policies','data_processing_records','export_requests','export_policies',
  'security_alerts','security_policies','data_classifications'
]) as t;

drop function if exists public._apply_std_rls(text, text);
