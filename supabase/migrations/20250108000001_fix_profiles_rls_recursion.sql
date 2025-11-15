-- Migration: Fix infinite recursion in profiles RLS policies
-- The admin policies were querying the profiles table, causing infinite recursion
-- Solution: Create a SECURITY DEFINER function that bypasses RLS to check admin status

-- Create a helper function to check if the current user is an admin
-- This function uses SECURITY DEFINER to bypass RLS when checking admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION public.is_admin() IS 
  'Checks if the current authenticated user is an admin. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- Drop and recreate the admin policies to use the helper function
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (public.is_admin());

-- Comments for documentation
COMMENT ON POLICY "Admins can view all profiles" ON profiles IS 
  'Allows admin users to view all user profiles. Uses is_admin() function to prevent infinite recursion.';
COMMENT ON POLICY "Admins can update all profiles" ON profiles IS 
  'Allows admin users to update any user profile. Uses is_admin() function to prevent infinite recursion.';





