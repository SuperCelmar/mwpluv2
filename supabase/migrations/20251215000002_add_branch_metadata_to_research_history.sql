-- Migration: Mirror branch metadata on v2_research_history
-- Description:
--   * Adds branch_type, has_analysis, is_rnu, primary_document_id, document_metadata
--   * Keeps research history aligned with conversations for webhook/chat gating

BEGIN;

ALTER TABLE v2_research_history
  ADD COLUMN IF NOT EXISTS branch_type text,
  ADD COLUMN IF NOT EXISTS has_analysis boolean,
  ADD COLUMN IF NOT EXISTS is_rnu boolean,
  ADD COLUMN IF NOT EXISTS primary_document_id uuid REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS document_metadata jsonb;

UPDATE v2_research_history
SET
  branch_type = COALESCE(branch_type, 'pending'),
  has_analysis = COALESCE(has_analysis, false),
  is_rnu = COALESCE(is_rnu, false)
WHERE branch_type IS NULL
   OR has_analysis IS NULL
   OR is_rnu IS NULL;

ALTER TABLE v2_research_history
  ALTER COLUMN branch_type SET DEFAULT 'pending',
  ALTER COLUMN branch_type SET NOT NULL,
  ALTER COLUMN has_analysis SET DEFAULT false,
  ALTER COLUMN has_analysis SET NOT NULL,
  ALTER COLUMN is_rnu SET DEFAULT false,
  ALTER COLUMN is_rnu SET NOT NULL;

ALTER TABLE v2_research_history
  DROP CONSTRAINT IF EXISTS v2_research_history_branch_type_check;

ALTER TABLE v2_research_history
  ADD CONSTRAINT v2_research_history_branch_type_check
    CHECK (branch_type IN ('pending', 'rnu', 'non_rnu_analysis', 'non_rnu_source'));

CREATE INDEX IF NOT EXISTS idx_v2_research_history_primary_document
  ON v2_research_history(primary_document_id);

COMMENT ON COLUMN v2_research_history.branch_type IS
  'Resolved branch snapshot (pending, rnu, non_rnu_analysis, non_rnu_source).';

COMMENT ON COLUMN v2_research_history.has_analysis IS
  'True when an HTML analysis exists for the associated zone.';

COMMENT ON COLUMN v2_research_history.is_rnu IS
  'True when the municipality is governed by the RNU.';

COMMENT ON COLUMN v2_research_history.primary_document_id IS
  'Primary PLU/RNU document UUID attached to the search.';

COMMENT ON COLUMN v2_research_history.document_metadata IS
  'JSON metadata for webhook/chat payloads (zone name, source PLU URL, etc.).';

COMMIT;

