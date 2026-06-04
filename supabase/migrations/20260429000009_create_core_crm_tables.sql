-- Core CRM Tables: contacts, deals, companies, app_settings

-- Companies Table
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  website text,
  size text,
  revenue numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.companies enable row level security;
create policy "Allow authenticated access" on public.companies for select to authenticated using (true);
create policy "Allow service role full access" on public.companies for all to service_role using (true);

-- Contacts Table
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id),
  name text not null,
  first_name text,
  last_name text,
  email text,
  phone text,
  title text,
  company text,
  industry text,
  status text check (status in ('lead', 'prospect', 'customer', 'churned')) default 'lead',
  interest_level text check (interest_level in ('hot', 'medium', 'low', 'cold')) default 'medium',
  sources text[] default '{}',
  social_profiles jsonb default '{}',
  notes text,
  ai_score numeric,
  last_connected timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_team_member boolean default false,
  gamification_stats jsonb
);

alter table public.contacts enable row level security;
create policy "Users can view contacts they created" on public.contacts for select using (auth.uid() = created_by);
create policy "Users can insert their contacts" on public.contacts for insert with check (auth.uid() = created_by);
create policy "Users can update their contacts" on public.contacts for update using (auth.uid() = created_by);
create policy "Allow service role full access" on public.contacts for all to service_role using (true);

create index idx_contacts_created_by on public.contacts(created_by);
create index idx_contacts_email on public.contacts(email);
create index idx_contacts_company on public.contacts(company);

-- Deals Table
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id),
  contact_id uuid references public.contacts(id) on delete set null,
  assigned_to_id uuid,
  title text,
  company text,
  contact text,
  value numeric,
  stage text check (stage in ('qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost')) default 'qualification',
  probability numeric default 0,
  priority text check (priority in ('high', 'medium', 'low')) default 'medium',
  due_date timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_favorite boolean default false,
  workflow_id uuid
);

alter table public.deals enable row level security;
create policy "Users can view deals in their workspace" on public.deals for select using (true);
create policy "Users can insert deals" on public.deals for insert with check (true);
create policy "Users can update deals" on public.deals for update using (true);
create policy "Allow service role full access" on public.deals for all to service_role using (true);

create index idx_deals_contact_id on public.deals(contact_id);
create index idx_deals_assigned_to_id on public.deals(assigned_to_id);
create index idx_deals_stage on public.deals(stage);

-- App Settings Table
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb not null,
  updated_at timestamptz default now(),
  unique(user_id, setting_key)
);

alter table public.app_settings enable row level security;
create policy "Users can manage their settings" on public.app_settings for all using (auth.uid() = user_id);
create policy "Allow global settings read" on public.app_settings for select using (user_id is null);
create policy "Allow service role full access" on public.app_settings for all to service_role using (true);

create index idx_app_settings_user_id on public.app_settings(user_id);
create index idx_app_settings_setting_key on public.app_settings(setting_key);

-- Custom Personas Table
create table if not exists public.custom_personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  tone text,
  ideal_segments text[] default '{}',
  email_style text,
  communication_focus text[] default '{}',
  is_default boolean default false,
  usage_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.custom_personas enable row level security;
create policy "Users can manage their personas" on public.custom_personas for all using (auth.uid() = user_id);
create policy "Allow service role full access" on public.custom_personas for all to service_role using (true);

-- AI Feedback Table
create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  task text,
  feature text,
  score integer,
  feedback text,
  comments text,
  context jsonb,
  session_id text,
  timestamp timestamptz default now()
);

alter table public.ai_feedback enable row level security;
create policy "Users can manage their feedback" on public.ai_feedback for all using (auth.uid() = user_id);
create policy "Allow service role full access" on public.ai_feedback for all to service_role using (true);