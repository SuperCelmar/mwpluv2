-- Migration: Add INSEE code to cities table and RLS policies for shared tables
-- Fix for cities database connection issue where INSEE codes are used as unique identifiers
-- Part of the foundation tables shared by v1 and v2

-- Add insee_code column to cities table with unique constraint
ALTER TABLE cities ADD COLUMN IF NOT EXISTS insee_code VARCHAR;

-- Add unique constraint on insee_code to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_insee_code ON cities(insee_code) WHERE insee_code IS NOT NULL;

-- Add regular index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cities_insee_code_lookup ON cities(insee_code);

-- Enable Row Level Security for shared reference tables
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE zonings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read cities (reference data)
CREATE POLICY "Anyone can view cities"
  ON cities FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert cities
CREATE POLICY "Authenticated users can create cities"
  ON cities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Everyone can read zonings (reference data)
CREATE POLICY "Anyone can view zonings"
  ON zonings FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert zonings
CREATE POLICY "Authenticated users can create zonings"
  ON zonings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Everyone can read zones (reference data)
CREATE POLICY "Anyone can view zones"
  ON zones FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert zones
CREATE POLICY "Authenticated users can create zones"
  ON zones FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON COLUMN cities.insee_code IS 'INSEE code (e.g., "38185") - unique identifier for French communes, nullable for existing cities without INSEE codes';
COMMENT ON TABLE cities IS 'Shared reference table: Cities are publicly readable, authenticated users can create cities when needed';
COMMENT ON TABLE zonings IS 'Shared reference table: Zonings are publicly readable, authenticated users can create zonings when needed';
COMMENT ON TABLE zones IS 'Shared reference table: Zones are publicly readable, authenticated users can create zones when needed';

