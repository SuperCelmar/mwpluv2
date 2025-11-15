-- Migration: Add analysis metadata columns to v2_conversations
-- Description:
--   * Track whether a conversation is RNU or has a reusable analysis
--   * Persist the primary document id used for chat/webhook payloads
--   * Provide an enum-like analysis_status with CHECK constraint

BEGIN;

ALTER TABLE v2_conversations
  ADD COLUMN IF NOT EXISTS primary_document_id uuid REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS analysis_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_rnu boolean NOT NULL DEFAULT false;

ALTER TABLE v2_conversations
  DROP CONSTRAINT IF EXISTS v2_conversations_analysis_status_check;

ALTER TABLE v2_conversations
  ADD CONSTRAINT v2_conversations_analysis_status_check
    CHECK (analysis_status IN ('pending', 'analysis_available', 'source_only', 'rnu'));

CREATE INDEX IF NOT EXISTS idx_v2_conversations_primary_document
  ON v2_conversations(primary_document_id);

COMMENT ON COLUMN v2_conversations.primary_document_id IS
  'Primary document referenced by this conversation for chat/webhook payloads.';

COMMENT ON COLUMN v2_conversations.analysis_status IS
  'Analysis availability state: pending, analysis_available, source_only, or rnu.';

COMMENT ON COLUMN v2_conversations.is_rnu IS
  'True when the municipality is governed by the RNU and no zone-urba polygon is required.';

COMMIT;


