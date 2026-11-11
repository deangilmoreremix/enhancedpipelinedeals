\set QUIET on
\getenv tmpdir E2E_TMP
begin;
-- ---- claim_workflow_events: single-session semantics ------------------------
insert into public.workflow_events(id, event_type, entity_type, created_at, processed, attempts, claimed_at) values
 ('00000000-0000-0000-0000-0000000000e1','t','deal', now()-interval '50 min', false, 0, null),
 ('00000000-0000-0000-0000-0000000000e2','t','deal', now()-interval '40 min', false, 0, null),
 ('00000000-0000-0000-0000-0000000000e3','t','deal', now()-interval '30 min', true,  0, null),   -- processed
 ('00000000-0000-0000-0000-0000000000e4','t','deal', now()-interval '20 min', false, 5, null),   -- attempts capped
 ('00000000-0000-0000-0000-0000000000e5','t','deal', now()-interval '10 min', false, 1, now()),  -- fresh claim
 ('00000000-0000-0000-0000-0000000000e6','t','deal', now()-interval '5 min',  false, 2, now()-interval '11 min'); -- stale claim
delete from public.workflow_events where event_type <> 't';
create temp table c1 as select * from public.claim_workflow_events(1, 5);
select e2e.eq('claim: limit 1 returns oldest eligible', (select string_agg(id::text, ',') from c1), '00000000-0000-0000-0000-0000000000e1');
select e2e.eq('claim: attempts incremented + claimed_at set', (select attempts::text || coalesce(claimed_at is not null, false)::text from public.workflow_events where id='00000000-0000-0000-0000-0000000000e1'), '1true');
create temp table c2 as select * from public.claim_workflow_events(25, 5);
select e2e.eq('claim: skips processed, capped, fresh-claimed; takes unclaimed + stale',
  (select string_agg(right(id::text, 2), ',' order by created_at) from c2), 'e2,e6');
select e2e.eq('claim: stale claim re-claimed increments attempts', (select attempts from public.workflow_events where id='00000000-0000-0000-0000-0000000000e6'), 3);
select e2e.eq('claim: already-claimed rows are not re-claimed', (select count(*) from public.claim_workflow_events(25, 5)), 0::bigint);
select e2e.eq('claim: capped event untouched', (select attempts from public.workflow_events where id='00000000-0000-0000-0000-0000000000e4'), 5);
update public.workflow_events set claimed_at = now() - interval '11 min' where id = '00000000-0000-0000-0000-0000000000e4';
select e2e.eq('claim: attempts cap holds even with stale claim', (select count(*) from public.claim_workflow_events(25, 5)), 0::bigint);
select e2e.eq('claim: higher cap makes it eligible', (select count(*) from public.claim_workflow_events(25, 6)), 1::bigint);
insert into public.workflow_events(event_type, entity_type) values ('t','deal'),('t','deal');
select e2e.eq('claim: p_limit <= 0 treated as 1', (select count(*) from public.claim_workflow_events(0, 99)), 1::bigint);
select e2e.ok('claim: callable by service_role only (anon/authenticated denied)', not has_function_privilege('anon', 'public.claim_workflow_events(integer,integer)', 'execute') and not has_function_privilege('authenticated', 'public.claim_workflow_events(integer,integer)', 'execute')
  and has_function_privilege('service_role', 'public.claim_workflow_events(integer,integer)', 'execute'));

-- ---- run history view + RPC ------------------------------------------------
insert into public.deal_workflows(id, name) values ('00000000-0000-0000-0000-0000000000f1', 'WF One');
insert into public.workflow_executions(id, workflow_id, trigger_type, status, started_at, completed_at, steps, context, source, record_id, error_message, error_step_id) values
 ('r1','00000000-0000-0000-0000-0000000000f1','deal.created','failed', now()-interval '3 min', now()-interval '3 min' + interval '2 seconds',
   '[{"id":"s1","status":"success"},{"id":"s2","status":"failed"},{"id":"s3","status":"skipped"}]', '{"recordId":"ctx-1"}', 'server', null, 'boom', 's2'),
 ('r2','00000000-0000-0000-0000-0000000000f1','manual','success', now()-interval '2 min', null, '[]', '{}', 'client', 'rec-2', null, null),
 ('r3','other-wf','manual','success', now()-interval '1 min', null, null, null, 'client', null, null, null);
select e2e.ok('view: steps jsonb exposed', (select jsonb_array_length(steps) = 3 from public.workflow_run_history where id='r1'));
select e2e.eq('view: steps_total/failed', (select steps_total::text || '/' || steps_failed::text from public.workflow_run_history where id='r1'), '3/1');
select e2e.eq('view: workflow_name joined', (select workflow_name from public.workflow_run_history where id='r1'), 'WF One');
select e2e.eq('view: record_id falls back to context.recordId', (select record_id from public.workflow_run_history where id='r1'), 'ctx-1');
select e2e.eq('view: duration_ms computed', (select duration_ms::int from public.workflow_run_history where id='r1'), 2000);
select e2e.ok('view: null steps -> totals 0, no error', (select steps_total = 0 and steps_failed = 0 from public.workflow_run_history where id='r3'));
select e2e.eq('view: error fields', (select error_message || '/' || error_step_id from public.workflow_run_history where id='r1'), 'boom/s2');
select e2e.eq('rpc: no filter returns all, newest first', (select string_agg(id, ',') from public.get_workflow_run_history()), 'r3,r2,r1');
select e2e.eq('rpc: workflow filter', (select string_agg(id, ',') from public.get_workflow_run_history(50, '00000000-0000-0000-0000-0000000000f1')), 'r2,r1');
select e2e.eq('rpc: limit', (select count(*) from public.get_workflow_run_history(1)), 1::bigint);
select e2e.eq('rpc: limit 0 clamped to 1', (select count(*) from public.get_workflow_run_history(0)), 1::bigint);
select e2e.ok('rpc: returns steps column', (select steps is not null from public.get_workflow_run_history(50, '00000000-0000-0000-0000-0000000000f1') where id = 'r1'));
select e2e.ok('rpc/view: rowtype column list has steps last', (select (array_agg(attname order by attnum))[array_length(array_agg(attname),1)] = 'steps' from pg_attribute where attrelid='public.workflow_run_history'::regclass and attnum>0 and not attisdropped));
select e2e.eq('view readable by anon (open mode)', (select e2e.cnt('select 1 from public.workflow_run_history') from (select e2e.as_user('anon') ) x where true), 3::bigint);
reset role;
select e2e.ok('view is security_invoker', (select coalesce(reloptions::text,'') like '%security_invoker=true%' from pg_class where oid='public.workflow_run_history'::regclass));
select e2e.ok('index idx_workflow_executions_workflow_started exists', to_regclass('public.idx_workflow_executions_workflow_started') is not null);
select e2e.ok('index idx_scheduled_triggers_due exists', to_regclass('public.idx_scheduled_triggers_due') is not null);
select e2e.ok('workflow_executions in realtime publication (or publication absent)',
  not exists (select 1 from pg_publication where pubname='supabase_realtime') or exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='workflow_executions'));
rollback;

-- ---- claim_workflow_events: real concurrency (two sessions, committed data) ----
delete from public.workflow_events;
insert into public.workflow_events(id, event_type, entity_type, created_at)
select gen_random_uuid(), 'e2e.concurrency', 'deal', now() - (10 - g) * interval '1 minute' from generate_series(1, 5) g;
\! (psql -X -q -At -c "begin; select string_agg(id::text, ',') from public.claim_workflow_events(2, 5); select pg_sleep(3); commit;" > "$E2E_TMP/a.out" 2>&1 &)
select pg_sleep(1.2) \g /dev/null
begin;
create temp table b as select * from public.claim_workflow_events(10, 5);
commit;
select pg_sleep(2.5) \g /dev/null
\set aids `cat "$E2E_TMP/a.out"`
select e2e.eq('concurrency: session B gets only rows A did not lock', (select count(*) from b), 3::bigint);
select e2e.eq('concurrency: session A claimed 2 rows', array_length(string_to_array(:'aids', ','), 1), 2);
select e2e.eq('concurrency: no overlap between A and B', (select count(*) from b where position(id::text in :'aids') > 0), 0::bigint);
select e2e.eq('concurrency: all 5 claimed exactly once (attempts=1)', (select count(*) from public.workflow_events where attempts = 1 and claimed_at is not null), 5::bigint);
delete from public.workflow_events where event_type = 'e2e.concurrency';
