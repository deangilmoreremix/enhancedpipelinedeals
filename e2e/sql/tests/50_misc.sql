\set QUIET on
\getenv migdir E2E_MIGDIR
begin;
-- ---- saved_pipeline_views ---------------------------------------------------
insert into auth.users(id,email) values ('00000000-0000-0000-0000-00000000bb01','u1@t.io'),('00000000-0000-0000-0000-00000000bb02','u2@t.io');
select e2e.passes('view_type ' || t, format($$insert into public.saved_pipeline_views(name, view_type) values (%L, %L)$$, 'vt-' || t, t))
from unnest(array['board','kanban','table','list','calendar','timeline','dashboard']) t;
select e2e.raises('view_type unknown rejected', $$insert into public.saved_pipeline_views(name, view_type) values ('bad','gantt')$$, '23514');
select e2e.raises('unique (coalesce(user_id), name): two NULL-user views with same name', $$insert into public.saved_pipeline_views(name) values ('vt-board')$$, '23505');
insert into public.saved_pipeline_views(user_id, name) values ('00000000-0000-0000-0000-00000000bb01','dup'),('00000000-0000-0000-0000-00000000bb02','dup');
select e2e.ok('same name allowed for different users', true);
select e2e.raises('same user + same name rejected', $$insert into public.saved_pipeline_views(user_id, name) values ('00000000-0000-0000-0000-00000000bb01','dup')$$, '23505');
select e2e.ok('legacy unique(user_id,name) constraint replaced', not exists (select 1 from pg_constraint where conrelid='public.saved_pipeline_views'::regclass and conname='saved_pipeline_views_user_id_name_key'));
select e2e.eq('default view_type', (select view_type from public.saved_pipeline_views where name='dup' limit 1), 'board');
-- RLS
insert into public.saved_pipeline_views(user_id, name, is_public) values ('00000000-0000-0000-0000-00000000bb02','u2-pub',true),('00000000-0000-0000-0000-00000000bb02','u2-priv',false);
select e2e.as_user('authenticated','00000000-0000-0000-0000-00000000bb01') \g /dev/null
select e2e.eq('rls: user sees own + public + shared, not others'' private', e2e.cnt($$select 1 from public.saved_pipeline_views where name in ('u2-pub','u2-priv')$$), 1::bigint);
select e2e.eq('rls: user cannot update others'' view -> 0 rows', e2e.dml($$update public.saved_pipeline_views set description='x' where name='u2-pub'$$), 0::bigint);
select e2e.raises('rls: user cannot insert a view for someone else', $$insert into public.saved_pipeline_views(user_id, name) values ('00000000-0000-0000-0000-00000000bb02','steal')$$, '42501');
select e2e.eq('rls: user can insert own', e2e.dml($$insert into public.saved_pipeline_views(user_id, name) values ('00000000-0000-0000-0000-00000000bb01','mine')$$), 1::bigint);
reset role;
select e2e.as_user('anon') \g /dev/null
select e2e.eq('rls: anon sees shared (NULL user) + public only', e2e.cnt($$select 1 from public.saved_pipeline_views where user_id is not null and not is_public$$), 0::bigint);
select e2e.eq('rls: anon can insert shared view', e2e.dml($$insert into public.saved_pipeline_views(name) values ('anon-shared')$$), 1::bigint);
select e2e.raises('rls: anon cannot insert owned view', $$insert into public.saved_pipeline_views(user_id, name) values ('00000000-0000-0000-0000-00000000bb01','anon-owned')$$, '42501');
reset role;

-- legacy copy from public.saved_views
select e2e.ok('legacy saved_views table exists', to_regclass('public.saved_views') is not null);
insert into public.saved_views(name, description, view_type, filters, sorting, columns, group_by, is_default, is_public, created_by, usage_count, tags) values
 ('legacy-ok', 'd', 'table', '{"stage":"proposal"}', '[{"f":"value"}]', '["title"]', '{owner,priority}', true, true, '00000000-0000-0000-0000-00000000bb01', 3, '{a,b}'),
 ('legacy-array', null, 'weird', '[{"field":"stage"}]', '[]', '[]', '{}', false, false, '00000000-0000-0000-0000-00000000dead', 0, '{}'),
 ('', null, 'kanban', null, null, null, null, null, null, null, null, null);
\i :migdir/20260801000002_saved_views_alignment.sql
select e2e.eq('legacy: copied rows', (select count(*) from public.saved_pipeline_views where name in ('legacy-ok','legacy-array','Untitled view')), 3::bigint);
select e2e.ok('legacy: mapped fields', (select view_type='table' and user_id='00000000-0000-0000-0000-00000000bb01' and group_by='owner' and is_default and is_public and usage_count=3 and tags='{a,b}' and filters->>'stage'='proposal' from public.saved_pipeline_views where name='legacy-ok'));
select e2e.ok('legacy: unknown view_type -> board, orphan created_by -> NULL user, array filters wrapped', (select view_type='board' and user_id is null and filters ? 'filters' from public.saved_pipeline_views where name='legacy-array'));
select e2e.eq('legacy: empty name -> Untitled view', (select view_type from public.saved_pipeline_views where name='Untitled view'), 'kanban');
\i :migdir/20260801000002_saved_views_alignment.sql
select e2e.eq('legacy: re-run does not duplicate', (select count(*) from public.saved_pipeline_views where name in ('legacy-ok','legacy-array','Untitled view')), 3::bigint);

-- ---- storage buckets --------------------------------------------------------
select e2e.eq('bucket ' || b, (select count(*) from storage.buckets where id = b), 1::bigint) from unnest(array['deal-files','ai-images','ai-audio','deal-images']) b;
select e2e.ok('bucket deal-files public + 50MB limit', (select public and file_size_limit = 52428800 from storage.buckets where id='deal-files'));
select e2e.ok('storage policies exist for every bucket', (select count(distinct (regexp_match(policyname, '(deal-files|ai-images|ai-audio|deal-images)'))[1]) = 4 from pg_policies where schemaname='storage' and tablename='objects'));
-- open mode public read / service role manage
select e2e.as_user('anon') \g /dev/null
select e2e.passes('anon can read storage.objects (public buckets)', $$select * from storage.objects$$);
select e2e.raises('anon cannot write deal-files', $$insert into storage.objects(bucket_id,name) values ('deal-files','a/b')$$, '42501');
select e2e.raises('anon cannot write ai-images', $$insert into storage.objects(bucket_id,name) values ('ai-images','a')$$, '42501');
reset role;
select e2e.as_user('authenticated','00000000-0000-0000-0000-00000000bb01') \g /dev/null
select e2e.passes('authenticated writes deal-images', $$insert into storage.objects(bucket_id,name) values ('deal-images','a')$$);
select e2e.raises('authenticated cannot write ai-audio', $$insert into storage.objects(bucket_id,name) values ('ai-audio','a')$$, '42501');
reset role;
select e2e.as_user('service_role') \g /dev/null
select e2e.passes('service_role writes ai-audio', $$insert into storage.objects(bucket_id,name) values ('ai-audio','a')$$);
reset role;

-- ---- pgvector ---------------------------------------------------------------
select case when exists (select 1 from pg_extension where extname='vector')
  then e2e.ok('match_contacts exists', to_regprocedure('public.match_contacts(vector,integer,double precision)') is not null)
  else 'UNTESTED match_contacts / contact_embeddings (pgvector not installed in this Postgres; migration skipped them with a notice)' end;
select case when exists (select 1 from pg_extension where extname='vector')
  then e2e.ok('contact_embeddings exists', to_regclass('public.contact_embeddings') is not null)
  else 'UNTESTED contact_embeddings RLS/hnsw index' end;
rollback;
