-- Migration: Add code column to zonings table
-- This allows mapping typezone from Carto API directly to zonings.code
-- Part of fixing the document query mapping logic

-- Add code column to zonings table
ALTER TABLE zonings 
  ADD COLUMN IF NOT EXISTS code VARCHAR(10);

-- Create index on code column for performance
CREATE INDEX IF NOT EXISTS idx_zonings_code ON zonings(code);

-- Update existing zonings to populate code based on name
UPDATE zonings 
SET code = 'U' 
WHERE name = 'Zones Urbaines' AND code IS NULL;

UPDATE zonings 
SET code = 'AU' 
WHERE name = 'Zones À Urbaniser' AND code IS NULL;

UPDATE zonings 
SET code = 'N' 
WHERE name = 'Zones Naturelles et Forestières' AND code IS NULL;

UPDATE zonings 
SET code = 'A' 
WHERE name = 'Zones Agricoles' AND code IS NULL;

-- Also handle RNU case
UPDATE zonings 
SET code = 'RNU' 
WHERE name = 'RNU' AND code IS NULL;

-- Add comment
COMMENT ON COLUMN zonings.code IS 'Short code from Carto API typezone field (U, AU, N, A, etc.) - used for direct mapping from API response';

