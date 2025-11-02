-- ========================================
-- Foundation Tables (Shared by v1 and v2)
-- These tables must exist before v2 migrations can run
-- ========================================

-- Cities table (referenced by v2_projects, v2_research_history)
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(name);

-- Zonings table (parent of zones)
CREATE TABLE IF NOT EXISTS zonings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zonings_city ON zonings(city_id);

-- Zones table (referenced by v2_projects, v2_research_history)
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoning_id UUID REFERENCES zonings(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  zones_constructibles BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zones_zoning ON zones(zoning_id);

-- Typologies table (parent of documents)
CREATE TABLE IF NOT EXISTS typologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_typologies_name ON typologies(name);

-- Documents table (referenced by v2_conversation_documents, v2_project_documents)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoning_id UUID REFERENCES zonings(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  typology_id UUID REFERENCES typologies(id) ON DELETE SET NULL,
  content_json JSONB,
  html_content TEXT,
  pdf_storage_path TEXT,
  source_plu_url TEXT,
  source_plu_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_zone ON documents(zone_id);
CREATE INDEX IF NOT EXISTS idx_documents_zoning ON documents(zoning_id);
CREATE INDEX IF NOT EXISTS idx_documents_typology ON documents(typology_id);

-- Profiles table (referenced by RLS policies in v2 tables)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  full_name VARCHAR,
  phone VARCHAR,
  pseudo VARCHAR,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  deletion_requested_at TIMESTAMP,
  deletion_scheduled_for TIMESTAMP,
  deletion_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_admin ON profiles(is_admin) WHERE is_admin = true;

-- Comments for documentation
COMMENT ON TABLE cities IS 'Shared table: List of cities/communes in the system';
COMMENT ON TABLE zones IS 'Shared table: PLU zones within zonings';
COMMENT ON TABLE documents IS 'Shared table: PLU documents available in the system';
COMMENT ON TABLE profiles IS 'Shared table: User profiles linked to auth.users';