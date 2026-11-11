\set QUIET on
begin;
\set a1 '00000000-0000-0000-0000-000000000a01'
\set mg '00000000-0000-0000-0000-000000000a02'
\set m1 '00000000-0000-0000-0000-000000000a03'
\set m2 '00000000-0000-0000-0000-000000000a04'
\set v1 '00000000-0000-0000-0000-000000000a05'
\set b1 '00000000-0000-0000-0000-000000000b01'
\set b2 '00000000-0000-0000-0000-000000000b02'
\set x1 '00000000-0000-0000-0000-000000000c01'

-- ---- fixtures (as superuser) ----------------------------------------------
insert into auth.users(id, email) select u, u::text || '@t.io' from unnest(array[:'a1',:'mg',:'m1',:'m2',:'v1',:'b1',:'b2',:'x1']::uuid[]) u;
select public.default_workspace_id() as ws1 \gset
insert into public.workspaces(id, name, created_at) values ('00000000-0000-0000-0000-0000000000a2', 'WS2', now() + interval '1 day');
\set ws2 '00000000-0000-0000-0000-0000000000a2'
insert into public.roles(name, workspace_id, is_system_role) values ('admin', :'ws2', true), ('member', :'ws2', true);
insert into public.user_roles(user_id, role_id, workspace_id)
select u.id, r.id, w.id from (values (:'a1','admin',:'ws1'),(:'mg','manager',:'ws1'),(:'m1','member',:'ws1'),(:'m2','member',:'ws1'),(:'v1','viewer',:'ws1'),(:'b1','admin',:'ws2'),(:'b2','member',:'ws2')) v(uid, rn, wid)
join auth.users u on u.id = v.uid::uuid join public.workspaces w on w.id = v.wid::uuid
join public.roles r on lower(r.name) = v.rn and r.workspace_id = w.id
on conflict do nothing;
-- the backfill ran at migration time, so the test users have no auto-membership; make sure of that:
select e2e.eq('fixture: A1 is the only admin membership of ws1', (select count(*) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.workspace_id=:'ws1' and lower(r.name)='admin' and ur.user_id=:'a1'), 1::bigint);

insert into public.deals(id, title, stage, value, workspace_id, owner_id, created_by, assigned_to_id) values
 ('00000000-0000-0000-0000-00000000d001','T-own',      'qualification', 10, :'ws1', :'m1', :'m1', null),
 ('00000000-0000-0000-0000-00000000d002','T-other',    'qualification', 20, :'ws1', :'m2', :'m2', null),
 ('00000000-0000-0000-0000-00000000d003','T-assigned', 'qualification', 30, :'ws1', :'a1', :'a1', :'m1'),
 ('00000000-0000-0000-0000-00000000d004','T-ws2',      'qualification', 40, :'ws2', :'b2', :'b2', null);
insert into public.notes(id, deal_id, title, created_by) values
 ('00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-00000000d001','n-by-m1',:'m1'),
 ('00000000-0000-0000-0000-00000000e002','00000000-0000-0000-0000-00000000d002','n-by-m2',:'m2'),
 ('00000000-0000-0000-0000-00000000e003','00000000-0000-0000-0000-00000000d001','n-by-m2-on-m1-deal',:'m2');
insert into public.tasks(id, deal_id, title, user_id) values ('00000000-0000-0000-0000-00000000e101','00000000-0000-0000-0000-00000000d002','task-m2',:'m2');
insert into public.favorites(user_id, entity_type, entity_id) values (:'m1','deal','00000000-0000-0000-0000-00000000d001'),(:'m2','deal','00000000-0000-0000-0000-00000000d002');
insert into public.contacts(id, name, workspace_id, owner_id, created_by) values
 ('00000000-0000-0000-0000-00000000c0a1','C-own',   :'ws1', :'m1', :'m1'),
 ('00000000-0000-0000-0000-00000000c0a2','C-other', :'ws1', :'m2', :'m2'),
 ('00000000-0000-0000-0000-00000000c0a3','C-ws2',   :'ws2', :'b2', :'b2');
insert into public.contact_agent_settings(contact_id, agent_id, autopilot_enabled) values
 ('00000000-0000-0000-0000-00000000c0a1','cold_email_sdr', true),
 ('00000000-0000-0000-0000-00000000c0a3','cold_email_sdr', false);
insert into public.agent_logs(contact_id, level, message) values
 ('00000000-0000-0000-0000-00000000c0a1','info','log-own'),
 ('00000000-0000-0000-0000-00000000c0a3','info','log-ws2');
insert into storage.buckets(id,name,public) values ('deal-files','deal-files',true) on conflict do nothing;

-- =============================== OPEN MODE ===================================
select e2e.eq('mode defaults to open', public.rls_mode(), 'open');
select e2e.as_user('anon') \g /dev/null
select e2e.eq('open/anon: select deals', e2e.cnt($$select 1 from public.deals where title like 'T-%'$$), 4::bigint);
select e2e.eq('open/anon: insert deal allowed', e2e.dml($$insert into public.deals(title, stage) values ('OPEN-anon','proposal')$$), 1::bigint);
select e2e.eq('open/anon: update deal allowed', e2e.dml($$update public.deals set value = 11 where title='T-own'$$), 1::bigint);
select e2e.eq('open/anon: delete deal -> 0 rows (no delete policy, as before)', e2e.dml($$delete from public.deals where title='OPEN-anon'$$), 0::bigint);
select e2e.eq('open/anon: insert contact allowed', e2e.dml($$insert into public.contacts(name) values ('anon contact')$$), 1::bigint);
select e2e.eq('open/anon: read contacts (unchanged)', e2e.cnt($$select 1 from public.contacts where name like 'C-%'$$), 3::bigint);
select e2e.eq('open/anon: read contact_agent_settings + agent_logs (crm pattern)', e2e.cnt($$select 1 from public.contact_agent_settings$$) + e2e.cnt($$select 1 from public.agent_logs$$), 4::bigint);
select e2e.eq('open/anon: insert agent_log allowed', e2e.dml($$insert into public.agent_logs(contact_id, message) values ('00000000-0000-0000-0000-00000000c0a1','anon log')$$), 1::bigint);
select e2e.eq('open/anon: update contact -> 0 rows (no anon update policy, as before)', e2e.dml($$update public.contacts set title='x' where name='C-own'$$), 0::bigint);
select e2e.eq('open/anon: delete contact -> 0 rows', e2e.dml($$delete from public.contacts where name='C-own'$$), 0::bigint);
select e2e.eq('open/anon: read companies', e2e.cnt($$select 1 from public.companies$$) >= 0, true);
select e2e.eq('open/anon: read pipeline_stages', e2e.cnt($$select 1 from public.pipeline_stages$$), 5::bigint);
select e2e.raises('open/anon: insert user_roles denied', format($$insert into public.user_roles(user_id, role_id, workspace_id) values (%L, gen_random_uuid(), %L)$$, :'x1', :'ws1'), '42501');
select e2e.eq('open/anon: user_roles invisible', e2e.cnt($$select 1 from public.user_roles$$), 0::bigint);
select e2e.eq('open/anon: notes insert allowed', e2e.dml($$insert into public.notes(title) values ('anon note')$$), 1::bigint);
reset role;
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('open/auth: contacts have no authenticated select policy in open mode (as before)', e2e.cnt($$select 1 from public.contacts where name like 'C-%'$$), 0::bigint);
select e2e.eq('open/auth: agent_logs full access', e2e.cnt($$select 1 from public.agent_logs$$), 3::bigint);
select e2e.eq('open/auth: update contact_agent_settings', e2e.dml($$update public.contact_agent_settings set current_step = 1 where contact_id='00000000-0000-0000-0000-00000000c0a3'$$), 1::bigint);
select e2e.eq('open/auth: sees all workspaces', e2e.cnt($$select 1 from public.deals where title like 'T-%'$$), 4::bigint);
select e2e.eq('open/auth: update other user''s deal', e2e.dml($$update public.deals set value = 21 where title='T-other'$$), 1::bigint);
select e2e.eq('open/auth: insert leaves workspace_id/owner null (defaults only in workspace mode)', e2e.dml($$insert into public.deals(id, title) values ('00000000-0000-0000-0000-00000000d0f1','OPEN-auth')$$), 1::bigint);
select e2e.ok('open/auth: no default workspace stamped', (select workspace_id is null and owner_id is null from public.deals where id='00000000-0000-0000-0000-00000000d0f1'));
select e2e.eq('open/auth: hard delete deal -> 0 rows (documented: no delete policy on deals)', e2e.dml($$delete from public.deals where id='00000000-0000-0000-0000-00000000d0f1'$$), 0::bigint);
select e2e.eq('open/auth: delete note allowed', e2e.dml($$delete from public.notes where id='00000000-0000-0000-0000-00000000e002'$$), 1::bigint);
select e2e.eq('open/auth: soft delete (update deleted_at) allowed', e2e.dml($$update public.deals set deleted_at = now() where id='00000000-0000-0000-0000-00000000d0f1'$$), 1::bigint);
select e2e.passes('open/auth: roles table writable (legacy behaviour)', $$update public.roles set description = 'x' where lower(name)='viewer'$$);
select e2e.raises('open/auth: set_rls_mode denied for non-admin', $$select public.set_rls_mode('workspace')$$, '42501');
select e2e.passes('open/auth: storage write deal-files', $$insert into storage.objects(bucket_id, name, owner) values ('deal-files', '00000000-0000-0000-0000-00000000d004/a.txt', null)$$);
reset role;

-- ====================== switch: admin-only, validation ========================
select e2e.as_user('authenticated', :'v1') \g /dev/null
select e2e.raises('set_rls_mode: viewer denied', $$select public.set_rls_mode('workspace')$$, '42501');
reset role;
select e2e.as_user('anon') \g /dev/null
select e2e.raises('set_rls_mode: anon denied', $$select public.set_rls_mode('workspace')$$, '42501');
reset role;
select e2e.as_user('authenticated', :'a1') \g /dev/null
select e2e.raises('set_rls_mode: invalid value rejected', $$select public.set_rls_mode('bogus')$$, '22023');
reset role;
select e2e.as_user('service_role') \g /dev/null
select e2e.eq('set_rls_mode: service_role may switch', public.set_rls_mode('workspace'), 'workspace');
reset role;
select e2e.eq('mode is now workspace', public.rls_mode(), 'workspace');

-- ============================ WORKSPACE MODE =================================
-- anon
select e2e.as_user('anon') \g /dev/null
select e2e.eq('ws/anon: select deals denied', e2e.cnt($$select 1 from public.deals$$), 0::bigint);
select e2e.raises('ws/anon: insert deal denied', $$insert into public.deals(title) values ('x')$$, '42501');
select e2e.eq('ws/anon: update -> 0 rows', e2e.dml($$update public.deals set value = 1$$), 0::bigint);
select e2e.eq('ws/anon: pipeline_stages hidden', e2e.cnt($$select 1 from public.pipeline_stages$$), 0::bigint);
select e2e.eq('ws/anon: contacts hidden', e2e.cnt($$select 1 from public.contacts$$), 0::bigint);
select e2e.raises('ws/anon: contact insert denied', $$insert into public.contacts(name) values ('anon-ws')$$, '42501');
select e2e.eq('ws/anon: agent tables hidden', e2e.cnt($$select 1 from public.agent_logs$$) + e2e.cnt($$select 1 from public.contact_agent_settings$$), 0::bigint);
select e2e.raises('ws/anon: agent_log insert denied', $$insert into public.agent_logs(message) values ('x')$$, '42501');
select e2e.eq('ws/anon: rpc search_deals returns nothing', e2e.cnt($$select * from public.search_deals('T')$$), 0::bigint);
reset role;

-- member M1 (own d001, assigned d003, not d002, ws1)
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('ws/member: sees own workspace deals only', e2e.cnt($$select 1 from public.deals where title like 'T-%'$$), 3::bigint);
select e2e.eq('ws/member: ws2 deal invisible', e2e.cnt($$select 1 from public.deals where title='T-ws2'$$), 0::bigint);
select e2e.eq('ws/member: null-workspace rows invisible', e2e.cnt($$select 1 from public.deals where workspace_id is null$$), 0::bigint);
select e2e.eq('ws/member: update own deal', e2e.dml($$update public.deals set value = 5 where title='T-own'$$), 1::bigint);
select e2e.eq('ws/member: update assigned deal', e2e.dml($$update public.deals set value = 5 where title='T-assigned'$$), 1::bigint);
select e2e.eq('ws/member: update other''s deal -> 0 rows, no error', e2e.dml($$update public.deals set value = 5 where title='T-other'$$), 0::bigint);
select e2e.eq('ws/member: delete other''s deal -> 0 rows', e2e.dml($$delete from public.deals where title='T-other'$$), 0::bigint);
select e2e.eq('ws/member: update ws2 deal -> 0 rows', e2e.dml($$update public.deals set value = 5 where title='T-ws2'$$), 0::bigint);
select e2e.raises('ws/member: cannot move own deal to another workspace', format($$update public.deals set workspace_id = %L where title='T-own'$$, :'ws2'), '42501');
select e2e.raises('ws/member: insert into other workspace denied', format($$insert into public.deals(title, workspace_id) values ('X-ws2', %L)$$, :'ws2'), '42501');
select e2e.eq('ws/member: insert w/o workspace gets defaults', e2e.dml($$insert into public.deals(id, title) values ('00000000-0000-0000-0000-00000000d0a1','T-new')$$), 1::bigint);
select e2e.ok('ws/member: defaults workspace_id/created_by/owner_id', (select workspace_id = :'ws1'::uuid and created_by = :'m1'::uuid and owner_id = :'m1'::uuid from public.deals where id='00000000-0000-0000-0000-00000000d0a1'));
select e2e.eq('ws/member: insert w/ explicit other owner keeps it', e2e.dml(format($$insert into public.deals(id, title, owner_id) values ('00000000-0000-0000-0000-00000000d0a2','T-new2', %L)$$, :'m2')), 1::bigint);
select e2e.eq('ws/member: can edit deal it created even though owner differs', e2e.dml($$update public.deals set value = 2 where id='00000000-0000-0000-0000-00000000d0a2'$$), 1::bigint);
select e2e.eq('ws/member: delete own deal', e2e.dml($$delete from public.deals where id='00000000-0000-0000-0000-00000000d0a1'$$), 1::bigint);
select e2e.eq('ws/member: sees own workspace contacts only', e2e.cnt($$select 1 from public.contacts where name like 'C-%'$$), 2::bigint);
select e2e.eq('ws/member: update own contact', e2e.dml($$update public.contacts set title='t' where name='C-own'$$), 1::bigint);
select e2e.eq('ws/member: update other''s contact -> 0 rows', e2e.dml($$update public.contacts set title='t' where name='C-other'$$), 0::bigint);
select e2e.eq('ws/member: delete other''s contact -> 0 rows', e2e.dml($$delete from public.contacts where name='C-other'$$), 0::bigint);
select e2e.eq('ws/member: ws2 contact invisible', e2e.cnt($$select 1 from public.contacts where name='C-ws2'$$), 0::bigint);
select e2e.eq('ws/member: insert contact', e2e.dml($$insert into public.contacts(id, name) values ('00000000-0000-0000-0000-00000000c0f1','C-new')$$), 1::bigint);
select e2e.ok('ws/member: contact defaults stamped', (select workspace_id = :'ws1'::uuid and created_by = :'m1'::uuid and owner_id = :'m1'::uuid from public.contacts where id='00000000-0000-0000-0000-00000000c0f1'));
select e2e.raises('ws/member: contact insert into other workspace denied', format($$insert into public.contacts(name, workspace_id) values ('X', %L)$$, :'ws2'), '42501');
select e2e.raises('ws/member: cannot move contact to another workspace', format($$update public.contacts set workspace_id = %L where name='C-own'$$, :'ws2'), '42501');
select e2e.eq('ws/member: delete own contact', e2e.dml($$delete from public.contacts where id='00000000-0000-0000-0000-00000000c0f1'$$), 1::bigint);
select e2e.eq('ws/member: agent_logs scoped to visible contacts', e2e.cnt($$select 1 from public.agent_logs$$), 2::bigint);
select e2e.eq('ws/member: contact_agent_settings scoped', e2e.cnt($$select 1 from public.contact_agent_settings$$), 1::bigint);
select e2e.eq('ws/member: update settings of own contact', e2e.dml($$update public.contact_agent_settings set current_step = 2 where contact_id='00000000-0000-0000-0000-00000000c0a1'$$), 1::bigint);
select e2e.eq('ws/member: insert agent_log for visible contact', e2e.dml($$insert into public.agent_logs(contact_id, message) values ('00000000-0000-0000-0000-00000000c0a1','m1 log')$$), 1::bigint);
select e2e.raises('ws/member: insert agent_log for other workspace contact denied', $$insert into public.agent_logs(contact_id, message) values ('00000000-0000-0000-0000-00000000c0a3','nope')$$, '42501');
select e2e.eq('ws/member: pipeline_stages readable (member)', e2e.cnt($$select 1 from public.pipeline_stages$$) > 0, true);
select e2e.raises('ws/member: pipeline_stages write denied', $$insert into public.pipeline_stages(key,name) values ('zz','ZZ')$$, '42501');
select e2e.eq('ws/member: stage update -> 0 rows', e2e.dml($$update public.pipeline_stages set name='hax'$$), 0::bigint);
-- child tables
select e2e.eq('ws/member: notes visible (ws1 deals)', e2e.cnt($$select 1 from public.notes where title like 'n-by%'$$), 2::bigint); -- e002 deleted in open phase
select e2e.eq('ws/member: edit own note', e2e.dml($$update public.notes set title='n1' where id='00000000-0000-0000-0000-00000000e001'$$), 1::bigint);
select e2e.eq('ws/member: edit other''s note on own deal (can_edit_deal)', e2e.dml($$update public.notes set title='n3' where id='00000000-0000-0000-0000-00000000e003'$$), 1::bigint);
select e2e.eq('ws/member: insert note on visible deal', e2e.dml($$insert into public.notes(deal_id, title) values ('00000000-0000-0000-0000-00000000d002','by m1')$$), 1::bigint);
select e2e.eq('ws/member: cannot edit task on other''s deal', e2e.dml($$update public.tasks set title='hax' where id='00000000-0000-0000-0000-00000000e101'$$), 0::bigint);
select e2e.eq('ws/member: favorites are per user', e2e.cnt($$select 1 from public.favorites$$), 1::bigint);
select e2e.eq('ws/member: sees only own workspace row', e2e.cnt($$select 1 from public.workspaces$$), 1::bigint);
select e2e.ok('ws/member: sees own user_roles only', (select e2e.cnt($$select 1 from public.user_roles where user_id <> auth.uid()$$) = 0));
select e2e.raises('ws/member: cannot self-promote (insert admin role)', format($$insert into public.user_roles(user_id, role_id, workspace_id) select %L, id, workspace_id from public.roles where lower(name)='admin' and workspace_id=%L$$, :'m1', :'ws1'), '42501');
select e2e.eq('ws/member: cannot self-promote (update own user_role)', e2e.dml(format($$update public.user_roles set role_id = (select id from public.roles where lower(name)='admin' and workspace_id=%L) where user_id=%L$$, :'ws1', :'m1')), 0::bigint);
select e2e.eq('ws/member: cannot delete roles', e2e.dml($$delete from public.roles$$), 0::bigint);
select e2e.eq('ws/member: cannot update workspaces', e2e.dml($$update public.workspaces set name='hax'$$), 0::bigint);
select e2e.raises('ws/member: set_rls_mode denied', $$select public.set_rls_mode('open')$$, '42501');
select e2e.eq('ws/member: aggregates scoped by RLS', (select sum(deal_count) from public.pipeline_aggregates(null,'count','value')), 4::numeric);
select e2e.eq('ws/member: search_deals scoped by RLS', e2e.cnt($$select * from public.search_deals('T-ws2')$$), 0::bigint);
-- storage
select e2e.passes('ws/member: storage insert for visible deal', $$insert into storage.objects(bucket_id, name) values ('deal-files', '00000000-0000-0000-0000-00000000d001/ok.txt')$$);
select e2e.raises('ws/member: storage insert for other-workspace deal denied', $$insert into storage.objects(bucket_id, name) values ('deal-files', '00000000-0000-0000-0000-00000000d004/no.txt')$$, '42501');
select e2e.raises('ws/member: storage insert with non-uuid path denied', $$insert into storage.objects(bucket_id, name) values ('deal-files', 'loose.txt')$$, '42501');
select e2e.eq('ws/member: storage read limited to visible deals', e2e.cnt($$select 1 from storage.objects where bucket_id='deal-files'$$), 1::bigint);
select e2e.eq('ws/member: storage delete on deal they cannot edit -> 0', e2e.dml($$delete from storage.objects where name like '00000000-0000-0000-0000-00000000d004/%'$$), 0::bigint);
select e2e.eq('ws/member: storage delete own deal file', e2e.dml($$delete from storage.objects where name like '00000000-0000-0000-0000-00000000d001/%'$$), 1::bigint);
-- helper recursion / performance
set statement_timeout = '5s';
select e2e.passes('ws/member: helper fns do not recurse/deadlock (300 policy-evaluating queries)', $q$do $x$ begin for i in 1..300 loop perform count(*) from public.user_roles; perform count(*) from public.roles; perform count(*) from public.deals; end loop; end $x$$q$);
reset statement_timeout;
reset role;

-- viewer
select e2e.as_user('authenticated', :'v1') \g /dev/null
select e2e.eq('ws/viewer: can read workspace deals', e2e.cnt($$select 1 from public.deals where title like 'T-%'$$), 4::bigint);
select e2e.eq('ws/viewer: reads workspace contacts', e2e.cnt($$select 1 from public.contacts where name like 'C-%'$$), 2::bigint);
select e2e.raises('ws/viewer: contact insert denied', $$insert into public.contacts(name) values ('v')$$, '42501');
select e2e.eq('ws/viewer: contact update -> 0 rows', e2e.dml($$update public.contacts set title='v'$$), 0::bigint);
select e2e.eq('ws/viewer: contact delete -> 0 rows', e2e.dml($$delete from public.contacts$$), 0::bigint);
select e2e.raises('ws/viewer: insert denied', $$insert into public.deals(title) values ('v')$$, '42501');
select e2e.eq('ws/viewer: update -> 0 rows', e2e.dml($$update public.deals set value = 1$$), 0::bigint);
select e2e.eq('ws/viewer: delete -> 0 rows', e2e.dml($$delete from public.deals$$), 0::bigint);
select e2e.raises('ws/viewer: note insert denied', $$insert into public.notes(deal_id, title) values ('00000000-0000-0000-0000-00000000d001','v')$$, '42501');
select e2e.raises('ws/viewer: favorite insert denied', format($$insert into public.favorites(user_id, entity_type, entity_id) values (%L,'deal','00000000-0000-0000-0000-00000000d001')$$, :'v1'), '42501');
select e2e.raises('ws/viewer: storage insert denied', $$insert into storage.objects(bucket_id, name) values ('deal-files', '00000000-0000-0000-0000-00000000d001/v.txt')$$, '42501');
reset role;

-- manager
select e2e.as_user('authenticated', :'mg') \g /dev/null
select e2e.eq('ws/manager: edits any deal in workspace', e2e.dml($$update public.deals set value = 3 where title in ('T-own','T-other','T-assigned')$$), 3::bigint);
select e2e.eq('ws/manager: not other workspace', e2e.dml($$update public.deals set value = 3 where title='T-ws2'$$), 0::bigint);
select e2e.eq('ws/manager: edits any contact in workspace', e2e.dml($$update public.contacts set title='m' where name in ('C-own','C-other')$$), 2::bigint);
select e2e.eq('ws/manager: not other workspace contact', e2e.dml($$update public.contacts set title='m' where name='C-ws2'$$), 0::bigint);
select e2e.passes('ws/manager: manages pipeline stages', $$insert into public.pipeline_stages(key,name) values ('mgr-stage','Mgr')$$);
select e2e.raises('ws/manager: cannot manage user_roles', format($$insert into public.user_roles(user_id, role_id, workspace_id) select %L, id, workspace_id from public.roles where lower(name)='admin' and workspace_id=%L$$, :'mg', :'ws1'), '42501');
reset role;

-- admin A1
select e2e.as_user('authenticated', :'a1') \g /dev/null
select e2e.eq('ws/admin: edits all deals in workspace', e2e.dml($$update public.deals set value = 9 where title in ('T-own','T-other','T-assigned')$$), 3::bigint);
select e2e.eq('ws/admin: cannot touch other workspace deal', e2e.dml($$update public.deals set value = 9 where title='T-ws2'$$), 0::bigint);
select e2e.eq('ws/admin: cannot see other workspace', e2e.cnt($$select 1 from public.deals where title='T-ws2'$$), 0::bigint);
select e2e.eq('ws/admin: sees null-workspace rows (repair)', e2e.cnt($$select 1 from public.deals where workspace_id is null$$) > 0, true);
select e2e.eq('ws/admin: deletes any contact in own workspace', e2e.dml($$delete from public.contacts where name = 'C-other'$$), 1::bigint);
select e2e.eq('ws/admin: cannot see other workspace contact', e2e.cnt($$select 1 from public.contacts where name='C-ws2'$$), 0::bigint);
select e2e.passes('ws/admin: can assign roles in own workspace', format($$insert into public.user_roles(user_id, role_id, workspace_id) select %L, id, workspace_id from public.roles where lower(name)='member' and workspace_id=%L$$, :'x1', :'ws1'));
select e2e.passes('ws/admin: set_rls_mode allowed (no-op to workspace)', $$select public.set_rls_mode('workspace')$$);
select e2e.eq('ws/admin: deletes other''s deal', e2e.dml($$delete from public.deals where title='T-other'$$), 1::bigint);
reset role;

-- cross-workspace admin B1
select e2e.as_user('authenticated', :'b1') \g /dev/null
select e2e.eq('ws/cross-admin: sees only ws2 deals', e2e.cnt($$select 1 from public.deals where title like 'T-%'$$), 1::bigint);
select e2e.eq('ws/cross-admin: cannot edit ws1 deal', e2e.dml($$update public.deals set value = 1 where title='T-own'$$), 0::bigint);
select e2e.eq('ws/cross-admin: edits ws2 deal', e2e.dml($$update public.deals set value = 1 where title='T-ws2'$$), 1::bigint);
select e2e.raises('ws/cross-admin: cannot insert ws1 deal', format($$insert into public.deals(title, workspace_id) values ('b', %L)$$, :'ws1'), '42501');
reset role;
select e2e.as_user('authenticated', :'b2') \g /dev/null
select e2e.eq('ws/ws2-member: edits own ws2 deal', e2e.dml($$update public.deals set value = 2 where title='T-ws2'$$), 1::bigint);
reset role;

-- authenticated with a profile but WITHOUT a user_roles row (new signup): plain member of the default workspace
delete from public.user_roles where user_id = :'x1';
select e2e.ok('fixture: x1 has a profile and no role row', exists (select 1 from public.profiles where id = :'x1') and not exists (select 1 from public.user_roles where user_id = :'x1'));
select e2e.as_user('authenticated', :'x1') \g /dev/null
select e2e.eq('ws/no-role-row: current_role_name defaults to member', public.current_role_name(), 'member');
select e2e.eq('ws/no-role-row: current_workspace_id is the default workspace', public.current_workspace_id(), :'ws1'::uuid);
select e2e.eq('ws/no-role-row: sees default-workspace deals', e2e.cnt($$select 1 from public.deals where title in ('T-own','T-assigned')$$), 2::bigint);
select e2e.eq('ws/no-role-row: does not see other workspace deals', e2e.cnt($$select 1 from public.deals where title='T-ws2'$$), 0::bigint);
select e2e.eq('ws/no-role-row: sees default-workspace contacts', e2e.cnt($$select 1 from public.contacts where name = 'C-own'$$), 1::bigint);
select e2e.eq('ws/no-role-row: can insert (member)', e2e.dml($$insert into public.deals(title) values ('x1-deal')$$), 1::bigint);
select e2e.eq('ws/no-role-row: cannot edit others'' records', e2e.dml($$update public.deals set value = 1 where title='T-own'$$), 0::bigint);
select e2e.raises('ws/no-role-row: cannot self-promote', format($$insert into public.user_roles(user_id, role_id, workspace_id) select %L, id, workspace_id from public.roles where lower(name)='admin' and workspace_id=%L$$, :'x1', :'ws1'), '42501');
reset role;
-- no profile at all (e.g. profile sync failed): sees nothing
delete from public.profiles where id = :'x1';
select e2e.as_user('authenticated', :'x1') \g /dev/null
select e2e.eq('ws/no-profile: sees nothing', e2e.cnt($$select 1 from public.deals$$), 0::bigint);
select e2e.eq('ws/no-profile: contacts hidden', e2e.cnt($$select 1 from public.contacts$$), 0::bigint);
select e2e.raises('ws/no-profile: cannot insert', $$insert into public.deals(title) values ('x')$$, '42501');
reset role;

-- service_role bypass
select e2e.as_user('service_role') \g /dev/null
select e2e.eq('ws/service_role: sees every deal (bypassrls)', e2e.cnt($$select 1 from public.deals where title like 'T-%'$$), 4::bigint);
select e2e.passes('ws/service_role: insert any workspace', format($$insert into public.deals(title, workspace_id) values ('svc', %L)$$, :'ws2'));
select e2e.passes('ws/service_role: claim_workflow_events', $$select * from public.claim_workflow_events(1,5)$$);
select e2e.passes('ws/service_role: merge_deals', $$select public.merge_deals('00000000-0000-0000-0000-00000000d001', array['00000000-0000-0000-0000-00000000d003']::uuid[])$$);
reset role;

-- SECURITY DEFINER merge_deals must not bypass workspace RLS
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.raises('ws/member: merge_deals cannot touch other workspace deals', format($$select public.merge_deals(%L, array[%L]::uuid[])$$, '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d004'), '42501');
select e2e.raises('ws/member: merge_deals cannot touch deals they cannot edit', format($$select public.merge_deals(%L, array[%L]::uuid[])$$, '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d002'), '42501');
reset role;
select e2e.as_user('anon') \g /dev/null
select e2e.raises('ws/anon: merge_deals denied', format($$select public.merge_deals(%L, array[%L]::uuid[])$$, '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d003'), '42501');
reset role;
select e2e.ok('merge target d004 untouched by denied calls', (select deleted_at is null from public.deals where id='00000000-0000-0000-0000-00000000d004'));

-- ============================ rollback to open ===============================
select e2e.as_user('authenticated', :'a1') \g /dev/null
select e2e.eq('rollback: admin flips back to open', public.set_rls_mode('open'), 'open');
reset role;
select e2e.as_user('anon') \g /dev/null
select e2e.ok('open again/anon: reads all workspaces', e2e.cnt($$select 1 from public.deals where title like 'T-%'$$) >= 3);
select e2e.eq('open again/anon: insert allowed', e2e.dml($$insert into public.deals(title) values ('OPEN-again')$$), 1::bigint);
reset role;
select e2e.as_user('authenticated', :'v1') \g /dev/null
select e2e.eq('open again/viewer: can update again (legacy open behaviour)', e2e.dml($$update public.deals set value = 77 where title='T-ws2'$$), 1::bigint);
reset role;
select e2e.eq('open again: mode flag', public.rls_mode(), 'open');

rollback;
