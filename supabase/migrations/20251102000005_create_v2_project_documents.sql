-- Migration: Create v2_project_documents junction table
-- Many-to-many relationship between projects and documents (project-level collection)
-- Part of the non-destructive v2 architecture alongside v1 tables

CREATE TABLE IF NOT EXISTS v2_project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,  -- Shared with v1
  
  -- Metadata
  pinned BOOLEAN DEFAULT false,  -- Important/pinned document
  added_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,  -- User notes about this document for this project
  
  -- Ensure one document per project (but can update metadata)
  UNIQUE(project_id, document_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_v2_proj_docs_project ON v2_project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_v2_proj_docs_pinned ON v2_project_documents(project_id, pinned) 
  WHERE pinned = true;

-- Row Level Security
ALTER TABLE v2_project_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view documents linked to their projects
CREATE POLICY "Users can view own project documents"
  ON v2_project_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM v2_projects
      WHERE v2_projects.id = v2_project_documents.project_id
      AND v2_projects.user_id = auth.uid()
    )
  );

-- Policy: Users can link documents to their projects
CREATE POLICY "Users can link documents to projects"
  ON v2_project_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_projects
      WHERE v2_projects.id = v2_project_documents.project_id
      AND v2_projects.user_id = auth.uid()
    )
  );

-- Policy: Users can update document links in their projects
CREATE POLICY "Users can update own project documents"
  ON v2_project_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM v2_projects
      WHERE v2_projects.id = v2_project_documents.project_id
      AND v2_projects.user_id = auth.uid()
    )
  );

-- Policy: Users can remove document links from their projects
CREATE POLICY "Users can remove documents from projects"
  ON v2_project_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM v2_projects
      WHERE v2_projects.id = v2_project_documents.project_id
      AND v2_projects.user_id = auth.uid()
    )
  );

-- Policy: Admins can view all project documents
CREATE POLICY "Admins can view all project documents"
  ON v2_project_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comments for documentation
COMMENT ON TABLE v2_project_documents IS 'V2 Project-Documents junction - project-level document collection. Non-destructive alongside v1 tables.';
COMMENT ON COLUMN v2_project_documents.document_id IS 'Reference to documents table (shared with v1)';
COMMENT ON COLUMN v2_project_documents.pinned IS 'Flag to mark important/pinned documents for quick access';
COMMENT ON COLUMN v2_project_documents.notes IS 'User notes about this document specific to this project';

