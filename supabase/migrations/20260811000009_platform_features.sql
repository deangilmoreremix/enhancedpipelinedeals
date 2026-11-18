-- Platform features: custom fields for contacts/companies, company duplicates + rollups, API keys,
-- workflow versioning + webhook trigger, task board position, roles editor RPCs, email snippets.
-- Idempotent. Policies follow the rls_mode() open|workspace pattern of 20260811000002.

-- ---------------------------------------------------------------------------
-- (1) deal_field_definitions.entity_type; uniqueness (key, entity_type)
-- ---------------------------------------------------------------------------
alter table public.deal_field_definitions add column if not exists entity_type text not null default 'deal';
do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'deal_field_definitions_entity_type_check' and conrelid = 'public.deal_field_definitions'::regclass) then
    alter table public.deal_field_definitions add constraint deal_field_definitions_entity_type_check check (entity_type in ('deal','contact','company'));
  end if;
  if exists (select 1 from pg_constraint where conname = 'deal_field_definitions_key_key' and conrelid = 'public.deal_field_definitions'::regclass) then
    alter table public.deal_field_definitions drop constraint deal_field_definitions_key_key;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'deal_field_definitions_key_entity_key' and conrelid = 'public.deal_field_definitions'::regclass) then
    alter table public.deal_field_definitions add constraint deal_field_definitions_key_entity_key unique (key, entity_type);
  end if;
end $c$;
alter table public.contacts  add column if not exists custom_fields jsonb not null default '{}'::jsonb;
alter table public.companies add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- (2) company duplicates
-- ---------------------------------------------------------------------------
create or replace function public.norm_company_name(p text) returns text
language sql immutable set search_path = public, pg_temp as $fn$
  select nullif(lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')), '')
$fn$;

create or replace function public.norm_domain(p text) returns text
language sql immutable set search_path = public, pg_temp as $fn$
  select nullif(lower(regexp_replace(regexp_replace(regexp_replace(btrim(coalesce(p, '')), '^[a-zA-Z]+://', ''), '^www\.', '', 'i'), '[/?#].*$', '')), '')
$fn$;

create or replace function public.find_duplicate_companies(p_name text, p_domain text default null, p_exclude uuid default null)
returns table(id uuid, name text, domain text, reason text)
language sql stable set search_path = public, pg_temp as $fn$
  select c.id, c.name, c.domain,
         case when public.norm_company_name(c.name) = public.norm_company_name(p_name) then 'name' else 'domain' end
  from public.companies c
  where c.deleted_at is null
    and (p_exclude is null or c.id <> p_exclude)
    and ((public.norm_company_name(p_name) is not null and public.norm_company_name(c.name) = public.norm_company_name(p_name))
      or (public.norm_domain(p_domain) is not null and public.norm_domain(c.domain) = public.norm_domain(p_domain)))
  order by c.created_at nulls last, c.id
$fn$;

create or replace function public.scan_duplicate_companies()
returns table(group_key text, ids uuid[], names text[], reason text)
language sql stable set search_path = public, pg_temp as $fn$
  with live as (
    select c.id, c.name, c.created_at, public.norm_company_name(c.name) as nn, public.norm_domain(c.domain) as nd
    from public.companies c where c.deleted_at is null
  ), g as (
    select 'name:' || nn as group_key, 'name'::text as reason, id, name, created_at from live where nn is not null
    union all
    select 'domain:' || nd, 'domain', id, name, created_at from live where nd is not null
  )
  select g.group_key, array_agg(g.id order by g.created_at nulls last, g.id), array_agg(g.name order by g.created_at nulls last, g.id), min(g.reason)
  from g group by g.group_key having count(*) >= 2
  order by g.group_key
$fn$;

-- ---------------------------------------------------------------------------
-- (3) company rollups
-- ---------------------------------------------------------------------------
create or replace function public.company_rollups(p_company_ids uuid[] default null)
returns table(company_id uuid, open_deal_count int, open_deal_value numeric, won_deal_value numeric, contact_count int, last_activity timestamptz)
language sql stable set search_path = public, pg_temp as $fn$
  select c.id,
    coalesce(d.open_cnt, 0)::int, coalesce(d.open_val, 0)::numeric, coalesce(d.won_val, 0)::numeric,
    coalesce(k.cnt, 0)::int,
    nullif(greatest(coalesce(d.last_d, '-infinity'::timestamptz), coalesce(a.last_a, '-infinity'::timestamptz), coalesce(k.last_k, '-infinity'::timestamptz)), '-infinity'::timestamptz)
  from public.companies c
  left join lateral (
    select count(*) filter (where not st.won and not st.lost) as open_cnt,
           sum(dl.value) filter (where not st.won and not st.lost) as open_val,
           sum(dl.value) filter (where st.won) as won_val,
           max(dl.updated_at) as last_d
    from public.deals dl
    cross join lateral (
      select coalesce(bool_or(s.is_won), false) as won, coalesce(bool_or(s.is_lost), false) as lost
      from public.pipeline_stages s where s.key = dl.stage
    ) st
    where dl.company_id = c.id and dl.deleted_at is null
  ) d on true
  left join lateral (
    select count(*) as cnt, max(ct.updated_at) as last_k from public.contacts ct where ct.company_id = c.id
  ) k on true
  left join lateral (
    select max(da.created_at) as last_a from public.deal_activities da join public.deals dl on dl.id = da.deal_id
    where dl.company_id = c.id and dl.deleted_at is null
  ) a on true
  where c.deleted_at is null and (p_company_ids is null or c.id = any(p_company_ids))
$fn$;

-- ---------------------------------------------------------------------------
-- (4) api_keys (service role inserts via function; clients read own, never key_hash)
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{read}',
  workspace_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists idx_api_keys_created_by on public.api_keys(created_by);
alter table public.api_keys enable row level security;
drop policy if exists api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys for select to authenticated using (created_by = (select auth.uid()));
drop policy if exists api_keys_service on public.api_keys;
create policy api_keys_service on public.api_keys for all to service_role using (true) with check (true);
revoke all on public.api_keys from public, anon, authenticated;
grant select (id, name, prefix, scopes, workspace_id, created_by, created_at, last_used_at, revoked_at) on public.api_keys to authenticated;
grant all on public.api_keys to service_role;

create or replace view public.api_keys_public with (security_invoker = true) as
  select id, name, prefix, scopes, workspace_id, created_by, created_at, last_used_at, revoked_at from public.api_keys;
revoke all on public.api_keys_public from public, anon;
grant select on public.api_keys_public to authenticated, service_role;

create or replace function public.revoke_api_key(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  update public.api_keys set revoked_at = coalesce(revoked_at, now()) where id = p_id and created_by = auth.uid();
  if not found then raise exception 'api key not found' using errcode = 'P0002'; end if;
end
$fn$;
revoke all on function public.revoke_api_key(uuid) from public, anon;
grant execute on function public.revoke_api_key(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (5) workflow versions + webhook trigger
-- ---------------------------------------------------------------------------
alter table public.deal_workflows add column if not exists published_version int;
-- Field types: allow computed types added in this wave (formula, rollup). The inline CHECK from 000008 is auto-named.
alter table public.deal_field_definitions drop constraint if exists deal_field_definitions_type_check;
alter table public.deal_field_definitions add constraint deal_field_definitions_type_check
  check (type in ('text','number','select','multi_select','rating','link','email','phone','date','formula','rollup'));

alter table public.deal_workflows add column if not exists webhook_token text;
alter table public.deal_workflows add column if not exists webhook_enabled boolean not null default false;
create unique index if not exists uq_deal_workflows_webhook_token on public.deal_workflows(webhook_token) where webhook_token is not null;

create table if not exists public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.deal_workflows(id) on delete cascade,
  version int not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  snapshot jsonb not null,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (workflow_id, version)
);
create index if not exists idx_workflow_versions_workflow on public.workflow_versions(workflow_id);
alter table public.workflow_versions enable row level security;
drop policy if exists wv_select on public.workflow_versions;
create policy wv_select on public.workflow_versions for select to authenticated
  using ((select public.rls_mode()) = 'open' or ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null and public.is_member()));
drop policy if exists wv_service on public.workflow_versions;
create policy wv_service on public.workflow_versions for all to service_role using (true) with check (true);
revoke all on public.workflow_versions from public, anon;
revoke insert, update, delete on public.workflow_versions from authenticated;
grant select on public.workflow_versions to authenticated;
grant all on public.workflow_versions to service_role;

create or replace function public.can_write_workflows() returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select auth.uid() is not null
     and (public.rls_mode() = 'open' or public.is_manager_or_admin())
$fn$;

create or replace function public.publish_workflow_version(p_workflow_id uuid, p_note text default null) returns int
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare w public.deal_workflows; v int;
begin
  if not public.can_write_workflows() then raise exception 'not allowed to publish workflows' using errcode = '42501'; end if;
  select * into w from public.deal_workflows where id = p_workflow_id for update;
  if not found then raise exception 'workflow not found' using errcode = 'P0002'; end if;
  select coalesce(max(version), 0) + 1 into v from public.workflow_versions where workflow_id = p_workflow_id;
  update public.workflow_versions set status = 'archived' where workflow_id = p_workflow_id and status = 'published';
  insert into public.workflow_versions(workflow_id, version, status, snapshot, note, created_by)
  values (p_workflow_id, v, 'published',
          jsonb_build_object('name', w.name, 'description', w.description, 'stages', w.stages, 'triggers', w.triggers,
                             'settings', coalesce(w.settings, '{}'::jsonb), 'category', w.category),
          p_note, auth.uid());
  update public.deal_workflows set published_version = v, updated_at = now() where id = p_workflow_id;
  return v;
end
$fn$;

create or replace function public.restore_workflow_version(p_workflow_id uuid, p_version int) returns void
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare s jsonb;
begin
  if not public.can_write_workflows() then raise exception 'not allowed to restore workflows' using errcode = '42501'; end if;
  select snapshot into s from public.workflow_versions where workflow_id = p_workflow_id and version = p_version;
  if not found then raise exception 'workflow version not found' using errcode = 'P0002'; end if;
  update public.deal_workflows set
    name = coalesce(s->>'name', name),
    description = s->>'description',
    stages = coalesce(s->'stages', '[]'::jsonb),
    triggers = coalesce(s->'triggers', '[]'::jsonb),
    settings = coalesce(s->'settings', '{}'::jsonb),
    category = s->>'category',
    updated_at = now()
  where id = p_workflow_id;
end
$fn$;

create or replace function public.rotate_workflow_webhook_token(p_workflow_id uuid, p_enable boolean default true) returns text
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare tok text;
begin
  if not public.can_write_workflows() then raise exception 'not allowed to change workflow webhooks' using errcode = '42501'; end if;
  if not exists (select 1 from public.deal_workflows where id = p_workflow_id) then raise exception 'workflow not found' using errcode = 'P0002'; end if;
  if not coalesce(p_enable, true) then
    update public.deal_workflows set webhook_enabled = false, updated_at = now() where id = p_workflow_id;
    return null;
  end if;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  update public.deal_workflows set webhook_token = tok, webhook_enabled = true, updated_at = now() where id = p_workflow_id;
  return tok;
end
$fn$;
revoke all on function public.publish_workflow_version(uuid, text), public.restore_workflow_version(uuid, int),
  public.rotate_workflow_webhook_token(uuid, boolean) from public, anon;
grant execute on function public.publish_workflow_version(uuid, text), public.restore_workflow_version(uuid, int),
  public.rotate_workflow_webhook_token(uuid, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (6) tasks.board_position
-- ---------------------------------------------------------------------------
do $t$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='board_position') then
    alter table public.tasks add column board_position numeric not null default 0;
    update public.tasks k set board_position = r.rn
    from (select id, row_number() over (partition by status order by created_at, id) as rn from public.tasks) r
    where r.id = k.id;
  end if;
end $t$;

-- ---------------------------------------------------------------------------
-- (7) roles editor RPCs (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.set_role_permissions(p_role_id uuid, p_permissions jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare r public.roles;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select * into r from public.roles where id = p_role_id;
  if not found then raise exception 'role not found' using errcode = 'P0002'; end if;
  if r.workspace_id is not null and r.workspace_id is distinct from public.current_workspace_id() then raise exception 'role belongs to another workspace' using errcode = '42501'; end if;
  if lower(r.name) = 'admin' then raise exception 'the admin role cannot be edited' using errcode = '42501'; end if;
  update public.roles set permissions = coalesce(p_permissions, '[]'::jsonb), updated_at = now() where id = p_role_id;
end
$fn$;

create or replace function public.assign_user_role(p_user_id uuid, p_role_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare r public.roles; ws uuid;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select * into r from public.roles where id = p_role_id;
  if not found then raise exception 'role not found' using errcode = 'P0002'; end if;
  if r.workspace_id is not null and r.workspace_id is distinct from public.current_workspace_id() then raise exception 'role belongs to another workspace' using errcode = '42501'; end if;
  ws := coalesce(r.workspace_id, public.current_workspace_id(), public.default_workspace_id());
  insert into public.user_roles(user_id, role_id, workspace_id, assigned_by)
  values (p_user_id, p_role_id, ws, auth.uid())
  on conflict (user_id, role_id, workspace_id) do update set assigned_by = excluded.assigned_by, assigned_at = now();
end
$fn$;

create or replace function public.remove_user_role(p_user_id uuid, p_role_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare r public.roles;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select * into r from public.roles where id = p_role_id;
  if not found then raise exception 'role not found' using errcode = 'P0002'; end if;
  if r.workspace_id is not null and r.workspace_id is distinct from public.current_workspace_id() then raise exception 'role belongs to another workspace' using errcode = '42501'; end if;
  if lower(r.name) = 'admin' and p_user_id = auth.uid()
     and not exists (select 1 from public.user_roles ur where ur.role_id = p_role_id and ur.user_id <> p_user_id) then
    raise exception 'cannot remove the last admin' using errcode = '42501';
  end if;
  delete from public.user_roles where user_id = p_user_id and role_id = p_role_id;
end
$fn$;
revoke all on function public.set_role_permissions(uuid, jsonb), public.assign_user_role(uuid, uuid), public.remove_user_role(uuid, uuid) from public, anon;
grant execute on function public.set_role_permissions(uuid, jsonb), public.assign_user_role(uuid, uuid), public.remove_user_role(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (8) email_templates: workspace scope, snippets
-- ---------------------------------------------------------------------------
alter table public.email_templates add column if not exists workspace_id uuid;
alter table public.email_templates add column if not exists is_snippet boolean not null default false;
alter table public.email_templates add column if not exists shortcut text;
create index if not exists idx_email_templates_snippet on public.email_templates(is_snippet) where is_snippet;

do $p$
declare p text;
  open_c constant text := '(select public.rls_mode()) = ''open''';
  ws_c   constant text := '(select public.rls_mode()) = ''workspace'' and (select auth.uid()) is not null';
begin
  alter table public.email_templates enable row level security;
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'email_templates' and policyname <> 'Allow service role full access' loop
    execute format('drop policy if exists %I on public.email_templates', p);
  end loop;
  execute format('create policy et_select on public.email_templates for select to anon, authenticated using (%s or (%s and public.is_member() and (workspace_id is null or public.ws_visible(workspace_id))))', open_c, ws_c);
  execute format('create policy et_insert on public.email_templates for insert to authenticated with check (%s or (%s and public.is_writer()))', open_c, ws_c);
  execute format('create policy et_update on public.email_templates for update to authenticated using (%s or (%s and public.is_writer() and (workspace_id is null or public.ws_visible(workspace_id)))) with check (%s or (%s and public.is_writer()))', open_c, ws_c, open_c, ws_c);
  execute format('create policy et_delete on public.email_templates for delete to authenticated using (%s or (%s and public.is_writer() and (workspace_id is null or public.ws_visible(workspace_id))))', open_c, ws_c);
end $p$;
grant select on public.email_templates to anon;
grant select, insert, update, delete on public.email_templates to authenticated;

-- ---------------------------------------------------------------------------
-- (9) webhook_configurations: authenticated already has an ALL policy ("Allow authenticated access"); nothing to change.
-- ---------------------------------------------------------------------------
