\set QUIET on
-- Platform features (20260811000009): field entity types, company dupes/rollups, api_keys, workflow versions,
-- board_position, roles RPCs, email snippets; RLS in open + workspace modes.
begin;
\set a1 '00000000-0000-0000-0000-000000009b01'
\set mg '00000000-0000-0000-0000-000000009b02'
\set m1 '00000000-0000-0000-0000-000000009b03'
\set m2 '00000000-0000-0000-0000-000000009b04'
\set v1 '00000000-0000-0000-0000-000000009b05'
insert into auth.users(id, email) select u, u::text || '@t.io' from unnest(array[:'a1',:'mg',:'m1',:'m2',:'v1']::uuid[]) u;
select public.default_workspace_id() as ws1 \gset
insert into public.user_roles(user_id, role_id, workspace_id)
select v.uid::uuid, r.id, :'ws1' from (values (:'a1','admin'),(:'mg','manager'),(:'m1','member'),(:'m2','member'),(:'v1','viewer')) v(uid, rn)
join public.roles r on lower(r.name) = v.rn and r.workspace_id = :'ws1' on conflict do nothing;

-- ---- (1) field definitions ---------------------------------------------------------------------------
select e2e.ok('entity_type column default deal', exists (select 1 from information_schema.columns where table_name='deal_field_definitions' and column_name='entity_type' and column_default like '%deal%' and is_nullable='NO'));
select e2e.raises('entity_type check', $$insert into public.deal_field_definitions(key,label,type,entity_type) values ('x','X','text','lead')$$, '23514');
insert into public.deal_field_definitions(key,label,type,entity_type) values ('tier','Tier','text','deal'),('tier','Tier','text','contact'),('tier','Tier','text','company');
select e2e.eq('same key across entity types allowed', (select count(*) from public.deal_field_definitions where key='tier'), 3::bigint);
select e2e.raises('same key+entity rejected', $$insert into public.deal_field_definitions(key,label,type,entity_type) values ('tier','T2','text','contact')$$, '23505');
select e2e.ok('contacts/companies custom_fields jsonb', (select count(*) = 2 from information_schema.columns where table_name in ('contacts','companies') and column_name='custom_fields' and data_type='jsonb'));

-- ---- (2)(3) companies --------------------------------------------------------------------------------
insert into public.companies(id, name, domain) values
 ('00000000-0000-0000-0000-00000000f001','Acme Inc','acme.com'),
 ('00000000-0000-0000-0000-00000000f002','  ACME   inc ',null),
 ('00000000-0000-0000-0000-00000000f003','Acme Holdings','https://www.Acme.com/about'),
 ('00000000-0000-0000-0000-00000000f004','Solo Co','solo.io'),
 ('00000000-0000-0000-0000-00000000f005','Acme Inc','acme.com');
update public.companies set deleted_at = now() where id = '00000000-0000-0000-0000-00000000f005';
select e2e.eq('find dupes: name+domain, excludes deleted', (select count(*) from public.find_duplicate_companies('acme inc','acme.com')), 3::bigint);
select e2e.eq('find dupes: p_exclude', (select count(*) from public.find_duplicate_companies('acme inc','acme.com','00000000-0000-0000-0000-00000000f001')), 2::bigint);
select e2e.eq('find dupes: domain only reason', (select reason from public.find_duplicate_companies('Other', 'ACME.com') where id='00000000-0000-0000-0000-00000000f003'), 'domain');
select e2e.eq('find dupes: no match', (select count(*) from public.find_duplicate_companies('Nope', null)), 0::bigint);
select e2e.eq('scan: groups >=2 (name + domain)', (select count(*) from public.scan_duplicate_companies()), 2::bigint);
select e2e.ok('scan: name group has 2 ids/names', exists (select 1 from public.scan_duplicate_companies() where group_key='name:acme inc' and cardinality(ids)=2 and cardinality(names)=2 and reason='name'));
select e2e.ok('scan: domain group has 2 ids', exists (select 1 from public.scan_duplicate_companies() where group_key='domain:acme.com' and cardinality(ids)=2));

insert into public.contacts(id, name, email, company_id) values ('00000000-0000-0000-0000-00000000f101','C1','c1@x.io','00000000-0000-0000-0000-00000000f001'),('00000000-0000-0000-0000-00000000f102','C2','c2@x.io','00000000-0000-0000-0000-00000000f001');
insert into public.deals(id, title, stage, value, workspace_id, owner_id, created_by, company_id, position) values
 ('00000000-0000-0000-0000-00000000f201','O1','qualification',100,:'ws1',:'m1',:'m1','00000000-0000-0000-0000-00000000f001',1),
 ('00000000-0000-0000-0000-00000000f202','O2','proposal',50,:'ws1',:'m1',:'m1','00000000-0000-0000-0000-00000000f001',2),
 ('00000000-0000-0000-0000-00000000f203','W1','closed-won',1000,:'ws1',:'m1',:'m1','00000000-0000-0000-0000-00000000f001',3),
 ('00000000-0000-0000-0000-00000000f204','L1','closed-lost',7,:'ws1',:'m1',:'m1','00000000-0000-0000-0000-00000000f001',4),
 ('00000000-0000-0000-0000-00000000f205','D1','proposal',9999,:'ws1',:'m1',:'m1','00000000-0000-0000-0000-00000000f001',5);
update public.deals set deleted_at = now() where id = '00000000-0000-0000-0000-00000000f205';
select e2e.eq('rollup: open count', (select open_deal_count from public.company_rollups(array['00000000-0000-0000-0000-00000000f001']::uuid[])), 2);
select e2e.eq('rollup: open value', (select open_deal_value from public.company_rollups(array['00000000-0000-0000-0000-00000000f001']::uuid[])), 150::numeric);
select e2e.eq('rollup: won value', (select won_deal_value from public.company_rollups(array['00000000-0000-0000-0000-00000000f001']::uuid[])), 1000::numeric);
select e2e.eq('rollup: contact count', (select contact_count from public.company_rollups(array['00000000-0000-0000-0000-00000000f001']::uuid[])), 2);
select e2e.ok('rollup: last_activity set', (select last_activity is not null from public.company_rollups(array['00000000-0000-0000-0000-00000000f001']::uuid[])));
select e2e.ok('rollup: empty company zeros + null activity', (select open_deal_count=0 and won_deal_value=0 and contact_count=0 and last_activity is null from public.company_rollups(array['00000000-0000-0000-0000-00000000f004']::uuid[])));
select e2e.ok('rollup: null arg returns all live companies', (select count(*) = 4 from public.company_rollups()));

-- ---- (4) api_keys -------------------------------------------------------------------------------------
insert into public.api_keys(id, name, prefix, key_hash, created_by) values
 ('00000000-0000-0000-0000-00000000a001','K1','epk_1','hash1',:'m1'),('00000000-0000-0000-0000-00000000a002','K2','epk_2','hash2',:'m2');
select e2e.eq('api_keys default scopes', (select scopes from public.api_keys where id='00000000-0000-0000-0000-00000000a001'), array['read']);
select e2e.raises('api_keys key_hash unique', $$insert into public.api_keys(name,prefix,key_hash) values ('d','p','hash1')$$, '23505');
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('api_keys: sees own only (columns)', e2e.cnt($$select id,name,prefix,scopes,revoked_at from public.api_keys$$), 1::bigint);
select e2e.eq('api_keys_public: own only', e2e.cnt($$select * from public.api_keys_public$$), 1::bigint);
select e2e.raises('api_keys: key_hash not selectable', $$select key_hash from public.api_keys$$, '42501');
select e2e.raises('api_keys: select * denied (hash column)', $$select * from public.api_keys$$, '42501');
select e2e.raises('api_keys: client insert denied', $$insert into public.api_keys(name,prefix,key_hash) values ('x','x','hx')$$, '42501');
select e2e.raises('api_keys: client direct update denied', $$update public.api_keys set revoked_at = now()$$, '42501');
select e2e.raises('api_keys: revoke foreign key rejected', $$select public.revoke_api_key('00000000-0000-0000-0000-00000000a002')$$, 'P0002');
select e2e.passes('api_keys: revoke own', $$select public.revoke_api_key('00000000-0000-0000-0000-00000000a001')$$);
reset role;
select e2e.ok('api_keys: revoked_at set', (select revoked_at is not null from public.api_keys where id='00000000-0000-0000-0000-00000000a001'));
select e2e.ok('api_keys: foreign key untouched', (select revoked_at is null from public.api_keys where id='00000000-0000-0000-0000-00000000a002'));
select e2e.as_user('anon') \g /dev/null
select e2e.raises('api_keys: anon denied', $$select id from public.api_keys$$, '42501');
select e2e.raises('api_keys_public: anon denied', $$select id from public.api_keys_public$$, '42501');
select e2e.raises('revoke_api_key: anon denied', $$select public.revoke_api_key('00000000-0000-0000-0000-00000000a002')$$, '42501');
reset role;

-- ---- (5) workflows ------------------------------------------------------------------------------------
insert into public.deal_workflows(id, user_id, name, description, stages, triggers, category) values
 ('00000000-0000-0000-0000-00000000b001', null, 'WF', 'desc', '[{"a":1}]', '[{"t":1}]', 'sales');
select e2e.ok('workflow cols', (select count(*) = 3 from information_schema.columns where table_name='deal_workflows' and column_name in ('published_version','webhook_token','webhook_enabled')));
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('open/auth: publish v1', public.publish_workflow_version('00000000-0000-0000-0000-00000000b001','first'), 1);
update public.deal_workflows set stages = '[{"a":2}]', name = 'WF2' where id = '00000000-0000-0000-0000-00000000b001';
select e2e.eq('open/auth: publish v2', public.publish_workflow_version('00000000-0000-0000-0000-00000000b001'), 2);
select e2e.eq('versions readable', e2e.cnt($$select 1 from public.workflow_versions$$), 2::bigint);
select e2e.raises('versions: client insert denied', $$insert into public.workflow_versions(workflow_id,version,snapshot) values ('00000000-0000-0000-0000-00000000b001',9,'{}')$$, '42501');
select e2e.raises('publish: unknown workflow', $$select public.publish_workflow_version('00000000-0000-0000-0000-00000000bfff')$$, 'P0002');
select e2e.passes('restore v1', $$select public.restore_workflow_version('00000000-0000-0000-0000-00000000b001', 1)$$);
select e2e.raises('restore: unknown version', $$select public.restore_workflow_version('00000000-0000-0000-0000-00000000b001', 77)$$, 'P0002');
select e2e.ok('token: 32+ url-safe', (select length(t) >= 32 and t ~ '^[A-Za-z0-9_-]+$' from (select public.rotate_workflow_webhook_token('00000000-0000-0000-0000-00000000b001') t) s));
reset role;
select e2e.ok('publish: snapshot + statuses', (select (select status from public.workflow_versions where workflow_id='00000000-0000-0000-0000-00000000b001' and version=1)='archived'
  and (select status from public.workflow_versions where workflow_id='00000000-0000-0000-0000-00000000b001' and version=2)='published'
  and (select snapshot->>'name' from public.workflow_versions where workflow_id='00000000-0000-0000-0000-00000000b001' and version=1)='WF'
  and (select snapshot ? 'settings' and snapshot ? 'category' and snapshot ? 'triggers' from public.workflow_versions where workflow_id='00000000-0000-0000-0000-00000000b001' and version=2)));
select e2e.ok('restore: content back, published_version unchanged', (select name='WF' and stages='[{"a":1}]'::jsonb and published_version=2 from public.deal_workflows where id='00000000-0000-0000-0000-00000000b001'));
select e2e.ok('token: enabled and stored', (select webhook_enabled and length(webhook_token)>=32 from public.deal_workflows where id='00000000-0000-0000-0000-00000000b001'));
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.ok('token: disable returns null', (select public.rotate_workflow_webhook_token('00000000-0000-0000-0000-00000000b001', false) is null));
reset role;
select e2e.ok('token: disabled flag', (select not webhook_enabled from public.deal_workflows where id='00000000-0000-0000-0000-00000000b001'));
select e2e.as_user('anon') \g /dev/null
select e2e.raises('anon: publish denied', $$select public.publish_workflow_version('00000000-0000-0000-0000-00000000b001')$$, '42501');
select e2e.raises('anon: rotate denied', $$select public.rotate_workflow_webhook_token('00000000-0000-0000-0000-00000000b001')$$, '42501');
reset role;

-- ---- (6) board_position -------------------------------------------------------------------------------
select e2e.ok('tasks.board_position numeric not null default 0', exists (select 1 from information_schema.columns where table_name='tasks' and column_name='board_position' and data_type='numeric' and is_nullable='NO' and column_default like '0%'));
insert into public.tasks(title, user_id) values ('bp', :'m1');
select e2e.eq('board_position default 0', (select board_position from public.tasks where title='bp'), 0::numeric);

-- ---- (7) roles RPCs -----------------------------------------------------------------------------------
select r.id as role_member from public.roles r where lower(r.name)='member' and r.workspace_id=:'ws1' limit 1 \gset
select r.id as role_viewer from public.roles r where lower(r.name)='viewer' and r.workspace_id=:'ws1' limit 1 \gset
select r.id as role_admin from public.roles r where lower(r.name)='admin' and r.workspace_id=:'ws1' limit 1 \gset
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.raises('member: set_role_permissions denied', format($$select public.set_role_permissions(%L, '["x"]')$$, :'role_member'), '42501');
select e2e.raises('member: assign denied', format($$select public.assign_user_role(%L,%L)$$, :'m2', :'role_viewer'), '42501');
select e2e.raises('member: remove denied', format($$select public.remove_user_role(%L,%L)$$, :'m2', :'role_member'), '42501');
reset role;
select e2e.as_user('authenticated', :'mg') \g /dev/null
select e2e.raises('manager: assign denied', format($$select public.assign_user_role(%L,%L)$$, :'m2', :'role_viewer'), '42501');
reset role;
select e2e.as_user('anon') \g /dev/null
select e2e.raises('anon: assign denied', format($$select public.assign_user_role(%L,%L)$$, :'m2', :'role_viewer'), '42501');
reset role;
select e2e.as_user('authenticated', :'a1') \g /dev/null
select e2e.passes('admin: set permissions', format($$select public.set_role_permissions(%L, '["deals.read","deals.write"]')$$, :'role_member'));
select e2e.raises('admin: cannot edit admin role', format($$select public.set_role_permissions(%L, '[]')$$, :'role_admin'), '42501');
select e2e.passes('admin: assign role', format($$select public.assign_user_role(%L,%L)$$, :'m2', :'role_viewer'));
select e2e.passes('admin: assign idempotent', format($$select public.assign_user_role(%L,%L)$$, :'m2', :'role_viewer'));
select e2e.raises('admin: unknown role', $$select public.assign_user_role('00000000-0000-0000-0000-00000000ffff','00000000-0000-0000-0000-00000000ffff')$$, 'P0002');
select e2e.raises('admin: cannot remove last admin (self)', format($$select public.remove_user_role(%L,%L)$$, :'a1', :'role_admin'), '42501');
reset role;
select e2e.ok('role permissions persisted', (select permissions = '["deals.read","deals.write"]'::jsonb from public.roles where id=:'role_member'));
select e2e.eq('assignment exists once', (select count(*) from public.user_roles where user_id=:'m2' and role_id=:'role_viewer'), 1::bigint);
select e2e.as_user('authenticated', :'a1') \g /dev/null
select e2e.passes('admin: remove role', format($$select public.remove_user_role(%L,%L)$$, :'m2', :'role_viewer'));
reset role;
select e2e.eq('assignment removed', (select count(*) from public.user_roles where user_id=:'m2' and role_id=:'role_viewer'), 0::bigint);

-- ---- (8) email templates ------------------------------------------------------------------------------
select e2e.ok('email_templates cols', (select count(*) = 3 from information_schema.columns where table_name='email_templates' and column_name in ('workspace_id','is_snippet','shortcut')));
insert into public.email_templates(id, name, subject, body, workspace_id, is_snippet, shortcut) values
 ('00000000-0000-0000-0000-00000000c001','Snip','s','b',:'ws1',true,'/hi'),
 ('00000000-0000-0000-0000-00000000c002','Foreign','s','b','00000000-0000-0000-0000-00000000dead',false,null);
select e2e.eq('is_snippet default false', (select is_snippet from public.email_templates where id='00000000-0000-0000-0000-00000000c002'), false);
select e2e.as_user('anon') \g /dev/null
select e2e.eq('open/anon: reads templates', e2e.cnt($$select 1 from public.email_templates$$), 2::bigint);
select e2e.raises('open/anon: cannot insert', $$insert into public.email_templates(name) values ('a')$$, '42501');
reset role;
select e2e.as_user('authenticated', :'v1') \g /dev/null
select e2e.eq('open/auth: any authenticated inserts', e2e.dml($$insert into public.email_templates(name, is_snippet) values ('n', true)$$), 1::bigint);
reset role;
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('open/auth: webhook_configurations CRUD', e2e.dml($$insert into public.webhook_configurations(name,url) values ('w','https://x.io')$$), 1::bigint);
select e2e.eq('open/auth: webhook_configurations update', e2e.dml($$update public.webhook_configurations set name='w2'$$), 1::bigint);
select e2e.eq('open/auth: webhook_configurations delete', e2e.dml($$delete from public.webhook_configurations$$), 1::bigint);
reset role;

-- ---- workspace mode ------------------------------------------------------------------------------------
update public.app_settings set setting_value = '"workspace"'::jsonb where setting_key='rls_mode' and user_id is null;
select e2e.as_user('anon') \g /dev/null
select e2e.eq('ws/anon: no templates', e2e.cnt($$select 1 from public.email_templates$$), 0::bigint);
reset role;
select e2e.as_user('authenticated', :'m1') \g /dev/null
select e2e.eq('ws/member: sees own-workspace + global templates only', e2e.cnt($$select 1 from public.email_templates where id in ('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000c002')$$), 1::bigint);
select e2e.eq('ws/member: inserts template', e2e.dml($$insert into public.email_templates(name) values ('mine')$$), 1::bigint);
select e2e.eq('ws/member: cannot update foreign-workspace template', e2e.dml($$update public.email_templates set name='h' where id='00000000-0000-0000-0000-00000000c002'$$), 0::bigint);
select e2e.ok('ws/member: sees api_keys own', (select count(*) = 0 from public.api_keys where created_by <> auth.uid()));
select e2e.eq('ws/member: versions visible to workspace member', e2e.cnt($$select 1 from public.workflow_versions$$), 2::bigint);
select e2e.raises('ws/member: publish denied', $$select public.publish_workflow_version('00000000-0000-0000-0000-00000000b001')$$, '42501');
select e2e.raises('ws/member: rotate denied', $$select public.rotate_workflow_webhook_token('00000000-0000-0000-0000-00000000b001')$$, '42501');
select e2e.raises('ws/member: restore denied', $$select public.restore_workflow_version('00000000-0000-0000-0000-00000000b001',1)$$, '42501');
reset role;
select e2e.as_user('authenticated', :'v1') \g /dev/null
select e2e.raises('ws/viewer: cannot insert template', $$insert into public.email_templates(name) values ('v')$$, '42501');
reset role;
select e2e.as_user('authenticated', :'mg') \g /dev/null
select e2e.eq('ws/manager: publish v3', public.publish_workflow_version('00000000-0000-0000-0000-00000000b001','m'), 3);
select e2e.ok('ws/manager: rotate token', (select length(public.rotate_workflow_webhook_token('00000000-0000-0000-0000-00000000b001')) >= 32));
select e2e.passes('ws/manager: restore', $$select public.restore_workflow_version('00000000-0000-0000-0000-00000000b001',2)$$);
reset role;
select e2e.as_user('authenticated', :'a1') \g /dev/null
select e2e.passes('ws/admin: assign role', format($$select public.assign_user_role(%L,%L)$$, :'m2', :'role_viewer'));
reset role;
select e2e.as_user('authenticated', :'m2') \g /dev/null
select e2e.eq('ws/other user: api_keys isolation', e2e.cnt($$select 1 from public.api_keys_public$$), 1::bigint);
reset role;
update public.app_settings set setting_value = '"open"'::jsonb where setting_key='rls_mode' and user_id is null;
rollback;

-- formula/rollup field types are accepted, unknown types still rejected
do $$ begin
  insert into public.deal_field_definitions(key,type,label,entity_type) values ('zz_formula','formula','F','deal');
  insert into public.deal_field_definitions(key,type,label,entity_type) values ('zz_rollup','rollup','R','company');
  begin
    insert into public.deal_field_definitions(key,type,label,entity_type) values ('zz_bad','bogus','B','deal');
    raise exception 'bogus type accepted';
  exception when check_violation then null; end;
  delete from public.deal_field_definitions where key in ('zz_formula','zz_rollup');
end $$;
