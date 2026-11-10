-- Storage buckets (ai-images, ai-audio, deal-images) and pgvector semantic search
-- (contact_embeddings + match_contacts RPC). Idempotent.

-- ---------------------------------------------------------------------------
-- Storage buckets (public read; writes via service role, deal-images also authenticated)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('ai-images', 'ai-images', true, 10485760, array['image/png','image/jpeg','image/webp']),
  ('ai-audio', 'ai-audio', true, 26214400, array['audio/mpeg']),
  ('deal-images', 'deal-images', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "Public read ai-images" on storage.objects;
create policy "Public read ai-images" on storage.objects for select to anon, authenticated using (bucket_id = 'ai-images');
drop policy if exists "Service role manage ai-images" on storage.objects;
create policy "Service role manage ai-images" on storage.objects for all to service_role using (bucket_id = 'ai-images') with check (bucket_id = 'ai-images');

drop policy if exists "Public read ai-audio" on storage.objects;
create policy "Public read ai-audio" on storage.objects for select to anon, authenticated using (bucket_id = 'ai-audio');
drop policy if exists "Service role manage ai-audio" on storage.objects;
create policy "Service role manage ai-audio" on storage.objects for all to service_role using (bucket_id = 'ai-audio') with check (bucket_id = 'ai-audio');

drop policy if exists "Public read deal-images" on storage.objects;
create policy "Public read deal-images" on storage.objects for select to anon, authenticated using (bucket_id = 'deal-images');
drop policy if exists "Authenticated write deal-images" on storage.objects;
create policy "Authenticated write deal-images" on storage.objects for insert to authenticated with check (bucket_id = 'deal-images');
drop policy if exists "Authenticated update deal-images" on storage.objects;
create policy "Authenticated update deal-images" on storage.objects for update to authenticated using (bucket_id = 'deal-images') with check (bucket_id = 'deal-images');
drop policy if exists "Authenticated delete deal-images" on storage.objects;
create policy "Authenticated delete deal-images" on storage.objects for delete to authenticated using (bucket_id = 'deal-images');
drop policy if exists "Service role manage deal-images" on storage.objects;
create policy "Service role manage deal-images" on storage.objects for all to service_role using (bucket_id = 'deal-images') with check (bucket_id = 'deal-images');

-- ---------------------------------------------------------------------------
-- Semantic search
-- ---------------------------------------------------------------------------
create extension if not exists vector;

create table if not exists public.contact_embeddings (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  content text,
  embedding vector(1536),
  model text,
  updated_at timestamptz default now()
);

create index if not exists idx_contact_embeddings_embedding
  on public.contact_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.contact_embeddings enable row level security;
drop policy if exists "Allow authenticated access" on public.contact_embeddings;
create policy "Allow authenticated access" on public.contact_embeddings for all to authenticated using (true) with check (true);
drop policy if exists "Allow service role full access" on public.contact_embeddings;
create policy "Allow service role full access" on public.contact_embeddings for all to service_role using (true) with check (true);

create or replace function public.match_contacts(
  query_embedding vector(1536),
  match_count int default 10,
  min_similarity float default 0.0
)
returns table (contact_id uuid, content text, similarity float)
language sql stable
as $$
  select ce.contact_id, ce.content, (1 - (ce.embedding <=> query_embedding))::float as similarity
  from public.contact_embeddings ce
  where ce.embedding is not null
    and (1 - (ce.embedding <=> query_embedding)) >= min_similarity
  order by ce.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_contacts(vector, int, float) from public, anon;
grant execute on function public.match_contacts(vector, int, float) to authenticated, service_role;
