-- Fix RLS policies to allow anonymous access for read operations

-- Achievements: Allow anon SELECT
drop policy if exists "Allow authenticated access" on public.achievements;
create policy "Allow anon read access" on public.achievements for select to anon using (true);

-- Challenges: Allow anon SELECT
drop policy if exists "Allow authenticated access" on public.challenges;
create policy "Allow anon read access" on public.challenges for select to anon using (true);

-- User achievements: Allow anon SELECT (for viewing public achievements)
drop policy if exists "Users can view their achievements" on public.user_achievements;
create policy "Allow anon read access" on public.user_achievements for select to anon using (true);

-- Contacts: Allow anon SELECT and INSERT for demo mode
drop policy if exists "Users can view contacts they created" on public.contacts;
create policy "Allow anon read access" on public.contacts for select to anon using (true);

drop policy if exists "Users can insert their contacts" on public.contacts;
create policy "Allow anon insert" on public.contacts for insert to anon with check (true);

-- Deals: Already has using (true) for select/insert/update, just making sure
-- Verify existing policies allow anon

-- App settings: Allow anon SELECT for global settings
drop policy if exists "Allow global settings read" on public.app_settings;
create policy "Allow anon read global settings" on public.app_settings for select to anon using (user_id is null);

-- Feature flags: Allow anon SELECT
drop policy if exists "Allow authenticated users to read feature flags" on public.feature_flags;
create policy "Allow anon read access" on public.feature_flags for select to anon using (true);