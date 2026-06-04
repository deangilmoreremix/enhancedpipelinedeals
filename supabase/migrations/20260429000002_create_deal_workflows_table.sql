-- Create deal_workflows table
create table if not exists public.deal_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  stages jsonb not null default '[]',
  triggers jsonb not null default '[]',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.deal_workflows enable row level security;

-- Simple policies
create policy "Allow authenticated access" on public.deal_workflows for select to authenticated using (true);
create policy "Allow service role full access" on public.deal_workflows for all to service_role using (true);

-- Indexes
create index idx_deal_workflows_user_id on public.deal_workflows(user_id);
create index idx_deal_workflows_is_active on public.deal_workflows(is_active);
