\set QUIET on
-- Hardening (20260811000006): rate limiting + contact_embeddings RLS (vector parts UNTESTED without pgvector)
begin;
\set u1 '00000000-0000-0000-0000-000000007a01'
\set u2 '00000000-0000-0000-0000-000000007a02'
insert into auth.users(id, email) select u, u::text || '@t.io' from unnest(array[:'u1',:'u2']::uuid[]) u;

select e2e.ok('rate_limits table exists with RLS enabled', (select relrowsecurity from pg_class where oid = 'public.rate_limits'::regclass));
select e2e.eq('rate_limits has no client policies', (select count(*) from pg_policies where tablename='rate_limits'), 0::bigint);
select e2e.ok('check_rate_limit is security definer', (select prosecdef from pg_proc where oid = 'public.check_rate_limit(text,int,int)'::regprocedure));

-- service role: allowed up to the limit, blocked after
select e2e.as_user('service_role') \g /dev/null
select e2e.eq('svc: call 1 allowed', public.check_rate_limit('svc:a', 3, 3600), true);
select e2e.eq('svc: call 2 allowed', public.check_rate_limit('svc:a', 3, 3600), true);
select e2e.eq('svc: call 3 allowed (at limit)', public.check_rate_limit('svc:a', 3, 3600), true);
select e2e.eq('svc: call 4 blocked', public.check_rate_limit('svc:a', 3, 3600), false);
select e2e.eq('svc: call 5 still blocked', public.check_rate_limit('svc:a', 3, 3600), false);
select e2e.eq('svc: other key independent', public.check_rate_limit('svc:b', 3, 3600), true);
select e2e.raises('svc: invalid limit rejected', $$select public.check_rate_limit('svc:c', 0, 60)$$, '22023');
select e2e.raises('svc: window > 1 day rejected', $$select public.check_rate_limit('svc:c', 1, 86401)$$, '22023');
-- new window resets
select e2e.eq('svc: 1s window first call', public.check_rate_limit('svc:w', 1, 1), true);
select e2e.eq('svc: 1s window second call blocked', public.check_rate_limit('svc:w', 1, 1), false);
select pg_sleep(1.2) \g /dev/null
select e2e.eq('svc: new window resets', public.check_rate_limit('svc:w', 1, 1), true);
reset role;

-- authenticated: own prefix only
select e2e.as_user('authenticated', :'u1') \g /dev/null
select e2e.eq('auth: own-prefixed key allowed', public.check_rate_limit(:'u1' || ':ai', 1, 3600), true);
select e2e.eq('auth: own-prefixed key blocked after limit', public.check_rate_limit(:'u1' || ':ai', 1, 3600), false);
select e2e.raises('auth: foreign prefix rejected', format($$select public.check_rate_limit(%L, 1, 60)$$, :'u2' || ':ai'), '42501');
select e2e.raises('auth: unprefixed key rejected', $$select public.check_rate_limit('ai', 1, 60)$$, '42501');
select e2e.raises('auth: cannot read rate_limits table', $$select count(*) from public.rate_limits$$, '42501');
reset role;

select e2e.as_user('anon') \g /dev/null
select e2e.raises('anon: execute denied', $$select public.check_rate_limit('x', 1, 60)$$, '42501');
select e2e.raises('anon: table denied', $$select count(*) from public.rate_limits$$, '42501');
reset role;

-- idempotent: re-apply the migration file
\getenv migdir E2E_MIGDIR
\set mig :migdir '/20260811000006_hardening.sql'
\i :mig
select e2e.eq('idempotent: policies still none on rate_limits', (select count(*) from pg_policies where tablename='rate_limits'), 0::bigint);
select e2e.eq('idempotent: counters preserved (svc:a still blocked)', (select public.check_rate_limit('svc:a', 3, 3600)), false);

-- contact_embeddings (needs pgvector)
do $$ begin
  if to_regclass('public.contact_embeddings') is null then
    raise notice 'UNTESTED contact_embeddings RLS scoping (pgvector not installed)';
    raise notice 'UNTESTED match_contacts respects contact visibility (pgvector not installed)';
  end if;
end $$;
select case when to_regclass('public.contact_embeddings') is null then 'UNTESTED contact_embeddings RLS scoping (pgvector not installed)' else e2e.ok('contact_embeddings: blanket policy removed', (select count(*)=0 from pg_policies where tablename='contact_embeddings' and qual='true' and roles @> '{authenticated}')) end;
select case when to_regclass('public.contact_embeddings') is null then 'UNTESTED match_contacts respects contact visibility (pgvector not installed)' else e2e.ok('match_contacts is security invoker', not (select prosecdef from pg_proc where proname='match_contacts')) end;
rollback;
