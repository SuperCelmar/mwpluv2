-- Migration: Expose analytics schema to PostgREST API
-- This allows the Supabase client to query analytics tables via REST API
-- PostgREST will search exposed schemas in order to find tables

-- Grant usage on analytics schema to anon and authenticated roles
GRANT USAGE ON SCHEMA analytics TO anon, authenticated;

-- Grant select on analytics tables to anon and authenticated roles
-- Users can only see their own data via RLS policies
GRANT SELECT ON analytics.user_monthly_usage TO anon, authenticated;
GRANT SELECT ON analytics.chat_events TO anon, authenticated;

-- Grant insert on chat_events (for logging events)
GRANT INSERT ON analytics.chat_events TO anon, authenticated;

-- Create RLS policy to allow authenticated users to insert their own chat events
-- (Service role policy already exists, this adds authenticated user support)
-- Drop policy if it exists first to avoid errors
DROP POLICY IF EXISTS "Authenticated users can insert own chat events" ON analytics.chat_events;

CREATE POLICY "Authenticated users can insert own chat events"
  ON analytics.chat_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Configure PostgREST to expose analytics schema
-- This tells PostgREST to search the analytics schema when resolving table names
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, analytics';

-- Reload PostgREST configuration to apply changes
NOTIFY pgrst, 'reload config';

-- Note: The analytics schema must also be added to the PostgREST config
-- In production: Dashboard > Settings > API > Exposed schemas > Add "analytics"
-- In local dev: Add "analytics" to schemas array in supabase/config.toml

