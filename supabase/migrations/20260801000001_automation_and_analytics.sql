-- Phase E: automation runner + analytics support. Idempotent.

-- ---------------------------------------------------------------------------
-- workflow_events: retry bookkeeping for the workflow-runner Netlify function
-- ---------------------------------------------------------------------------
alter table public.workflow_events
  add column if not exists processed_at timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists error text,
  add column if not exists claimed_at timestamptz;

create index if not exists idx_workflow_events_processed_created
  on public.workflow_events (processed, created_at);

-- Atomically claim a batch of unprocessed events (skip locked => safe with overlapping runners).
-- Events are retried until attempts reaches p_max_attempts; a stale claim (> 10 min) is re-claimable.
create or replace function public.claim_workflow_events(p_limit integer default 25, p_max_attempts integer default 5)
returns setof public.workflow_events
language plpgsql security definer set search_path = public as $fn$
begin
  return query
  with picked as (
    select e.id
    from public.workflow_events e
    where e.processed = false
      and e.attempts < p_max_attempts
      and (e.claimed_at is null or e.claimed_at < now() - interval '10 minutes')
    order by e.created_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update public.workflow_events e
     set attempts = e.attempts + 1, claimed_at = now()
    from picked
   where e.id = picked.id
  returning e.*;
end
$fn$;

grant execute on function public.claim_workflow_events(integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- workflow_executions: link runs to the event/record that caused them
-- ---------------------------------------------------------------------------
alter table public.workflow_executions
  add column if not exists event_id uuid,
  add column if not exists source text default 'client',
  add column if not exists record_id text,
  add column if not exists record_type text,
  add column if not exists attempt integer default 1;

create index if not exists idx_workflow_executions_event on public.workflow_executions (event_id);
create index if not exists idx_workflow_executions_created on public.workflow_executions (created_at desc);
create index if not exists idx_workflow_executions_status on public.workflow_executions (status, started_at desc);

-- scheduled_triggers: used for delayed workflow resumes (schedule_config.kind = 'delay_resume')
create index if not exists idx_scheduled_triggers_due on public.scheduled_triggers (next_run) where is_active;

-- sla_instances: the application layer reads started_at
alter table public.sla_instances add column if not exists started_at timestamptz default now();
update public.sla_instances set started_at = created_at where started_at is null;

-- ---------------------------------------------------------------------------
-- Run history: view + RPC
-- ---------------------------------------------------------------------------
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
       else 0 end as steps_failed
from public.workflow_executions e
left join public.deal_workflows w on w.id::text = e.workflow_id;

grant select on public.workflow_run_history to anon, authenticated, service_role;

create or replace function public.get_workflow_run_history(p_limit integer default 50, p_workflow_id text default null)
returns setof public.workflow_run_history
language sql stable as $fn$
  select * from public.workflow_run_history
  where p_workflow_id is null or workflow_id = p_workflow_id
  order by started_at desc nulls last
  limit least(greatest(p_limit, 1), 500)
$fn$;

grant execute on function public.get_workflow_run_history(integer, text) to anon, authenticated, service_role;

-- Realtime for workflow events (ignore if already configured)
do $$
begin
  begin
    alter publication supabase_realtime add table public.workflow_events;
  exception when others then null;
  end;
end $$;
