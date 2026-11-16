-- Deal view features: custom fields, field-diff history, multi-target notes/tasks, mentions + notifications,
-- per-user view prefs, favorite folders, duplicate detection / purge / restore / clone RPCs.
-- Idempotent. Policies follow the rls_mode() open|workspace pattern of 20260811000002.

-- ---------------------------------------------------------------------------
-- (1) deals.custom_fields
-- ---------------------------------------------------------------------------
alter table public.deals add column if not exists custom_fields jsonb default '{}'::jsonb;
alter table public.deals disable trigger user;
update public.deals set custom_fields = '{}'::jsonb where custom_fields is null;
alter table public.deals enable trigger user;
alter table public.deals alter column custom_fields set default '{}'::jsonb;
alter table public.deals alter column custom_fields set not null;

-- ---------------------------------------------------------------------------
-- (2) deal_field_definitions
-- ---------------------------------------------------------------------------
create table if not exists public.deal_field_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  key text not null unique,
  label text not null,
  type text check (type in ('text','number','select','multi_select','rating','link','email','phone','date')),
  options jsonb not null default '[]'::jsonb,
  position int not null default 0,
  group_name text,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz default now()
);
create index if not exists idx_deal_field_definitions_position on public.deal_field_definitions(position);

-- ---------------------------------------------------------------------------
-- (4) tasks: assignee_id + status reconciliation
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists assignee_id uuid;
alter table public.tasks add column if not exists status text;
do $t$
declare c record; has_completed boolean; has_completed_at boolean;
begin
  select exists (select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='completed' and data_type='boolean') into has_completed;
  select exists (select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='completed_at') into has_completed_at;
  -- drop any existing CHECK on status so values can be normalised
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.tasks'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.tasks drop constraint %I', c.conname);
  end loop;
  alter table public.tasks disable trigger user;
  update public.tasks set status = case
      when lower(coalesce(status, '')) in ('done', 'completed', 'complete', 'closed') then 'done'
      when lower(coalesce(status, '')) in ('in_progress', 'in progress', 'doing', 'started') then 'in_progress'
      else 'todo' end
    where status is distinct from case
      when lower(coalesce(status, '')) in ('done', 'completed', 'complete', 'closed') then 'done'
      when lower(coalesce(status, '')) in ('in_progress', 'in progress', 'doing', 'started') then 'in_progress'
      else 'todo' end;
  if has_completed then
    execute 'update public.tasks set status = ''done'' where completed is true and status <> ''done''';
  end if;
  if has_completed_at then
    execute 'update public.tasks set status = ''done'' where completed_at is not null and status <> ''done''';
  end if;
  alter table public.tasks enable trigger user;
end
$t$;
alter table public.tasks alter column status set default 'todo';
alter table public.tasks alter column status set not null;
do $t$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.tasks'::regclass and conname = 'tasks_status_check') then
    alter table public.tasks add constraint tasks_status_check check (status in ('todo', 'in_progress', 'done'));
  end if;
end $t$;
create index if not exists idx_tasks_assignee_id on public.tasks(assignee_id);

-- ---------------------------------------------------------------------------
-- (4) note_targets / task_targets
-- ---------------------------------------------------------------------------
create table if not exists public.note_targets (
  note_id uuid not null references public.notes(id) on delete cascade,
  target_type text not null check (target_type in ('deal', 'contact', 'company')),
  target_id uuid not null,
  primary key (note_id, target_type, target_id)
);
create index if not exists idx_note_targets_target on public.note_targets(target_type, target_id);

create table if not exists public.task_targets (
  task_id uuid not null references public.tasks(id) on delete cascade,
  target_type text not null check (target_type in ('deal', 'contact', 'company')),
  target_id uuid not null,
  primary key (task_id, target_type, target_id)
);
create index if not exists idx_task_targets_target on public.task_targets(target_type, target_id);

insert into public.note_targets (note_id, target_type, target_id)
select n.id, 'deal', n.deal_id from public.notes n where n.deal_id is not null
on conflict do nothing;
insert into public.task_targets (task_id, target_type, target_id)
select t.id, 'deal', t.deal_id from public.tasks t where t.deal_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- (5) note_mentions / user_notifications
-- ---------------------------------------------------------------------------
create table if not exists public.note_mentions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  mentioned_user_id uuid not null,
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  unique (note_id, mentioned_user_id)
);
create index if not exists idx_note_mentions_user on public.note_mentions(mentioned_user_id);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  link text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_user_notifications_user on public.user_notifications(user_id, created_at desc);

create or replace function public.note_mention_notify() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare n record; snippet text;
begin
  if new.mentioned_user_id is not null and new.mentioned_user_id is not distinct from coalesce(new.created_by, auth.uid()) then
    return new; -- self mention
  end if;
  select * into n from public.notes where id = new.note_id;
  snippet := left(coalesce(n.body_text, ''), 200);
  insert into public.user_notifications (user_id, type, title, body, link, data)
  values (new.mentioned_user_id, 'mention', 'You were mentioned in a note',
          nullif(snippet, ''),
          case when n.deal_id is not null then '/deals/' || n.deal_id::text else null end,
          jsonb_build_object('note_id', new.note_id, 'deal_id', n.deal_id,
                             'mentioned_by', coalesce(new.created_by, auth.uid()),
                             'mention_id', new.id));
  return new;
end
$fn$;
drop trigger if exists trg_note_mention_notify on public.note_mentions;
create trigger trg_note_mention_notify after insert on public.note_mentions
  for each row execute function public.note_mention_notify();

do $rt$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.user_notifications;
    exception
      when duplicate_object then null;
      when others then raise notice 'deal_view_features: could not add user_notifications to supabase_realtime (%)', sqlerrm;
    end;
  end if;
end
$rt$;

-- ---------------------------------------------------------------------------
-- (6) deal_view_prefs / favorite_folders / favorite_folder_items
-- ---------------------------------------------------------------------------
create table if not exists public.deal_view_prefs (
  user_id uuid primary key,
  tab_order text[] not null default '{}',
  hidden_tabs text[] not null default '{}',
  hidden_field_groups text[] not null default '{}',
  pinned_deal_ids uuid[] not null default '{}',
  updated_at timestamptz default now()
);
create table if not exists public.favorite_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  position int not null default 0,
  created_at timestamptz default now()
);
create index if not exists idx_favorite_folders_user on public.favorite_folders(user_id, position);
create table if not exists public.favorite_folder_items (
  folder_id uuid not null references public.favorite_folders(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  position int not null default 0,
  primary key (folder_id, deal_id)
);
create index if not exists idx_favorite_folder_items_deal on public.favorite_folder_items(deal_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $rls$
declare
  t text;
  p text;
  open_c constant text := '(select public.rls_mode()) = ''open''';
  ws_c   constant text := '(select public.rls_mode()) = ''workspace'' and (select auth.uid()) is not null';
  uid    constant text := '(select auth.uid())';
  note_vis constant text := 'exists (select 1 from public.notes n where n.id = note_id)';
  note_mod constant text := 'public.is_writer() and exists (select 1 from public.notes n where n.id = note_id and (n.created_by = (select auth.uid()) or public.can_edit_deal(n.deal_id) or public.can_edit_contact(n.contact_id)))';
  task_vis constant text := 'exists (select 1 from public.tasks k where k.id = task_id)';
  task_mod constant text := 'public.is_writer() and exists (select 1 from public.tasks k where k.id = task_id and (k.user_id = (select auth.uid()) or k.assignee_id = (select auth.uid()) or public.can_edit_deal(k.deal_id) or public.is_admin()))';
  tgt_ok constant text := '(target_type = ''company'' or (target_type = ''deal'' and public.can_view_deal(target_id)) or (target_type = ''contact'' and public.can_view_contact(target_id)))';
begin
  foreach t in array array['deal_field_definitions','note_targets','task_targets','note_mentions','user_notifications',
                           'deal_view_prefs','favorite_folders','favorite_folder_items'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;
  end loop;

  -- deal_field_definitions: read all (anon in open mode), write manager/admin (open: any authenticated)
  execute format('create policy dfd_select on public.deal_field_definitions for select to anon, authenticated using (%s or (%s and public.is_member() and (workspace_id is null or public.ws_visible(workspace_id))))', open_c, ws_c);
  execute format('create policy dfd_insert on public.deal_field_definitions for insert to authenticated with check (%s or (%s and public.is_manager_or_admin()))', open_c, ws_c);
  execute format('create policy dfd_update on public.deal_field_definitions for update to authenticated using (%s or (%s and public.is_manager_or_admin())) with check (%s or (%s and public.is_manager_or_admin()))', open_c, ws_c, open_c, ws_c);
  execute format('create policy dfd_delete on public.deal_field_definitions for delete to authenticated using (%s or (%s and public.is_manager_or_admin()))', open_c, ws_c);

  -- note_targets (follows parent note)
  execute format('create policy nt_select on public.note_targets for select to anon, authenticated using (%s or (%s and %s))', open_c, ws_c, note_vis);
  execute format('create policy nt_insert on public.note_targets for insert to anon, authenticated with check (%s or (%s and %s and %s))', open_c, ws_c, note_mod, tgt_ok);
  execute format('create policy nt_update on public.note_targets for update to authenticated using (%s or (%s and %s)) with check (%s or (%s and %s and %s))', open_c, ws_c, note_mod, open_c, ws_c, note_mod, tgt_ok);
  execute format('create policy nt_delete on public.note_targets for delete to authenticated using (%s or (%s and %s))', open_c, ws_c, note_mod);

  -- task_targets (follows parent task)
  execute format('create policy tt_select on public.task_targets for select to anon, authenticated using (%s or (%s and %s))', open_c, ws_c, task_vis);
  execute format('create policy tt_insert on public.task_targets for insert to anon, authenticated with check (%s or (%s and %s and %s))', open_c, ws_c, task_mod, tgt_ok);
  execute format('create policy tt_update on public.task_targets for update to authenticated using (%s or (%s and %s)) with check (%s or (%s and %s and %s))', open_c, ws_c, task_mod, open_c, ws_c, task_mod, tgt_ok);
  execute format('create policy tt_delete on public.task_targets for delete to authenticated using (%s or (%s and %s))', open_c, ws_c, task_mod);

  -- note_mentions
  execute format('create policy nm_select on public.note_mentions for select to authenticated using (%s or (%s and (mentioned_user_id = %s or created_by = %s or %s)))', open_c, ws_c, uid, uid, note_vis);
  execute format('create policy nm_insert on public.note_mentions for insert to authenticated with check (%s or (%s and public.is_writer() and %s))', open_c, ws_c, note_vis);
  execute format('create policy nm_delete on public.note_mentions for delete to authenticated using (%s or (%s and (created_by = %s or public.is_manager_or_admin())))', open_c, ws_c, uid);

  -- user_notifications: own rows only; read_at is the only updatable column; inserts via trigger / service_role
  execute format('create policy un_select on public.user_notifications for select to authenticated using (user_id = %s)', uid);
  execute format('create policy un_update on public.user_notifications for update to authenticated using (user_id = %s) with check (user_id = %s)', uid, uid);

  -- own-rows tables
  execute format('create policy dvp_all on public.deal_view_prefs for all to authenticated using (user_id = %s) with check (user_id = %s)', uid, uid);
  execute format('create policy ff_all on public.favorite_folders for all to authenticated using (user_id = %s) with check (user_id = %s)', uid, uid);
  execute format('create policy ffi_all on public.favorite_folder_items for all to authenticated using (exists (select 1 from public.favorite_folders f where f.id = folder_id and f.user_id = %s)) with check (exists (select 1 from public.favorite_folders f where f.id = folder_id and f.user_id = %s))', uid, uid);
end
$rls$;

revoke all on public.user_notifications from anon, authenticated;
grant select on public.user_notifications to authenticated;
grant update (read_at) on public.user_notifications to authenticated;
revoke all on public.deal_view_prefs, public.favorite_folders, public.favorite_folder_items, public.note_mentions from anon;

-- workspace/creator defaults on insert (workspace mode only)
drop trigger if exists rls_insert_defaults on public.deal_field_definitions;
create trigger rls_insert_defaults before insert on public.deal_field_definitions
  for each row execute function public.rls_insert_defaults('workspace_id', 'created_by', '');

-- ---------------------------------------------------------------------------
-- (3) deal_audit: + field-diff history ('field_changed' rows)
-- ---------------------------------------------------------------------------
create or replace function public.deal_audit() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  col text;
  o jsonb;
  n jsonb;
  act text;
  actor uuid;
  k text;
  lbl text;
  tracked text[] := array['stage','value','title','company','priority','probability','close_date','owner_id','deleted_at'];
  diffed text[] := array['title','value','priority','owner_id','company','close_date','due_date'];
begin
  if tg_op = 'INSERT' then
    actor := coalesce(auth.uid(), new.created_by);
    insert into public.deal_activities (deal_id, type, title, metadata, created_by)
    values (new.id, 'created', 'Deal created',
            jsonb_build_object('new', jsonb_build_object('stage', new.stage, 'value', new.value, 'title', new.title)),
            actor);
    if new.deleted_at is null then
      insert into public.sales_velocity_metrics (deal_id, stage, entered_at)
      values (new.id, new.stage, coalesce(new.created_at, now()))
      on conflict do nothing;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    -- deal_activities rows cascade with the deal; nothing durable to write against a vanished deal id
    return old;
  end if;

  o := to_jsonb(old);
  n := to_jsonb(new);

  if o is not distinct from n then
    return new;
  end if;

  actor := coalesce(auth.uid(), new.created_by);

  if old.deleted_at is null and new.deleted_at is not null then
    act := 'deleted';
  elsif old.deleted_at is not null and new.deleted_at is null then
    act := 'restored';
  elsif old.stage is distinct from new.stage then
    act := 'stage_changed';
  else
    act := 'updated';
  end if;

  -- stage-stay bookkeeping (sales velocity)
  if old.stage is distinct from new.stage and new.deleted_at is null then
    update public.sales_velocity_metrics v
       set exited_at = now(),
           days_in_stage = round((extract(epoch from (now() - coalesce(v.entered_at, now()))) / 86400.0)::numeric, 4)
     where v.deal_id = new.id and v.exited_at is null;
    insert into public.sales_velocity_metrics (deal_id, stage, entered_at) values (new.id, new.stage, now())
    on conflict do nothing;
  elsif old.deleted_at is not null and new.deleted_at is null then
    insert into public.sales_velocity_metrics (deal_id, stage, entered_at) values (new.id, new.stage, now())
    on conflict do nothing;
  end if;

  -- field-diff history: one 'field_changed' row per changed field / custom field key
  foreach col in array diffed loop
    if o->col is distinct from n->col then
      insert into public.deal_activities (deal_id, type, title, description, metadata, created_by)
      values (new.id, 'field_changed', initcap(replace(col, '_', ' ')) || ' changed',
              col || ': ' || coalesce(o->>col, '') || ' -> ' || coalesce(n->>col, ''),
              jsonb_build_object('field', col, 'from', o->col, 'to', n->col), actor);
    end if;
  end loop;
  if o->'custom_fields' is distinct from n->'custom_fields'
     and jsonb_typeof(coalesce(o->'custom_fields', '{}'::jsonb)) = 'object'
     and jsonb_typeof(coalesce(n->'custom_fields', '{}'::jsonb)) = 'object' then
    for k in
      select key from (
        select jsonb_object_keys(coalesce(o->'custom_fields', '{}'::jsonb)) as key
        union
        select jsonb_object_keys(coalesce(n->'custom_fields', '{}'::jsonb))
      ) ks order by key
    loop
      if (o->'custom_fields'->k) is distinct from (n->'custom_fields'->k) then
        lbl := null;
        if to_regclass('public.deal_field_definitions') is not null then
          select d.label into lbl from public.deal_field_definitions d where d.key = k limit 1;
        end if;
        insert into public.deal_activities (deal_id, type, title, description, metadata, created_by)
        values (new.id, 'field_changed', coalesce(lbl, k) || ' changed',
                coalesce(lbl, k) || ': ' || coalesce(o->'custom_fields'->>k, '') || ' -> ' || coalesce(n->'custom_fields'->>k, ''),
                jsonb_build_object('field', k, 'from', o->'custom_fields'->k, 'to', n->'custom_fields'->k,
                                   'custom', true, 'label', coalesce(lbl, k)),
                actor);
      end if;
    end loop;
  end if;

  -- Skip pure ordering churn (position/updated_at only) for the generic row
  if act = 'updated' and not exists (
    select 1 from unnest(tracked) c where o->c is distinct from n->c
  ) then
    return new;
  end if;

  insert into public.deal_activities (deal_id, type, title, metadata, created_by)
  values (new.id, act,
          case act when 'stage_changed' then 'Stage changed' when 'deleted' then 'Deal deleted'
                   when 'restored' then 'Deal restored' else 'Deal updated' end,
          jsonb_build_object(
            'old', jsonb_build_object('stage', old.stage, 'value', old.value),
            'new', jsonb_build_object('stage', new.stage, 'value', new.value)),
          actor);

  foreach col in array tracked loop
    if o->col is distinct from n->col then
      insert into public.deal_history (deal_id, field, old_value, new_value, changed_by)
      values (new.id, col, o->>col, n->>col, actor);
    end if;
  end loop;

  return new;
end
$fn$;

-- ---------------------------------------------------------------------------
-- (7) RPCs
-- ---------------------------------------------------------------------------
do $e$ begin
  begin
    create extension if not exists pg_trgm;
  exception when others then
    raise notice 'deal_view_features: pg_trgm unavailable (%), using fallback similarity', sqlerrm;
  end;
end $e$;

create or replace function public.find_duplicate_deals(
  p_title text, p_company text, p_contact_id uuid default null, p_exclude uuid default null
) returns table (id uuid, title text, company text, value numeric, stage text, reason text)
language plpgsql stable security invoker set search_path = public, extensions, pg_temp as $fn$
#variable_conflict use_column
declare
  nt text := lower(regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g'));
  nc text := lower(regexp_replace(btrim(coalesce(p_company, '')), '\s+', ' ', 'g'));
  has_trgm boolean := exists (select 1 from pg_proc where proname = 'similarity');
begin
  if nt = '' then return; end if;
  return query
  select * from (
    select distinct on (d.id) d.id, d.title, d.company, d.value, d.stage,
      case
        when lower(regexp_replace(btrim(coalesce(d.title, '')), '\s+', ' ', 'g')) = nt
             and lower(regexp_replace(btrim(coalesce(d.company, '')), '\s+', ' ', 'g')) = nc
          then 'same_title_company'
        else 'same_contact_similar_title'
      end as reason
    from public.deals d
    where d.deleted_at is null
      and (p_exclude is null or d.id <> p_exclude)
      and (
        (lower(regexp_replace(btrim(coalesce(d.title, '')), '\s+', ' ', 'g')) = nt
          and lower(regexp_replace(btrim(coalesce(d.company, '')), '\s+', ' ', 'g')) = nc)
        or (p_contact_id is not null and d.contact_id = p_contact_id and (
              case when has_trgm
                then public._dvf_sim(d.title, p_title) >= 0.5
                else lower(coalesce(d.title, '')) like '%' || nt || '%' or nt like '%' || lower(nullif(btrim(coalesce(d.title, '')), '')) || '%'
              end))
      )
  ) m
  order by (m.reason = 'same_title_company') desc, m.title
  limit 20;
end
$fn$;

-- similarity wrapper (dynamic so the function compiles without pg_trgm)
create or replace function public._dvf_sim(a text, b text) returns numeric
language plpgsql stable set search_path = public, extensions, pg_temp as $fn$
declare r numeric;
begin
  execute 'select similarity($1, $2)' into r using coalesce(a, ''), coalesce(b, '');
  return r;
exception when others then
  return 0;
end
$fn$;

-- permanently delete soft-deleted deals (SECURITY DEFINER: deals has no DELETE policy for clients)
create or replace function public.purge_deals(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_ids uuid[]; m uuid; n int := 0;
begin
  if auth.role() = 'anon' or (auth.role() is not null and auth.role() <> 'service_role' and auth.uid() is null) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select coalesce(array_agg(d.id), '{}') into v_ids from public.deals d
   where d.id = any(coalesce(p_ids, '{}')) and d.deleted_at is not null;
  if public.rls_mode() = 'workspace' and auth.role() is not null and auth.role() <> 'service_role' then
    foreach m in array v_ids loop
      if not public.can_edit_deal(m) then
        raise exception 'not allowed to purge deal %', m using errcode = '42501';
      end if;
    end loop;
  end if;
  if coalesce(array_length(v_ids, 1), 0) = 0 then return 0; end if;
  delete from public.tasks where deal_id = any(v_ids);
  delete from public.favorites where entity_type = 'deal' and entity_id = any(v_ids);
  delete from public.deals where id = any(v_ids) and deleted_at is not null;
  get diagnostics n = row_count;
  return n;
end
$fn$;

create or replace function public.restore_deals(p_ids uuid[]) returns int
language plpgsql security invoker set search_path = public, pg_temp as $fn$
declare n int;
begin
  update public.deals set deleted_at = null, updated_at = now()
   where id = any(coalesce(p_ids, '{}')) and deleted_at is not null;
  get diagnostics n = row_count;
  return n;
end
$fn$;

create or replace function public.clone_deal(p_id uuid, p_include_related boolean default false) returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $fn$
declare
  src public.deals%rowtype;
  v jsonb;
  cols text;
  new_id uuid := gen_random_uuid();
  pos numeric;
  uid uuid := auth.uid();
  nrow record; trow record; new_note uuid; new_task uuid;
begin
  if auth.role() = 'anon' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into src from public.deals where id = p_id;
  if not found then
    raise exception 'deal not found' using errcode = 'P0002';
  end if;
  if public.rls_mode() = 'workspace' and auth.role() is not null and auth.role() <> 'service_role'
     and not (public.is_writer() and public.can_view_deal(p_id)) then
    raise exception 'not allowed to clone this deal' using errcode = '42501';
  end if;
  select coalesce(max(position), 0) + 1 into pos from public.deals where stage is not distinct from src.stage and deleted_at is null;

  v := (to_jsonb(src) - 'id' - 'created_at' - 'updated_at' - 'deleted_at' - 'tsv' - 'last_activity')
       || jsonb_build_object('id', new_id, 'title', coalesce(src.title, '') || ' (copy)', 'position', pos,
                             'is_favorite', false, 'deleted_at', null, 'custom_fields', coalesce(src.custom_fields, '{}'::jsonb));
  if uid is not null then v := v || jsonb_build_object('created_by', uid); end if;
  select string_agg(quote_ident(a.attname), ', ') into cols
    from pg_attribute a
   where a.attrelid = 'public.deals'::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
     and a.attname not in ('created_at', 'updated_at', 'tsv', 'last_activity');
  execute format('insert into public.deals (%1$s) select %1$s from jsonb_populate_record(null::public.deals, $1)', cols) using v;

  if p_include_related then
    for nrow in select * from public.notes where deal_id = p_id and deleted_at is null loop
      new_note := gen_random_uuid();
      insert into public.notes (id, deal_id, contact_id, title, body, body_text, created_by)
      values (new_note, new_id, nrow.contact_id, nrow.title, nrow.body, nrow.body_text, coalesce(uid, nrow.created_by));
      insert into public.note_targets (note_id, target_type, target_id)
      select new_note, nt.target_type, case when nt.target_type = 'deal' and nt.target_id = p_id then new_id else nt.target_id end
        from public.note_targets nt where nt.note_id = nrow.id
      on conflict do nothing;
      insert into public.note_targets (note_id, target_type, target_id) values (new_note, 'deal', new_id) on conflict do nothing;
    end loop;
    for trow in select * from public.tasks where deal_id = p_id loop
      new_task := gen_random_uuid();
      insert into public.tasks (id, deal_id, contact_id, user_id, title, due_date, notes, status, assignee_id, created_by_agent)
      values (new_task, new_id, trow.contact_id, coalesce(uid, trow.user_id), trow.title, trow.due_date, trow.notes, 'todo', trow.assignee_id, coalesce(trow.created_by_agent, false));
      insert into public.task_targets (task_id, target_type, target_id)
      select new_task, tt.target_type, case when tt.target_type = 'deal' and tt.target_id = p_id then new_id else tt.target_id end
        from public.task_targets tt where tt.task_id = trow.id
      on conflict do nothing;
      insert into public.task_targets (task_id, target_type, target_id) values (new_task, 'deal', new_id) on conflict do nothing;
    end loop;
  end if;
  return new_id;
end
$fn$;

revoke all on function public.find_duplicate_deals(text, text, uuid, uuid) from public, anon;
revoke all on function public.purge_deals(uuid[]) from public, anon;
revoke all on function public.restore_deals(uuid[]) from public, anon;
revoke all on function public.clone_deal(uuid, boolean) from public, anon;
revoke all on function public._dvf_sim(text, text) from public, anon;
revoke all on function public.note_mention_notify() from public, anon, authenticated;
grant execute on function public.find_duplicate_deals(text, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.purge_deals(uuid[]) to authenticated, service_role;
grant execute on function public.restore_deals(uuid[]) to authenticated, service_role;
grant execute on function public.clone_deal(uuid, boolean) to authenticated, service_role;
grant execute on function public._dvf_sim(text, text) to authenticated, service_role;
