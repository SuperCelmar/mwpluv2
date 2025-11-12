-- Migration: Add RLS policies for profiles table
-- Ensures users can only view and update their own profiles
-- Admins can view all profiles

-- Enable Row Level Security on profiles table (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
-- Allows users to update their own profile fields including avatar_url
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: System can insert profiles (via trigger or admin)
-- This is typically handled by a trigger when a user signs up
-- But we allow authenticated users to create their own profile if needed
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Policy: Admins can update all profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comments for documentation
COMMENT ON POLICY "Users can view own profile" ON profiles IS 
  'Allows users to read their own profile data';
COMMENT ON POLICY "Users can update own profile" ON profiles IS 
  'Allows users to update their own profile fields including avatar_url, pseudo, first_name, last_name, phone';
COMMENT ON POLICY "Users can create own profile" ON profiles IS 
  'Allows users to create their own profile record (typically handled by trigger on user signup)';
COMMENT ON POLICY "Admins can view all profiles" ON profiles IS 
  'Allows admin users to view all user profiles';
COMMENT ON POLICY "Admins can update all profiles" ON profiles IS 
  'Allows admin users to update any user profile';

