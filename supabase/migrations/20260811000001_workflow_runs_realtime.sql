-- Workflow runs: realtime + run-detail support (Workstream H).
-- Idempotent and safe to re-run.

-- 1) Realtime for workflow_executions (never errors if the publication is missing / already contains it)
do $$
begin
  begin
    alter publication supabase_realtime add table public.workflow_executions;
  exception
    when duplicate_object then null;
    when undefined_object then null;
    when undefined_table then null;
    when others then null;
  end;
end $$;

-- 2) Run history list is filtered by workflow and sorted by start time
create index if not exists idx_workflow_executions_workflow_started
  on public.workflow_executions (workflow_id, started_at desc);

-- 3) Expose `steps` (jsonb) on the history view so the run detail can overlay per-step status.
--    Keeps every column of 20260801000001 and appends `steps` last (CREATE OR REPLACE VIEW may only add columns at the end).
create or replace view public.workflow_run_history
with (security_invoker = true) as
select
  e.id,
  e.workflow_id,
  w.name as workflow_name,
  e.trigger_type,
  e.status,
  e.source,
  e.event_id,
  coalesce(e.record_id, e.context->>'recordId') as record_id,
  e.started_at,
  e.completed_at,
  coalesce(e.duration, extract(epoch from (e.completed_at - e.started_at)) * 1000) as duration_ms,
  e.error_message,
  e.error_step_id,
  case when jsonb_typeof(e.steps) = 'array' then jsonb_array_length(e.steps) else 0 end as steps_total,
  case when jsonb_typeof(e.steps) = 'array'
       then (select count(*) from jsonb_array_elements(e.steps) s where s->>'status' = 'failed')
       else 0 end as steps_failed,
  e.steps
from public.workflow_executions e
left join public.deal_workflows w on w.id::text = e.workflow_id;

grant select on public.workflow_run_history to anon, authenticated, service_role;

-- 4) RPC returns the same row type (now including steps). The return type changed, so recreate it.
drop function if exists public.get_workflow_run_history(integer, text);

create or replace function public.get_workflow_run_history(p_limit integer default 50, p_workflow_id text default null)
returns setof public.workflow_run_history
language sql stable as $fn$
  select * from public.workflow_run_history
  where p_workflow_id is null or workflow_id = p_workflow_id
  order by started_at desc nulls last
  limit least(greatest(p_limit, 1), 500)
$fn$;

grant execute on function public.get_workflow_run_history(integer, text) to anon, authenticated, service_role;
