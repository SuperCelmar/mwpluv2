-- Migration: Revert zoning_id back to zone_id in v2_research_history table
-- This reverts the change made in migration 20251102000010_replace_zone_id_with_zoning_id.sql
-- We need to store zones.id instead of zoning.id in v2_research_history

-- Drop the zoning_id column and its index
ALTER TABLE v2_research_history DROP COLUMN IF EXISTS zoning_id;
DROP INDEX IF EXISTS idx_v2_research_zoning;

-- Add back zone_id column with foreign key to zones table
ALTER TABLE v2_research_history 
  ADD COLUMN zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;

-- Add index on zone_id for performance
CREATE INDEX IF NOT EXISTS idx_v2_research_zone ON v2_research_history(zone_id);

-- Update comment
COMMENT ON COLUMN v2_research_history.zone_id IS 'Reference to zones table (shared with v1) - used for storing specific zone information';

