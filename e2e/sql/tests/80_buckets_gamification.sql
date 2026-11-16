\set QUIET on
-- 20260811000007: buckets the client uploads to + authenticated reads of the gamification catalogue
begin;
select e2e.ok('contact-avatars bucket exists and is public', exists(select 1 from storage.buckets where id='contact-avatars' and public));
select e2e.ok('deal-attachments bucket exists and is private', exists(select 1 from storage.buckets where id='deal-attachments' and not public));
select e2e.ok('contact-documents bucket exists and is private', exists(select 1 from storage.buckets where id='contact-documents' and not public));
select e2e.ok('authenticated can write deal-attachments (policy)', exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated write deal-attachments'));
select e2e.ok('anon has no read on deal-attachments', not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated read deal-attachments' and 'anon' = any(roles)));
select e2e.ok('achievements readable by authenticated', exists(select 1 from pg_policies where tablename='achievements' and cmd='SELECT' and 'authenticated' = any(roles)));
select e2e.ok('challenges readable by authenticated', exists(select 1 from pg_policies where tablename='challenges' and cmd='SELECT' and 'authenticated' = any(roles)));
rollback;
