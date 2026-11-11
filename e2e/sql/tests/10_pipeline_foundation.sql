\set QUIET on
\getenv migdir E2E_MIGDIR
begin;

select e2e.eq('stages: 5 seeded default stages', (select count(*) from public.pipeline_stages where pipeline_id is null), 5::bigint);
select e2e.eq('stages: keys/order', (select string_agg(key, ',' order by position) from public.pipeline_stages where pipeline_id is null),
  'qualification,proposal,negotiation,closed-won,closed-lost');
select e2e.ok('stages: won/lost flags', (select bool_and(is_won) filter (where key='closed-won') and bool_and(is_lost) filter (where key='closed-lost') from public.pipeline_stages));
select e2e.raises('stage unique key per pipeline', $$insert into public.pipeline_stages(key,name) values ('proposal','dup')$$, '23505');
select e2e.eq('deals.stage CHECK dropped (custom stage allowed)',
  (select count(*) from pg_constraint where conrelid='public.deals'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%stage%'), 0::bigint);

-- seed deals (position left at default 0 so the backfill can be re-run)
insert into public.deals (id, title, company, contact, notes, value, probability, stage, created_at) values
 ('00000000-0000-0000-0000-0000000000a1','Acme Rocket Skates','Wile Corp','Wile E','fast shipping', 1234.56, 20,'qualification','2026-01-01'),
 ('00000000-0000-0000-0000-0000000000a2','Anvil Order','Acme Inc','Road Runner','needs rocket booster', 100, 40,'qualification','2026-01-02'),
 ('00000000-0000-0000-0000-0000000000a3','Birdseed','Desert LLC','Runner','', 300, 60,'qualification','2026-01-03'),
 ('00000000-0000-0000-0000-0000000000a4','Tunnel Paint','Acme Inc','Wile','', 50, 80,'proposal','2026-01-04'),
 ('00000000-0000-0000-0000-0000000000a5','Deleted-soon','Gone','x','', 999, 10,'proposal','2026-01-05');

select e2e.eq('insert -> deal_activities created (1 per deal)', (select count(*) from public.deal_activities where type='created'), 5::bigint);
select e2e.eq('insert -> workflow_events deal.created', (select count(*) from public.workflow_events where event_type='deal.created'), 5::bigint);
select e2e.ok('workflow_events payload has stage/value', (select payload->>'stage'='qualification' and (payload->>'value')::numeric=1234.56 from public.workflow_events where event_type='deal.created' and entity_id='00000000-0000-0000-0000-0000000000a1'));
select e2e.ok('tsv populated on insert', (select bool_and(tsv is not null) from public.deals));

-- stage change
update public.deals set stage='proposal' where id='00000000-0000-0000-0000-0000000000a1';
select e2e.eq('stage change -> stage_changed activity', (select count(*) from public.deal_activities where deal_id='00000000-0000-0000-0000-0000000000a1' and type='stage_changed'), 1::bigint);
select e2e.ok('stage change -> deal_history row', (select old_value='qualification' and new_value='proposal' from public.deal_history where deal_id='00000000-0000-0000-0000-0000000000a1' and field='stage'));
select e2e.ok('stage change -> workflow event from/to', (select payload->>'from'='qualification' and payload->>'to'='proposal' from public.workflow_events where event_type='deal.stage_changed' and entity_id='00000000-0000-0000-0000-0000000000a1'));

-- ordering-only update must not log
update public.deals set position = 7, updated_at = now() where id='00000000-0000-0000-0000-0000000000a1';
select e2e.eq('position/updated_at only -> no extra activity', (select count(*) from public.deal_activities where deal_id='00000000-0000-0000-0000-0000000000a1'), 2::bigint);
select e2e.eq('position-only -> no workflow event', (select count(*) from public.workflow_events where entity_id='00000000-0000-0000-0000-0000000000a1'), 2::bigint);
update public.deals set value = 2000 where id='00000000-0000-0000-0000-0000000000a1';
select e2e.eq('value update -> updated activity + deal.updated event',
  (select count(*) from public.deal_activities where deal_id='00000000-0000-0000-0000-0000000000a1' and type='updated')
  + (select count(*) from public.workflow_events where entity_id='00000000-0000-0000-0000-0000000000a1' and event_type='deal.updated'), 2::bigint);
update public.deals set value = 1234.56 where id='00000000-0000-0000-0000-0000000000a1';

-- soft delete / restore
update public.deals set deleted_at = now() where id='00000000-0000-0000-0000-0000000000a5';
select e2e.eq('soft delete -> deleted activity', (select count(*) from public.deal_activities where deal_id='00000000-0000-0000-0000-0000000000a5' and type='deleted'), 1::bigint);
select e2e.eq('soft delete -> deal_history deleted_at', (select count(*) from public.deal_history where deal_id='00000000-0000-0000-0000-0000000000a5' and field='deleted_at'), 1::bigint);
update public.deals set deleted_at = null where id='00000000-0000-0000-0000-0000000000a5';
select e2e.eq('restore -> restored activity', (select count(*) from public.deal_activities where deal_id='00000000-0000-0000-0000-0000000000a5' and type='restored'), 1::bigint);
update public.deals set deleted_at = now() where id='00000000-0000-0000-0000-0000000000a5';
select e2e.passes('hard delete OK', $$delete from public.deals where id='00000000-0000-0000-0000-0000000000a5'$$);
select e2e.eq('hard delete removed row', (select count(*) from public.deals where id='00000000-0000-0000-0000-0000000000a5'), 0::bigint);

-- backfills: reset to the pre-migration shape then re-apply the migration file
update public.deals set position = 0, amount_micros = null, tsv = null;
\i :migdir/20260801000000_pipeline_foundation.sql
select e2e.eq('backfill: qualification positions ordered by created_at',
  (select string_agg(id::text, ',' order by position) from public.deals where stage='qualification'),
  '00000000-0000-0000-0000-0000000000a2,00000000-0000-0000-0000-0000000000a3');
select e2e.eq('backfill: proposal positions (a1 created first)',
  (select string_agg(position::text, ',' order by created_at) from public.deals where stage='proposal'), '1,2');
select e2e.eq('backfill: amount_micros', (select amount_micros from public.deals where id='00000000-0000-0000-0000-0000000000a1'), 1234560000::bigint);
select e2e.ok('backfill: tsv restored', (select bool_and(tsv is not null) from public.deals));
select e2e.eq('backfill did not write activities', (select count(*) from public.deal_activities where type='updated'), 2::bigint); -- the two explicit value updates only

-- search_deals
select e2e.eq('search: title match ranks above notes-only match',
  (select string_agg(title, ' | ' order by ord) from (select title, row_number() over () ord from public.search_deals('rocket')) s),
  'Acme Rocket Skates | Anvil Order');
select e2e.eq('search: company term', (select count(*) from public.search_deals('acme')), 3::bigint);
select e2e.eq('search: multi-word websearch (and)', (select title from public.search_deals('acme rocket') limit 1), 'Acme Rocket Skates');
select e2e.eq('search: quoted phrase', (select count(*) from public.search_deals('"rocket skates"')), 1::bigint);
select e2e.eq('search: OR / exclusion syntax', (select count(*) from public.search_deals('rocket -skates')), 1::bigint);
select e2e.eq('search: whitespace-only query -> 0 rows, no error', (select count(*) from public.search_deals('   ')), 0::bigint);
select e2e.eq('search: prefix is NOT matched server-side (client falls back to Fuse)', (select count(*) from public.search_deals('rock')), 0::bigint);
select e2e.eq('search: limit honoured', (select count(*) from public.search_deals('acme', 1)), 1::bigint);
update public.deals set deleted_at = now() where id='00000000-0000-0000-0000-0000000000a2';
select e2e.eq('search: excludes soft-deleted', (select count(*) from public.search_deals('anvil')), 0::bigint);
update public.deals set deleted_at = null where id='00000000-0000-0000-0000-0000000000a2';
update public.deals set title = 'Zeppelin' where id='00000000-0000-0000-0000-0000000000a3';
select e2e.eq('search: tsv follows title updates', (select count(*) from public.search_deals('zeppelin')), 1::bigint);

-- pipeline_aggregates  (qualification: a2=100,a3=300 ; proposal: a1=1234.56,a4=50 ; a5 deleted)
update public.deals set value = 1234.56 where id='00000000-0000-0000-0000-0000000000a1';
create temp table _agg as select 'sum' op, * from public.pipeline_aggregates(null,'sum','value')
 union all select 'count', * from public.pipeline_aggregates(null,'count','value')
 union all select 'avg', * from public.pipeline_aggregates(null,'avg','value')
 union all select 'min', * from public.pipeline_aggregates(null,'min','value')
 union all select 'max', * from public.pipeline_aggregates(null,'max','value')
 union all select 'psum', * from public.pipeline_aggregates(null,'sum','probability');
select e2e.eq('agg sum qualification', (select agg from _agg where op='sum' and stage='qualification'), 400::numeric);
select e2e.eq('agg sum proposal', (select agg from _agg where op='sum' and stage='proposal'), 1284.56::numeric);
select e2e.eq('agg count', (select agg from _agg where op='count' and stage='qualification'), 2::numeric);
select e2e.eq('agg avg', (select agg from _agg where op='avg' and stage='qualification'), 200::numeric);
select e2e.eq('agg min', (select agg from _agg where op='min' and stage='proposal'), 50::numeric);
select e2e.eq('agg max', (select agg from _agg where op='max' and stage='proposal'), 1234.56::numeric);
select e2e.eq('agg on probability field', (select agg from _agg where op='psum' and stage='qualification'), 100::numeric);
select e2e.eq('agg excludes soft-deleted (deal_count)', (select sum(deal_count) from _agg where op='count'), 4::numeric);
select e2e.eq('agg stage filter', (select count(*) from public.pipeline_aggregates(array['proposal'],'sum','value')), 1::bigint);
select e2e.raises('agg rejects bad field', $$select * from public.pipeline_aggregates(null,'sum','title; drop table deals')$$);
select e2e.raises('agg rejects bad op', $$select * from public.pipeline_aggregates(null,'median','value')$$);
select e2e.raises('agg rejects injection in op', $$select * from public.pipeline_aggregates(null,'sum) from deals --','value')$$);

-- merge_deals(keep a1, [a2,a3,a1])
insert into public.contacts(id, name) values ('00000000-0000-0000-0000-0000000000c1','C1');
insert into public.notes(deal_id, title) values ('00000000-0000-0000-0000-0000000000a2','n2'),('00000000-0000-0000-0000-0000000000a3','n3');
insert into public.deal_files(deal_id, name, path) values ('00000000-0000-0000-0000-0000000000a2','f','p');
insert into public.tasks(deal_id, title) values ('00000000-0000-0000-0000-0000000000a3','t');
insert into public.calendar_events(deal_id, title) values ('00000000-0000-0000-0000-0000000000a2','ev');
insert into public.favorites(user_id, entity_type, entity_id) values
  ('00000000-0000-0000-0000-0000000000f1','deal','00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000f1','deal','00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000f2','deal','00000000-0000-0000-0000-0000000000a3');
select public.merge_deals('00000000-0000-0000-0000-0000000000a1', array['00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a1']::uuid[]);
select e2e.eq('merge: notes re-pointed', (select count(*) from public.notes where deal_id='00000000-0000-0000-0000-0000000000a1'), 2::bigint);
select e2e.eq('merge: files re-pointed', (select count(*) from public.deal_files where deal_id='00000000-0000-0000-0000-0000000000a1'), 1::bigint);
select e2e.eq('merge: tasks re-pointed', (select count(*) from public.tasks where deal_id='00000000-0000-0000-0000-0000000000a1'), 1::bigint);
select e2e.eq('merge: calendar_events re-pointed', (select count(*) from public.calendar_events where deal_id='00000000-0000-0000-0000-0000000000a1'), 1::bigint);
select e2e.ok('merge: deal_activities re-pointed (created rows of merged deals now on keep)', (select count(*) from public.deal_activities where deal_id='00000000-0000-0000-0000-0000000000a1' and type='created') = 3);
select e2e.eq('merge: favorites deduped per user', (select count(*) from public.favorites where entity_id='00000000-0000-0000-0000-0000000000a1' and user_id='00000000-0000-0000-0000-0000000000f1'), 1::bigint);
select e2e.eq('merge: other user favorite moved', (select count(*) from public.favorites where entity_id='00000000-0000-0000-0000-0000000000a1' and user_id='00000000-0000-0000-0000-0000000000f2'), 1::bigint);
select e2e.eq('merge: no favorites left on merged', (select count(*) from public.favorites where entity_id in ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3')), 0::bigint);
select e2e.eq('merge: merged deals soft-deleted', (select count(*) from public.deals where id in ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3') and deleted_at is not null), 2::bigint);
select e2e.ok('merge: keep deal untouched', (select deleted_at is null from public.deals where id='00000000-0000-0000-0000-0000000000a1'));
select e2e.passes('merge: idempotent re-run', $$select public.merge_deals('00000000-0000-0000-0000-0000000000a1', array['00000000-0000-0000-0000-0000000000a2']::uuid[])$$);
select e2e.eq('merge: idempotent counts', (select count(*) from public.notes where deal_id='00000000-0000-0000-0000-0000000000a1'), 2::bigint);
select e2e.passes('merge: keep == only merged id is a no-op', $$select public.merge_deals('00000000-0000-0000-0000-0000000000a1', array['00000000-0000-0000-0000-0000000000a1']::uuid[])$$);
select e2e.ok('merge: keep != merged guard (keep never soft-deleted)', (select deleted_at is null from public.deals where id='00000000-0000-0000-0000-0000000000a1'));
select e2e.passes('merge: null/empty ids', $$select public.merge_deals('00000000-0000-0000-0000-0000000000a1', null)$$);

rollback;
