-- Migration: Add RLS policies for documents table
-- Documents are shared/public resources that all authenticated users can read
-- Authenticated users can insert placeholder documents
-- Only admins can update/delete documents

-- Enable Row Level Security on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view all documents
-- Documents are shared/public resources, not user-specific
CREATE POLICY "Authenticated users can view all documents"
  ON documents FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Authenticated users can insert documents
-- Needed for creating placeholder documents during enrichment
CREATE POLICY "Authenticated users can insert documents"
  ON documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Admins can update documents
CREATE POLICY "Admins can update documents"
  ON documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Policy: Admins can delete documents
CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Comments for documentation
COMMENT ON POLICY "Authenticated users can view all documents" ON documents IS 
  'Allows all authenticated users to read documents (documents are shared/public resources)';
COMMENT ON POLICY "Authenticated users can insert documents" ON documents IS 
  'Allows authenticated users to create placeholder documents during enrichment process';
COMMENT ON POLICY "Admins can update documents" ON documents IS 
  'Only admins can update existing documents';
COMMENT ON POLICY "Admins can delete documents" ON documents IS 
  'Only admins can delete documents';

