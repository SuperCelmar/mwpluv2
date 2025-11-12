-- Migration: Fix avatars storage bucket RLS policies
-- This migration adds RLS policies for the avatars bucket to allow users to upload their own avatars
-- The avatars bucket must exist (created manually in Supabase Dashboard)
-- Storage > Buckets > Name: 'avatars', Public: true

-- Policy: Users can upload their own avatars
-- Users can only upload files that start with their user ID
-- File naming pattern: {userId}-{timestamp}.{ext}
-- User IDs are UUIDs (e.g., "131e8334-6605-4e36-86cd-8cf51e1ef017") which contain hyphens
-- We check if filename STARTS WITH the user ID, not extract a segment
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid() IS NOT NULL AND
  -- Check if filename starts with user ID followed by a hyphen
  -- This correctly handles UUIDs which contain hyphens
  split_part(name, '/', -1) LIKE (auth.uid()::text || '-%')
);

-- Policy: Users can update their own avatars
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid() IS NOT NULL AND
  split_part(name, '/', -1) LIKE (auth.uid()::text || '-%')
)
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid() IS NOT NULL AND
  split_part(name, '/', -1) LIKE (auth.uid()::text || '-%')
);

-- Policy: Users can delete their own avatars
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid() IS NOT NULL AND
  split_part(name, '/', -1) LIKE (auth.uid()::text || '-%')
);

-- Policy: Anyone can view avatars (public bucket)
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Comments for documentation
COMMENT ON POLICY "Users can upload own avatars" ON storage.objects IS 
  'Allows authenticated users to upload avatar images. Filenames must start with user ID (UUID) followed by hyphen (e.g., {uuid}-{timestamp}.{ext}).';
COMMENT ON POLICY "Users can update own avatars" ON storage.objects IS 
  'Allows users to update their own avatar images in the avatars bucket.';
COMMENT ON POLICY "Users can delete own avatars" ON storage.objects IS 
  'Allows users to delete their own avatar images from the avatars bucket.';
COMMENT ON POLICY "Anyone can view avatars" ON storage.objects IS 
  'Allows public read access to avatar images in the avatars bucket.';

