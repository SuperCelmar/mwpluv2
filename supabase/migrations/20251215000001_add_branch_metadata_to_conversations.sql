-- Migration: Add branch metadata columns to v2_conversations
-- Description:
--   * Adds branch_type, has_analysis, document_metadata columns
--   * Ensures is_rnu + primary_document_id exist with sane defaults
--   * Provides check constraint + indexes for new metadata

BEGIN;

-- Add/ensure columns exist
ALTER TABLE v2_conversations
  ADD COLUMN IF NOT EXISTS branch_type text,
  ADD COLUMN IF NOT EXISTS has_analysis boolean,
  ADD COLUMN IF NOT EXISTS is_rnu boolean,
  ADD COLUMN IF NOT EXISTS primary_document_id uuid REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS document_metadata jsonb;

-- Backfill existing rows with defaults
UPDATE v2_conversations
SET
  branch_type = COALESCE(branch_type, 'pending'),
  has_analysis = COALESCE(has_analysis, false),
  is_rnu = COALESCE(is_rnu, false)
WHERE branch_type IS NULL
   OR has_analysis IS NULL
   OR is_rnu IS NULL;

-- Enforce defaults and nullability
ALTER TABLE v2_conversations
  ALTER COLUMN branch_type SET DEFAULT 'pending',
  ALTER COLUMN branch_type SET NOT NULL,
  ALTER COLUMN has_analysis SET DEFAULT false,
  ALTER COLUMN has_analysis SET NOT NULL,
  ALTER COLUMN is_rnu SET DEFAULT false,
  ALTER COLUMN is_rnu SET NOT NULL;

-- Refresh branch type check constraint
ALTER TABLE v2_conversations
  DROP CONSTRAINT IF EXISTS v2_conversations_branch_type_check;

ALTER TABLE v2_conversations
  ADD CONSTRAINT v2_conversations_branch_type_check
    CHECK (branch_type IN ('pending', 'rnu', 'non_rnu_analysis', 'non_rnu_source'));

-- Indexes to support lookups
CREATE INDEX IF NOT EXISTS idx_v2_conversations_branch_type
  ON v2_conversations(branch_type);

CREATE INDEX IF NOT EXISTS idx_v2_conversations_primary_document
  ON v2_conversations(primary_document_id);

-- Column comments for clarity
COMMENT ON COLUMN v2_conversations.branch_type IS
  'Conversation branch: pending, rnu, non_rnu_analysis, non_rnu_source.';

COMMENT ON COLUMN v2_conversations.has_analysis IS
  'True when an HTML analysis is available for the associated PLU zone.';

COMMENT ON COLUMN v2_conversations.is_rnu IS
  'True when municipality follows RNU (chat stays enabled despite missing analysis).';

COMMENT ON COLUMN v2_conversations.primary_document_id IS
  'Primary PLU/RNU document UUID powering the conversation artifacts.';

COMMENT ON COLUMN v2_conversations.document_metadata IS
  'JSON metadata describing the selected document (zone name, source URL, timestamps).';

COMMIT;

