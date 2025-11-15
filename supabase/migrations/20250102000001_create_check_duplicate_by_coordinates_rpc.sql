-- Migration: Create RPC function for duplicate check by coordinates using PostGIS
-- This function uses ST_DWithin to find addresses within a specified distance (in meters)
-- Enables efficient duplicate detection before making expensive API calls
-- 
-- Usage:
-- SELECT * FROM check_duplicate_by_coordinates(
--   p_lon := 2.3522,
--   p_lat := 48.8566,
--   p_user_id := 'user-uuid',
--   p_distance_meters := 50
-- );

-- Ensure PostGIS extension is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the RPC function
CREATE OR REPLACE FUNCTION check_duplicate_by_coordinates(
  p_lon DECIMAL(10, 7),
  p_lat DECIMAL(10, 7),
  p_user_id UUID,
  p_distance_meters INTEGER DEFAULT 50
)
RETURNS TABLE (
  conversation_id UUID,
  distance_meters DECIMAL(10, 2),
  created_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rh.conversation_id,
    CAST(
      ST_Distance(
        geography(ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)),
        geography(ST_SetSRID(ST_MakePoint(rh.geo_lon, rh.geo_lat), 4326))
      ) AS DECIMAL(10, 2)
    ) AS distance_meters,
    rh.created_at
  FROM v2_research_history rh
  WHERE 
    rh.user_id = p_user_id
    AND rh.geo_lon IS NOT NULL
    AND rh.geo_lat IS NOT NULL
    AND rh.conversation_id IS NOT NULL
    AND ST_DWithin(
      geography(ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)),
      geography(ST_SetSRID(ST_MakePoint(rh.geo_lon, rh.geo_lat), 4326)),
      p_distance_meters
    )
  ORDER BY rh.created_at DESC
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_duplicate_by_coordinates TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION check_duplicate_by_coordinates IS 'Finds duplicate research history entries within specified distance using PostGIS ST_DWithin. Returns conversation_id if duplicate found. Parameters: p_lon (Longitude WGS84), p_lat (Latitude WGS84), p_user_id (User ID to filter), p_distance_meters (Distance threshold in meters, default: 50)';

