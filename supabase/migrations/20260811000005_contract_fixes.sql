-- Contract fixes found by the endpoint audit: make the database match what the app actually calls.
-- Idempotent and safe to re-run. Postgres 15 compatible. Runs after 20260811000002 (RLS helpers).
--
--   (a) signed-in users can read global feature_flags / app_settings (rls_mode)
--   (b) deal_workflows: columns the workflow service writes + write policies (open: authenticated; workspace: manager/admin)
--   (c) kpi_values.status/calculated_at; sales_velocity_metrics gets one row per stage stay (deal_id, stage,
--       entered_at, exited_at, days_in_stage) maintained by deal_audit; legacy period_start/period_end/metrics kept
--   (d) deals in supabase_realtime + REPLICA IDENTITY FULL
--   (e) enhanced_activities INSERT policy
--   (f) merge_deals(keep, merge_ids, p_fields) re-points every child table and updates the survivor atomically
--   (g) deal_audit attributes changes to auth.uid() (fallback created_by) and fills deal_history.changed_by
--   (h) initialize_all_feature_flags never overwrites existing flags and is service_role only; analytics flags seeded
--   (i) deal-files bucket becomes private (signed URLs); storage policies (workspace aware) stay in force
--   (j) deal_last_activity view (last real activity per deal, excludes audit-trail noise)

-- ---------------------------------------------------------------------------
-- (a) global flags / settings readable by signed-in users
-- ---------------------------------------------------------------------------
drop policy if exists "Allow authenticated read feature flags" on public.feature_flags;
create policy "Allow authenticated read feature flags" on public.feature_flags
  for select to authenticated using (true);

drop policy if exists "Allow authenticated read global settings" on public.app_settings;
create policy "Allow authenticated read global settings" on public.app_settings
  for select to authenticated using (user_id is null);

-- ---------------------------------------------------------------------------
-- (b) deal_workflows
-- ---------------------------------------------------------------------------
alter table public.deal_workflows add column if not exists category text;
alter table public.deal_workflows add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.deal_workflows add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.deal_workflows add column if not exists version integer not null default 1;
alter table public.deal_workflows add column if not exists created_by uuid;

-- open mode: any signed-in user may write (reads were already open to them); workspace mode: managers/admins.
-- anon never writes workflows.
drop policy if exists rls_insert on public.deal_workflows;
create policy rls_insert on public.deal_workflows for insert to authenticated
  with check ((select public.rls_mode()) = 'open'
              or ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null and public.is_manager_or_admin()));
drop policy if exists rls_update on public.deal_workflows;
create policy rls_update on public.deal_workflows for update to authenticated
  using ((select public.rls_mode()) = 'open'
         or ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null and public.is_manager_or_admin()))
  with check ((select public.rls_mode()) = 'open'
              or ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null and public.is_manager_or_admin()));
drop policy if exists rls_delete on public.deal_workflows;
create policy rls_delete on public.deal_workflows for delete to authenticated
  using ((select public.rls_mode()) = 'open'
         or ((select public.rls_mode()) = 'workspace' and (select auth.uid()) is not null and public.is_manager_or_admin()));

-- ---------------------------------------------------------------------------
-- (c) KPI / velocity shape
-- ---------------------------------------------------------------------------
alter table public.kpi_values add column if not exists status text;
alter table public.kpi_values add column if not exists calculated_at timestamptz default now();
do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'kpi_values_status_check' and conrelid = 'public.kpi_values'::regclass) then
    alter table public.kpi_values add constraint kpi_values_status_check
      check (status is null or status in ('on_track', 'at_risk', 'off_track'));
  end if;
end $c$;

alter table public.sales_velocity_metrics add column if not exists deal_id uuid references public.deals(id) on delete cascade;
alter table public.sales_velocity_metrics add column if not exists stage text;
alter table public.sales_velocity_metrics add column if not exists entered_at timestamptz;
alter table public.sales_velocity_metrics add column if not exists exited_at timestamptz;
alter table public.sales_velocity_metrics add column if not exists days_in_stage numeric;
create index if not exists idx_sales_velocity_deal on public.sales_velocity_metrics(deal_id, entered_at desc);
create index if not exists idx_sales_velocity_exited on public.sales_velocity_metrics(exited_at) where exited_at is not null;
create unique index if not exists uq_sales_velocity_open_stay on public.sales_velocity_metrics(deal_id) where exited_at is null and deal_id is not null;

-- backfill: one open stay per live deal
insert into public.sales_velocity_metrics (deal_id, stage, entered_at)
select d.id, d.stage, coalesce(d.updated_at, d.created_at, now())
from public.deals d
where d.deleted_at is null
  and not exists (select 1 from public.sales_velocity_metrics v where v.deal_id = d.id);

-- ---------------------------------------------------------------------------
-- (d) realtime on deals (guarded) + full replica identity so UPDATE payloads carry TOASTed columns
-- ---------------------------------------------------------------------------
do $rt$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.deals;
    exception
      when duplicate_object then null;
      when others then raise notice 'contract_fixes: could not add deals to supabase_realtime (%)', sqlerrm;
    end;
  end if;
  begin
    alter table public.deals replica identity full;
  exception when others then
    raise notice 'contract_fixes: could not set replica identity full on deals (%)', sqlerrm;
  end;
end $rt$;

-- ---------------------------------------------------------------------------
-- (e) enhanced_activities: clients may log activities (SELECT/service_role policies already exist)
-- ---------------------------------------------------------------------------
drop policy if exists "Allow authenticated insert enhanced activities" on public.enhanced_activities;
create policy "Allow authenticated insert enhanced activities" on public.enhanced_activities
  for insert to authenticated
  with check (
    (select public.rls_mode()) = 'open'
    or ((select public.rls_mode()) = 'workspace'
        and public.is_writer()
        and (user_id is null or user_id = (select auth.uid()))
        and (deal_id is null or public.can_view_deal(deal_id))
        and (contact_id is null or public.can_view_contact(contact_id)))
  );

-- ---------------------------------------------------------------------------
-- (g) deal_audit: actor = auth.uid() (fallback created_by); deal_history.changed_by; velocity stays
-- ---------------------------------------------------------------------------
create or replace function public.deal_audit() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  col text;
  o jsonb;
  n jsonb;
  act text;
  actor uuid;
  tracked text[] := array['stage','value','title','company','priority','probability','close_date','owner_id','deleted_at'];
begin
  if tg_op = 'INSERT' then
    actor := coalesce(auth.uid(), new.created_by);
    insert into public.deal_activities (deal_id, type, title, metadata, created_by)
    values (new.id, 'created', 'Deal created',
            jsonb_build_object('new', jsonb_build_object('stage', new.stage, 'value', new.value, 'title', new.title)),
            actor);
    if new.deleted_at is null then
      insert into public.sales_velocity_metrics (deal_id, stage, entered_at)
      values (new.id, new.stage, coalesce(new.created_at, now()))
      on conflict do nothing;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    -- deal_activities rows cascade with the deal; nothing durable to write against a vanished deal id
    return old;
  end if;

  o := to_jsonb(old);
  n := to_jsonb(new);

  if o is not distinct from n then
    return new;
  end if;

  actor := coalesce(auth.uid(), new.created_by);

  if old.deleted_at is null and new.deleted_at is not null then
    act := 'deleted';
  elsif old.deleted_at is not null and new.deleted_at is null then
    act := 'restored';
  elsif old.stage is distinct from new.stage then
    act := 'stage_changed';
  else
    act := 'updated';
  end if;

  -- stage-stay bookkeeping (sales velocity)
  if old.stage is distinct from new.stage and new.deleted_at is null then
    update public.sales_velocity_metrics v
       set exited_at = now(),
           days_in_stage = round((extract(epoch from (now() - coalesce(v.entered_at, now()))) / 86400.0)::numeric, 4)
     where v.deal_id = new.id and v.exited_at is null;
    insert into public.sales_velocity_metrics (deal_id, stage, entered_at) values (new.id, new.stage, now())
    on conflict do nothing;
  elsif old.deleted_at is not null and new.deleted_at is null then
    insert into public.sales_velocity_metrics (deal_id, stage, entered_at) values (new.id, new.stage, now())
    on conflict do nothing;
  end if;

  -- Skip pure ordering churn (position/updated_at only)
  if act = 'updated' and not exists (
    select 1 from unnest(tracked) c where o->c is distinct from n->c
  ) then
    return new;
  end if;

  insert into public.deal_activities (deal_id, type, title, metadata, created_by)
  values (new.id, act,
          case act when 'stage_changed' then 'Stage changed' when 'deleted' then 'Deal deleted'
                   when 'restored' then 'Deal restored' else 'Deal updated' end,
          jsonb_build_object(
            'old', jsonb_build_object('stage', old.stage, 'value', old.value),
            'new', jsonb_build_object('stage', new.stage, 'value', new.value)),
          actor);

  foreach col in array tracked loop
    if o->col is distinct from n->col then
      insert into public.deal_history (deal_id, field, old_value, new_value, changed_by)
      values (new.id, col, o->>col, n->>col, actor);
    end if;
  end loop;

  return new;
end
$fn$;

-- ---------------------------------------------------------------------------
-- (f) merge_deals(keep, merge_ids, p_fields)
--     * re-points every child table that references a deal (tables with a UNIQUE(deal_id) are left alone)
--     * p_fields (jsonb, optional): column -> value patch applied to the survivor in the same transaction
--       (generated columns and id/workspace_id/created_by/created_at/deleted_at/updated_at/position are ignored)
--     * keeps the workspace-mode guard; returns the survivor row as jsonb
-- ---------------------------------------------------------------------------
drop function if exists public.merge_deals(uuid, uuid[]);
create or replace function public.merge_deals(keep uuid, merge_ids uuid[], p_fields jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  m uuid;
  t text;
  k text;
  v jsonb;
  child_tables constant text[] := array[
    'notes', 'deal_files', 'tasks', 'deal_activities', 'calendar_events', 'deal_history', 'deal_deadlines',
    'communication_records', 'communication_logs', 'outbound_messages', 'deal_health_factors',
    'deal_probability_factors', 'enhanced_activities', 'activities', 'action_items', 'automated_notes',
    'email_threads', 'follow_ups', 'deal_insights'
  ];
  skip_cols constant text[] := array['id', 'workspace_id', 'created_by', 'created_at', 'deleted_at', 'updated_at', 'position'];
  result jsonb;
begin
  merge_ids := array_remove(merge_ids, keep);

  if public.rls_mode() = 'workspace' and auth.role() is not null and auth.role() <> 'service_role' then
    if not public.can_edit_deal(keep) then
      raise exception 'not allowed to edit the deal to keep' using errcode = '42501';
    end if;
    if merge_ids is not null then
      foreach m in array merge_ids loop
        if not public.can_edit_deal(m) then
          raise exception 'not allowed to merge deal %', m using errcode = '42501';
        end if;
      end loop;
    end if;
  end if;

  if not exists (select 1 from public.deals where id = keep and deleted_at is null) then
    raise exception 'deal to keep not found' using errcode = 'P0002';
  end if;

  if merge_ids is not null and array_length(merge_ids, 1) is not null then
    foreach t in array child_tables loop
      if to_regclass('public.' || t) is not null
         and exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = t and column_name = 'deal_id') then
        execute format('update public.%I set deal_id = $1 where deal_id = any($2)', t) using keep, merge_ids;
      end if;
    end loop;

    -- favorites: unique per (user, entity); drop dupes of keep, then repoint
    delete from public.favorites f
    where f.entity_type = 'deal' and f.entity_id = any(merge_ids)
      and exists (
        select 1 from public.favorites kf
        where kf.entity_type = 'deal' and kf.entity_id = keep and kf.user_id is not distinct from f.user_id
      );
    update public.favorites set entity_id = keep
    where entity_type = 'deal' and entity_id = any(merge_ids);

    -- stage-stay rows of the merged deals disappear with them (their velocity history is not the survivor's)
    delete from public.sales_velocity_metrics where deal_id = any(merge_ids);

    update public.deals set deleted_at = now(), updated_at = now() where id = any(merge_ids);
  end if;

  if p_fields is not null and jsonb_typeof(p_fields) = 'object' then
    for k, v in select key, value from jsonb_each(p_fields) loop
      continue when k = any(skip_cols);
      -- only real, non-generated columns of deals
      continue when not exists (
        select 1 from pg_attribute a
        where a.attrelid = 'public.deals'::regclass and a.attname = k and a.attnum > 0
          and not a.attisdropped and a.attgenerated = ''
      );
      execute format(
        'update public.deals set %1$I = (jsonb_populate_record(null::public.deals, jsonb_build_object(%2$L, $1::jsonb))).%1$I, updated_at = now() where id = $2',
        k, k) using v, keep;
    end loop;
  end if;

  select to_jsonb(d) into result from public.deals d where d.id = keep;
  return result;
end
$fn$;

revoke all on function public.merge_deals(uuid, uuid[], jsonb) from public;
grant execute on function public.merge_deals(uuid, uuid[], jsonb) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- (h) feature flags: never reset existing flags, service_role only, seed the analytics flags
-- ---------------------------------------------------------------------------
create or replace function public.initialize_all_feature_flags()
returns void as $$
begin
  insert into public.feature_flags (feature_key, enabled, rollout_percentage, description)
  values
    ('twenty_kanban_aggregation', true, 100, 'Show aggregation metrics in kanban column headers'),
    ('twenty_wip_limits', true, 100, 'Enable Work-in-Progress limits on kanban columns'),
    ('twenty_custom_columns', true, 100, 'Allow users to create and customize pipeline columns'),
    ('deal_health_indicators', true, 100, 'Display deal health scores and factors'),
    ('win_probability_calculator', true, 100, 'Show win probability calculations and factors'),
    ('deal_templates_phase3', true, 100, 'Deal templates system with create-from-current'),
    ('bulk_deal_actions', true, 100, 'Bulk operations on multiple deals'),
    ('deal_timeline', true, 100, 'Visual timeline of deal activities and milestones'),
    ('advanced_table_view', true, 100, 'Advanced table view with custom columns, filtering, sorting'),
    ('advanced_kanban_view', true, 100, 'Enhanced kanban with drag-drop and WIP limits'),
    ('advanced_dashboard', true, 100, 'Customizable dashboard with real-time widgets'),
    ('advanced_calendar_view', true, 100, 'Calendar view for date-based deal visualization'),
    ('saved_views', true, 100, 'Save and share custom view configurations'),
    ('custom_metrics', true, 100, 'User-defined KPI calculations'),
    ('advanced_export', true, 100, 'Enhanced export capabilities (Excel, PDF, XML)'),
    ('advanced_filtering', true, 100, 'Complex filtering with AND/OR logic'),
    ('export_templates', false, 0, 'Save and reuse export configurations'),
    ('scheduled_reports', false, 0, 'Automated report generation and delivery'),
    ('twenty_workflow_automation', true, 100, 'Automated deal progression workflows'),
    ('twenty_workflow_phase5', false, 0, 'Advanced Phase 5 workflow features (visual builder, AI agents)'),
    ('twenty_sla_monitoring', false, 0, 'Service Level Agreement tracking and alerts'),
    ('twenty_calendar_integration', true, 100, 'Calendar integration for meetings, deadlines, and reminders'),
    ('ai_deal_scoring', false, 0, 'AI-powered deal qualification and scoring'),
    ('ai_deal_scoring_auto_refresh', false, 0, 'Auto-refresh deal scores based on activity'),
    ('ai_competitor_analysis', false, 0, 'AI analysis of competitive landscape'),
    ('ai_competitor_alerts', false, 0, 'Real-time alerts for competitive threats'),
    ('ai_deal_insights', false, 0, 'AI-generated recommendations for deal progression'),
    ('ai_predictive_analytics', false, 0, 'Predictive metrics and forecasting'),
    ('ai_automated_notes', false, 0, 'AI summarization of deal communications'),
    ('ai_action_item_extraction', false, 0, 'Extract action items from communications'),
    ('ai_chatbot', false, 0, 'Conversational assistant with CRM data access'),
    ('ai_context_awareness', false, 0, 'Page context awareness in AI interactions'),
    ('ai_natural_language_queries', false, 0, 'Natural language queries without navigation'),
    ('ai_workflow_agents', false, 0, 'Autonomous agents for multi-step workflow tasks'),
    ('ai_agent_collaboration', false, 0, 'Multi-agent collaboration in workflows'),
    ('ai_data_enrichment', false, 0, 'Enrich records from public sources'),
    ('ai_social_enrichment', false, 0, 'Social media and professional profile enrichment'),
    ('ai_firmographic_enrichment', false, 0, 'Company size, revenue, and industry data'),
    ('ai_record_classification', false, 0, 'Automatic categorization and classification'),
    ('ai_custom_classification', false, 0, 'Custom classification schemas'),
    ('ai_summary_generation', false, 0, 'AI-generated summaries and insights'),
    ('ai_executive_summaries', false, 0, 'Executive-level summaries and reports'),
    ('ai_custom_prompts', false, 0, 'Define custom AI prompts and templates'),
    ('ai_prompt_versioning', false, 0, 'Version control and performance tracking for prompts'),
    ('ai_performance_optimization', true, 100, 'Performance optimization for AI operations'),
    ('ai_privacy_protection', true, 100, 'Privacy and security for AI data processing'),
    ('ai_rate_limiting', true, 100, 'Rate limiting for AI API calls'),
    ('twenty_views_reporting', true, 100, 'Saved views and reporting features'),
    ('twenty_deal_templates', true, 100, 'Deal templates panel in deals section'),
    ('twenty_workflow_phase5_features', false, 0, 'Enhanced workflow panel with visual builder'),
    ('twenty_predictive_analytics', true, 100, 'Predictive analytics (forecasting) in the pipeline and analytics dashboard'),
    ('twenty_pipeline_analytics', true, 100, 'Pipeline analytics and forecasting dashboard')
  on conflict (feature_key) do nothing;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.initialize_all_feature_flags() from public, anon, authenticated;
grant execute on function public.initialize_all_feature_flags() to service_role;

insert into public.feature_flags (feature_key, enabled, rollout_percentage, description) values
  ('twenty_predictive_analytics', true, 100, 'Predictive analytics (forecasting) in the pipeline and analytics dashboard'),
  ('twenty_pipeline_analytics', true, 100, 'Pipeline analytics and forecasting dashboard')
on conflict (feature_key) do nothing;

-- ---------------------------------------------------------------------------
-- (i) deal-files: private bucket (the app uses signed URLs). Read/write policies from 20260811000002 stay:
--     open mode = anon/authenticated read, authenticated write; workspace mode = per-deal checks.
-- ---------------------------------------------------------------------------
do $b$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets set public = false where id = 'deal-files' and public is distinct from false;
  end if;
exception when insufficient_privilege then
  raise notice 'contract_fixes: not owner of storage.buckets, deal-files left as it was';
end $b$;

-- ---------------------------------------------------------------------------
-- (j) last real activity per deal (audit-trail rows written by deal_audit do not count)
-- ---------------------------------------------------------------------------
create or replace view public.deal_last_activity with (security_invoker = on) as
select d.id as deal_id,
       nullif(greatest(
         coalesce((select max(n.created_at) from public.notes n where n.deal_id = d.id and n.deleted_at is null), 'epoch'::timestamptz),
         coalesce((select max(a.created_at) from public.deal_activities a
                    where a.deal_id = d.id and a.type not in ('created', 'updated', 'stage_changed', 'deleted', 'restored')), 'epoch'::timestamptz),
         coalesce((select max(c.timestamp) from public.communication_records c where c.deal_id = d.id), 'epoch'::timestamptz),
         coalesce((select max(e.created_at) from public.enhanced_activities e where e.deal_id = d.id), 'epoch'::timestamptz),
         coalesce((select max(x.created_at) from public.activities x where x.deal_id = d.id), 'epoch'::timestamptz),
         coalesce((select max(o.sent_at) from public.outbound_messages o where o.deal_id = d.id), 'epoch'::timestamptz)
       ), 'epoch'::timestamptz) as last_activity_at
from public.deals d;
grant select on public.deal_last_activity to anon, authenticated, service_role;
