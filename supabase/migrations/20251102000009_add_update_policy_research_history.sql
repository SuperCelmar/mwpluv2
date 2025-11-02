-- Migration: Add UPDATE RLS policy for v2_research_history table
-- Fixes loophole where conversation_id and project_id were not being saved
-- Part of the v2 architecture

-- Policy: Users can update their own research history
CREATE POLICY "Users can update own research history"
  ON v2_research_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON POLICY "Users can update own research history" ON v2_research_history IS 'Allows authenticated users to update their own research history records, enabling conversation_id and project_id to be linked after initial creation';

