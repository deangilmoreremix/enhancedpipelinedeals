-- Create realtime_sync_status table for tracking sync versions
create table if not exists public.realtime_sync_status (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('deal', 'contact', 'activity')),
  entity_id uuid not null,
  last_sync_version integer default 0,
  last_synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(entity_type, entity_id)
);

-- Enable RLS
alter table public.realtime_sync_status enable row level security;

-- Policies (service role and read access for users involved with the entity)
create policy "Users can view sync status for their entities"
  on public.realtime_sync_status for select
  using (
    (entity_type = 'deal' and exists (
      select 1 from public.deals d
      where d.id = entity_id
      and (d.assigned_to_id = auth.uid() or d.contact_id in (
        select id from public.contacts where created_by = auth.uid()
      ))
    ))
    or
    (entity_type = 'contact' and exists (
      select 1 from public.contacts c
      where c.id = entity_id
      and c.created_by = auth.uid()
    ))
    or
    (entity_type = 'activity' and exists (
      select 1 from public.enhanced_activities a
      where a.id = entity_id
      and a.user_id = auth.uid()
    ))
  );

-- Allow service role full access
create policy "Allow service role full access"
  on public.realtime_sync_status for all
  to service_role
  using (true);

-- Indexes
create index idx_realtime_sync_status_entity on public.realtime_sync_status(entity_type, entity_id);

-- Function to increment sync version
create or replace function public.increment_sync_version(
  p_entity_type text,
  p_entity_id uuid
) returns integer as $$
declare
  v_version integer;
begin
  insert into public.realtime_sync_status (entity_type, entity_id, last_sync_version)
  values (p_entity_type, p_entity_id, 1)
  on conflict (entity_type, entity_id)
  do update set
    last_sync_version = realtime_sync_status.last_sync_version + 1,
    last_synced_at = now()
  returning last_sync_version into v_version;

  return v_version;
end;
$$ language plpgsql security definer;

-- Grant execute on function to authenticated users
grant execute on function public.increment_sync_version to authenticated;
