/*
  # Storage Security Policies for Production

  This migration implements comprehensive security policies for Supabase Storage
  to ensure secure file uploads and access control.

  ## Security Features:
  - Row Level Security (RLS) on storage.objects
  - Bucket-specific access policies
  - User-based file ownership
  - Public access for images with proper validation
  - Private access for sensitive documents
*/

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DEAL IMAGES BUCKET (Public - for web display)
-- =====================================================

-- Allow authenticated users to upload to deal-images bucket
CREATE POLICY "Users can upload deal images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'deal-images'
  AND (storage.foldername(name))[1] IN ('deals', 'contacts', 'avatars')
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow public read access to deal images (for web display)
CREATE POLICY "Public can view deal images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'deal-images');

-- Users can delete their own uploaded images
CREATE POLICY "Users can delete their own deal images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'deal-images'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- =====================================================
-- CONTACT AVATARS BUCKET (Public - for profile display)
-- =====================================================

-- Allow authenticated users to upload contact avatars
CREATE POLICY "Users can upload contact avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contact-avatars'
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow public read access to contact avatars
CREATE POLICY "Public can view contact avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'contact-avatars');

-- Users can delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'contact-avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- =====================================================
-- DEAL ATTACHMENTS BUCKET (Private - sensitive documents)
-- =====================================================

-- Only authenticated users can upload deal attachments
CREATE POLICY "Users can upload deal attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'deal-attachments'
  AND (storage.foldername(name))[1] = 'deals'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Only authenticated users can view deal attachments
CREATE POLICY "Users can view deal attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'deal-attachments'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Users can delete their own deal attachments
CREATE POLICY "Users can delete their own deal attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'deal-attachments'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- =====================================================
-- CONTACT DOCUMENTS BUCKET (Private - sensitive documents)
-- =====================================================

-- Only authenticated users can upload contact documents
CREATE POLICY "Users can upload contact documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contact-documents'
  AND (storage.foldername(name))[1] = 'contacts'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Only authenticated users can view contact documents
CREATE POLICY "Users can view contact documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contact-documents'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Users can delete their own contact documents
CREATE POLICY "Users can delete their own contact documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'contact-documents'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- =====================================================
-- STORAGE USAGE TRACKING
-- =====================================================

-- Create a function to track storage usage per user
CREATE OR REPLACE FUNCTION track_storage_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update storage usage record
  INSERT INTO storage_usage (user_id, bucket_name, file_count, total_size, last_updated)
  VALUES (
    CASE
      WHEN TG_OP = 'INSERT' THEN auth.uid()
      ELSE (SELECT user_id FROM storage_usage WHERE user_id = auth.uid() AND bucket_name = NEW.bucket_id)
    END,
    NEW.bucket_id,
    1,
    NEW.metadata->>'size',
    now()
  )
  ON CONFLICT (user_id, bucket_name)
  DO UPDATE SET
    file_count = storage_usage.file_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE 0 END,
    total_size = storage_usage.total_size + (NEW.metadata->>'size')::bigint,
    last_updated = now();

  -- For DELETE operations, decrement counters
  IF TG_OP = 'DELETE' THEN
    UPDATE storage_usage
    SET
      file_count = GREATEST(file_count - 1, 0),
      total_size = GREATEST(total_size - (OLD.metadata->>'size')::bigint, 0),
      last_updated = now()
    WHERE user_id = auth.uid() AND bucket_name = OLD.bucket_id;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for storage usage tracking
DROP TRIGGER IF EXISTS track_deal_images_usage ON storage.objects;
CREATE TRIGGER track_deal_images_usage
  AFTER INSERT OR DELETE ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'deal-images' OR OLD.bucket_id = 'deal-images')
  EXECUTE FUNCTION track_storage_usage();

DROP TRIGGER IF EXISTS track_contact_avatars_usage ON storage.objects;
CREATE TRIGGER track_contact_avatars_usage
  AFTER INSERT OR DELETE ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'contact-avatars' OR OLD.bucket_id = 'contact-avatars')
  EXECUTE FUNCTION track_storage_usage();

DROP TRIGGER IF EXISTS track_deal_attachments_usage ON storage.objects;
CREATE TRIGGER track_deal_attachments_usage
  AFTER INSERT OR DELETE ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'deal-attachments' OR OLD.bucket_id = 'deal-attachments')
  EXECUTE FUNCTION track_storage_usage();

DROP TRIGGER IF EXISTS track_contact_documents_usage ON storage.objects;
CREATE TRIGGER track_contact_documents_usage
  AFTER INSERT OR DELETE ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'contact-documents' OR OLD.bucket_id = 'contact-documents')
  EXECUTE FUNCTION track_storage_usage();

-- =====================================================
-- CORS CONFIGURATION
-- =====================================================

-- Note: CORS headers should be configured in the Supabase dashboard or via API
-- For production deployments, ensure the following origins are allowed:
-- - Your production domain
-- - localhost:5173 (for development)
-- - Any staging domains

-- =====================================================
-- FILE TYPE VALIDATION
-- =====================================================

-- Create a function to validate file types before storage
CREATE OR REPLACE FUNCTION validate_file_type()
RETURNS TRIGGER AS $$
DECLARE
  allowed_types text[];
  file_ext text;
BEGIN
  -- Get file extension
  file_ext := lower(substring(NEW.name from '\.([^\.]+)$'));

  -- Define allowed types per bucket
  CASE NEW.bucket_id
    WHEN 'deal-images' THEN
      allowed_types := ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif'];
    WHEN 'contact-avatars' THEN
      allowed_types := ARRAY['jpg', 'jpeg', 'png', 'webp'];
    WHEN 'deal-attachments' THEN
      allowed_types := ARRAY['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'];
    WHEN 'contact-documents' THEN
      allowed_types := ARRAY['pdf', 'doc', 'docx', 'txt'];
    ELSE
      RAISE EXCEPTION 'Unknown bucket: %', NEW.bucket_id;
  END CASE;

  -- Check if file extension is allowed
  IF file_ext IS NULL OR NOT (file_ext = ANY(allowed_types)) THEN
    RAISE EXCEPTION 'File type not allowed for bucket %. Allowed types: %', NEW.bucket_id, array_to_string(allowed_types, ', ');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create validation triggers
DROP TRIGGER IF EXISTS validate_deal_images_type ON storage.objects;
CREATE TRIGGER validate_deal_images_type
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'deal-images')
  EXECUTE FUNCTION validate_file_type();

DROP TRIGGER IF EXISTS validate_contact_avatars_type ON storage.objects;
CREATE TRIGGER validate_contact_avatars_type
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'contact-avatars')
  EXECUTE FUNCTION validate_file_type();

DROP TRIGGER IF EXISTS validate_deal_attachments_type ON storage.objects;
CREATE TRIGGER validate_deal_attachments_type
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'deal-attachments')
  EXECUTE FUNCTION validate_file_type();

DROP TRIGGER IF EXISTS validate_contact_documents_type ON storage.objects;
CREATE TRIGGER validate_contact_documents_type
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'contact-documents')
  EXECUTE FUNCTION validate_file_type();

-- =====================================================
-- CLEANUP POLICIES
-- =====================================================

-- Function to clean up orphaned storage usage records
CREATE OR REPLACE FUNCTION cleanup_storage_usage()
RETURNS void AS $$
BEGIN
  -- Remove records where users no longer exist
  DELETE FROM storage_usage
  WHERE user_id NOT IN (SELECT id FROM auth.users);

  -- Recalculate storage usage for all users (run periodically)
  -- This is a maintenance function that can be called via cron or manually
  UPDATE storage_usage
  SET
    file_count = (
      SELECT COUNT(*)
      FROM storage.objects
      WHERE bucket_id = storage_usage.bucket_name
      AND (storage.foldername(name))[2] = storage_usage.user_id::text
    ),
    total_size = (
      SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
      FROM storage.objects
      WHERE bucket_id = storage_usage.bucket_name
      AND (storage.foldername(name))[2] = storage_usage.user_id::text
    ),
    last_updated = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===============================================';
  RAISE NOTICE '  STORAGE SECURITY POLICIES IMPLEMENTED';
  RAISE NOTICE '===============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS enabled on storage.objects';
  RAISE NOTICE '✅ Bucket-specific access policies created';
  RAISE NOTICE '✅ User-based file ownership enforced';
  RAISE NOTICE '✅ Public access for images, private for documents';
  RAISE NOTICE '✅ Storage usage tracking implemented';
  RAISE NOTICE '✅ File type validation added';
  RAISE NOTICE '✅ Automatic cleanup functions created';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next Steps:';
  RAISE NOTICE '  1. Configure CORS in Supabase Dashboard';
  RAISE NOTICE '  2. Set up monitoring for storage usage';
  RAISE NOTICE '  3. Test file uploads with different user roles';
  RAISE NOTICE '';
  RAISE NOTICE '===============================================';
END $$;