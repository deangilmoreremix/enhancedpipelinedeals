-- SDR Agent Preferences and related tables

-- SDR User Preferences Table
create table if not exists public.sdr_user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  agent_id text not null,
  preferences jsonb default '{}',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, agent_id)
);

-- Enable RLS
alter table public.sdr_user_preferences enable row level security;

-- RLS Policy: Users can access their own preferences
create policy "Users can manage their own SDR preferences"
  on public.sdr_user_preferences for all
  using (auth.uid()::text = user_id);

-- SDR Preset Configurations Table
create table if not exists public.sdr_preset_configurations (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  name text not null,
  description text,
  category text,
  preferences jsonb not null,
  user_id uuid references auth.users(id) on delete cascade,
  recommended_for text[] default '{}',
  success_rate decimal(5,2),
  is_public boolean not null default true,
  usage_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_active boolean not null default true
);

alter table public.sdr_preset_configurations enable row level security;

create policy "Users can view preset configurations"
  on public.sdr_preset_configurations for select
  using (is_active = true);

create policy "Users can manage preset configurations"
  on public.sdr_preset_configurations for all
  to authenticated
  using (true);

-- SDR Campaign Templates Table
create table if not exists public.sdr_campaign_templates (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  agent_id text not null,
  description text,
  sequence jsonb not null,
  settings jsonb,
  is_public boolean not null default false,
  tags text[] default '{}',
  usage_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sdr_campaign_templates enable row level security;

create policy "Users can manage their own campaign templates"
  on public.sdr_campaign_templates for all
  using (auth.uid()::text = user_id);

-- SDR Agent Performance Table
create table if not exists public.sdr_agent_performance (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  agent_id text not null,
  campaign_id uuid,
  deal_id uuid,
  contact_id uuid,
  metrics jsonb default '{}',
  execution_time integer,
  success boolean,
  timestamp timestamptz default now()
);

alter table public.sdr_agent_performance enable row level security;

create policy "Users can view their own agent performance"
  on public.sdr_agent_performance for select
  using (auth.uid()::text = user_id);

create policy "Users can insert their own agent performance"
  on public.sdr_agent_performance for insert
  with check (auth.uid()::text = user_id);

-- Indexes for performance
create index idx_sdr_user_preferences_user_agent on public.sdr_user_preferences(user_id, agent_id);
create index idx_sdr_user_preferences_active on public.sdr_user_preferences(is_active);
create index idx_sdr_preset_configurations_agent_id on public.sdr_preset_configurations(agent_id);
create index idx_sdr_campaign_templates_user_id on public.sdr_campaign_templates(user_id);
create index idx_sdr_agent_performance_user_agent on public.sdr_agent_performance(user_id, agent_id);