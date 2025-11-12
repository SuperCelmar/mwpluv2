-- Migration: Remove analytics views from public schema
-- These views were created as a workaround but are not needed since
-- the analytics schema is now properly exposed to PostgREST

-- Drop views if they exist
DROP VIEW IF EXISTS public.user_monthly_usage CASCADE;
DROP VIEW IF EXISTS public.chat_events CASCADE;

-- Note: The actual tables exist in analytics.user_monthly_usage and analytics.chat_events
-- PostgREST now searches the analytics schema directly via pgrst.db_schemas configuration

