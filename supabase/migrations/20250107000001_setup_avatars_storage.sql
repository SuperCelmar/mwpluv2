-- Migration: Setup avatars storage bucket and RLS policies
-- Note: The 'avatars' storage bucket must be created manually in Supabase Dashboard
-- Storage > Buckets > New Bucket > Name: 'avatars', Public: true

-- Storage RLS Policies for avatars bucket
-- These policies control access to files in the 'avatars' storage bucket

-- Policy: Users can upload their own avatars
-- Users can only upload files that start with their user ID
-- File naming pattern: {userId}-{timestamp}.{ext}
-- The name field contains the full path, so we extract the filename
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  split_part(split_part(name, '/', -1), '-', 1) = auth.uid()::text
);

-- Policy: Users can update their own avatars
-- Users can only update files that start with their user ID
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  split_part(split_part(name, '/', -1), '-', 1) = auth.uid()::text
);

-- Policy: Users can delete their own avatars
-- Users can only delete files that start with their user ID
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  split_part(split_part(name, '/', -1), '-', 1) = auth.uid()::text
);

-- Policy: Anyone can view avatars (public bucket)
-- Since avatars are public, anyone can read them
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Comments for documentation
COMMENT ON POLICY "Users can upload own avatars" ON storage.objects IS 
  'Allows users to upload avatar images to the avatars bucket. Files must be named with user ID prefix.';
COMMENT ON POLICY "Users can update own avatars" ON storage.objects IS 
  'Allows users to update their own avatar images in the avatars bucket.';
COMMENT ON POLICY "Users can delete own avatars" ON storage.objects IS 
  'Allows users to delete their own avatar images from the avatars bucket.';
COMMENT ON POLICY "Anyone can view avatars" ON storage.objects IS 
  'Allows public read access to avatar images in the avatars bucket.';

