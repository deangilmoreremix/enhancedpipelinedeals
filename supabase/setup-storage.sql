-- =====================================================
-- SUPABASE STORAGE SETUP
-- Run this to create storage buckets
-- =====================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, '5MB', ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  ('deal-images', 'deal-images', true, '10MB', ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  ('voice-messages', 'voice-messages', true, '10MB', ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3']),
  ('video-messages', 'video-messages', true, '100MB', ARRAY['video/mp4', 'video/webm', 'video/quicktime']),
  ('documents', 'documents', true, '25MB', ARRAY['application/pdf', 'text/csv', 'application/vnd.ms-excel'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Avatar policies
CREATE POLICY "Avatar upload for authenticated" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Avatar public read" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Avatar owner delete" ON storage.objects
FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Deal images policies
CREATE POLICY "Deal images upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'deal-images' AND auth.role() = 'authenticated');

CREATE POLICY "Deal images public read" ON storage.objects
FOR SELECT USING (bucket_id = 'deal-images');

CREATE POLICY "Deal images owner delete" ON storage.objects
FOR DELETE USING (bucket_id = 'deal-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Voice messages policies
CREATE POLICY "Voice upload for authenticated" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'voice-messages' AND auth.role() = 'authenticated');

CREATE POLICY "Voice public read" ON storage.objects
FOR SELECT USING (bucket_id = 'voice-messages');

CREATE POLICY "Voice owner delete" ON storage.objects
FOR DELETE USING (bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Video messages policies
CREATE POLICY "Video upload for authenticated" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'video-messages' AND auth.role() = 'authenticated');

CREATE POLICY "Video public read" ON storage.objects
FOR SELECT USING (bucket_id = 'video-messages');

CREATE POLICY "Video owner delete" ON storage.objects
FOR DELETE USING (bucket_id = 'video-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Documents policies
CREATE POLICY "Documents upload for authenticated" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Documents public read" ON storage.objects
FOR SELECT USING (bucket_id = 'documents');

CREATE POLICY "Documents owner delete" ON storage.objects
FOR DELETE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- STORAGE SETUP COMPLETE!
-- =====================================================
