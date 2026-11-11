-- Emits the contract schema (tables/columns, views, RPC signatures, RLS policies per role/op, buckets, realtime)
-- of the migrated test cluster as one JSON document. Used by e2e/sql/run.sh to write e2e/lib/schema.json.
with cols as (
  select c.table_name,
         jsonb_object_agg(c.column_name, jsonb_build_object(
           'type', c.data_type, 'nullable', c.is_nullable = 'YES',
           'default', c.column_default, 'generated', c.is_generated = 'ALWAYS' or c.generation_expression is not null)
           order by c.ordinal_position) as columns
  from information_schema.columns c
  where c.table_schema = 'public'
  group by c.table_name
), rels as (
  select cl.relname, cl.relkind, cl.relrowsecurity, cl.relreplident
  from pg_class cl where cl.relnamespace = 'public'::regnamespace and cl.relkind in ('r', 'v', 'p')
), pol as (
  select p.tablename,
         jsonb_agg(jsonb_build_object('name', p.policyname, 'cmd', p.cmd, 'roles', to_jsonb(p.roles), 'permissive', p.permissive)
                   order by p.policyname) as policies,
         -- role -> op -> policy names (PUBLIC expands to anon+authenticated; service_role bypasses RLS and is listed as '*')
         (select jsonb_object_agg(r, ops) from (
            select r, jsonb_object_agg(op, names) as ops from (
              select r, op, jsonb_agg(pn order by pn) as names from (
                select rr as r, oo as op, pp.policyname as pn
                from pg_policies pp
                cross join lateral unnest(case when 'public' = any(pp.roles) then array['anon','authenticated'] else pp.roles::text[] end) as rr
                cross join lateral unnest(case pp.cmd when 'ALL' then array['SELECT','INSERT','UPDATE','DELETE'] else array[pp.cmd] end) as oo
                where pp.schemaname = p.schemaname and pp.tablename = p.tablename
              ) x group by r, op
            ) y group by r
         ) z) as by_role
  from pg_policies p where p.schemaname = 'public' group by p.schemaname, p.tablename
), tables as (
  select r.relname,
         jsonb_build_object('kind', case r.relkind when 'v' then 'view' else 'table' end,
                            'rls', r.relrowsecurity, 'replica_identity', r.relreplident::text,
                            'columns', coalesce(c.columns, '{}'::jsonb),
                            'policies', coalesce(pol.policies, '[]'::jsonb),
                            'by_role', coalesce(pol.by_role, '{}'::jsonb)) as def
  from rels r left join cols c on c.table_name = r.relname left join pol on pol.tablename = r.relname
), rpcs as (
  select p.proname,
         jsonb_agg(jsonb_build_object(
           'args', pg_get_function_arguments(p.oid),
           'identity', pg_get_function_identity_arguments(p.oid),
           'returns', pg_get_function_result(p.oid),
           'security_definer', p.prosecdef,
           'volatility', p.provolatile::text,
           'execute', (select coalesce(jsonb_agg(r order by r), '[]'::jsonb) from unnest(array['anon','authenticated','service_role']) r
                       where has_function_privilege(r, p.oid, 'execute')))
           order by pg_get_function_identity_arguments(p.oid)) as sigs
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  group by p.proname
)
select jsonb_pretty(jsonb_build_object(
  'generated_by', 'e2e/sql/run.sh (emit-schema.sql) against a Postgres ' || current_setting('server_version_num')::int / 10000 || ' test cluster with all supabase/migrations applied',
  'tables', (select jsonb_object_agg(relname, def order by relname) from tables),
  'rpc', (select jsonb_object_agg(proname, sigs order by proname) from rpcs),
  'storage', jsonb_build_object(
    'buckets', (select coalesce(jsonb_object_agg(id, jsonb_build_object('public', public, 'file_size_limit', file_size_limit) order by id), '{}'::jsonb) from storage.buckets),
    'policies', (select coalesce(jsonb_agg(jsonb_build_object('name', policyname, 'cmd', cmd, 'roles', to_jsonb(roles)) order by policyname), '[]'::jsonb)
                 from pg_policies where schemaname = 'storage' and tablename = 'objects')),
  'realtime_tables', (select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public')
));
