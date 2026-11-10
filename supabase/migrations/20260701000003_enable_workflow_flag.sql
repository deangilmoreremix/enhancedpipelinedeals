-- Enable the Phase 5 workflow experience (visual builder, AI agents) now that /workflows is routed.
-- Idempotent: inserts the flag if missing, otherwise turns it on.
insert into public.feature_flags (feature_key, enabled, rollout_percentage, description)
values ('twenty_workflow_phase5', true, 100, 'Advanced Phase 5 workflow features (visual builder, AI agents)')
on conflict (feature_key) do update
  set enabled = true,
      rollout_percentage = 100,
      updated_at = now();
