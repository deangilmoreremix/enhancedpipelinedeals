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

-- Create policy to allow authenticated users to read feature flags
create policy "Allow authenticated users to read feature flags"
  on public.feature_flags for select
  to authenticated
  using (true);

-- Create policy to allow service role to manage feature flags
create policy "Allow service role full access"
  on public.feature_flags for all
  to service_role
  using (true);

-- Create indexes
create index idx_feature_flags_feature_key on public.feature_flags(feature_key);
create index idx_feature_flags_enabled on public.feature_flags(enabled);
