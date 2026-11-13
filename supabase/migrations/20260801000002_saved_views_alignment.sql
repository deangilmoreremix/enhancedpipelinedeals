-- Phase D: one canonical saved-views table (public.saved_pipeline_views).
-- Idempotent. Aligns columns with what the app reads/writes, relaxes the view_type
-- check, handles unique(user_id, name) for NULL users, replaces the owner-only RLS
-- with owner/public/shared-demo policies, and copies rows over from the legacy
-- public.saved_views table (created by 20260701000001) when it exists.

create table if not exists public.saved_pipeline_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  view_type text not null default 'board',
  filters jsonb default '{}'::jsonb,
  sorting jsonb default '[]'::jsonb,
  group_by text,
  columns jsonb default '[]'::jsonb,
  is_default boolean default false,
  is_public boolean default false,
  tags text[] default '{}',
  usage_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.saved_pipeline_views add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.saved_pipeline_views add column if not exists name text;
alter table public.saved_pipeline_views add column if not exists description text;
alter table public.saved_pipeline_views add column if not exists view_type text default 'board';
alter table public.saved_pipeline_views add column if not exists filters jsonb default '{}'::jsonb;
alter table public.saved_pipeline_views add column if not exists sorting jsonb default '[]'::jsonb;
alter table public.saved_pipeline_views add column if not exists group_by text;
alter table public.saved_pipeline_views add column if not exists columns jsonb default '[]'::jsonb;
alter table public.saved_pipeline_views add column if not exists is_default boolean default false;
alter table public.saved_pipeline_views add column if not exists is_public boolean default false;
alter table public.saved_pipeline_views add column if not exists tags text[] default '{}';
alter table public.saved_pipeline_views add column if not exists usage_count integer default 0;
alter table public.saved_pipeline_views add column if not exists created_at timestamptz default now();
alter table public.saved_pipeline_views add column if not exists updated_at timestamptz default now();

-- the original table (20260429000001) declared view_type NOT NULL without a default
alter table public.saved_pipeline_views alter column view_type set default 'board';

-- view_type: board|table|list|calendar|dashboard (+ legacy kanban/timeline)
alter table public.saved_pipeline_views drop constraint if exists saved_pipeline_views_view_type_check;
alter table public.saved_pipeline_views
  add constraint saved_pipeline_views_view_type_check
  check (view_type in ('board', 'kanban', 'table', 'list', 'calendar', 'timeline', 'dashboard'));

-- unique(user_id, name) that also works for NULL user (demo / anon)
alter table public.saved_pipeline_views drop constraint if exists saved_pipeline_views_user_id_name_key;
create unique index if not exists uq_saved_pipeline_views_owner_name
  on public.saved_pipeline_views (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

create index if not exists idx_saved_pipeline_views_user_id on public.saved_pipeline_views(user_id);
create index if not exists idx_saved_pipeline_views_is_default on public.saved_pipeline_views(is_default) where is_default = true;
create index if not exists idx_saved_pipeline_views_is_public on public.saved_pipeline_views(is_public) where is_public = true;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.saved_pipeline_views enable row level security;

drop policy if exists "Users can view their own saved views" on public.saved_pipeline_views;
drop policy if exists "Users can insert their own saved views" on public.saved_pipeline_views;
drop policy if exists "Users can update their own saved views" on public.saved_pipeline_views;
drop policy if exists "Users can delete their own saved views" on public.saved_pipeline_views;
drop policy if exists "saved_pipeline_views select" on public.saved_pipeline_views;
drop policy if exists "saved_pipeline_views insert" on public.saved_pipeline_views;
drop policy if exists "saved_pipeline_views update" on public.saved_pipeline_views;
drop policy if exists "saved_pipeline_views delete" on public.saved_pipeline_views;
drop policy if exists "saved_pipeline_views anon" on public.saved_pipeline_views;
drop policy if exists "saved_pipeline_views service" on public.saved_pipeline_views;

create policy "saved_pipeline_views select" on public.saved_pipeline_views
  for select to authenticated
  using (user_id = auth.uid() or is_public = true or user_id is null);
create policy "saved_pipeline_views insert" on public.saved_pipeline_views
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);
create policy "saved_pipeline_views update" on public.saved_pipeline_views
  for update to authenticated
  using (user_id = auth.uid() or user_id is null)
  with check (user_id = auth.uid() or user_id is null);
create policy "saved_pipeline_views delete" on public.saved_pipeline_views
  for delete to authenticated
  using (user_id = auth.uid() or user_id is null);
-- demo / unauthenticated sessions only ever see and edit the shared (user_id is null) rows
create policy "saved_pipeline_views anon" on public.saved_pipeline_views
  for all to anon
  using (user_id is null or is_public = true)
  with check (user_id is null);
create policy "saved_pipeline_views service" on public.saved_pipeline_views
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Copy rows from the legacy saved_views table (if present and compatible)
-- ---------------------------------------------------------------------------
do $$
declare
  has_legacy boolean;
  has_cols boolean;
begin
  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'saved_views')
    into has_legacy;
  if not has_legacy then
    return;
  end if;

  select count(*) = 7 from information_schema.columns
   where table_schema = 'public' and table_name = 'saved_views'
     and column_name in ('name', 'description', 'view_type', 'filters', 'sorting', 'created_by', 'is_public')
    into has_cols;
  if not has_cols then
    return;
  end if;

  execute $sql$
    insert into public.saved_pipeline_views
      (user_id, name, description, view_type, filters, sorting, columns, group_by, is_default, is_public, tags, usage_count, created_at, updated_at)
    select
      case when exists (select 1 from auth.users u where u.id = s.created_by) then s.created_by else null end,
      coalesce(nullif(s.name, ''), 'Untitled view'),
      s.description,
      case when s.view_type in ('board', 'kanban', 'table', 'list', 'calendar', 'timeline', 'dashboard') then s.view_type else 'board' end,
      case when jsonb_typeof(s.filters) = 'array' then jsonb_build_object('filters', s.filters) else coalesce(s.filters, '{}'::jsonb) end,
      coalesce(s.sorting, '[]'::jsonb),
      coalesce(s.columns, '[]'::jsonb),
      (select g from unnest(coalesce(s.group_by, '{}'::text[])) as g limit 1),
      coalesce(s.is_default, false),
      coalesce(s.is_public, false),
      coalesce(s.tags, '{}'::text[]),
      coalesce(s.usage_count, 0),
      coalesce(s.created_at, now()),
      coalesce(s.updated_at, now())
    from public.saved_views s
    on conflict do nothing
  $sql$;
exception when others then
  raise notice 'saved_views copy skipped: %', sqlerrm;
end $$;

do $$
begin
  if to_regclass('public.saved_views') is not null then
    comment on table public.saved_views is 'DEPRECATED: use public.saved_pipeline_views (rows copied by 20260801000002).';
  end if;
end $$;
