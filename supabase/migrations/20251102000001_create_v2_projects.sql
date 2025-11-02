-- Migration: Create v2_projects table
-- This table stores user projects with status tracking, PLU alerts, and metadata
-- Part of the non-destructive v2 architecture alongside v1 tables

CREATE TABLE IF NOT EXISTS v2_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User-editable info
  name TEXT,  -- NULL = "Sans nom" in UI
  description TEXT,
  project_type TEXT CHECK (project_type IN (
    'construction', 'extension', 'renovation', 
    'amenagement', 'lotissement', 'other'
  )),
  
  -- Auto-calculated info (informational, editable)
  main_address TEXT,
  main_city_id UUID REFERENCES cities(id),  -- Shared with v1
  main_zone_id UUID REFERENCES zones(id),   -- Shared with v1
  geo_lon DECIMAL(10, 7),
  geo_lat DECIMAL(10, 7),
  
  -- UI metadata
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT '📁',
  starred BOOLEAN DEFAULT false,
  position INTEGER,
  
  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Auto-created, not yet edited
    'active',     -- User edited/using
    'completed',  -- Marked as completed
    'archived'    -- Archived
  )),
  
  -- PLU alerts
  plu_alert_enabled BOOLEAN DEFAULT false,
  plu_last_check_at TIMESTAMP,
  plu_check_frequency TEXT DEFAULT 'monthly' CHECK (
    plu_check_frequency IN ('daily', 'weekly', 'monthly')
  ),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  first_edited_at TIMESTAMP,  -- When user first edited the project
  
  -- Flexible metadata
  metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_v2_projects_user ON v2_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_projects_status ON v2_projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_v2_projects_starred ON v2_projects(user_id, starred) 
  WHERE starred = true;
CREATE INDEX IF NOT EXISTS idx_v2_projects_active ON v2_projects(user_id) 
  WHERE status IN ('draft', 'active');

-- Row Level Security
ALTER TABLE v2_projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own projects
CREATE POLICY "Users can view own projects"
  ON v2_projects FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own projects
CREATE POLICY "Users can create own projects"
  ON v2_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON v2_projects FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON v2_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Admins can view all projects
CREATE POLICY "Admins can view all projects"
  ON v2_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comments for documentation
COMMENT ON TABLE v2_projects IS 'V2 Projects table - stores user project organization. Non-destructive alongside v1 tables.';
COMMENT ON COLUMN v2_projects.status IS 'Project lifecycle: draft (auto-created), active (user edited), completed, archived';
COMMENT ON COLUMN v2_projects.plu_alert_enabled IS 'Enable automatic PLU change notifications for this project';
COMMENT ON COLUMN v2_projects.main_city_id IS 'Reference to cities table (shared with v1) - informational only';
COMMENT ON COLUMN v2_projects.main_zone_id IS 'Reference to zones table (shared with v1) - informational only';

