-- Migration: Create v2_messages table
-- This table stores enhanced messages with array references and AI metadata
-- Part of the non-destructive v2 architecture alongside v1 tables

CREATE TABLE IF NOT EXISTS v2_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES v2_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  
  -- Message type
  message_type TEXT CHECK (message_type IN (
    'text',              -- Standard text message
    'address_search',    -- Address search message
    'document_summary',  -- Document summary
    'comparison',        -- Zone comparison
    'clarification'      -- AI clarification question
  )),
  
  -- Referenced entities (arrays for flexibility)
  referenced_documents UUID[],  -- Documents cited in this message
  referenced_zones UUID[],      -- Zones mentioned
  referenced_cities UUID[],     -- Cities mentioned
  
  -- Search context (if applicable)
  search_context JSONB,
  
  -- AI metadata
  intent_detected TEXT,  -- 'address_lookup', 'rule_check', 'comparison', etc.
  confidence_score DECIMAL(3,2),
  ai_model_used TEXT,
  
  -- Threading
  conversation_turn INTEGER,
  reply_to_message_id UUID REFERENCES v2_messages(id),
  
  -- Additional metadata
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_v2_msg_conversation ON v2_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_v2_msg_user ON v2_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_msg_documents ON v2_messages USING GIN(referenced_documents);
CREATE INDEX IF NOT EXISTS idx_v2_msg_turn ON v2_messages(conversation_id, conversation_turn);

-- Row Level Security
ALTER TABLE v2_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own messages
CREATE POLICY "Users can view own messages"
  ON v2_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create messages in their own conversations
CREATE POLICY "Users can create own messages"
  ON v2_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own messages
CREATE POLICY "Users can update own messages"
  ON v2_messages FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages"
  ON v2_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Admins can view all messages
CREATE POLICY "Admins can view all messages"
  ON v2_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comments for documentation
COMMENT ON TABLE v2_messages IS 'V2 Messages table - enhanced messages with AI metadata and array references. Non-destructive alongside v1 tables.';
COMMENT ON COLUMN v2_messages.referenced_documents IS 'Array of document UUIDs cited in this message - enables multi-document conversations';
COMMENT ON COLUMN v2_messages.search_context IS 'JSONB storing address search context: address_input, geocoded_address, coordinates, city, zone, documents_found';
COMMENT ON COLUMN v2_messages.intent_detected IS 'AI-detected intent classification for analytics';
COMMENT ON COLUMN v2_messages.confidence_score IS 'AI confidence score (0.00 to 1.00) for intent detection';

