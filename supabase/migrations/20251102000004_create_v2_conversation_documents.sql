-- Migration: Create v2_conversation_documents junction table
-- Many-to-many relationship between conversations and documents
-- Part of the non-destructive v2 architecture alongside v1 tables

CREATE TABLE IF NOT EXISTS v2_conversation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES v2_conversations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,  -- Shared with v1
  
  -- Addition context
  added_at TIMESTAMP DEFAULT NOW(),
  added_by TEXT DEFAULT 'user' CHECK (added_by IN (
    'user',           -- Manually added by user
    'ai_auto',        -- Auto-added by AI
    'ai_suggested',   -- AI suggested, user accepted
    'address_search', -- Added via address search
    'migration'       -- Migrated from v1
  )),
  
  -- Usage metadata
  relevance_score DECIMAL(3,2),  -- 0.00 to 1.00
  usage_count INTEGER DEFAULT 0,
  last_referenced_at TIMESTAMP,
  
  -- Trigger context
  trigger_context JSONB,
  
  -- Ensure one document per conversation (but can update metadata)
  UNIQUE(conversation_id, document_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_v2_conv_docs_conversation ON v2_conversation_documents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_v2_conv_docs_document ON v2_conversation_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_v2_conv_docs_relevance ON v2_conversation_documents(conversation_id, relevance_score DESC);

-- Row Level Security
ALTER TABLE v2_conversation_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view documents linked to their conversations
CREATE POLICY "Users can view own conversation documents"
  ON v2_conversation_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM v2_conversations
      WHERE v2_conversations.id = v2_conversation_documents.conversation_id
      AND v2_conversations.user_id = auth.uid()
    )
  );

-- Policy: Users can link documents to their conversations
CREATE POLICY "Users can link documents to conversations"
  ON v2_conversation_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_conversations
      WHERE v2_conversations.id = v2_conversation_documents.conversation_id
      AND v2_conversations.user_id = auth.uid()
    )
  );

-- Policy: Users can update document links in their conversations
CREATE POLICY "Users can update own conversation documents"
  ON v2_conversation_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM v2_conversations
      WHERE v2_conversations.id = v2_conversation_documents.conversation_id
      AND v2_conversations.user_id = auth.uid()
    )
  );

-- Policy: Users can remove document links from their conversations
CREATE POLICY "Users can remove documents from conversations"
  ON v2_conversation_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM v2_conversations
      WHERE v2_conversations.id = v2_conversation_documents.conversation_id
      AND v2_conversations.user_id = auth.uid()
    )
  );

-- Policy: Admins can view all conversation documents
CREATE POLICY "Admins can view all conversation documents"
  ON v2_conversation_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comments for documentation
COMMENT ON TABLE v2_conversation_documents IS 'V2 Conversation-Documents junction - many-to-many linking. Non-destructive alongside v1 tables.';
COMMENT ON COLUMN v2_conversation_documents.document_id IS 'Reference to documents table (shared with v1)';
COMMENT ON COLUMN v2_conversation_documents.added_by IS 'How this document was added to the conversation for tracking';
COMMENT ON COLUMN v2_conversation_documents.relevance_score IS 'AI-calculated relevance score (0.00 to 1.00) for this document in this conversation';
COMMENT ON COLUMN v2_conversation_documents.trigger_context IS 'JSONB storing context of how document was triggered: trigger_type, address, query, message_id';

