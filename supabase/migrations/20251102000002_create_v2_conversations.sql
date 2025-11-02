-- Migration: Create v2_conversations table
-- This table stores conversations that are always linked to a project
-- Part of the non-destructive v2 architecture alongside v1 tables

CREATE TABLE IF NOT EXISTS v2_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Always linked to a project
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  
  -- Conversation type
  conversation_type TEXT DEFAULT 'address_analysis' CHECK (
    conversation_type IN (
      'address_analysis',  -- Single address analysis
      'multi_zone',        -- Multiple zones comparison
      'general'            -- General discussion
    )
  ),
  
  -- Title (auto-generated or user-defined)
  title TEXT,
  
  -- Context metadata
  context_metadata JSONB,
  
  -- State
  is_active BOOLEAN DEFAULT true,
  archived_at TIMESTAMP,
  last_message_at TIMESTAMP DEFAULT NOW(),
  
  -- Denormalized stats (for performance)
  message_count INTEGER DEFAULT 0,
  document_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_v2_conv_user ON v2_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_conv_project ON v2_conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_v2_conv_active ON v2_conversations(user_id, is_active) 
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_v2_conv_last_message ON v2_conversations(user_id, last_message_at DESC);

-- Row Level Security
ALTER TABLE v2_conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own conversations
CREATE POLICY "Users can view own conversations"
  ON v2_conversations FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own conversations
CREATE POLICY "Users can create own conversations"
  ON v2_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON v2_conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
  ON v2_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Admins can view all conversations
CREATE POLICY "Admins can view all conversations"
  ON v2_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comments for documentation
COMMENT ON TABLE v2_conversations IS 'V2 Conversations table - always linked to a project. Non-destructive alongside v1 tables.';
COMMENT ON COLUMN v2_conversations.project_id IS 'Required reference to v2_projects - conversations cannot exist without a project';
COMMENT ON COLUMN v2_conversations.context_metadata IS 'JSONB storing context like initial_address, geocoded coordinates, city, zone, etc.';
COMMENT ON COLUMN v2_conversations.message_count IS 'Denormalized count of messages for performance';
COMMENT ON COLUMN v2_conversations.document_count IS 'Denormalized count of linked documents for performance';

