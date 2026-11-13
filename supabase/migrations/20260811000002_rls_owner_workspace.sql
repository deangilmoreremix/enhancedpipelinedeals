-- Workstream I: opt-in record-level permissions (owner / workspace / role based RLS).
-- Idempotent and safe to re-run. Postgres 15 compatible.
--
-- DESIGN
--   * A global flag `rls_mode` in public.app_settings ('open' | 'workspace') decides which rules apply.
--     It DEFAULTS TO 'open'. In open mode every policy below behaves exactly like the policy it replaces
--     (anon select/insert on CRM tables, authenticated full access, ...), so applying this migration changes
--     nothing until an admin calls public.set_rls_mode('workspace') (Settings > Permissions switch).
--   * In 'workspace' mode:
--       - anon is denied everywhere (auth.uid() is null => false);
--       - authenticated users see rows of THEIR workspace only (rows with workspace_id null are visible to admins
--         only, so they can be repaired);
--       - INSERT requires a writer role (admin/manager/member) and a row in the user's workspace
--         (workspace_id / owner / creator columns are defaulted by triggers in this mode);
--       - UPDATE/DELETE require admin/manager, or (member) owning / being assigned to / having created the record
--         (child records: created it, or own / are assigned to the parent deal). Viewers are read-only;
--       - service_role is untouched (it bypasses RLS).
--   * Contacts keep their existing policies (not covered by this migration).
--
-- ROLLBACK (instant, no data change):
--   update public.app_settings set setting_value = '"open"'::jsonb where setting_key = 'rls_mode' and user_id is null;
--   -- or, as an admin / service_role:  select public.set_rls_mode('open');
--   -- Full removal: re-run the policy sections of 20260429000009 / 20260701000000 / 20260801000000 / 20260811000000.

-- ---------------------------------------------------------------------------
-- (a) rls_mode flag + helper
-- ---------------------------------------------------------------------------
insert into public.app_settings (user_id, setting_key, setting_value)
select null, 'rls_mode', '"open"'::jsonb
where not exists (select 1 from public.app_settings where setting_key = 'rls_mode' and user_id is null);

create or replace function public.rls_mode() returns text
language plpgsql stable security definer set search_path = public, pg_temp as $fn$
declare v jsonb;
begin
  begin
    select setting_value into v
    from public.app_settings
    where setting_key = 'rls_mode' and user_id is null
    order by updated_at desc nulls last
    limit 1;
  exception when others then
    return 'open';
  end;
  if v is null then return 'open'; end if;
  return case when (v #>> '{}') = 'workspace' then 'workspace' else 'open' end;
end
$fn$;

-- ---------------------------------------------------------------------------
-- (b) identity helpers (null-safe, SECURITY DEFINER so they bypass RLS on user_roles/roles/workspaces)
-- ---------------------------------------------------------------------------
create or replace function public.default_workspace_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $fn$
  select id from public.workspaces order by created_at asc nulls last, id asc limit 1
$fn$;

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
  return ws;
end
$fn$;

-- Highest role of the current user in their workspace: admin | manager | member | viewer (null when signed out).
-- Authenticated users without a role row are 'member' (matches the UI fallback).
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
  return coalesce(r, 'member');
end
$fn$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select coalesce(public.current_role_name() = 'admin', false)
$fn$;

create or replace function public.is_manager_or_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select coalesce(public.current_role_name() in ('admin', 'manager'), false)
$fn$;

create or replace function public.is_writer() returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select coalesce(public.current_role_name() in ('admin', 'manager', 'member'), false)
$fn$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select auth.uid() is not null and (public.current_workspace_id() is not null or public.is_admin())
$fn$;

-- Row belongs to the caller's workspace (null-workspace rows are visible to admins only, so they can be repaired).
create or replace function public.ws_visible(ws uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select auth.uid() is not null
     and ((ws is not null and ws = public.current_workspace_id()) or (ws is null and public.is_admin()))
$fn$;

-- May the caller modify a record with this owner / creator / workspace?
create or replace function public.can_edit_record(owner uuid, created uuid, ws uuid) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $fn$
declare uid uuid; r text;
begin
  uid := auth.uid();
  if uid is null then return false; end if;
  r := public.current_role_name();
  if r in ('admin', 'manager') then
    return public.ws_visible(ws);
  elsif r = 'member' then
    return ws is not null and ws = public.current_workspace_id() and (owner = uid or created = uid);
  end if;
  return false;
end
$fn$;

-- Parent-record helpers for child tables (notes, tasks, files, activities, history).
create or replace function public.can_view_deal(p_deal uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select coalesce((select public.ws_visible(d.workspace_id) from public.deals d where d.id = p_deal), false)
$fn$;

create or replace function public.can_edit_deal(p_deal uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select coalesce((
    select public.can_edit_record(d.owner_id, d.created_by, d.workspace_id)
        or public.can_edit_record(d.assigned_to_id, null, d.workspace_id)
    from public.deals d where d.id = p_deal
  ), false)
$fn$;

create or replace function public.can_view_contact(p_contact uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select coalesce((select public.ws_visible(c.workspace_id) from public.contacts c where c.id = p_contact), false)
$fn$;

create or replace function public.can_edit_contact(p_contact uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select coalesce((
    select public.can_edit_record(c.owner_id, c.created_by, c.workspace_id)
    from public.contacts c where c.id = p_contact
  ), false)
$fn$;

-- deal id encoded as the first folder of a deal-files object path ("<dealId>/<timestamp>-<name>")
create or replace function public.storage_deal_id(p_name text) returns uuid
language plpgsql immutable set search_path = public, pg_temp as $fn$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end
$fn$;

-- Admin-only switch (service_role may also call it, e.g. from the SQL editor / CLI).
create or replace function public.set_rls_mode(mode text) returns text
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare n integer;
begin
  if mode is null or mode not in ('open', 'workspace') then
    raise exception 'rls mode must be open or workspace' using errcode = '22023';
  end if;
  if not (coalesce(auth.role(), '') = 'service_role' or public.is_admin()) then
    raise exception 'only admins can change the RLS mode' using errcode = '42501';
  end if;
  update public.app_settings
     set setting_value = to_jsonb(mode), updated_at = now()
   where setting_key = 'rls_mode' and user_id is null;
  get diagnostics n = row_count;
  if n = 0 then
    insert into public.app_settings (user_id, setting_key, setting_value) values (null, 'rls_mode', to_jsonb(mode));
  end if;
  return mode;
end
$fn$;

revoke all on function public.set_rls_mode(text) from public;
grant execute on function public.set_rls_mode(text) to authenticated, service_role;
grant execute on function
  public.rls_mode(), public.default_workspace_id(), public.current_workspace_id(), public.current_role_name(),
  public.is_admin(), public.is_manager_or_admin(), public.is_writer(), public.is_member(), public.ws_visible(uuid),
  public.can_edit_record(uuid, uuid, uuid), public.can_view_deal(uuid), public.can_edit_deal(uuid),
  public.can_view_contact(uuid), public.can_edit_contact(uuid), public.storage_deal_id(text)
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (c) backfill: default workspace, system roles, memberships, workspace_id and owner_id
--     (user triggers are paused so updated_at / workflow events are not touched)
-- ---------------------------------------------------------------------------
do $bf$
declare
  ws uuid;
  admin_role uuid;
  member_role uuid;
  first_admin uuid;
  t text;
  has_auth boolean := to_regclass('auth.users') is not null;
begin
  ws := public.default_workspace_id();
  if ws is null then
    insert into public.workspaces (name) values ('Default workspace') returning id into ws;
  end if;

  -- system roles for the default workspace
  insert into public.roles (name, description, is_system_role, workspace_id)
  select r.name, r.descr, true, ws
  from (values
    ('admin',   'Full access, manages roles and settings'),
    ('manager', 'Everything except managing roles'),
    ('member',  'Edits own or assigned records'),
    ('viewer',  'Read-only')
  ) as r(name, descr)
  where not exists (
    select 1 from public.roles x where lower(x.name) = r.name and x.workspace_id is not distinct from ws
  );

  select id into admin_role  from public.roles where lower(name) = 'admin'  and workspace_id is not distinct from ws limit 1;
  select id into member_role from public.roles where lower(name) = 'member' and workspace_id is not distinct from ws limit 1;

  if has_auth then
    -- make sure the workspace has at least one admin: its owner, else the earliest user
    if not exists (
      select 1 from public.user_roles ur join public.roles ro on ro.id = ur.role_id
      where ur.workspace_id = ws and lower(ro.name) in ('admin', 'owner', 'administrator')
    ) then
      execute $q$
        select coalesce(
          (select u.id from auth.users u where u.id = (select w.owner_id from public.workspaces w where w.id = $1)),
          (select u2.id from auth.users u2 order by u2.created_at asc nulls last limit 1)
        )
      $q$ into first_admin using ws;
      if first_admin is not null then
        insert into public.user_roles (user_id, role_id, workspace_id) values (first_admin, admin_role, ws)
        on conflict do nothing;
      end if;
    end if;

    -- everyone without a membership becomes a member of the default workspace
    execute $q$
      insert into public.user_roles (user_id, role_id, workspace_id)
      select u.id, $1, $2
      from auth.users u
      where not exists (select 1 from public.user_roles ur where ur.user_id = u.id)
      on conflict do nothing
    $q$ using member_role, ws;
  end if;

  -- workspace_id where the column exists and is null
  foreach t in array array['deals', 'contacts', 'companies', 'notes', 'deal_files', 'tasks',
                           'deal_activities', 'deal_history', 'pipeline_stages', 'favorites'] loop
    if to_regclass('public.' || t) is not null
       and exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t and column_name = 'workspace_id') then
      execute format('alter table public.%I disable trigger user', t);
      execute format('update public.%I set workspace_id = $1 where workspace_id is null', t) using ws;
      execute format('alter table public.%I enable trigger user', t);
    end if;
  end loop;

  -- owner_id from assigned_to_id / created_by where derivable
  alter table public.deals disable trigger user;
  update public.deals set owner_id = coalesce(assigned_to_id, created_by)
   where owner_id is null and coalesce(assigned_to_id, created_by) is not null;
  alter table public.deals enable trigger user;

  alter table public.contacts disable trigger user;
  update public.contacts set owner_id = created_by where owner_id is null and created_by is not null;
  alter table public.contacts enable trigger user;

  alter table public.companies disable trigger user;
  update public.companies set owner_id = created_by where owner_id is null and created_by is not null;
  alter table public.companies enable trigger user;
end
$bf$;

-- ---------------------------------------------------------------------------
-- Defaults on INSERT (workspace mode only; open mode is untouched)
--   trigger args: workspace column, creator column, owner column ('' = none)
-- ---------------------------------------------------------------------------
create or replace function public.rls_insert_defaults() returns trigger
language plpgsql set search_path = public, pg_temp as $fn$
declare uid uuid; patch jsonb := '{}'::jsonb; j jsonb; ws_col text; cr_col text; ow_col text;
begin
  if public.rls_mode() <> 'workspace' then return new; end if;
  uid := auth.uid();
  if uid is null then return new; end if;
  j := to_jsonb(new);
  ws_col := coalesce(tg_argv[0], '');
  cr_col := coalesce(tg_argv[1], '');
  ow_col := coalesce(tg_argv[2], '');
  if ws_col <> '' and (j ->> ws_col) is null then
    patch := patch || jsonb_build_object(ws_col, public.current_workspace_id());
  end if;
  if cr_col <> '' and (j ->> cr_col) is null then
    patch := patch || jsonb_build_object(cr_col, uid);
  end if;
  -- a new record is owned by its creator unless an owner / assignee was chosen
  if ow_col <> '' and (j ->> ow_col) is null and (j ->> 'assigned_to_id') is null then
    patch := patch || jsonb_build_object(ow_col, uid);
  end if;
  if patch <> '{}'::jsonb then
    new := jsonb_populate_record(new, patch);
  end if;
  return new;
end
$fn$;

do $trg$
declare spec record;
begin
  for spec in
    select * from (values
      ('deals',           'workspace_id', 'created_by',  'owner_id'),
      ('contacts',        'workspace_id', 'created_by',  'owner_id'),
      ('companies',       'workspace_id', 'created_by',  'owner_id'),
      ('notes',           '',             'created_by',  ''),
      ('deal_files',      '',             'uploaded_by', ''),
      ('tasks',           '',             'user_id',     ''),
      ('deal_activities', '',             'created_by',  ''),
      ('favorites',       '',             'user_id',     '')
    ) as v(tbl, ws_col, cr_col, ow_col)
  loop
    if to_regclass('public.' || spec.tbl) is not null then
      execute format('drop trigger if exists rls_insert_defaults on public.%I', spec.tbl);
      execute format(
        'create trigger rls_insert_defaults before insert on public.%I for each row execute function public.rls_insert_defaults(%L, %L, %L)',
        spec.tbl, spec.ws_col, spec.cr_col, spec.ow_col);
    end if;
  end loop;
end
$trg$;

-- ---------------------------------------------------------------------------
-- (d) policies
--   _rls_install(table, select_pred, insert_pred, modify_pred, update_check,
--                anon         -- anon select+insert allowed in open mode (today's "crm" pattern)
--                open_write   -- authenticated insert/update allowed in open mode
--                open_delete  -- authenticated delete allowed in open mode
--                anon_update  -- anon update allowed in open mode (deals only))
--   Open-mode branches reproduce the replaced policies; workspace-mode branches (only active when rls_mode is
--   'workspace' and a user is signed in) apply the predicates.
-- ---------------------------------------------------------------------------
create or replace function public._rls_install(
  tbl text, sel text, ins text, modp text, upd_check text,
  anon boolean, open_write boolean, open_delete boolean, anon_update boolean default false
) returns void language plpgsql as $fn$
declare
  open_c constant text := '(select public.rls_mode()) = ''open''';
  uid_c  constant text := '(select public.rls_mode()) = ''workspace'' and (select auth.uid()) is not null';
  p text;
  write_open text := case when open_write then open_c else 'false' end;
  del_open text := case when open_delete then open_c else 'false' end;
begin
  if to_regclass('public.' || tbl) is null then
    raise notice 'rls_owner_workspace: skipping missing table %', tbl;
    return;
  end if;
  execute format('alter table public.%I enable row level security', tbl);

  -- replaced legacy policies + this migration's own (idempotent)
  foreach p in array array[
    'Allow authenticated access', 'Allow anon read access', 'Allow anon insert',
    'Users can view deals in their workspace', 'Users can insert deals', 'Users can update deals',
    'rls_select', 'rls_insert', 'rls_update', 'rls_delete', 'rls_anon_update'
  ] loop
    execute format('drop policy if exists %I on public.%I', p, tbl);
  end loop;

  execute format('create policy rls_select on public.%I for select to %s using (%s or (%s and (%s)))',
    tbl, case when anon then 'anon, authenticated' else 'authenticated' end, open_c, uid_c, sel);

  execute format('create policy rls_insert on public.%I for insert to %s with check (%s or (%s and (%s)))',
    tbl, case when anon then 'anon, authenticated' else 'authenticated' end,
    case when anon or open_write then open_c else 'false' end, uid_c, ins);

  execute format('create policy rls_update on public.%I for update to authenticated using (%s or (%s and (%s))) with check (%s or (%s and (%s)))',
    tbl, write_open, uid_c, modp, write_open, uid_c, upd_check);

  if anon_update then
    execute format('create policy rls_anon_update on public.%I for update to anon using (%s) with check (%s)', tbl, open_c, open_c);
  end if;

  execute format('create policy rls_delete on public.%I for delete to authenticated using (%s or (%s and (%s)))',
    tbl, del_open, uid_c, modp);
end
$fn$;

-- deals (today: select/insert/update for every role incl. anon, no delete policy)
select public._rls_install('deals',
  'public.ws_visible(workspace_id)',
  'public.is_writer() and public.ws_visible(workspace_id)',
  'public.can_edit_record(owner_id, created_by, workspace_id) or public.can_edit_record(assigned_to_id, null, workspace_id)',
  'public.is_writer() and public.ws_visible(workspace_id)',
  true, true, false, true);

-- companies (today: authenticated all, anon select+insert)
select public._rls_install('companies',
  'public.ws_visible(workspace_id)',
  'public.is_writer() and public.ws_visible(workspace_id)',
  'public.can_edit_record(owner_id, created_by, workspace_id)',
  'public.is_writer() and public.ws_visible(workspace_id)',
  true, true, true);

-- notes (child of a deal or a contact)
select public._rls_install('notes',
  'public.can_view_deal(deal_id) or public.can_view_contact(contact_id) or created_by = (select auth.uid())',
  'public.is_writer() and (public.can_view_deal(deal_id) or public.can_view_contact(contact_id) or (deal_id is null and contact_id is null))',
  'public.is_writer() and (created_by = (select auth.uid()) or public.can_edit_deal(deal_id) or public.can_edit_contact(contact_id))',
  'public.is_writer()',
  true, true, true);

select public._rls_install('deal_files',
  'public.can_view_deal(deal_id)',
  'public.is_writer() and public.can_view_deal(deal_id)',
  'public.is_writer() and (uploaded_by = (select auth.uid()) or public.can_edit_deal(deal_id))',
  'public.is_writer()',
  true, true, true);

select public._rls_install('tasks',
  'public.can_view_deal(deal_id) or user_id = (select auth.uid()) or public.is_admin()',
  'public.is_writer()',
  'public.is_writer() and (user_id = (select auth.uid()) or public.can_edit_deal(deal_id) or public.is_admin())',
  'public.is_writer()',
  true, true, true);

select public._rls_install('deal_activities',
  'public.can_view_deal(deal_id)',
  'public.is_writer() and public.can_view_deal(deal_id)',
  'public.is_writer() and (created_by = (select auth.uid()) or public.can_edit_deal(deal_id))',
  'public.is_writer()',
  true, true, true);

select public._rls_install('deal_history',
  'public.can_view_deal(deal_id)',
  'public.is_writer() and public.can_view_deal(deal_id)',
  'public.is_manager_or_admin()',
  'public.is_manager_or_admin()',
  true, true, true);

-- pipeline stages: any workspace member reads, managers/admins write
select public._rls_install('pipeline_stages',
  'public.is_member()',
  'public.is_manager_or_admin()',
  'public.is_manager_or_admin()',
  'public.is_manager_or_admin()',
  true, true, true);

-- favorites are per user
select public._rls_install('favorites',
  'user_id = (select auth.uid())',
  'public.is_writer() and user_id = (select auth.uid())',
  'user_id = (select auth.uid())',
  'user_id = (select auth.uid())',
  true, true, true);

-- workflows
select public._rls_install('workflow_events',
  'public.is_member()',
  'public.is_writer()',
  'public.is_manager_or_admin()',
  'public.is_manager_or_admin()',
  true, true, true);

select public._rls_install('workflow_executions',
  'public.is_member()',
  'public.is_writer()',
  'public.is_manager_or_admin()',
  'public.is_manager_or_admin()',
  true, true, true);

-- deal_workflows: today authenticated can only SELECT (writes go through service_role). Keep that in open mode;
-- in workspace mode managers/admins may also write.
select public._rls_install('deal_workflows',
  'public.is_member()',
  'public.is_manager_or_admin()',
  'public.is_manager_or_admin()',
  'public.is_manager_or_admin()',
  false, false, false);

-- role administration: in workspace mode only admins may change memberships (prevents self-promotion)
select public._rls_install('user_roles',
  'user_id = (select auth.uid()) or public.is_admin()',
  'public.is_admin()',
  'public.is_admin()',
  'public.is_admin()',
  false, true, true);

select public._rls_install('roles',
  'public.is_member() or public.is_admin()',
  'public.is_admin()',
  'public.is_admin()',
  'public.is_admin()',
  false, true, true);

select public._rls_install('workspaces',
  'id = public.current_workspace_id() or public.is_admin()',
  'public.is_admin()',
  'public.is_admin()',
  'public.is_admin()',
  false, true, true);

drop function if exists public._rls_install(text, text, text, text, text, boolean, boolean, boolean, boolean);

-- ---------------------------------------------------------------------------
-- merge_deals is SECURITY DEFINER (it re-points children across tables), so in workspace mode it must itself
-- enforce edit rights: the caller must be able to edit the kept deal and every merged deal (this also rejects
-- anon and other-workspace callers). Open mode, service_role and direct DB sessions (no JWT role) are unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.merge_deals(keep uuid, merge_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $fn$
declare m uuid;
begin
  merge_ids := array_remove(merge_ids, keep);
  if merge_ids is null or array_length(merge_ids, 1) is null then
    return;
  end if;

  if public.rls_mode() = 'workspace' and auth.role() is not null and auth.role() <> 'service_role' then
    if not public.can_edit_deal(keep) then
      raise exception 'not allowed to edit the deal to keep' using errcode = '42501';
    end if;
    foreach m in array merge_ids loop
      if not public.can_edit_deal(m) then
        raise exception 'not allowed to merge deal %', m using errcode = '42501';
      end if;
    end loop;
  end if;

  update public.notes set deal_id = keep where deal_id = any(merge_ids);
  update public.deal_files set deal_id = keep where deal_id = any(merge_ids);
  update public.tasks set deal_id = keep where deal_id = any(merge_ids);
  update public.deal_activities set deal_id = keep where deal_id = any(merge_ids);
  update public.calendar_events set deal_id = keep where deal_id = any(merge_ids);

  delete from public.favorites f
  where f.entity_type = 'deal' and f.entity_id = any(merge_ids)
    and exists (
      select 1 from public.favorites k
      where k.entity_type = 'deal' and k.entity_id = keep and k.user_id is not distinct from f.user_id
    );
  update public.favorites set entity_id = keep
  where entity_type = 'deal' and entity_id = any(merge_ids);

  update public.deals set deleted_at = now(), updated_at = now() where id = any(merge_ids);
end
$fn$;

grant execute on function public.merge_deals(uuid, uuid[]) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- storage: deal-files bucket (path "<dealId>/<ts>-<name>")
-- ---------------------------------------------------------------------------
do $st$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'rls_owner_workspace: storage.objects not found, skipping deal-files policies';
    return;
  end if;
  begin
    drop policy if exists "Public read deal-files" on storage.objects;
    create policy "Public read deal-files" on storage.objects for select to anon, authenticated
      using (bucket_id = 'deal-files' and (
        (select public.rls_mode()) = 'open'
        or ((select auth.uid()) is not null and public.can_view_deal(public.storage_deal_id(name)))
      ));

    drop policy if exists "Authenticated write deal-files" on storage.objects;
    create policy "Authenticated write deal-files" on storage.objects for insert to authenticated
      with check (bucket_id = 'deal-files' and (
        (select public.rls_mode()) = 'open'
        or (public.is_writer() and public.can_view_deal(public.storage_deal_id(name)))
      ));

    drop policy if exists "Authenticated update deal-files" on storage.objects;
    create policy "Authenticated update deal-files" on storage.objects for update to authenticated
      using (bucket_id = 'deal-files' and (
        (select public.rls_mode()) = 'open'
        or (public.is_writer() and public.can_edit_deal(public.storage_deal_id(name)))
      ))
      with check (bucket_id = 'deal-files' and (
        (select public.rls_mode()) = 'open'
        or (public.is_writer() and public.can_edit_deal(public.storage_deal_id(name)))
      ));

    drop policy if exists "Authenticated delete deal-files" on storage.objects;
    create policy "Authenticated delete deal-files" on storage.objects for delete to authenticated
      using (bucket_id = 'deal-files' and (
        (select public.rls_mode()) = 'open'
        or (public.is_writer() and public.can_edit_deal(public.storage_deal_id(name)))
      ));
    -- "Service role manage deal-files" (20260801000000) is unchanged.
  exception when insufficient_privilege then
    raise notice 'rls_owner_workspace: not owner of storage.objects, deal-files policies left as they were';
  end;
end
$st$;
