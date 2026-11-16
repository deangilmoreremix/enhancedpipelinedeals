-- Hardening: (1) contact_embeddings RLS scoped to contact visibility, (2) persistent rate limiting.
-- Idempotent. pgvector is optional (section 1 is skipped when the table does not exist).

-- ---------------------------------------------------------------------------
-- 1) contact_embeddings: replace the blanket `using (true)` policy with the contacts visibility rule
--    open mode      : anon may read (as public.contacts "Allow anon read access")
--    workspace mode : authenticated only, contact must be ws_visible (public.can_view_contact)
--    writes         : service_role only (no client write policy)
--    match_contacts is SECURITY INVOKER (default), so it is filtered by these policies.
-- ---------------------------------------------------------------------------
do $emb$
begin
  if to_regclass('public.contact_embeddings') is null then
    raise notice 'contact_embeddings absent (pgvector not installed): skipping embeddings RLS hardening';
    return;
  end if;

  alter table public.contact_embeddings enable row level security;
  drop policy if exists "Allow authenticated access" on public.contact_embeddings;
  drop policy if exists contact_embeddings_select_ws on public.contact_embeddings;
  drop policy if exists contact_embeddings_select_open on public.contact_embeddings;

  create policy contact_embeddings_select_ws on public.contact_embeddings for select to authenticated
    using ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null
           and public.can_view_contact(contact_id));

  create policy contact_embeddings_select_open on public.contact_embeddings for select to anon
    using ((select public.rls_mode()) = 'open'
           and exists (select 1 from public.contacts c where c.id = contact_id));

  -- make sure match_contacts stays invoker-rights (re-assert; harmless if already so)
  if to_regprocedure('public.match_contacts(vector, integer, double precision)') is not null then
    alter function public.match_contacts(vector, integer, double precision) security invoker;
  end if;
end
$emb$;

-- ---------------------------------------------------------------------------
-- 2) Persistent fixed-window rate limiting
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;   -- no client policies: only the definer function touches it
revoke all on public.rate_limits from public, anon, authenticated;

create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid text := (select auth.uid())::text;
  v_ws timestamptz;
  v_count int;
begin
  if p_key is null or length(p_key) = 0 or p_limit is null or p_limit < 1
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;
  -- authenticated callers may only use keys in their own namespace; service role (no uid) may use any key
  if v_uid is not null and left(p_key, length(v_uid)) <> v_uid then
    raise exception 'rate limit key must be prefixed by the caller id' using errcode = '42501';
  end if;

  v_ws := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_ws, 1)
  on conflict (key, window_start) do update set count = rl.count + 1
  returning rl.count into v_count;

  -- opportunistic prune (windows are capped at 1 day, so 2 days old rows are dead)
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_count <= p_limit;
end
$fn$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon;
grant execute on function public.check_rate_limit(text, int, int) to authenticated, service_role;
