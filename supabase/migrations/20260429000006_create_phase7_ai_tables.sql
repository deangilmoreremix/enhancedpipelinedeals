-- Phase 7 AI Enhancements: Create tables for deal scoring, competitor analysis, insights, etc.
-- Note: Foreign key constraints reference tables that should exist in the core schema

-- Deal Scorings Table
create table if not exists public.deal_scorings (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid,
  overall_score decimal(5,2) not null check (overall_score >= 0 and overall_score <= 100),
  qualification_level text not null check (qualification_level in ('cold', 'warm', 'hot', 'qualified', 'sales_ready')),
  scoring_factors jsonb default '[]',
  confidence decimal(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  last_updated timestamptz not null default now(),
  ai_provider text not null default 'openai',
  model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(deal_id)
);

-- Competitor Analyses Table
create table if not exists public.competitor_analyses (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid,
  primary_competitors jsonb default '[]',
  competitive_position text not null check (competitive_position in ('leading', 'competitive', 'challenged', 'losing')),
  threats jsonb default '[]',
  opportunities jsonb default '[]',
  recommendations text[] default '{}',
  last_updated timestamptz not null default now(),
  confidence decimal(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(deal_id)
);

-- Deal Insights Table
create table if not exists public.deal_insights (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid,
  progression_insights jsonb default '[]',
  risk_assessments jsonb default '[]',
  action_recommendations jsonb default '[]',
  predictive_metrics jsonb default '[]',
  communication_suggestions jsonb default '[]',
  generated_at timestamptz not null default now(),
  confidence decimal(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  ai_provider text not null default 'openai',
  model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Automated Notes Table
create table if not exists public.automated_notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid,
  contact_id uuid,
  communication_id uuid not null,
  summary text not null,
  key_points text[] default '{}',
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative', 'mixed')),
  action_items jsonb default '[]',
  follow_ups jsonb default '[]',
  tags text[] default '{}',
  generated_at timestamptz not null default now(),
  confidence decimal(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  ai_provider text not null default 'openai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(communication_id)
);

-- Action Items Table
create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid,
  communication_id uuid,
  description text not null,
  priority text not null check (priority in ('low', 'medium', 'high')) default 'medium',
  assignee text,
  due_date timestamptz,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Follow-ups Table
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid,
  communication_id uuid,
  type text not null check (type in ('email', 'call', 'meeting', 'task')),
  description text not null,
  timing text,
  priority text not null check (priority in ('low', 'medium', 'high')) default 'medium',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Data Enrichments Table
create table if not exists public.data_enrichments (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null,
  entity_type text not null check (entity_type in ('contact', 'company', 'deal')),
  enrichment_type text not null check (enrichment_type in ('social', 'firmographic', 'technographic', 'intent', 'news')),
  source text not null,
  data jsonb default '{}',
  confidence decimal(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  last_updated timestamptz not null default now(),
  ai_provider text not null default 'openai',
  cost decimal(10,4),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

-- Record Classifications Table
create table if not exists public.record_classifications (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null,
  entity_type text not null check (entity_type in ('contact', 'company', 'deal')),
  classifications jsonb default '[]',
  primary_category text not null,
  secondary_categories text[] default '{}',
  confidence decimal(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  classified_at timestamptz not null default now(),
  classifier_version text not null,
  user_feedback boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(entity_id, entity_type)
);

-- Summary Generations Table
create table if not exists public.summary_generations (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null,
  entity_type text not null check (entity_type in ('contact', 'company', 'deal')),
  summary_type text not null check (summary_type in ('executive', 'detailed', 'bullet_points', 'timeline', 'risk_analysis')),
  content text not null,
  key_insights text[] default '{}',
  recommendations text[] default '{}',
  generated_at timestamptz not null default now(),
  ai_provider text not null default 'openai',
  model_version text not null,
  confidence decimal(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  word_count integer not null,
  created_at timestamptz not null default now()
);

-- Custom AI Prompts Table
create table if not exists public.custom_ai_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('scoring', 'analysis', 'communication', 'classification', 'enrichment', 'general')),
  prompt_template text not null,
  variables jsonb default '{}',
  model text not null default 'gpt-5.2-thinking',
  temperature decimal(3,2) not null default 0.7 check (temperature >= 0 and temperature <= 2),
  max_tokens integer not null default 2000,
  system_message text,
  examples jsonb default '[]',
  version text not null default '1.0.0',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  usage_count integer not null default 0,
  performance_metrics jsonb default '{}'
);

-- Prompt Executions Table
create table if not exists public.prompt_executions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid references public.custom_ai_prompts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  variables jsonb default '{}',
  success boolean not null,
  execution_time integer not null,
  confidence decimal(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  executed_at timestamptz not null default now()
);

-- Enable RLS for all tables
alter table public.deal_scorings enable row level security;
alter table public.competitor_analyses enable row level security;
alter table public.deal_insights enable row level security;
alter table public.automated_notes enable row level security;
alter table public.action_items enable row level security;
alter table public.follow_ups enable row level security;
alter table public.data_enrichments enable row level security;
alter table public.record_classifications enable row level security;
alter table public.summary_generations enable row level security;
alter table public.custom_ai_prompts enable row level security;
alter table public.prompt_executions enable row level security;

-- Simple RLS: Allow authenticated users full access (tables will be secured when core entities exist)
-- deal_scorings
create policy "Allow authenticated access" on public.deal_scorings for select to authenticated using (true);
create policy "Allow service role full access" on public.deal_scorings for all to service_role using (true);

-- competitor_analyses
create policy "Allow authenticated access" on public.competitor_analyses for select to authenticated using (true);
create policy "Allow service role full access" on public.competitor_analyses for all to service_role using (true);

-- deal_insights
create policy "Allow authenticated access" on public.deal_insights for select to authenticated using (true);
create policy "Allow service role full access" on public.deal_insights for all to service_role using (true);

-- automated_notes
create policy "Allow authenticated access" on public.automated_notes for select to authenticated using (true);
create policy "Allow service role full access" on public.automated_notes for all to service_role using (true);

-- action_items
create policy "Allow authenticated access" on public.action_items for select to authenticated using (true);
create policy "Allow service role full access" on public.action_items for all to service_role using (true);

-- follow_ups
create policy "Allow authenticated access" on public.follow_ups for select to authenticated using (true);
create policy "Allow service role full access" on public.follow_ups for all to service_role using (true);

-- data_enrichments
create policy "Allow authenticated access" on public.data_enrichments for select to authenticated using (true);
create policy "Allow service role full access" on public.data_enrichments for all to service_role using (true);

-- record_classifications
create policy "Allow authenticated access" on public.record_classifications for select to authenticated using (true);
create policy "Allow service role full access" on public.record_classifications for all to service_role using (true);

-- summary_generations
create policy "Allow authenticated access" on public.summary_generations for select to authenticated using (true);
create policy "Allow service role full access" on public.summary_generations for all to service_role using (true);

-- custom_ai_prompts
create policy "Allow authenticated access" on public.custom_ai_prompts for select to authenticated using (true);
create policy "Allow service role full access" on public.custom_ai_prompts for all to service_role using (true);

-- Indexes for performance
create index idx_deal_scorings_deal_id on public.deal_scorings(deal_id);
create index idx_competitor_analyses_deal_id on public.competitor_analyses(deal_id);
create index idx_deal_insights_deal_id on public.deal_insights(deal_id);
create index idx_automated_notes_communication_id on public.automated_notes(communication_id);
create index idx_automated_notes_deal_id on public.automated_notes(deal_id);
create index idx_data_enrichments_entity on public.data_enrichments(entity_id, entity_type);
create index idx_record_classifications_entity on public.record_classifications(entity_id, entity_type);
create index idx_custom_ai_prompts_user_category on public.custom_ai_prompts(user_id, category);
create index idx_custom_ai_prompts_category on public.custom_ai_prompts(category);
create index idx_prompt_executions_prompt_id on public.prompt_executions(prompt_id);
create index idx_prompt_executions_user_id on public.prompt_executions(user_id);
create index idx_summary_generations_entity on public.summary_generations(entity_id, entity_type);
create index idx_action_items_deal_id on public.action_items(deal_id);
create index idx_action_items_status on public.action_items(status);
create index idx_follow_ups_deal_id on public.follow_ups(deal_id);
create index idx_follow_ups_completed on public.follow_ups(completed);
