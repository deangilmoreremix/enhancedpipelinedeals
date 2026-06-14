-- Fix feature_flags RLS for anon access
drop policy if exists "Allow authenticated users to read feature flags" on public.feature_flags;
create policy "Allow anon read access" on public.feature_flags for select to anon using (true);