-- Migration: Create v2_research_history table
-- Enhanced research history linking to v2 conversations, messages, and projects
-- Part of the non-destructive v2 architecture alongside v1 tables

CREATE TABLE IF NOT EXISTS v2_research_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contextual links (optional, SET NULL on delete)
  conversation_id UUID REFERENCES v2_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES v2_messages(id) ON DELETE SET NULL,
  project_id UUID REFERENCES v2_projects(id) ON DELETE SET NULL,
  
  -- Search input
  address_input TEXT NOT NULL,
  search_intent TEXT,
  
  -- Results
  geocoded_address TEXT,
  city_id UUID REFERENCES cities(id),      -- Shared with v1
  zone_id UUID REFERENCES zones(id),       -- Shared with v1
  geo_lon DECIMAL(10, 7),
  geo_lat DECIMAL(10, 7),
  
  documents_found UUID[],  -- Documents found for this address
  success BOOLEAN DEFAULT true,
  error_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_v2_research_user ON v2_research_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_v2_research_conversation ON v2_research_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_v2_research_project ON v2_research_history(project_id);

-- Row Level Security
ALTER TABLE v2_research_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own research history
CREATE POLICY "Users can view own research history"
  ON v2_research_history FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own research history
CREATE POLICY "Users can create own research history"
  ON v2_research_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all research history
CREATE POLICY "Admins can view all research history"
  ON v2_research_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comments for documentation
COMMENT ON TABLE v2_research_history IS 'V2 Research History table - enhanced with v2 conversation/project links. Non-destructive alongside v1 tables.';
COMMENT ON COLUMN v2_research_history.conversation_id IS 'Optional link to v2_conversations - SET NULL if conversation deleted';
COMMENT ON COLUMN v2_research_history.project_id IS 'Optional link to v2_projects - SET NULL if project deleted';
COMMENT ON COLUMN v2_research_history.documents_found IS 'Array of document UUIDs found during address search';
COMMENT ON COLUMN v2_research_history.city_id IS 'Reference to cities table (shared with v1)';
COMMENT ON COLUMN v2_research_history.zone_id IS 'Reference to zones table (shared with v1)';

