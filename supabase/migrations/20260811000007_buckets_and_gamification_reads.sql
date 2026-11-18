-- Fixes found by the strict fake Supabase:
--  * the client tried to create storage buckets (impossible with a user key): create them here instead
--  * signed-in users could not read achievements/challenges (anon-only SELECT policy)
-- Idempotent.

-- Gamification catalogue is readable by every signed-in user (rows are not per-user)
do $g$
begin
  if to_regclass('public.achievements') is not null then
    drop policy if exists "achievements_select_authenticated" on public.achievements;
    create policy "achievements_select_authenticated" on public.achievements for select to authenticated using (true);
  end if;
  if to_regclass('public.challenges') is not null then
    drop policy if exists "challenges_select_authenticated" on public.challenges;
    create policy "challenges_select_authenticated" on public.challenges for select to authenticated using (true);
  end if;
end
$g$;

-- Storage buckets the app uploads to. Avatars are public; attachments/documents are private (signed URLs).
do $s$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present, skipping bucket creation';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit) values
    ('contact-avatars', 'contact-avatars', true, 2097152),
    ('deal-attachments', 'deal-attachments', false, 10485760),
    ('contact-documents', 'contact-documents', false, 10485760)
  on conflict (id) do nothing;

  -- public avatars: anyone can read, signed-in users write
  drop policy if exists "Public read contact-avatars" on storage.objects;
  create policy "Public read contact-avatars" on storage.objects for select to anon, authenticated using (bucket_id = 'contact-avatars');

  drop policy if exists "Authenticated write contact-avatars" on storage.objects;
  create policy "Authenticated write contact-avatars" on storage.objects for insert to authenticated with check (bucket_id = 'contact-avatars');
  drop policy if exists "Authenticated update contact-avatars" on storage.objects;
  create policy "Authenticated update contact-avatars" on storage.objects for update to authenticated using (bucket_id = 'contact-avatars') with check (bucket_id = 'contact-avatars');
  drop policy if exists "Authenticated delete contact-avatars" on storage.objects;
  create policy "Authenticated delete contact-avatars" on storage.objects for delete to authenticated using (bucket_id = 'contact-avatars');
  drop policy if exists "Service role manage contact-avatars" on storage.objects;
  create policy "Service role manage contact-avatars" on storage.objects for all to service_role using (bucket_id = 'contact-avatars') with check (bucket_id = 'contact-avatars');

  -- private buckets: signed-in users read/write (signed URLs for sharing)
  drop policy if exists "Authenticated read deal-attachments" on storage.objects;
  create policy "Authenticated read deal-attachments" on storage.objects for select to authenticated using (bucket_id = 'deal-attachments');
  drop policy if exists "Authenticated write deal-attachments" on storage.objects;
  create policy "Authenticated write deal-attachments" on storage.objects for insert to authenticated with check (bucket_id = 'deal-attachments');
  drop policy if exists "Authenticated delete deal-attachments" on storage.objects;
  create policy "Authenticated delete deal-attachments" on storage.objects for delete to authenticated using (bucket_id = 'deal-attachments');
  drop policy if exists "Service role manage deal-attachments" on storage.objects;
  create policy "Service role manage deal-attachments" on storage.objects for all to service_role using (bucket_id = 'deal-attachments') with check (bucket_id = 'deal-attachments');

  drop policy if exists "Authenticated read contact-documents" on storage.objects;
  create policy "Authenticated read contact-documents" on storage.objects for select to authenticated using (bucket_id = 'contact-documents');
  drop policy if exists "Authenticated write contact-documents" on storage.objects;
  create policy "Authenticated write contact-documents" on storage.objects for insert to authenticated with check (bucket_id = 'contact-documents');
  drop policy if exists "Authenticated delete contact-documents" on storage.objects;
  create policy "Authenticated delete contact-documents" on storage.objects for delete to authenticated using (bucket_id = 'contact-documents');
  drop policy if exists "Service role manage contact-documents" on storage.objects;
  create policy "Service role manage contact-documents" on storage.objects for all to service_role using (bucket_id = 'contact-documents') with check (bucket_id = 'contact-documents');
end
$s$;
