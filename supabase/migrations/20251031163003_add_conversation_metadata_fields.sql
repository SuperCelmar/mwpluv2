/*
  # Add Conversation Metadata Fields

  1. Changes to projects table
    - Add `gps_coordinates` (jsonb) - Store GPS coordinates from address API
    - Add `insee_code` (text) - Store INSEE city code from address API
    - Add `document_loaded` (boolean) - Track if document artifact is loaded
    - Add `map_loaded` (boolean) - Track if map artifact is loaded
    - Add `artifacts_ready` (boolean) - Computed flag for UI to enable chat input
  
  2. Purpose
    - Support the new workflow where artifacts must load before chat is enabled
    - Store address metadata needed for N8N webhook calls
    - Track loading state of document and map artifacts
  
  3. Default Values
    - All artifact loading flags default to false
    - GPS coordinates and INSEE code are nullable
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'gps_coordinates'
  ) THEN
    ALTER TABLE projects ADD COLUMN gps_coordinates jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'insee_code'
  ) THEN
    ALTER TABLE projects ADD COLUMN insee_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'document_loaded'
  ) THEN
    ALTER TABLE projects ADD COLUMN document_loaded boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'map_loaded'
  ) THEN
    ALTER TABLE projects ADD COLUMN map_loaded boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'artifacts_ready'
  ) THEN
    ALTER TABLE projects ADD COLUMN artifacts_ready boolean DEFAULT false;
  END IF;
END $$;