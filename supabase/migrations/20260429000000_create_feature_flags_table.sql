-- Enable RLS
alter table public.feature_flags enable row level security;

-- Create policy to allow authenticated users to read feature flags
create policy "Allow authenticated users to read feature flags"
  on public.feature_flags for select
  to authenticated
  using (true);

-- Create policy to allow service role to manage feature flags
create policy "Allow service role full access"
  on public.feature_flags for all
  to service_role
  using (true);
