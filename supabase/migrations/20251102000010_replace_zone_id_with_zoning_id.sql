-- Migration: Replace zone_id with zoning_id in v2_research_history table
-- Zoning ID is more precise than zone ID for duplicate detection since zones belong to zonings
-- Part of the v2 architecture

-- Drop the zone_id column
ALTER TABLE v2_research_history DROP COLUMN IF EXISTS zone_id;

-- Add zoning_id column with foreign key to zonings table
ALTER TABLE v2_research_history 
  ADD COLUMN zoning_id UUID REFERENCES zonings(id) ON DELETE SET NULL;

-- Add index on zoning_id for performance (used in duplicate detection queries)
CREATE INDEX IF NOT EXISTS idx_v2_research_zoning ON v2_research_history(zoning_id);

-- Update comment
COMMENT ON COLUMN v2_research_history.zoning_id IS 'Reference to zonings table (shared with v1) - used for duplicate detection';

