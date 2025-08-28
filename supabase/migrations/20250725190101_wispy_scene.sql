/*
  # Create Storage Bucket for Images
  
  1. Storage Setup
    - Create `deal-images` bucket for storing uploaded images
    - Set up proper permissions for authenticated users
    
  2. Security
    - Enable RLS on storage bucket
    - Add policies for upload and read access
*/

-- Create the storage bucket for deal images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deal-images',
  'deal-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to upload images
CREATE POLICY "Authenticated users can upload images" ON storage.objects
FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'deal-images' AND 
  auth.role() = 'authenticated'
);

-- Policy for public read access to images
CREATE POLICY "Public read access for images" ON storage.objects
FOR SELECT 
TO public 
USING (bucket_id = 'deal-images');

-- Policy for authenticated users to update their own images
CREATE POLICY "Users can update images" ON storage.objects
FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'deal-images' AND 
  auth.role() = 'authenticated'
);

-- Policy for authenticated users to delete images
CREATE POLICY "Users can delete images" ON storage.objects
FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'deal-images' AND 
  auth.role() = 'authenticated'
);