\set QUIET on
\getenv migdir E2E_MIGDIR
-- Contract fixes (20260811000005): columns the app writes, RLS per role/op, merge_deals, deal_audit actor,
-- feature-flag init safety, realtime, private deal-files bucket, deal_last_activity.
begin;
\set a1 '00000000-0000-0000-0000-000000006a01'
\set mg '00000000-0000-0000-0000-000000006a02'
\set m1 '00000000-0000-0000-0000-000000006a03'
\set v1 '00000000-0000-0000-0000-000000006a05'
\set d1 '00000000-0000-0000-0000-00000000f001'
\set d2 '00000000-0000-0000-0000-00000000f002'
\set d3 '00000000-0000-0000-0000-00000000f003'

-- helper: names of columns from `cols` missing on the table
create or replace function e2e.missing_cols(tbl text, cols text[]) returns text language sql stable as
$$ select coalesce(string_agg(c, ','), '') from unnest(cols) c
   where not exists (select 1 from information_schema.columns where table_schema='public' and table_name=tbl and column_name=c) $$;

-- ---- columns the client reads / writes (dealMapper FIELDS + dealFromRow, stageToRow, services) ----------------
select e2e.eq('cols: deals (dealMapper)', e2e.missing_cols('deals', array['id','title','company','company_id','contact','contact_id','assigned_to_id','assigned_to','value','amount_micros','stage','probability','priority','due_date','notes','created_at','updated_at','contact_avatar','company_avatar','last_activity','tags','is_favorite','custom_fields','social_profiles','last_enrichment','attachments','links','next_follow_up','ai_score','health_score','health_factors','win_probability','probability_factors','template_id','timeline','last_health_update','last_probability_update','position','deleted_at','owner_id','close_date','currency_code','created_by','workspace_id']), '');
select e2e.eq('cols: pipeline_stages (stageToRow)', e2e.missing_cols('pipeline_stages', array['pipeline_id','key','name','color','position','visible','probability','is_won','is_lost','wip_limit','updated_at']), '');
select e2e.eq('cols: deal_workflows (workflow services)', e2e.missing_cols('deal_workflows', array['id','user_id','name','description','stages','triggers','is_active','category','settings','metadata','version','created_by','created_at','updated_at']), '');
select e2e.eq('cols: enhanced_activities (enhancedActivityService)', e2e.missing_cols('enhanced_activities', array['deal_id','contact_id','user_id','activity_type','title','description','metadata','tags','priority','status','duration_minutes','related_records','ai_insights','created_at','updated_at']), '');
select e2e.eq('cols: kpi_values (kpiService)', e2e.missing_cols('kpi_values', array['kpi_id','period_start','period_end','value','target_value','status','calculated_at','metadata']), '');
select e2e.eq('cols: sales_velocity_metrics (kpiService velocity)', e2e.missing_cols('sales_velocity_metrics', array['deal_id','stage','entered_at','exited_at','days_in_stage','period_start','period_end','metrics']), '');
select e2e.eq('cols: deal_history', e2e.missing_cols('deal_history', array['deal_id','field','old_value','new_value','changed_by','changed_at']), '');
select e2e.eq('cols: deal_activities', e2e.missing_cols('deal_activities', array['deal_id','type','title','description','metadata','created_by','created_at']), '');
select e2e.ok('type: kpi_values.status / calculated_at', (select count(*) = 2 from information_schema.columns where table_name='kpi_values' and ((column_name='status' and data_type='text') or (column_name='calculated_at' and data_type like 'timestamp%'))));
select e2e.ok('type: deal_workflows.version integer default 1, settings/metadata jsonb', (select count(*) = 3 from information_schema.columns where table_name='deal_workflows' and ((column_name='version' and data_type='integer' and column_default like '1%') or (column_name in ('settings','metadata') and data_type='jsonb'))));
select e2e.ok('view: deal_last_activity exists', to_regclass('public.deal_last_activity') is not null);

-- ---- fixtures ----------------------------------------------------------------------------------------------
insert into auth.users(id, email) select u, u::text || '@t.io' from unnest(array[:'a1',:'mg',:'m1',:'v1']::uuid[]) u;
select public.default_workspace_id() as ws1 \gset
insert into public.user_roles(user_id, role_id, workspace_id)
select v.uid::uuid, r.id, :'ws1' from (values (:'a1','admin'),(:'mg','manager'),(:'m1','member'),(:'v1','viewer')) v(uid, rn)
join public.roles r on lower(r.name) = v.rn and r.workspace_id = :'ws1' on conflict do nothing;
insert into public.deals(id, title, stage, value, workspace_id, owner_id, created_by) values
 (:'d1','K-keep','qualification',10,:'ws1',:'m1',:'m1'),
 (:'d2','K-merge1','proposal',20,:'ws1',:'m1',:'m1'),
 (:'d3','K-merge2','proposal',30,:'ws1',:'m1',:'m1');

-- ---- (a) feature_flags / app_settings visible to signed-in users -------------------------------------------
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.ok('auth: reads feature_flags', e2e.cnt($$select 1 from public.feature_flags$$) > 5);
select e2e.eq('auth: reads global rls_mode setting', e2e.cnt($$select 1 from public.app_settings where user_id is null and setting_key='rls_mode'$$), 1::bigint);
select e2e.eq('auth: cannot write feature_flags', e2e.dml($$update public.feature_flags set enabled = not enabled$$), 0::bigint);
reset role;
select e2e.as_user('anon') \g /dev/null
select e2e.ok('anon: still reads feature_flags', e2e.cnt($$select 1 from public.feature_flags$$) > 5);
reset role;
insert into public.app_settings(user_id, setting_key, setting_value) values (:'a1', 'private-pref', '1'::jsonb);
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('auth: other users'' settings stay private', e2e.cnt($$select 1 from public.app_settings where setting_key='private-pref'$$), 0::bigint);
reset role;

-- ---- (h) feature flag init -------------------------------------------------------------------------------
select e2e.ok('flags: analytics flags seeded', (select count(*) = 2 and bool_and(enabled) from public.feature_flags where feature_key in ('twenty_predictive_analytics','twenty_pipeline_analytics')));
update public.feature_flags set enabled = true, rollout_percentage = 42 where feature_key = 'twenty_workflow_phase5';
update public.feature_flags set enabled = false where feature_key = 'twenty_kanban_aggregation';
select e2e.as_user('anon') \g /dev/null
select e2e.raises('flags: anon cannot call initialize_all_feature_flags', $$select public.initialize_all_feature_flags()$$, '42501');
reset role;
select e2e.as_user('authenticated', :'a1') \g /dev/null
select e2e.raises('flags: authenticated (even admin) cannot call initialize_all_feature_flags', $$select public.initialize_all_feature_flags()$$, '42501');
reset role;
select e2e.as_user('service_role') \g /dev/null
select e2e.passes('flags: service_role can call initialize_all_feature_flags', $$select public.initialize_all_feature_flags()$$);
reset role;
select e2e.ok('flags: init does not reset existing flags', (select enabled and rollout_percentage = 42 from public.feature_flags where feature_key='twenty_workflow_phase5')
  and (select not enabled from public.feature_flags where feature_key='twenty_kanban_aggregation'));
delete from public.feature_flags where feature_key = 'twenty_wip_limits';
select e2e.as_user('service_role') \g /dev/null
select public.initialize_all_feature_flags() \g /dev/null
reset role;
select e2e.eq('flags: init re-creates missing flags', (select count(*) from public.feature_flags where feature_key='twenty_wip_limits'), 1::bigint);

-- ---- (b) deal_workflows: open mode --------------------------------------------------------------------------
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('open/auth: insert workflow with all service columns', e2e.dml(format($$insert into public.deal_workflows(user_id, name, description, stages, triggers, is_active, category, settings, metadata, version, created_by) values (%L,'wf1','d','[]','[]',true,'custom','{"isActive":true}','{"a":1}',1,%L)$$, :'m1', :'m1')), 1::bigint);
select e2e.eq('open/auth: update workflow', e2e.dml($$update public.deal_workflows set version = 2, settings = '{"isActive":false}', is_active = false where name='wf1'$$), 1::bigint);
select e2e.eq('open/auth: read workflow', e2e.cnt($$select 1 from public.deal_workflows where name='wf1' and version = 2$$), 1::bigint);
select e2e.eq('open/auth: delete workflow', e2e.dml($$delete from public.deal_workflows where name='wf1'$$), 1::bigint);
reset role;
insert into public.deal_workflows(name) values ('wf-anon-target');
select e2e.as_user('anon') \g /dev/null
select e2e.raises('open/anon: cannot insert workflow', $$insert into public.deal_workflows(name) values ('x')$$, '42501');
select e2e.eq('open/anon: cannot see/update workflow', e2e.dml($$update public.deal_workflows set name='h' where name='wf-anon-target'$$), 0::bigint);
select e2e.eq('open/anon: cannot delete workflow', e2e.dml($$delete from public.deal_workflows where name='wf-anon-target'$$), 0::bigint);
reset role;

-- ---- (e) enhanced_activities insert: open mode -----------------------------------------------------------
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('open/auth: insert enhanced_activity', e2e.dml(format($$insert into public.enhanced_activities(deal_id, user_id, activity_type, title, metadata, tags, priority, status, related_records, ai_insights) values (%L,%L,'note','n1','{}','{}','medium','completed','[]','{}')$$, :'d1', :'m1')), 1::bigint);
reset role;
select e2e.as_user('anon') \g /dev/null
select e2e.raises('open/anon: enhanced_activity insert denied', format($$insert into public.enhanced_activities(deal_id, activity_type, title) values (%L,'note','x')$$, :'d1'), '42501');
reset role;

-- ---- (g) deal_audit actor + velocity ---------------------------------------------------------------------
select e2e.as_user('authenticated', :'mg') \g /dev/null
select e2e.eq('audit: update as manager', e2e.dml($$update public.deals set stage='negotiation', value=11 where title='K-keep'$$), 1::bigint);
reset role;
select e2e.ok('audit: deal_activities.created_by = acting user (not deal creator)', (select created_by = :'mg'::uuid from public.deal_activities where deal_id=:'d1' and type='stage_changed'));
select e2e.ok('audit: deal_history.changed_by = acting user', (select count(*) = 2 and bool_and(changed_by = :'mg'::uuid) from public.deal_history where deal_id=:'d1'));
select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false) \g /dev/null
update public.deals set title = 'K-keep2' where id = :'d1';
select e2e.ok('audit: no JWT -> falls back to created_by', (select changed_by = :'m1'::uuid from public.deal_history where deal_id=:'d1' and field='title'));
update public.deals set title = 'K-keep' where id = :'d1';
select e2e.ok('velocity: closed qualification stay + open negotiation stay', (select count(*) filter (where stage='qualification' and exited_at is not null and days_in_stage >= 0) = 1 and count(*) filter (where stage='negotiation' and exited_at is null) = 1 from public.sales_velocity_metrics where deal_id=:'d1'));
select e2e.raises('velocity: at most one open stay per deal', format($$insert into public.sales_velocity_metrics(deal_id, stage, entered_at) values (%L,'x',now())$$, :'d1'), '23505');
select e2e.eq('velocity: every live deal has an open stay', (select count(*) from public.deals d where d.deleted_at is null and not exists (select 1 from public.sales_velocity_metrics v where v.deal_id=d.id and v.exited_at is null)), 0::bigint);
insert into public.kpi_definitions(id, name) values ('00000000-0000-0000-0000-00000000aa01', 'k');
select e2e.passes('kpi_values: insert with status + calculated_at', $$insert into public.kpi_values(kpi_id, period_start, period_end, value, target_value, status) values ('00000000-0000-0000-0000-00000000aa01', current_date, current_date, 1, 2, 'at_risk')$$);
select e2e.raises('kpi_values: bad status rejected', $$insert into public.kpi_values(kpi_id, value, status) values ('00000000-0000-0000-0000-00000000aa01', 1, 'great')$$, '23514');
select e2e.ok('kpi_values: calculated_at defaulted', (select calculated_at is not null from public.kpi_values where status='at_risk'));

-- ---- (f) merge_deals ------------------------------------------------------------------------------------
insert into public.notes(deal_id, title) values (:'d2','n-d2'),(:'d3','n-d3');
insert into public.deal_history(deal_id, field, new_value) values (:'d2','manual','h');
insert into public.deal_deadlines(deal_id, title, deadline_at) values (:'d2','dl', now());
insert into public.communication_records(deal_id, type) values (:'d2','email');
insert into public.outbound_messages(deal_id, channel, recipient, body) values (:'d3','email','x@y.z','hi');
insert into public.deal_health_factors(deal_id, name) values (:'d2','hf');
insert into public.deal_probability_factors(deal_id, name) values (:'d3','pf');
insert into public.enhanced_activities(deal_id, activity_type, title) values (:'d2','call','ea');
insert into public.activities(deal_id, type, title) values (:'d3','call','ac');
insert into public.tasks(deal_id, title) values (:'d2','t');
insert into public.deal_files(deal_id, name, path) values (:'d3','f','p');
insert into public.calendar_events(deal_id, title) values (:'d2','ev');
insert into public.action_items(deal_id, description) values (:'d3','ai');
insert into public.follow_ups(deal_id, type, description) values (:'d2','call','fu');
select e2e.ok('merge: returns survivor row as jsonb', (select (public.merge_deals(:'d1', array[:'d2', :'d3', :'d1']::uuid[], jsonb_build_object('title','K-merged','value',99,'stage','won','workspace_id',null,'bogus','x','id','00000000-0000-0000-0000-000000000000','deleted_at','2020-01-01','tags',jsonb_build_array('a','b'))) ->> 'title') = 'K-merged'));
select e2e.ok('merge: p_fields applied atomically (title/value/stage/tags)', (select title='K-merged' and value=99 and stage='won' and tags = array['a','b'] from public.deals where id=:'d1'));
select e2e.ok('merge: protected columns ignored (id, workspace_id, deleted_at) and unknown keys skipped', (select workspace_id = :'ws1'::uuid and deleted_at is null from public.deals where id=:'d1'));
select e2e.ok('merge: merged deals soft-deleted', (select count(*) = 2 from public.deals where id in (:'d2',:'d3') and deleted_at is not null));
select e2e.eq('merge: notes', (select count(*) from public.notes where deal_id=:'d1' and title in ('n-d2','n-d3')), 2::bigint);
select e2e.eq('merge: deal_deadlines', (select count(*) from public.deal_deadlines where deal_id=:'d1'), 1::bigint);
select e2e.eq('merge: communication_records', (select count(*) from public.communication_records where deal_id=:'d1'), 1::bigint);
select e2e.eq('merge: outbound_messages', (select count(*) from public.outbound_messages where deal_id=:'d1'), 1::bigint);
select e2e.eq('merge: deal_health_factors', (select count(*) from public.deal_health_factors where deal_id=:'d1'), 1::bigint);
select e2e.eq('merge: deal_probability_factors', (select count(*) from public.deal_probability_factors where deal_id=:'d1'), 1::bigint);
select e2e.eq('merge: enhanced_activities', (select count(*) from public.enhanced_activities where deal_id=:'d1' and title='ea'), 1::bigint);
select e2e.eq('merge: activities', (select count(*) from public.activities where deal_id=:'d1'), 1::bigint);
select e2e.ok('merge: tasks, files, events, action_items, follow_ups', (select count(*) from public.tasks where deal_id=:'d1') = 1 and (select count(*) from public.deal_files where deal_id=:'d1') = 1 and (select count(*) from public.calendar_events where deal_id=:'d1') = 1 and (select count(*) from public.action_items where deal_id=:'d1') = 1 and (select count(*) from public.follow_ups where deal_id=:'d1') = 1);
select e2e.ok('merge: deal_history of merged deals now on survivor', (select count(*) from public.deal_history where deal_id in (:'d2',:'d3') and field <> 'deleted_at') = 0 and (select count(*) from public.deal_history where deal_id = :'d1' and field = 'manual') = 1);
select e2e.eq('merge: velocity rows of merged deals dropped', (select count(*) from public.sales_velocity_metrics where deal_id in (:'d2',:'d3')), 0::bigint);
select e2e.raises('merge: soft-deleted keep -> P0002', format($$select public.merge_deals(%L, array[%L]::uuid[])$$, :'d2', :'d1'), 'P0002');
select e2e.raises('merge: unknown keep -> P0002', $$select public.merge_deals(gen_random_uuid(), array[gen_random_uuid()])$$, 'P0002');
select e2e.passes('merge: 2-arg call still works (p_fields defaults)', format($$select public.merge_deals(%L, array[%L]::uuid[])$$, :'d1', :'d2'));
select e2e.eq('merge: single function signature (no ambiguous overload)', (select count(*) from pg_proc where proname='merge_deals' and pronamespace='public'::regnamespace), 1::bigint);
select e2e.ok('merge: p_fields leaves the survivor untouched when a value is invalid (atomic rollback)', (
  select e2e.raises('x', format($$select public.merge_deals(%L, null, '{"value":"abc"}'::jsonb)$$, :'d1')) like 'PASS%' and (select value = 99 from public.deals where id=:'d1')));
select e2e.ok('merge: execute is not public (anon/authenticated/service_role only via grants)', has_function_privilege('authenticated', 'public.merge_deals(uuid, uuid[], jsonb)', 'execute') and has_function_privilege('service_role', 'public.merge_deals(uuid, uuid[], jsonb)', 'execute'));

-- ---- (d) realtime ------------------------------------------------------------------------------------------
select e2e.ok('realtime: deals in supabase_realtime', exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='deals'));
select e2e.eq('realtime: deals replica identity FULL', (select relreplident::text from pg_class where oid='public.deals'::regclass), 'f');

-- ---- (i) deal-files private --------------------------------------------------------------------------------
insert into storage.buckets(id,name,public) values ('deal-files','deal-files',true) on conflict do nothing;
\i :migdir/20260811000005_contract_fixes.sql
select e2e.ok('bucket deal-files private after migration (re-run also flips a re-published bucket)', (select not public from storage.buckets where id='deal-files'));
select e2e.ok('deal-files policies intact', (select count(*) >= 5 from pg_policies where schemaname='storage' and tablename='objects' and policyname like '%deal-files%'));

-- ---- (j) deal_last_activity --------------------------------------------------------------------------------
insert into public.deals(id, title, stage, workspace_id) values ('00000000-0000-0000-0000-00000000f010','K-quiet','qualification',:'ws1');
select e2e.ok('last_activity: audit-only deal has NULL last activity', (select last_activity_at is null from public.deal_last_activity where deal_id='00000000-0000-0000-0000-00000000f010'));
insert into public.notes(deal_id, title, created_at) values ('00000000-0000-0000-0000-00000000f010','real', now() - interval '3 days');
select e2e.ok('last_activity: a note counts', (select abs(extract(epoch from (now() - interval '3 days' - last_activity_at))) < 5 from public.deal_last_activity where deal_id='00000000-0000-0000-0000-00000000f010'));
update public.deals set stage='proposal' where id='00000000-0000-0000-0000-00000000f010';
select e2e.ok('last_activity: stage change is not activity', (select abs(extract(epoch from (now() - interval '3 days' - last_activity_at))) < 5 from public.deal_last_activity where deal_id='00000000-0000-0000-0000-00000000f010'));
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.ok('last_activity: readable by authenticated (security_invoker)', e2e.cnt($$select 1 from public.deal_last_activity$$) >= 1);
reset role;

-- ================================ workspace mode ===================================
update public.app_settings set setting_value = '"workspace"'::jsonb where setting_key='rls_mode' and user_id is null;
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.raises('ws/member: cannot insert workflow', $$insert into public.deal_workflows(name) values ('nope')$$, '42501');
reset role;
select e2e.as_user('authenticated', :'v1') \g /dev/null
select e2e.raises('ws/viewer: cannot insert workflow', $$insert into public.deal_workflows(name) values ('nope')$$, '42501');
select e2e.raises('ws/viewer: cannot insert enhanced_activity', format($$insert into public.enhanced_activities(deal_id, activity_type, title) values (%L,'note','x')$$, :'d1'), '42501');
reset role;
select e2e.as_user('authenticated', :'mg') \g /dev/null
select e2e.eq('ws/manager: inserts workflow', e2e.dml($$insert into public.deal_workflows(name, category, settings) values ('mgr-wf','custom','{}')$$), 1::bigint);
select e2e.eq('ws/manager: updates workflow', e2e.dml($$update public.deal_workflows set version = 3 where name='mgr-wf'$$), 1::bigint);
select e2e.eq('ws/manager: deletes workflow', e2e.dml($$delete from public.deal_workflows where name='mgr-wf'$$), 1::bigint);
reset role;
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('ws/member: may log enhanced_activity on a visible deal', e2e.dml(format($$insert into public.enhanced_activities(deal_id, user_id, activity_type, title) values (%L,%L,'note','ok')$$, :'d1', :'m1')), 1::bigint);
select e2e.raises('ws/member: cannot log activity as someone else', format($$insert into public.enhanced_activities(deal_id, user_id, activity_type, title) values (%L,%L,'note','spoof')$$, :'d1', :'a1'), '42501');
select e2e.ok('ws/auth: still reads flags and the mode setting', e2e.cnt($$select 1 from public.feature_flags$$) > 5 and e2e.cnt($$select 1 from public.app_settings where setting_key='rls_mode' and user_id is null$$) = 1);
select e2e.raises('ws/member: merge_deals with p_fields still guarded', format($$select public.merge_deals(%L, array[]::uuid[], '{"value":1}')$$, '00000000-0000-0000-0000-00000000f010'), '42501');
reset role;
select e2e.as_user('anon') \g /dev/null
select e2e.raises('ws/anon: merge_deals denied', format($$select public.merge_deals(%L, array[%L]::uuid[], '{"value":1}')$$, :'d1', :'d3'), '42501');
reset role;
update public.app_settings set setting_value = '"open"'::jsonb where setting_key='rls_mode' and user_id is null;
rollback;
