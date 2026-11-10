-- Pipeline foundation: dynamic stages, soft delete, ordering, audit trigger, notes/files/favorites,
-- workflow events, aggregate/search/merge RPCs, deal-files storage bucket. Idempotent.
-- RLS follows 20260701000000_core_missing_tables.sql (anon read/insert, authenticated all, service_role all).

-- ---------------------------------------------------------------------------
-- Std RLS helper (dropped at end of file)
-- ---------------------------------------------------------------------------
create or replace function public._apply_std_rls(tbl text, mode text) returns void
language plpgsql as $fn$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format('drop policy if exists "Allow authenticated access" on public.%I', tbl);
  execute format('create policy "Allow authenticated access" on public.%I for all to authenticated using (true) with check (true)', tbl);
  execute format('drop policy if exists "Allow service role full access" on public.%I', tbl);
  execute format('create policy "Allow service role full access" on public.%I for all to service_role using (true) with check (true)', tbl);
  execute format('drop policy if exists "Allow anon read access" on public.%I', tbl);
  execute format('drop policy if exists "Allow anon insert" on public.%I', tbl);
  if mode = 'crm' then
    execute format('create policy "Allow anon read access" on public.%I for select to anon using (true)', tbl);
    execute format('create policy "Allow anon insert" on public.%I for insert to anon with check (true)', tbl);
  end if;
end
$fn$;

-- ---------------------------------------------------------------------------
-- (a) pipeline_stages
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid,
  key text not null,
  name text not null,
  color text default 'gray',
  position int not null default 0,
  visible boolean not null default true,
  probability numeric default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  wip_limit int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists uq_pipeline_stages_pipeline_key
  on public.pipeline_stages (coalesce(pipeline_id, '00000000-0000-0000-0000-000000000000'::uuid), key);
create index if not exists idx_pipeline_stages_position on public.pipeline_stages(position);

insert into public.pipeline_stages (pipeline_id, key, name, color, position, probability, is_won, is_lost, wip_limit)
select null, v.key, v.name, v.color, v.position, v.probability, v.is_won, v.is_lost, v.wip_limit
from (values
  ('qualification', 'Qualification', 'blue',   0, 10,  false, false, 10),
  ('proposal',      'Proposal',      'indigo', 1, 40,  false, false, 8),
  ('negotiation',   'Negotiation',   'purple', 2, 70,  false, false, 6),
  ('closed-won',    'Closed Won',    'green',  3, 100, true,  false, null),
  ('closed-lost',   'Closed Lost',   'red',    4, 0,   false, true,  null)
) as v(key, name, color, position, probability, is_won, is_lost, wip_limit)
where not exists (
  select 1 from public.pipeline_stages s where s.pipeline_id is null and s.key = v.key
);

-- ---------------------------------------------------------------------------
-- (b) drop deals.stage CHECK constraint(s)
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'deals' and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%stage%'
  loop
    execute format('alter table public.deals drop constraint %I', r.conname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- (c) deals columns, search vector, backfill
-- ---------------------------------------------------------------------------
alter table public.deals
  add column if not exists position double precision default 0,
  add column if not exists deleted_at timestamptz,
  add column if not exists amount_micros bigint,
  add column if not exists currency_code text default 'USD',
  add column if not exists close_date timestamptz,
  add column if not exists owner_id uuid;

-- Trigger-maintained tsvector (generated columns cannot call non-immutable helpers safely)
alter table public.deals add column if not exists tsv tsvector;

create or replace function public.deals_tsv_update() returns trigger
language plpgsql as $fn$
begin
  new.tsv :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.company, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.contact, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.notes, '')), 'C');
  return new;
end
$fn$;

drop trigger if exists trg_deals_tsv on public.deals;
create trigger trg_deals_tsv before insert or update of title, company, contact, notes on public.deals
  for each row execute function public.deals_tsv_update();

create index if not exists idx_deals_tsv on public.deals using gin (tsv);
create index if not exists idx_deals_stage_position on public.deals(stage, position) where deleted_at is null;
create index if not exists idx_deals_deleted_at on public.deals(deleted_at);

-- Backfill (touches the tsv trigger only via the update-of columns; set tsv explicitly)
update public.deals set
  tsv = setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(company, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(contact, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(notes, '')), 'C')
where tsv is null;

update public.deals d set position = r.rn
from (
  select id, (row_number() over (partition by stage order by created_at, id))::double precision as rn
  from public.deals
) r
where d.id = r.id and (d.position is null or d.position = 0);

update public.deals set amount_micros = round(coalesce(value, 0) * 1000000)::bigint
where amount_micros is null;

-- ---------------------------------------------------------------------------
-- (e) notes, deal_files, favorites, workflow_events
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  title text,
  body jsonb,
  body_text text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_notes_deal_id on public.notes(deal_id, created_at desc);
create index if not exists idx_notes_contact_id on public.notes(contact_id);

create table if not exists public.deal_files (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  name text not null,
  path text not null,
  size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz default now()
);
create index if not exists idx_deal_files_deal_id on public.deal_files(deal_id);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  entity_type text not null,
  entity_id uuid not null,
  position double precision default 0,
  created_at timestamptz default now()
);
create unique index if not exists uq_favorites_user_entity
  on public.favorites (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), entity_type, entity_id);

create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb default '{}',
  processed boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists idx_workflow_events_unprocessed on public.workflow_events(created_at) where processed = false;

-- tasks.deal_id already exists (20260701000000); keep idempotent guard
alter table public.tasks add column if not exists deal_id uuid references public.deals(id) on delete set null;

-- ---------------------------------------------------------------------------
-- (d) deal audit trigger
-- ---------------------------------------------------------------------------
create or replace function public.deal_audit() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  col text;
  o jsonb;
  n jsonb;
  act text;
  tracked text[] := array['stage','value','title','company','priority','probability','close_date','owner_id','deleted_at'];
begin
  if tg_op = 'INSERT' then
    insert into public.deal_activities (deal_id, type, title, metadata, created_by)
    values (new.id, 'created', 'Deal created',
            jsonb_build_object('new', jsonb_build_object('stage', new.stage, 'value', new.value, 'title', new.title)),
            new.created_by);
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

  if old.deleted_at is null and new.deleted_at is not null then
    act := 'deleted';
  elsif old.deleted_at is not null and new.deleted_at is null then
    act := 'restored';
  elsif old.stage is distinct from new.stage then
    act := 'stage_changed';
  else
    act := 'updated';
  end if;

  -- Skip pure ordering churn (position/updated_at only)
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
          new.created_by);

  foreach col in array tracked loop
    if o->col is distinct from n->col then
      insert into public.deal_history (deal_id, field, old_value, new_value)
      values (new.id, col, o->>col, n->>col);
    end if;
  end loop;

  return new;
end
$fn$;

drop trigger if exists trg_deal_audit on public.deals;
create trigger trg_deal_audit after insert or update or delete on public.deals
  for each row execute function public.deal_audit();

-- Workflow event emitter
create or replace function public.deal_emit_workflow_event() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'INSERT' then
    insert into public.workflow_events (event_type, entity_type, entity_id, payload)
    values ('deal.created', 'deal', new.id, jsonb_build_object('stage', new.stage, 'value', new.value));
  elsif tg_op = 'UPDATE' then
    if old.stage is distinct from new.stage then
      insert into public.workflow_events (event_type, entity_type, entity_id, payload)
      values ('deal.stage_changed', 'deal', new.id,
              jsonb_build_object('from', old.stage, 'to', new.stage, 'value', new.value));
    elsif old.value is distinct from new.value or old.title is distinct from new.title
       or old.priority is distinct from new.priority or old.deleted_at is distinct from new.deleted_at then
      insert into public.workflow_events (event_type, entity_type, entity_id, payload)
      values ('deal.updated', 'deal', new.id,
              jsonb_build_object('stage', new.stage, 'value', new.value));
    end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_deal_workflow_events on public.deals;
create trigger trg_deal_workflow_events after insert or update on public.deals
  for each row execute function public.deal_emit_workflow_event();

-- ---------------------------------------------------------------------------
-- (f) functions
-- ---------------------------------------------------------------------------
create or replace function public.pipeline_aggregates(
  p_stage_keys text[] default null,
  p_op text default 'sum',
  p_field text default 'value'
) returns table (stage text, deal_count bigint, agg numeric)
language plpgsql stable as $fn$
begin
  if p_op not in ('count','sum','avg','min','max') then
    raise exception 'invalid op %', p_op;
  end if;
  if p_field not in ('value','probability') then
    raise exception 'invalid field %', p_field;
  end if;

  return query
  select d.stage::text,
         count(*)::bigint,
         case p_op
           when 'count' then count(*)::numeric
           when 'sum' then coalesce(sum(case p_field when 'value' then d.value else d.probability end), 0)::numeric
           when 'avg' then coalesce(avg(case p_field when 'value' then d.value else d.probability end), 0)::numeric
           when 'min' then coalesce(min(case p_field when 'value' then d.value else d.probability end), 0)::numeric
           when 'max' then coalesce(max(case p_field when 'value' then d.value else d.probability end), 0)::numeric
         end
  from public.deals d
  where d.deleted_at is null
    and (p_stage_keys is null or d.stage = any(p_stage_keys))
  group by d.stage;
end
$fn$;

create or replace function public.search_deals(q text, lim int default 20)
returns setof public.deals
language sql stable as $fn$
  select d.*
  from public.deals d
  where d.deleted_at is null
    and d.tsv @@ websearch_to_tsquery('simple', q)
  order by ts_rank(d.tsv, websearch_to_tsquery('simple', q)) desc
  limit greatest(lim, 1)
$fn$;

create or replace function public.merge_deals(keep uuid, merge_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  merge_ids := array_remove(merge_ids, keep);
  if merge_ids is null or array_length(merge_ids, 1) is null then
    return;
  end if;

  update public.notes set deal_id = keep where deal_id = any(merge_ids);
  update public.deal_files set deal_id = keep where deal_id = any(merge_ids);
  update public.tasks set deal_id = keep where deal_id = any(merge_ids);
  update public.deal_activities set deal_id = keep where deal_id = any(merge_ids);
  update public.calendar_events set deal_id = keep where deal_id = any(merge_ids);

  -- favorites: unique per (user, entity); drop dupes of keep, then repoint
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

grant execute on function public.pipeline_aggregates(text[], text, text) to authenticated, anon, service_role;
grant execute on function public.search_deals(text, int) to authenticated, anon, service_role;
grant execute on function public.merge_deals(uuid, uuid[]) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- (g) storage bucket deal-files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('deal-files', 'deal-files', true, 52428800)
on conflict (id) do nothing;

drop policy if exists "Public read deal-files" on storage.objects;
create policy "Public read deal-files" on storage.objects for select to anon, authenticated using (bucket_id = 'deal-files');
drop policy if exists "Authenticated write deal-files" on storage.objects;
create policy "Authenticated write deal-files" on storage.objects for insert to authenticated with check (bucket_id = 'deal-files');
drop policy if exists "Authenticated update deal-files" on storage.objects;
create policy "Authenticated update deal-files" on storage.objects for update to authenticated using (bucket_id = 'deal-files') with check (bucket_id = 'deal-files');
drop policy if exists "Authenticated delete deal-files" on storage.objects;
create policy "Authenticated delete deal-files" on storage.objects for delete to authenticated using (bucket_id = 'deal-files');
drop policy if exists "Service role manage deal-files" on storage.objects;
create policy "Service role manage deal-files" on storage.objects for all to service_role using (bucket_id = 'deal-files') with check (bucket_id = 'deal-files');

-- ---------------------------------------------------------------------------
-- (h) RLS
-- ---------------------------------------------------------------------------
select public._apply_std_rls(t, 'crm') from unnest(array[
  'pipeline_stages','notes','deal_files','favorites','workflow_events'
]) as t;

drop function if exists public._apply_std_rls(text, text);

-- Realtime for the new stage table (ignore if publication/table already configured)
do $$
begin
  begin
    alter publication supabase_realtime add table public.pipeline_stages;
  exception when others then null;
  end;
end $$;
