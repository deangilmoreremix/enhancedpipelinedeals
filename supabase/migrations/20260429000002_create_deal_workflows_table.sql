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

-- Policies
create policy "Users can view their own workflows"
  on public.deal_workflows for select
  using (auth.uid() = user_id);

create policy "Users can insert their own workflows"
  on public.deal_workflows for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own workflows"
  on public.deal_workflows for update
  using (auth.uid() = user_id);

create policy "Users can delete their own workflows"
  on public.deal_workflows for delete
  using (auth.uid() = user_id);

-- Add workflow_id column to deals table if not exists
alter table public.deals add column if not exists workflow_id uuid references public.deal_workflows(id) on delete set null;

-- Indexes
create index idx_deal_workflows_user_id on public.deal_workflows(user_id);
create index idx_deal_workflows_is_active on public.deal_workflows(is_active);
create index idx_deals_workflow_id on public.deals(workflow_id);
