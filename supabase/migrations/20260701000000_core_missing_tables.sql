-- Core missing tables + columns used by the application code but absent from earlier migrations.
-- Idempotent: safe to re-run. RLS follows 20260613000000_fix_rls_for_anon_access.sql
-- (anon read/insert for demo-mode CRM data, authenticated access, service_role full access).
-- Sensitive/admin tables: authenticated + service_role only (no anon).

-- ---------------------------------------------------------------------------
-- Helper (dropped at end of this file): standard RLS policies
--   mode 'crm'       : anon select+insert, authenticated all, service_role all
--   mode 'private'   : authenticated all, service_role all
-- ---------------------------------------------------------------------------
create or replace function public._apply_std_rls(tbl text, mode text) returns void
language plpgsql as $fn$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format('drop policy if exists "Allow authenticated access" on public.%I', tbl);
  execute format('create policy "Allow authenticated access" on public.%I for all to authenticated using (true) with check (true)', tbl);
  execute format('drop policy if exists "Allow service role full access" on public.%I', tbl);
  execute format('create policy "Allow service role full access" on public.%I for all to service_role using (true) with check (true)', tbl);
  execute format('drop policy if exists "Allow anon read access" on public.%I', tbl);
  execute format('drop policy if exists "Allow anon insert" on public.%I', tbl);
  if mode = 'crm' then
    execute format('create policy "Allow anon read access" on public.%I for select to anon using (true)', tbl);
    execute format('create policy "Allow anon insert" on public.%I for insert to anon with check (true)', tbl);
  end if;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Missing columns on existing tables
-- ---------------------------------------------------------------------------
alter table public.contacts
  add column if not exists location text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists website text,
  add column if not exists source text,
  add column if not exists position text,
  add column if not exists avatar text,
  add column if not exists avatar_src text,
  add column if not exists tags text[] default '{}',
  add column if not exists custom_fields jsonb default '{}',
  add column if not exists is_favorite boolean default false,
  add column if not exists ai_score_rationale text,
  add column if not exists psychological_profile jsonb,
  add column if not exists behavioral_insights jsonb,
  add column if not exists last_enrichment jsonb,
  add column if not exists last_activity timestamptz,
  add column if not exists role text,
  add column if not exists workspace_id uuid;

alter table public.deals
  add column if not exists workspace_id uuid,
  add column if not exists assigned_to text,
  add column if not exists contact_avatar text,
  add column if not exists company_avatar text,
  add column if not exists last_activity text,
  add column if not exists tags text[] default '{}',
  add column if not exists custom_fields jsonb default '{}',
  add column if not exists social_profiles jsonb default '{}',
  add column if not exists last_enrichment jsonb,
  add column if not exists attachments jsonb default '[]',
  add column if not exists links jsonb default '[]',
  add column if not exists next_follow_up text,
  add column if not exists ai_score numeric,
  add column if not exists health_score numeric,
  add column if not exists health_factors jsonb default '[]',
  add column if not exists win_probability numeric,
  add column if not exists probability_factors jsonb default '[]',
  add column if not exists template_id uuid,
  add column if not exists timeline jsonb default '[]',
  add column if not exists last_health_update timestamptz,
  add column if not exists last_probability_update timestamptz;

create index if not exists idx_deals_workspace_id on public.deals(workspace_id);
create index if not exists idx_contacts_workspace_id on public.contacts(workspace_id);

-- ---------------------------------------------------------------------------
-- Workspaces / users / profiles / roles (backend + auth)
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text,
  owner_id uuid,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  avatar text,
  workspace_id uuid,
  custom_fields jsonb default '{}',
  data_processing_restricted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  name text,
  avatar text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  permissions jsonb default '[]',
  is_system_role boolean default false,
  workspace_id uuid,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_roles (
  user_id uuid not null,
  role_id uuid not null references public.roles(id) on delete cascade,
  workspace_id uuid not null,
  assigned_by uuid,
  assigned_at timestamptz default now(),
  expires_at timestamptz,
  primary key (user_id, role_id, workspace_id)
);

-- ---------------------------------------------------------------------------
-- Activities & communications
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  entity_type text,
  entity_id uuid,
  user_id uuid,
  type text,
  title text,
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_activities_contact_id on public.activities(contact_id, created_at desc);
create index if not exists idx_activities_deal_id on public.activities(deal_id);
create index if not exists idx_activities_entity on public.activities(entity_type, entity_id);

create table if not exists public.deal_activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  type text not null,
  title text,
  description text,
  metadata jsonb default '{}',
  created_by uuid,
  created_at timestamptz default now()
);
create index if not exists idx_deal_activities_deal_id on public.deal_activities(deal_id, created_at desc);

create table if not exists public.deal_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  field text,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz default now()
);
create index if not exists idx_deal_history_deal_id on public.deal_history(deal_id, changed_at desc);

create table if not exists public.deal_health_factors (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  name text not null,
  category text,
  score numeric,
  weight numeric,
  description text,
  is_positive boolean default true,
  "timestamp" timestamptz default now()
);
create index if not exists idx_deal_health_factors_deal_id on public.deal_health_factors(deal_id);

create table if not exists public.deal_probability_factors (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  name text not null,
  category text,
  impact numeric,
  confidence numeric,
  description text,
  data jsonb default '{}',
  "timestamp" timestamptz default now()
);
create index if not exists idx_deal_probability_factors_deal_id on public.deal_probability_factors(deal_id);

create table if not exists public.deal_risk_daily (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  date date not null default current_date,
  risk_score numeric,
  factors jsonb default '{}',
  created_at timestamptz default now(),
  unique (deal_id, date)
);

create table if not exists public.deal_deadlines (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  title text not null,
  description text,
  deadline_at timestamptz not null,
  deadline_type text default 'custom',
  priority text default 'medium',
  reminders jsonb default '[]',
  status text default 'active',
  calendar_event_id uuid,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_deal_deadlines_deal_id on public.deal_deadlines(deal_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  user_id uuid,
  title text not null,
  due_date timestamptz,
  notes text,
  status text default 'open',
  created_by_agent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tasks_contact_id on public.tasks(contact_id);
create index if not exists idx_tasks_status on public.tasks(status);

create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  channel text default 'email',
  recipient text,
  subject text,
  body text,
  status text default 'queued',
  created_by_agent boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_outbound_messages_contact_id on public.outbound_messages(contact_id);
create index if not exists idx_outbound_messages_status on public.outbound_messages(status);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  timezone text default 'UTC',
  location text,
  meeting_url text,
  attendees jsonb default '[]',
  status text default 'confirmed',
  event_type text default 'meeting',
  recurrence_rule text,
  reminders jsonb default '[]',
  metadata jsonb default '{}',
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- In case the table pre-exists with fewer columns
alter table public.calendar_events
  add column if not exists deal_id uuid,
  add column if not exists contact_id uuid,
  add column if not exists description text,
  add column if not exists timezone text default 'UTC',
  add column if not exists location text,
  add column if not exists meeting_url text,
  add column if not exists attendees jsonb default '[]',
  add column if not exists status text default 'confirmed',
  add column if not exists event_type text default 'meeting',
  add column if not exists recurrence_rule text,
  add column if not exists reminders jsonb default '[]',
  add column if not exists metadata jsonb default '{}',
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz default now();
create index if not exists idx_calendar_events_start on public.calendar_events(start_time);
create index if not exists idx_calendar_events_contact on public.calendar_events(contact_id);
create index if not exists idx_calendar_events_deal on public.calendar_events(deal_id);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  description text,
  remind_at timestamptz not null,
  reminder_type text default 'notification',
  related_type text,
  related_id uuid,
  status text default 'pending',
  delivery_method text default 'in_app',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_reminders_status_remind_at on public.reminders(status, remind_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  type text,
  title text,
  message text,
  metadata jsonb default '{}',
  is_read boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_notifications_user_id on public.notifications(user_id, created_at desc);

create table if not exists public.communication_records (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  user_id uuid,
  type text,
  direction text,
  content text,
  subject text,
  duration text,
  "timestamp" timestamptz default now(),
  status text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_communication_records_contact on public.communication_records(contact_id, "timestamp" desc);
create index if not exists idx_communication_records_deal on public.communication_records(deal_id);

create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  user_id uuid,
  type text,
  action text,
  details jsonb default '{}',
  "timestamp" timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  thread_id text unique,
  subject text,
  participants jsonb default '[]',
  last_message_at timestamptz,
  message_count integer default 0,
  tags text[] default '{}',
  priority_score numeric,
  status text default 'active',
  deal_id uuid references public.deals(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.email_threads(id) on delete cascade,
  message_id text unique,
  from_email text,
  to_emails jsonb default '[]',
  cc_emails jsonb default '[]',
  bcc_emails jsonb default '[]',
  subject text,
  body_text text,
  body_html text,
  sent_at timestamptz,
  received_at timestamptz,
  attachments jsonb default '[]',
  labels jsonb default '[]',
  ai_summary text,
  sentiment_analysis jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_emails_thread_id on public.emails(thread_id);

create table if not exists public.email_crm_links (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.emails(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  link_type text,
  confidence_score numeric,
  created_at timestamptz default now(),
  unique (email_id, record_type, record_id)
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text,
  subject text,
  body text,
  category text,
  variables jsonb default '[]',
  is_active boolean default true,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Apply RLS: CRM-style tables (anon read/insert like contacts)
select public._apply_std_rls(t, 'crm') from unnest(array[
  'activities','deal_activities','deal_history','deal_health_factors','deal_probability_factors',
  'deal_risk_daily','deal_deadlines','tasks','outbound_messages','calendar_events','reminders',
  'notifications','communication_records','communication_logs','email_threads','emails',
  'email_crm_links','email_templates'
]) as t;

-- Private tables (no anon)
select public._apply_std_rls(t, 'private') from unnest(array['workspaces','users','profiles','roles','user_roles']) as t;

drop function if exists public._apply_std_rls(text, text);
