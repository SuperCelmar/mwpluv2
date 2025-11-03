-- Migration: Add geometry column to zones table for storing multipolygon data from Carto API
-- This enables map display with highlighted zones without repeated API calls
-- Part of the map artifact implementation

-- Add geometry column as JSONB to store GeoJSON multipolygon data
ALTER TABLE zones ADD COLUMN IF NOT EXISTS geometry JSONB;

-- Add GIN index on geometry column for efficient queries
CREATE INDEX IF NOT EXISTS idx_zones_geometry ON zones USING GIN (geometry);

-- Add index for spatial queries (if using PostGIS in the future)
-- CREATE INDEX idx_zones_geometry_spatial ON zones USING GIST (geometry);

-- Comments for documentation
COMMENT ON COLUMN zones.geometry IS 'GeoJSON multipolygon geometry from Carto API - used for map visualization with highlighted zones';
COMMENT ON TABLE zones IS 'Shared table: PLU zones within zonings - now includes geometry for map display';


