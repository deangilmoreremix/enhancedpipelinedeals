-- Create deal_templates table
create table if not exists public.deal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text,
  template_data jsonb not null default '{}',
  is_public boolean default false,
  usage_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.deal_templates enable row level security;

-- Policies
create policy "Users can view public templates and their own"
  on public.deal_templates for select
  using (is_public or auth.uid() = user_id);

create policy "Users can insert their own templates"
  on public.deal_templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own templates"
  on public.deal_templates for update
  using (auth.uid() = user_id);

create policy "Users can delete their own templates"
  on public.deal_templates for delete
  using (auth.uid() = user_id);

-- Indexes
create index idx_deal_templates_user_id on public.deal_templates(user_id);
create index idx_deal_templates_is_public on public.deal_templates(is_public);
