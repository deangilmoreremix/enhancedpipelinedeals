-- Create enhanced_activities table
create table if not exists public.enhanced_activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid,
  contact_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  title text not null,
  description text,
  metadata jsonb default '{}',
  tags text[] default '{}',
  priority text check (priority in ('low', 'medium', 'high', 'critical')) default 'medium',
  status text check (status in ('pending', 'in_progress', 'completed', 'cancelled', 'failed')) default 'completed',
  duration_minutes integer,
  related_records jsonb default '[]',
  ai_insights jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.enhanced_activities enable row level security;

-- Simple policies
create policy "Allow authenticated access" on public.enhanced_activities for select to authenticated using (true);
create policy "Allow service role full access" on public.enhanced_activities for all to service_role using (true);

-- Indexes
create index idx_enhanced_activities_deal_id on public.enhanced_activities(deal_id);
create index idx_enhanced_activities_contact_id on public.enhanced_activities(contact_id);
create index idx_enhanced_activities_user_id on public.enhanced_activities(user_id);
create index idx_enhanced_activities_created_at on public.enhanced_activities(created_at desc);

-- Create activity_comments table
create table if not exists public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid,
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  mentions uuid[] default '{}',
  attachments jsonb default '[]',
  is_internal boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.activity_comments enable row level security;

-- Simple policies
create policy "Allow authenticated access" on public.activity_comments for select to authenticated using (true);
create policy "Allow service role full access" on public.activity_comments for all to service_role using (true);

-- Indexes
create index idx_activity_comments_activity_id on public.activity_comments(activity_id);
create index idx_activity_comments_user_id on public.activity_comments(user_id);

-- Create activity_subscriptions table
create table if not exists public.activity_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('deal', 'contact', 'company', 'activity')),
  entity_id uuid not null,
  subscription_type text not null check (subscription_type in ('all', 'mentions', 'high_priority', 'none')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, entity_type, entity_id)
);

-- Enable RLS
alter table public.activity_subscriptions enable row level security;

-- Simple policies
create policy "Users can manage their own subscriptions" on public.activity_subscriptions for all using (auth.uid() = user_id);

-- Indexes
create index idx_activity_subscriptions_user_id_entity on public.activity_subscriptions(user_id, entity_type, entity_id);
create index idx_activity_subscriptions_entity on public.activity_subscriptions(entity_type, entity_id);
