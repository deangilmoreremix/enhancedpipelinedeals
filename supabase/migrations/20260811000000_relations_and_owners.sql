-- Relations & owners: companies as first-class records, deals/contacts -> companies FK,
-- profiles auto-sync from auth.users, owner columns. Idempotent: safe to re-run.
-- RLS follows 20260701000000_core_missing_tables.sql (anon read/insert demo pattern for CRM data).

-- ---------------------------------------------------------------------------
-- companies: extra columns
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists domain text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists logo_url text,
  add column if not exists notes text,
  add column if not exists owner_id uuid,
  add column if not exists created_by uuid,
  add column if not exists workspace_id uuid,
  add column if not exists custom_fields jsonb default '{}',
  add column if not exists last_enrichment jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

create index if not exists idx_companies_name_lower on public.companies (lower(btrim(name)));
create index if not exists idx_companies_owner_id on public.companies(owner_id);

-- ---------------------------------------------------------------------------
-- Owner + company columns on deals / contacts
-- ---------------------------------------------------------------------------
alter table public.deals
  add column if not exists owner_id uuid,
  add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.contacts
  add column if not exists owner_id uuid,
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists idx_deals_company_id on public.deals(company_id);
create index if not exists idx_deals_owner_id on public.deals(owner_id);
create index if not exists idx_contacts_company_id on public.contacts(company_id);
create index if not exists idx_contacts_owner_id on public.contacts(owner_id);

-- ---------------------------------------------------------------------------
-- Backfill: one company per distinct (case-insensitive, trimmed) name, then link rows
-- ---------------------------------------------------------------------------
insert into public.companies (name)
select distinct on (lower(btrim(n))) btrim(n)
from (
  select company as n from public.deals where company is not null and btrim(company) <> ''
  union all
  select company as n from public.contacts where company is not null and btrim(company) <> ''
) src
where not exists (
  select 1 from public.companies c
  where lower(btrim(c.name)) = lower(btrim(src.n)) and c.deleted_at is null
)
order by lower(btrim(n)), btrim(n);

update public.deals d
set company_id = c.id
from public.companies c
where d.company_id is null
  and d.company is not null and btrim(d.company) <> ''
  and lower(btrim(c.name)) = lower(btrim(d.company))
  and c.deleted_at is null;

update public.contacts ct
set company_id = c.id
from public.companies c
where ct.company_id is null
  and ct.company is not null and btrim(ct.company) <> ''
  and lower(btrim(c.name)) = lower(btrim(ct.company))
  and c.deleted_at is null;

-- ---------------------------------------------------------------------------
-- RLS for companies (same as other CRM tables: anon read/insert, authenticated + service_role)
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
drop policy if exists "Allow authenticated access" on public.companies;
create policy "Allow authenticated access" on public.companies for all to authenticated using (true) with check (true);
drop policy if exists "Allow service role full access" on public.companies;
create policy "Allow service role full access" on public.companies for all to service_role using (true) with check (true);
drop policy if exists "Allow anon read access" on public.companies;
create policy "Allow anon read access" on public.companies for select to anon using (true);
drop policy if exists "Allow anon insert" on public.companies;
create policy "Allow anon insert" on public.companies for insert to anon with check (true);

-- ---------------------------------------------------------------------------
-- profiles <- auth.users sync (never fails the auth signup path)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key,
  name text,
  avatar text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.sync_profile_from_auth_user() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  begin
    insert into public.profiles (id, name, avatar)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'avatar')
    )
    on conflict (id) do nothing;
  exception when others then
    null; -- never block user creation
  end;
  return new;
end
$fn$;

do $do$
begin
  begin
    drop trigger if exists on_auth_user_created_sync_profile on auth.users;
    create trigger on_auth_user_created_sync_profile
      after insert on auth.users
      for each row execute function public.sync_profile_from_auth_user();
  exception when others then
    raise notice 'Skipping auth.users profile trigger: %', sqlerrm;
  end;

  begin
    insert into public.profiles (id, name, avatar)
    select u.id,
           coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
           coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'avatar')
    from auth.users u
    on conflict (id) do nothing;
  exception when others then
    raise notice 'Skipping profiles backfill: %', sqlerrm;
  end;
end
$do$;

-- Assignable users must be readable by signed-in users (profiles RLS: authenticated only, see core tables)
alter table public.profiles enable row level security;
drop policy if exists "Allow authenticated access" on public.profiles;
create policy "Allow authenticated access" on public.profiles for all to authenticated using (true) with check (true);
drop policy if exists "Allow service role full access" on public.profiles;
create policy "Allow service role full access" on public.profiles for all to service_role using (true) with check (true);

-- Legacy deals that only carry assigned_to_id: mirror into owner_id
update public.deals set owner_id = assigned_to_id where owner_id is null and assigned_to_id is not null;
