-- Create saved_pipeline_views table
create table if not exists public.saved_pipeline_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  view_type text not null check (view_type in ('kanban', 'table', 'calendar', 'timeline', 'dashboard')),
  filters jsonb default '{}',
  sorting jsonb default '[]',
  columns jsonb default '[]',
  is_default boolean default false,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, name)
);

-- Enable RLS
alter table public.saved_pipeline_views enable row level security;

-- Policies
create policy "Users can view their own saved views"
  on public.saved_pipeline_views for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saved views"
  on public.saved_pipeline_views for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own saved views"
  on public.saved_pipeline_views for update
  using (auth.uid() = user_id);

create policy "Users can delete their own saved views"
  on public.saved_pipeline_views for delete
  using (auth.uid() = user_id);

-- Indexes
create index idx_saved_pipeline_views_user_id on public.saved_pipeline_views(user_id);
create index idx_saved_pipeline_views_is_default on public.saved_pipeline_views(is_default) where is_default = true;
