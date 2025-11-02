-- Migration: Create v1 to v2 migration tools
-- This migration provides optional functions to migrate v1 conversations to v2 projects
-- Part of the non-destructive v2 architecture alongside v1 tables

-- ============================================================================
-- Migration Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS migration_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  v1_conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
  v2_conversation_id UUID REFERENCES v2_conversations(id) ON DELETE SET NULL,
  v2_project_id UUID REFERENCES v2_projects(id) ON DELETE SET NULL,
  migrated_at TIMESTAMP DEFAULT NOW(),
  migration_status TEXT DEFAULT 'completed' CHECK (
    migration_status IN ('pending', 'completed', 'failed')
  ),
  error_message TEXT,
  UNIQUE(v1_conversation_id)
);

-- Indexes for migration tracking
CREATE INDEX IF NOT EXISTS idx_migration_tracking_v1_conv ON migration_tracking(v1_conversation_id);
CREATE INDEX IF NOT EXISTS idx_migration_tracking_v2_conv ON migration_tracking(v2_conversation_id);
CREATE INDEX IF NOT EXISTS idx_migration_tracking_v2_project ON migration_tracking(v2_project_id);
CREATE INDEX IF NOT EXISTS idx_migration_tracking_status ON migration_tracking(migration_status);

-- Row Level Security for migration_tracking
ALTER TABLE migration_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own migration records
CREATE POLICY "Users can view own migration records"
  ON migration_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM v2_projects
      WHERE v2_projects.id = migration_tracking.v2_project_id
      AND v2_projects.user_id = auth.uid()
    )
  );

-- Policy: Users can insert their own migration records
CREATE POLICY "Users can create own migration records"
  ON migration_tracking FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_projects
      WHERE v2_projects.id = migration_tracking.v2_project_id
      AND v2_projects.user_id = auth.uid()
    )
  );

-- Policy: Admins can view all migration records
CREATE POLICY "Admins can view all migration records"
  ON migration_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- Migration Function: Single Conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_v1_conversation_to_v2(p_v1_conversation_id UUID)
RETURNS TABLE(project_id UUID, conversation_id UUID) AS $$
DECLARE
  v_project_id UUID;
  v_conversation_id UUID;
  v1_conv RECORD;
  v_user_id UUID;
BEGIN
  -- Fetch v1 conversation
  SELECT * INTO v1_conv 
  FROM chat_conversations 
  WHERE id = p_v1_conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'V1 conversation % not found', p_v1_conversation_id;
  END IF;
  
  v_user_id := v1_conv.user_id;
  
  -- Check if already migrated
  IF EXISTS (
    SELECT 1 FROM migration_tracking 
    WHERE v1_conversation_id = p_v1_conversation_id
  ) THEN
    RAISE EXCEPTION 'V1 conversation % has already been migrated', p_v1_conversation_id;
  END IF;
  
  BEGIN
    -- Create v2_project (draft, unnamed)
    INSERT INTO v2_projects (
      user_id, 
      status, 
      name,
      metadata
    )
    VALUES (
      v_user_id, 
      'draft',
      NULL, -- unnamed
      jsonb_build_object('migrated_from_v1', true, 'v1_conversation_id', p_v1_conversation_id)
    )
    RETURNING id INTO v_project_id;
    
    -- Create v2_conversation linked to project
    INSERT INTO v2_conversations (
      user_id,
      project_id,
      conversation_type,
      is_active,
      last_message_at,
      created_at,
      updated_at,
      context_metadata
    )
    VALUES (
      v_user_id,
      v_project_id,
      'address_analysis',
      v1_conv.is_active,
      v1_conv.last_message_at,
      v1_conv.created_at,
      COALESCE(v1_conv.last_message_at, v1_conv.created_at),
      jsonb_build_object('migrated_from_v1', true)
    )
    RETURNING id INTO v_conversation_id;
    
    -- Link document if exists
    IF v1_conv.document_id IS NOT NULL THEN
      INSERT INTO v2_conversation_documents (
        conversation_id,
        document_id,
        added_by,
        relevance_score,
        added_at
      )
      VALUES (
        v_conversation_id,
        v1_conv.document_id,
        'migration',
        1.0,
        v1_conv.created_at
      )
      ON CONFLICT (conversation_id, document_id) DO NOTHING;
    END IF;
    
    -- Migrate messages
    INSERT INTO v2_messages (
      conversation_id,
      user_id,
      role,
      message,
      referenced_documents,
      conversation_turn,
      reply_to_message_id,
      metadata,
      created_at
    )
    SELECT
      v_conversation_id,
      cm.user_id,
      cm.role::text, -- v1 and v2 both use TEXT with CHECK constraint
      cm.message,
      CASE 
        WHEN cm.document_id IS NOT NULL 
        THEN ARRAY[cm.document_id]::UUID[]
        ELSE ARRAY[]::UUID[]
      END,
      cm.conversation_turn,
      cm.reply_to_message_id,
      jsonb_build_object('migrated_from_v1', true) || COALESCE(cm.metadata, '{}'::jsonb),
      cm.created_at
    FROM chat_messages cm
    WHERE cm.conversation_id = p_v1_conversation_id
    ORDER BY cm.created_at;
    
    -- Update conversation message count
    UPDATE v2_conversations
    SET message_count = (
      SELECT COUNT(*) FROM v2_messages 
      WHERE conversation_id = v_conversation_id
    )
    WHERE id = v_conversation_id;
    
    -- Track migration
    INSERT INTO migration_tracking (
      v1_conversation_id,
      v2_conversation_id,
      v2_project_id,
      migration_status
    )
    VALUES (
      p_v1_conversation_id,
      v_conversation_id,
      v_project_id,
      'completed'
    );
    
    RETURN QUERY SELECT v_project_id, v_conversation_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log failed migration
    INSERT INTO migration_tracking (
      v1_conversation_id,
      v2_project_id,
      v2_conversation_id,
      migration_status,
      error_message
    )
    VALUES (
      p_v1_conversation_id,
      v_project_id,
      v_conversation_id,
      'failed',
      SQLERRM
    )
    ON CONFLICT (v1_conversation_id) 
    DO UPDATE SET 
      migration_status = 'failed',
      error_message = SQLERRM;
    
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Migration Function: All Conversations for a User
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_user_v1_to_v2(p_user_id UUID)
RETURNS TABLE(
  migrated_count INTEGER,
  failed_count INTEGER,
  skipped_count INTEGER
) AS $$
DECLARE
  v_conv RECORD;
  v_migrated INTEGER := 0;
  v_failed INTEGER := 0;
  v_skipped INTEGER := 0;
  v_result RECORD;
BEGIN
  -- Loop through all active v1 conversations for this user
  FOR v_conv IN 
    SELECT id FROM chat_conversations
    WHERE user_id = p_user_id
    AND is_active = true
    ORDER BY created_at
  LOOP
    BEGIN
      -- Check if already migrated
      IF EXISTS (
        SELECT 1 FROM migration_tracking 
        WHERE v1_conversation_id = v_conv.id
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
      
      -- Attempt migration
      SELECT * INTO v_result 
      FROM migrate_v1_conversation_to_v2(v_conv.id);
      
      v_migrated := v_migrated + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      -- Error already logged in migration_tracking by the function
      CONTINUE;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_migrated, v_failed, v_skipped;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE migration_tracking IS 'Tracks migration of v1 conversations to v2 projects. Prevents duplicate migrations.';
COMMENT ON FUNCTION migrate_v1_conversation_to_v2 IS 'Migrates a single v1 conversation to v2: creates project, conversation, migrates messages and links documents. Returns project_id and conversation_id.';
COMMENT ON FUNCTION migrate_user_v1_to_v2 IS 'Batch migrates all active v1 conversations for a user. Returns counts of migrated, failed, and skipped conversations.';

