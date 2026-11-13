-- 1) contact_agent_settings + agent_logs (used by netlify/functions run-agent / trigger-autopilot /
--    get-autopilot-status / update-autopilot-settings; previously only ALTERed in netlify/functions/db_migration.sql)
-- 2) opt-in workspace RLS (rls_mode, see 20260811000002) extended to public.contacts
-- 3) users with a profile but no role / membership row act as 'member' of the default workspace in workspace mode
-- Idempotent, safe to re-run. In 'open' mode (the default) every policy behaves exactly like today.

-- ---------------------------------------------------------------------------
-- (a) tables
-- ---------------------------------------------------------------------------
create table if not exists public.contact_agent_settings (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  agent_id text,
  persona_id text,
  sequence_length integer default 30,
  current_step integer default 0,
  autopilot_enabled boolean default false,
  escalated_to_ae boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.contact_agent_settings
  add column if not exists agent_id text,
  add column if not exists persona_id text,
  add column if not exists sequence_length integer default 30,
  add column if not exists current_step integer default 0,
  add column if not exists autopilot_enabled boolean default false,
  add column if not exists escalated_to_ae boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
create unique index if not exists contact_agent_settings_contact_id_key on public.contact_agent_settings(contact_id);

create table if not exists public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  level text default 'info',
  message text,
  created_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb
);
alter table public.agent_logs
  add column if not exists level text default 'info',
  add column if not exists message text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists metadata jsonb default '{}'::jsonb;
create index if not exists idx_agent_logs_contact_created on public.agent_logs(contact_id, created_at desc);

-- ---------------------------------------------------------------------------
-- (c) membership fallback (defined before the policies that use it)
--     A signed-in user with a profile but no user_roles row / owned workspace belongs to the default workspace
--     (same rule the backfill in 20260811000002 applies) and is a 'member' (current_role_name already defaults to it).
-- ---------------------------------------------------------------------------
create or replace function public.current_workspace_id() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $fn$
declare uid uuid; ws uuid;
begin
  uid := auth.uid();
  if uid is null then return null; end if;
  select ur.workspace_id into ws
  from public.user_roles ur
  where ur.user_id = uid and (ur.expires_at is null or ur.expires_at > now())
  order by ur.assigned_at desc nulls last
  limit 1;
  if ws is null then
    select w.id into ws from public.workspaces w where w.owner_id = uid order by w.created_at asc nulls last limit 1;
  end if;
  if ws is null and exists (select 1 from public.profiles p where p.id = uid) then
    ws := public.default_workspace_id();
  end if;
  return ws;
end
$fn$;

create or replace function public.current_role_name() returns text
language plpgsql stable security definer set search_path = public, pg_temp as $fn$
declare uid uuid; ws uuid; r text;
begin
  uid := auth.uid();
  if uid is null then return null; end if;
  ws := public.current_workspace_id();
  select x.norm into r
  from (
    select case
             when lower(ro.name) in ('admin', 'owner', 'administrator') then 'admin'
             when lower(ro.name) = 'manager' then 'manager'
             when lower(ro.name) in ('viewer', 'readonly', 'read_only', 'read-only', 'agent') then 'viewer'
             else 'member'
           end as norm
    from public.user_roles ur
    join public.roles ro on ro.id = ur.role_id
    where ur.user_id = uid
      and (ur.expires_at is null or ur.expires_at > now())
      and (ws is null or ur.workspace_id = ws)
  ) x
  order by case x.norm when 'admin' then 1 when 'manager' then 2 when 'member' then 3 else 4 end
  limit 1;
  if r is null and ws is not null and exists (select 1 from public.workspaces w where w.id = ws and w.owner_id = uid) then
    r := 'admin';
  end if;
  -- no role row (new signup with a profile, or a user_roles row of another workspace): plain member
  return coalesce(r, 'member');
end
$fn$;

-- ---------------------------------------------------------------------------
-- (b) contacts: replace the legacy policies (anon select/insert, created_by update, service_role all)
--     open mode      : exactly the previous behaviour
--     workspace mode : anon denied; workspace-scoped select/insert; update/delete by owner / creator / manager / admin
-- ---------------------------------------------------------------------------
alter table public.contacts enable row level security;

drop policy if exists "Allow anon read access" on public.contacts;
create policy "Allow anon read access" on public.contacts for select to anon
  using ((select public.rls_mode()) = 'open');

drop policy if exists "Allow anon insert" on public.contacts;
create policy "Allow anon insert" on public.contacts for insert to anon
  with check ((select public.rls_mode()) = 'open');

-- legacy "Users can update their contacts" (created_by = uid, role public) -> authenticated only (anon has no uid)
drop policy if exists "Users can update their contacts" on public.contacts;
drop policy if exists "Users can view contacts they created" on public.contacts;
drop policy if exists "Users can insert their contacts" on public.contacts;
drop policy if exists rls_select on public.contacts;
drop policy if exists rls_insert on public.contacts;
drop policy if exists rls_update on public.contacts;
drop policy if exists rls_delete on public.contacts;

create policy rls_select on public.contacts for select to authenticated
  using ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null and public.ws_visible(workspace_id));

create policy rls_insert on public.contacts for insert to authenticated
  with check ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null
              and public.is_writer() and public.ws_visible(workspace_id));

create policy rls_update on public.contacts for update to authenticated
  using (
    ((select public.rls_mode()) = 'open' and (select auth.uid()) = created_by)
    or ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null
        and public.can_edit_record(owner_id, created_by, workspace_id))
  )
  with check (
    ((select public.rls_mode()) = 'open' and (select auth.uid()) = created_by)
    or ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null
        and public.is_writer() and public.ws_visible(workspace_id))
  );

create policy rls_delete on public.contacts for delete to authenticated
  using ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null
         and public.can_edit_record(owner_id, created_by, workspace_id));

drop policy if exists "Allow service role full access" on public.contacts;
create policy "Allow service role full access" on public.contacts for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- RLS for the agent tables: open mode = CRM pattern (anon select+insert, authenticated all, service_role all);
-- workspace mode = scoped through the parent contact.
-- ---------------------------------------------------------------------------
create or replace function public._agent_rls(tbl text) returns void language plpgsql as $fn$
declare
  open_c constant text := '(select public.rls_mode()) = ''open''';
  ws_c   constant text := '(select public.rls_mode()) = ''workspace'' and (select auth.uid()) is not null';
  p text;
begin
  execute format('alter table public.%I enable row level security', tbl);
  foreach p in array array['Allow authenticated access', 'Allow anon read access', 'Allow anon insert',
                           'Allow service role full access', 'rls_select', 'rls_insert', 'rls_update', 'rls_delete'] loop
    execute format('drop policy if exists %I on public.%I', p, tbl);
  end loop;
  execute format('create policy rls_select on public.%I for select to anon, authenticated using (%s or (%s and public.can_view_contact(contact_id)))', tbl, open_c, ws_c);
  execute format('create policy rls_insert on public.%I for insert to anon, authenticated with check (%s or (%s and public.is_writer() and public.can_view_contact(contact_id)))', tbl, open_c, ws_c);
  execute format('create policy rls_update on public.%I for update to authenticated using (%s or (%s and public.can_edit_contact(contact_id))) with check (%s or (%s and public.can_edit_contact(contact_id)))', tbl, open_c, ws_c, open_c, ws_c);
  execute format('create policy rls_delete on public.%I for delete to authenticated using (%s or (%s and public.can_edit_contact(contact_id)))', tbl, open_c, ws_c);
  execute format('create policy "Allow service role full access" on public.%I for all to service_role using (true) with check (true)', tbl);
end
$fn$;

select public._agent_rls('contact_agent_settings');
select public._agent_rls('agent_logs');
drop function public._agent_rls(text);

grant select, insert on public.contact_agent_settings, public.agent_logs to anon;
grant select, insert, update, delete on public.contact_agent_settings, public.agent_logs to authenticated;
grant all on public.contact_agent_settings, public.agent_logs to service_role;
