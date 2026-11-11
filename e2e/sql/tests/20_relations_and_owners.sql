\set QUIET on
\getenv migdir E2E_MIGDIR
begin;

-- ---- company backfill ------------------------------------------------------
insert into public.companies(id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Zeta');
insert into public.companies(id, name, deleted_at) values ('00000000-0000-0000-0000-0000000000b2', 'Old Co', now());
insert into public.deals(id, title, company) values
 ('00000000-0000-0000-0000-0000000000d1','d1','  Acme  '),
 ('00000000-0000-0000-0000-0000000000d2','d2','ACME'),
 ('00000000-0000-0000-0000-0000000000d3','d3','Beta'),
 ('00000000-0000-0000-0000-0000000000d4','d4',null),
 ('00000000-0000-0000-0000-0000000000d5','d5','   '),
 ('00000000-0000-0000-0000-0000000000d6','d6','zeta '),
 ('00000000-0000-0000-0000-0000000000d7','d7','old co');
insert into public.contacts(id, name, company) values
 ('00000000-0000-0000-0000-0000000000e1','k1','acme'),
 ('00000000-0000-0000-0000-0000000000e2','k2','Gamma'),
 ('00000000-0000-0000-0000-0000000000e3','k3',null);
\i :migdir/20260811000000_relations_and_owners.sql
select e2e.eq('companies: one per distinct case-insensitive name', (select count(*) from public.companies where deleted_at is null), 5::bigint); -- Zeta, Acme, Beta, Gamma, Old Co(new)
select e2e.eq('companies: acme deduped', (select count(*) from public.companies where lower(btrim(name))='acme'), 1::bigint);
select e2e.eq('companies: names trimmed', (select count(*) from public.companies where name <> btrim(name)), 0::bigint);
select e2e.eq('companies: existing Zeta reused', (select count(*) from public.companies where lower(name)='zeta'), 1::bigint);
select e2e.eq('companies: soft-deleted not reused -> new Old Co', (select count(*) from public.companies where lower(name)='old co' and deleted_at is null), 1::bigint);
select e2e.ok('deals linked: d1+d2 same company', (select a.company_id is not null and a.company_id = b.company_id from public.deals a, public.deals b where a.id='00000000-0000-0000-0000-0000000000d1' and b.id='00000000-0000-0000-0000-0000000000d2'));
select e2e.ok('deal d6 linked to existing Zeta', (select company_id='00000000-0000-0000-0000-0000000000b1' from public.deals where id='00000000-0000-0000-0000-0000000000d6'));
select e2e.ok('deal d7 linked to live Old Co, not deleted', (select c.deleted_at is null from public.deals d join public.companies c on c.id=d.company_id where d.id='00000000-0000-0000-0000-0000000000d7'));
select e2e.ok('null/blank company -> no link', (select count(*)=0 from public.deals where id in ('00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000d5') and company_id is not null));
select e2e.ok('contact linked to same Acme', (select ct.company_id = d.company_id from public.contacts ct, public.deals d where ct.id='00000000-0000-0000-0000-0000000000e1' and d.id='00000000-0000-0000-0000-0000000000d1'));
select e2e.ok('contact Gamma linked', (select company_id is not null from public.contacts where id='00000000-0000-0000-0000-0000000000e2'));
select e2e.eq('text company column untouched', (select company from public.deals where id='00000000-0000-0000-0000-0000000000d1'), '  Acme  ');
\i :migdir/20260811000000_relations_and_owners.sql
select e2e.eq('companies: no duplicates on re-run', (select count(*) from public.companies where deleted_at is null), 5::bigint);
select e2e.ok('company FK on delete set null', (select confdeltype = 'n' from pg_constraint where conrelid='public.deals'::regclass and confrelid='public.companies'::regclass));

-- ---- owner_id backfill (relations migration: from assigned_to_id) ----------
update public.deals set owner_id = null;
update public.deals set assigned_to_id='00000000-0000-0000-0000-0000000000f9' where id='00000000-0000-0000-0000-0000000000d3';
\i :migdir/20260811000000_relations_and_owners.sql
select e2e.eq('owner_id <- assigned_to_id', (select owner_id from public.deals where id='00000000-0000-0000-0000-0000000000d3'), '00000000-0000-0000-0000-0000000000f9'::uuid);
select e2e.ok('owner_id stays null without assignee', (select owner_id is null from public.deals where id='00000000-0000-0000-0000-0000000000d1'));

-- ---- profiles sync trigger --------------------------------------------------
insert into auth.users(id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000aa01','alice@example.com','{"name":"Alice A","avatar_url":"http://x/a.png"}'),
 ('00000000-0000-0000-0000-00000000aa02','bob@example.com','{"full_name":"Bob B"}'),
 ('00000000-0000-0000-0000-00000000aa03','carol@example.com','{}');
select e2e.eq('profile trigger: name from meta.name', (select name from public.profiles where id='00000000-0000-0000-0000-00000000aa01'), 'Alice A');
select e2e.eq('profile trigger: avatar from avatar_url', (select avatar from public.profiles where id='00000000-0000-0000-0000-00000000aa01'), 'http://x/a.png');
select e2e.eq('profile trigger: full_name fallback', (select name from public.profiles where id='00000000-0000-0000-0000-00000000aa02'), 'Bob B');
select e2e.eq('profile trigger: email local-part fallback', (select name from public.profiles where id='00000000-0000-0000-0000-00000000aa03'), 'carol');
-- backfill: users that pre-date the trigger
alter table auth.users disable trigger on_auth_user_created_sync_profile;
insert into auth.users(id, email) values ('00000000-0000-0000-0000-00000000aa04','dave@example.com');
alter table auth.users enable trigger on_auth_user_created_sync_profile;
select e2e.eq('profile missing before backfill', (select count(*) from public.profiles where id='00000000-0000-0000-0000-00000000aa04'), 0::bigint);
\i :migdir/20260811000000_relations_and_owners.sql
select e2e.eq('profiles backfill', (select name from public.profiles where id='00000000-0000-0000-0000-00000000aa04'), 'dave');
select e2e.eq('profiles backfill keeps existing rows', (select name from public.profiles where id='00000000-0000-0000-0000-00000000aa01'), 'Alice A');
select e2e.passes('profile trigger never blocks signup (existing profile id)', $$insert into public.profiles(id,name) values ('00000000-0000-0000-0000-00000000aa05','pre'); insert into auth.users(id,email) values ('00000000-0000-0000-0000-00000000aa05','e@x.io')$$);

-- ---- workspace / owner backfill (rls migration) -----------------------------
update public.deals set owner_id = null, workspace_id = null, created_by = '00000000-0000-0000-0000-00000000aa01' where id='00000000-0000-0000-0000-0000000000d1';
update public.contacts set owner_id = null, created_by = '00000000-0000-0000-0000-00000000aa02' where id='00000000-0000-0000-0000-0000000000e1';
\i :migdir/20260811000002_rls_owner_workspace.sql
select e2e.eq('rls backfill: deal owner from created_by', (select owner_id from public.deals where id='00000000-0000-0000-0000-0000000000d1'), '00000000-0000-0000-0000-00000000aa01'::uuid);
select e2e.eq('rls backfill: contact owner from created_by', (select owner_id from public.contacts where id='00000000-0000-0000-0000-0000000000e1'), '00000000-0000-0000-0000-00000000aa02'::uuid);
select e2e.ok('rls backfill: deals.workspace_id = default workspace', (select bool_and(workspace_id = public.default_workspace_id()) from public.deals));
select e2e.eq('rls backfill: exactly one default workspace', (select count(*) from public.workspaces), 1::bigint);
select e2e.eq('rls backfill: 4 system roles', (select count(*) from public.roles where is_system_role), 4::bigint);
select e2e.eq('rls backfill: every auth user has a membership', (select count(*) from auth.users u where not exists (select 1 from public.user_roles ur where ur.user_id=u.id)), 0::bigint);
select e2e.eq('rls backfill: workspace has an admin', (select count(*) from public.user_roles ur join public.roles r on r.id=ur.role_id where lower(r.name)='admin'), 1::bigint);
select e2e.eq('rls backfill: backfill keeps updated_at (triggers paused -> no new activity)',
  (select count(*) from public.deal_activities where deal_id='00000000-0000-0000-0000-0000000000d1' and type='updated'), 0::bigint);
select e2e.eq('rls mode defaults to open', public.rls_mode(), 'open');

rollback;
