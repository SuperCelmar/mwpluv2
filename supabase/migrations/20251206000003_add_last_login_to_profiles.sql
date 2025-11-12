-- Migration: Add last_login_at column to profiles table
-- Tracks when user last logged in for display on Profile page

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON profiles(last_login_at DESC);

-- Comment for documentation
COMMENT ON COLUMN profiles.last_login_at IS 'Timestamp of user last login, updated on successful authentication';

