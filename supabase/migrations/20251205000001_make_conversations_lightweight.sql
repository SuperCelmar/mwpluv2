-- Migration: Make v2_conversations lightweight for instant creation
-- Allows conversations to be created without projects/enrichment upfront
-- Enrichment happens in background on chat page

-- Step 1: Make project_id nullable in v2_conversations
ALTER TABLE v2_conversations
ALTER COLUMN project_id DROP NOT NULL;

-- Update foreign key constraint to allow NULL (ON DELETE SET NULL instead of CASCADE)
ALTER TABLE v2_conversations
DROP CONSTRAINT IF EXISTS v2_conversations_project_id_fkey;

ALTER TABLE v2_conversations
ADD CONSTRAINT v2_conversations_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES v2_projects(id) ON DELETE SET NULL;

-- Step 2: Add enrichment_status field
ALTER TABLE v2_conversations
ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending' 
CHECK (enrichment_status IN ('pending', 'in_progress', 'completed', 'failed'));

-- Index for enrichment status queries
CREATE INDEX IF NOT EXISTS idx_v2_conv_enrichment ON v2_conversations(user_id, enrichment_status) 
WHERE enrichment_status IN ('pending', 'in_progress');

-- Comments
COMMENT ON COLUMN v2_conversations.project_id IS 
'Optional reference to v2_projects - created during enrichment phase, NULL for lightweight conversations';
COMMENT ON COLUMN v2_conversations.enrichment_status IS 
'Tracks background enrichment state: pending (not started), in_progress (running), completed (success), failed (error)';

