\set QUIET on
-- Deal view features (20260811000008): custom fields, field-diff history, targets, mentions/notifications,
-- view prefs, favorite folders, RPCs (duplicates, purge, restore, clone), RLS isolation, anon denial.
begin;
\set a1 '00000000-0000-0000-0000-000000009a01'
\set mg '00000000-0000-0000-0000-000000009a02'
\set m1 '00000000-0000-0000-0000-000000009a03'
\set m2 '00000000-0000-0000-0000-000000009a04'
\set v1 '00000000-0000-0000-0000-000000009a05'
\set d1 '00000000-0000-0000-0000-00000000e001'
\set d2 '00000000-0000-0000-0000-00000000e002'
\set d3 '00000000-0000-0000-0000-00000000e003'
\set d4 '00000000-0000-0000-0000-00000000e004'
\set n1 '00000000-0000-0000-0000-00000000e101'
\set t1 '00000000-0000-0000-0000-00000000e201'
\set c1 '00000000-0000-0000-0000-00000000e301'

insert into auth.users(id, email) select u, u::text || '@t.io' from unnest(array[:'a1',:'mg',:'m1',:'m2',:'v1']::uuid[]) u;
select public.default_workspace_id() as ws1 \gset
insert into public.user_roles(user_id, role_id, workspace_id)
select v.uid::uuid, r.id, :'ws1' from (values (:'a1','admin'),(:'mg','manager'),(:'m1','member'),(:'m2','member'),(:'v1','viewer')) v(uid, rn)
join public.roles r on lower(r.name) = v.rn and r.workspace_id = :'ws1' on conflict do nothing;
insert into public.contacts(id, name, email) values (:'c1', 'DVF Contact', 'dvf@t.io') on conflict do nothing;
insert into public.deals(id, title, company, stage, value, workspace_id, owner_id, created_by, contact_id, priority, position) values
 (:'d1','Acme Renewal','Acme Inc','qualification',100,:'ws1',:'m1',:'m1',:'c1','medium',1),
 (:'d2','  acme   RENEWAL ','acme inc','proposal',200,:'ws1',:'m1',:'m1',null,'medium',1),
 (:'d3','Acme Renewal Q4','Other Co','proposal',300,:'ws1',:'m1',:'m1',:'c1','medium',2),
 (:'d4','Unrelated','Zed','proposal',400,:'ws1',:'m1',:'m1',null,'medium',3);

-- ---- schema ---------------------------------------------------------------------------------------------
select e2e.ok('deals.custom_fields jsonb not null default {}', exists (select 1 from information_schema.columns where table_name='deals' and column_name='custom_fields' and data_type='jsonb' and is_nullable='NO' and column_default like '%{}%'));
select e2e.ok('tables exist', (select count(*) = 8 from unnest(array['deal_field_definitions','note_targets','task_targets','note_mentions','user_notifications','deal_view_prefs','favorite_folders','favorite_folder_items']) t where to_regclass('public.'||t) is not null));
select e2e.ok('tasks: assignee_id + status default todo', exists (select 1 from information_schema.columns where table_name='tasks' and column_name='assignee_id') and exists (select 1 from information_schema.columns where table_name='tasks' and column_name='status' and column_default like '%todo%'));
select e2e.raises('tasks.status check rejects open', $$insert into public.tasks(title, status) values ('x','open')$$, '23514');
select e2e.raises('field type check', $$insert into public.deal_field_definitions(key,label,type) values ('bad','Bad','nope')$$, '23514');
select e2e.raises('field key unique', $$insert into public.deal_field_definitions(key,label,type) values ('k1','A','text'),('k1','B','text')$$, '23505');
select e2e.ok('user_notifications in supabase_realtime', exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='user_notifications'));

-- ---- field definitions RLS (open mode) -----------------------------------------------------------------
insert into public.deal_field_definitions(key,label,type,options,group_name) values ('region','Region','select','["EU","US"]','Geo');
select e2e.as_user('anon') \g /dev/null
select e2e.eq('open/anon: reads field definitions', e2e.cnt($$select 1 from public.deal_field_definitions$$), 1::bigint);
select e2e.raises('open/anon: cannot write definitions', $$insert into public.deal_field_definitions(key,label,type) values ('a','A','text')$$, '42501');
reset role;
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('open/auth: any authenticated writes definitions', e2e.dml($$insert into public.deal_field_definitions(key,label,type) values ('budget','Budget','number')$$), 1::bigint);
reset role;

-- ---- field-diff history ------------------------------------------------------------------------------
select e2e.as_user('authenticated', :'m1') \g /dev/null
update public.deals set title = 'Acme Renewal 2', value = 150, priority = 'high', custom_fields = '{"region":"EU","budget":5}' where id = :'d1';
update public.deals set custom_fields = '{"region":"US","budget":5}' where id = :'d1';
update public.deals set owner_id = :'m2', company = 'Acme Corp', due_date = '2030-01-01', close_date = '2030-02-01' where id = :'d1';
reset role;
select e2e.eq('diff: title row', (select count(*) from public.deal_activities where deal_id=:'d1' and type='field_changed' and metadata->>'field'='title' and metadata->>'from'='Acme Renewal' and metadata->>'to'='Acme Renewal 2' and created_by=:'m1'), 1::bigint);
select e2e.eq('diff: value is numeric json', (select (metadata->'from')::text || (metadata->'to')::text from public.deal_activities where deal_id=:'d1' and metadata->>'field'='value' limit 1), '100150');
select e2e.eq('diff: priority row', (select count(*) from public.deal_activities where deal_id=:'d1' and type='field_changed' and metadata->>'field'='priority'), 1::bigint);
select e2e.eq('diff: owner/company/due_date/close_date rows', (select count(*) from public.deal_activities where deal_id=:'d1' and type='field_changed' and metadata->>'field' in ('owner_id','company','due_date','close_date')), 4::bigint);
select e2e.eq('diff: custom key region added then changed', (select count(*) from public.deal_activities where deal_id=:'d1' and type='field_changed' and metadata->>'field'='region'), 2::bigint);
select e2e.ok('diff: custom region EU->US + label', exists (select 1 from public.deal_activities where deal_id=:'d1' and metadata->>'field'='region' and metadata->'from'='"EU"' and metadata->'to'='"US"' and metadata->>'label'='Region' and (metadata->>'custom')::boolean));
select e2e.eq('diff: unchanged custom key budget logged once', (select count(*) from public.deal_activities where deal_id=:'d1' and metadata->>'field'='budget'), 1::bigint);
select e2e.ok('diff: rows carry title (timeline adapter)', (select bool_and(title is not null and created_at is not null) from public.deal_activities where deal_id=:'d1' and type='field_changed'));
update public.deals set stage='negotiation' where id=:'d4';
select e2e.ok('diff: stage change still stage_changed with history', exists (select 1 from public.deal_activities where deal_id=:'d4' and type='stage_changed') and exists (select 1 from public.deal_history where deal_id=:'d4' and field='stage'));
update public.deals set value = value where id=:'d2';
select e2e.eq('diff: no-op update writes nothing', (select count(*) from public.deal_activities where deal_id=:'d2' and type='field_changed'), 0::bigint);

-- ---- targets backfill-compatible + RLS ----------------------------------------------------------------
insert into public.notes(id, deal_id, title, body_text, created_by) values (:'n1', :'d1', 'N', 'hello', :'m1');
insert into public.tasks(id, deal_id, user_id, title) values (:'t1', :'d1', :'m1', 'T');
select e2e.eq('task default status todo', (select status from public.tasks where id=:'t1'), 'todo');
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('targets: insert note target', e2e.dml(format($$insert into public.note_targets values (%L,'contact',%L),(%L,'deal',%L)$$, :'n1', :'c1', :'n1', :'d1')), 2::bigint);
select e2e.eq('targets: insert task target', e2e.dml(format($$insert into public.task_targets values (%L,'deal',%L)$$, :'t1', :'d1')), 1::bigint);
select e2e.raises('targets: bad type', format($$insert into public.note_targets values (%L,'x',%L)$$, :'n1', :'d1'), '23514');
reset role;
-- backfill statement is idempotent
select e2e.eq('targets: backfill idempotent', e2e.dml($$insert into public.note_targets (note_id,target_type,target_id) select n.id,'deal',n.deal_id from public.notes n where n.deal_id is not null on conflict do nothing$$), 0::bigint);
delete from public.notes where id = :'n1';
select e2e.eq('targets: cascade on note delete', (select count(*) from public.note_targets where note_id=:'n1'), 0::bigint);
insert into public.notes(id, deal_id, title, body_text, created_by) values (:'n1', :'d1', 'N', 'hello', :'m1');

-- ---- mentions -> notifications ---------------------------------------------------------------------------
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('mention: insert', e2e.dml(format($$insert into public.note_mentions(note_id, mentioned_user_id) values (%L,%L),(%L,%L)$$, :'n1', :'m2', :'n1', :'m1')), 2::bigint);
select e2e.raises('mention: unique', format($$insert into public.note_mentions(note_id, mentioned_user_id) values (%L,%L)$$, :'n1', :'m2'), '23505');
reset role;
select e2e.eq('mention: notification for mentioned user', (select count(*) from public.user_notifications where user_id=:'m2' and type='mention' and (data->>'note_id')::uuid=:'n1'), 1::bigint);
select e2e.eq('mention: self mention skipped', (select count(*) from public.user_notifications where user_id=:'m1'), 0::bigint);
select e2e.eq('mention: link points at deal', (select link from public.user_notifications where user_id=:'m2'), '/deals/' || :'d1');
select e2e.as_user('authenticated', :'m2') \g /dev/null
select e2e.eq('notif: owner sees own', e2e.cnt($$select 1 from public.user_notifications$$), 1::bigint);
select e2e.eq('notif: owner marks read', e2e.dml($$update public.user_notifications set read_at = now()$$), 1::bigint);
select e2e.raises('notif: cannot edit other columns', $$update public.user_notifications set title = 'x'$$, '42501');
select e2e.raises('notif: client cannot insert', format($$insert into public.user_notifications(user_id,type,title) values (%L,'x','y')$$, :'m2'), '42501');
reset role;
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('notif: other user sees none', e2e.cnt($$select 1 from public.user_notifications$$), 0::bigint);
select e2e.eq('notif: other user cannot update', e2e.dml($$update public.user_notifications set read_at = null$$), 0::bigint);
reset role;
select e2e.as_user('anon') \g /dev/null
select e2e.raises('notif: anon denied', $$select 1 from public.user_notifications$$, '42501');
select e2e.raises('prefs: anon denied', $$select 1 from public.deal_view_prefs$$, '42501');
reset role;

-- ---- own-rows prefs / folders --------------------------------------------------------------------------
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('prefs: insert own', e2e.dml(format($$insert into public.deal_view_prefs(user_id, tab_order, pinned_deal_ids) values (%L, array['a','b'], array[%L]::uuid[])$$, :'m1', :'d1')), 1::bigint);
select e2e.raises('prefs: cannot insert for other', format($$insert into public.deal_view_prefs(user_id) values (%L)$$, :'m2'), '42501');
select e2e.eq('folders: insert own', e2e.dml(format($$insert into public.favorite_folders(id, user_id, name) values ('00000000-0000-0000-0000-00000000e401', %L, 'F')$$, :'m1')), 1::bigint);
select e2e.eq('folder items: insert own', e2e.dml(format($$insert into public.favorite_folder_items(folder_id, deal_id) values ('00000000-0000-0000-0000-00000000e401', %L)$$, :'d1')), 1::bigint);
select e2e.raises('folders: cannot create for other', format($$insert into public.favorite_folders(user_id, name) values (%L,'x')$$, :'m2'), '42501');
reset role;
select e2e.as_user('authenticated', :'m2') \g /dev/null
select e2e.eq('isolation: other user sees no prefs', e2e.cnt($$select 1 from public.deal_view_prefs$$), 0::bigint);
select e2e.eq('isolation: other user sees no folders', e2e.cnt($$select 1 from public.favorite_folders$$), 0::bigint);
select e2e.eq('isolation: other user sees no folder items', e2e.cnt($$select 1 from public.favorite_folder_items$$), 0::bigint);
select e2e.raises('isolation: cannot add item to foreign folder', format($$insert into public.favorite_folder_items(folder_id, deal_id) values ('00000000-0000-0000-0000-00000000e401', %L)$$, :'d2'), '42501');
select e2e.eq('isolation: cannot update foreign prefs', e2e.dml($$update public.deal_view_prefs set tab_order = '{}'$$), 0::bigint);
reset role;
select e2e.ok('prefs defaults', (select hidden_tabs = '{}' and hidden_field_groups = '{}' from public.deal_view_prefs where user_id=:'m1'));
delete from public.favorite_folders where id = '00000000-0000-0000-0000-00000000e401';
select e2e.eq('folder delete cascades items', (select count(*) from public.favorite_folder_items), 0::bigint);

-- ---- find_duplicate_deals ---------------------------------------------------------------------------------
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.ok('dup: same normalized title+company', exists (select 1 from public.find_duplicate_deals('ACME renewal 2', 'acme corp') where id = :'d1' and reason = 'same_title_company'));
select e2e.ok('dup: normalizes whitespace/case (d2 vs d1 title)', exists (select 1 from public.find_duplicate_deals('Acme Renewal', 'Acme Inc') where id = :'d2' and reason = 'same_title_company'));
select e2e.ok('dup: p_exclude', not exists (select 1 from public.find_duplicate_deals('Acme Renewal', 'Acme Inc', null, :'d2') where id = :'d2'));
select e2e.ok('dup: same contact + similar title', exists (select 1 from public.find_duplicate_deals('Acme Renewal', 'Nope Ltd', :'c1') where id = :'d3' and reason = 'same_contact_similar_title'));
select e2e.ok('dup: unrelated not matched', not exists (select 1 from public.find_duplicate_deals('Acme Renewal', 'Acme Inc', :'c1') where id = :'d4'));
select e2e.eq('dup: no contact -> no fuzzy match', (select count(*) from public.find_duplicate_deals('Acme Renewal', 'Nope Ltd')), 0::bigint);
reset role;
update public.deals set deleted_at = now() where id = :'d2';
select e2e.ok('dup: ignores soft-deleted', not exists (select 1 from public.find_duplicate_deals('Acme Renewal', 'Acme Inc') where id = :'d2'));
select e2e.as_user('anon') \g /dev/null
select e2e.raises('dup: anon denied', $$select * from public.find_duplicate_deals('a','b')$$, '42501');
reset role;

-- ---- purge / restore ----------------------------------------------------------------------------------------
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('purge: only soft-deleted removed', public.purge_deals(array[:'d2', :'d4']::uuid[]), 1);
reset role;
select e2e.ok('purge: live deal survives, deleted gone', exists (select 1 from public.deals where id=:'d4') and not exists (select 1 from public.deals where id=:'d2'));
update public.deals set deleted_at = now() where id = :'d3';
insert into public.tasks(deal_id, title) values (:'d3', 'child');
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('restore: returns count', public.restore_deals(array[:'d3', :'d4']::uuid[]), 1);
reset role;
select e2e.ok('restore: deleted_at cleared', (select deleted_at is null from public.deals where id=:'d3'));
update public.deals set deleted_at = now() where id = :'d3';
select e2e.as_user('authenticated', :'m1') \g /dev/null
select public.purge_deals(array[:'d3']::uuid[]) \g /dev/null
reset role;
select e2e.eq('purge: cascades children (tasks, activities)', (select count(*) from public.tasks where deal_id=:'d3') + (select count(*) from public.deal_activities where deal_id=:'d3'), 0::bigint);
select e2e.as_user('anon') \g /dev/null
select e2e.raises('purge: anon denied', format($$select public.purge_deals(array[%L]::uuid[])$$, :'d4'), '42501');
select e2e.raises('restore: anon denied', format($$select public.restore_deals(array[%L]::uuid[])$$, :'d4'), '42501');
reset role;

-- ---- clone_deal ---------------------------------------------------------------------------------------------
update public.tasks set status = 'done' where id = :'t1';
update public.deals set is_favorite = true where id = :'d1';
select e2e.as_user('authenticated', :'m1') \g /dev/null
select public.clone_deal(:'d1', false) as cl1 \gset
select public.clone_deal(:'d1', true) as cl2 \gset
reset role;
select e2e.ok('clone: copy fields', exists (select 1 from public.deals c join public.deals s on s.id = :'d1' where c.id = :'cl1' and c.title = s.title || ' (copy)' and c.stage = s.stage and c.custom_fields = s.custom_fields and c.is_favorite is not true and c.deleted_at is null and c.created_by = :'m1'));
select e2e.ok('clone: position at end of stage', (select c.position > (select max(position) from public.deals where stage = c.stage and id not in (:'cl1', :'cl2')) from public.deals c where c.id = :'cl1'));
select e2e.eq('clone without related: no notes/tasks', (select count(*) from public.notes where deal_id=:'cl1') + (select count(*) from public.tasks where deal_id=:'cl1'), 0::bigint);
select e2e.eq('clone with related: notes copied', (select count(*) from public.notes where deal_id=:'cl2'), 1::bigint);
select e2e.eq('clone with related: tasks copied as todo', (select count(*) from public.tasks where deal_id=:'cl2' and status='todo'), 1::bigint);
select e2e.ok('clone with related: targets re-pointed to clone', exists (select 1 from public.note_targets nt join public.notes n on n.id = nt.note_id where n.deal_id=:'cl2' and nt.target_type='deal' and nt.target_id=:'cl2') and not exists (select 1 from public.note_targets nt join public.notes n on n.id = nt.note_id where n.deal_id=:'cl2' and nt.target_type='deal' and nt.target_id=:'d1') and exists (select 1 from public.task_targets tt join public.tasks t on t.id = tt.task_id where t.deal_id=:'cl2' and tt.target_id=:'cl2'));
select e2e.ok('clone: source untouched', (select count(*) from public.notes where deal_id=:'d1') = 1);
select e2e.as_user('anon') \g /dev/null
select e2e.raises('clone: anon denied', format($$select public.clone_deal(%L)$$, :'d1'), '42501');
reset role;

-- ---- RPC grants ---------------------------------------------------------------------------------------------
select e2e.ok('rpc grants: not anon, yes authenticated+service_role', (
  select bool_and(not has_function_privilege('anon', p.oid, 'execute') and has_function_privilege('authenticated', p.oid, 'execute') and has_function_privilege('service_role', p.oid, 'execute'))
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('find_duplicate_deals','purge_deals','restore_deals','clone_deal')));

-- ================================ workspace mode ===================================
update public.app_settings set setting_value = '"workspace"'::jsonb where setting_key='rls_mode' and user_id is null;
select e2e.as_user('anon') \g /dev/null
select e2e.eq('ws/anon: no field definitions', e2e.cnt($$select 1 from public.deal_field_definitions$$), 0::bigint);
reset role;
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('ws/member: reads definitions', e2e.cnt($$select 1 from public.deal_field_definitions$$), 2::bigint);
select e2e.raises('ws/member: cannot write definitions', $$insert into public.deal_field_definitions(key,label,type) values ('w1','W','text')$$, '42501');
select e2e.eq('ws/member: sees targets of own note', e2e.cnt($$select 1 from public.note_targets$$) > 0, true);
reset role;
select e2e.as_user('authenticated', :'mg') \g /dev/null
select e2e.eq('ws/manager: writes definitions', e2e.dml($$insert into public.deal_field_definitions(key,label,type) values ('w1','W','text')$$), 1::bigint);
select e2e.ok('ws/manager: workspace_id defaulted', (select workspace_id is not null from public.deal_field_definitions where key='w1'));
reset role;
select e2e.as_user('authenticated', :'v1') \g /dev/null
select e2e.raises('ws/viewer: cannot add note target', format($$insert into public.note_targets values (%L,'deal',%L)$$, :'n1', :'d4'), '42501');
select e2e.raises('ws/viewer: cannot clone', format($$select public.clone_deal(%L)$$, :'d4'), '42501');
reset role;
update public.deals set deleted_at = now() where id = :'d4';
select e2e.as_user('authenticated', :'v1') \g /dev/null
select e2e.raises('ws/viewer: cannot purge', format($$select public.purge_deals(array[%L]::uuid[])$$, :'d4'), '42501');
reset role;
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('ws/member: purges own soft-deleted deal', public.purge_deals(array[:'d4']::uuid[]), 1);
reset role;
update public.app_settings set setting_value = '"open"'::jsonb where setting_key='rls_mode' and user_id is null;
rollback;
