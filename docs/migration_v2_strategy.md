# MWPLU Database Schema v2 - Migration Strategy

## 🎯 Objective

Design a **non-destructive** database architecture that allows:
- ✅ **v1 continues running** in production without changes
- ✅ **v2 features** work alongside v1
- ✅ **Progressive migration** from v1 to v2
- ✅ **Zero downtime** during transition

---

## 📋 Strategy Overview

### **Approach: Side-by-Side Architecture**

```
┌─────────────────────────────────────────────────────┐
│                 PRODUCTION DATABASE                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌────────────────┐         ┌──────────────────┐  │
│  │  V1 TABLES     │         │  V2 TABLES       │  │
│  │  (unchanged)   │         │  (new)           │  │
│  ├────────────────┤         ├──────────────────┤  │
│  │ • profiles     │         │ • v2_projects    │  │
│  │ • cities       │         │ • v2_convs       │  │
│  │ • documents    │  ←──→   │ • v2_messages    │  │
│  │ • chat_convs   │ shared  │ • v2_conv_docs   │  │
│  │ • chat_msgs    │ refs    │ • v2_research    │  │
│  └────────────────┘         └──────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Key Principles:**
1. **Zero modification** to existing v1 tables
2. **New tables** prefixed with `v2_`
3. **Shared reference tables** (cities, documents, profiles, etc.)
4. **Optional bridge table** for migration tracking

---

## 🗄️ Database Schema

### **✅ V1 Tables (UNCHANGED - Keep as-is)**

These tables remain **completely untouched**:

```sql
-- User management (shared between v1 and v2)
profiles
user_download_limits

-- Geographic & PLU data (shared)
cities
zonings
zones
documents
typologies

-- V1 chat system (continues working)
chat_conversations
chat_messages

-- V1 interactions (continues working)
ratings
comments
comments_deleted
downloads
view_history
research_history

-- Blog & contact (shared)
contact_messages
company_context
blog_categories
blog_tags
blog_articles
blog_article_tags
blog_content_planner
blog_analytics_events
blog_seo_audits

-- Analytics (shared)
analytics.chat_events
analytics.user_daily_usage
analytics.system_daily_metrics
analytics.document_usage
analytics.user_monthly_usage
```

---

## 🆕 New V2 Tables

### **1. Projects**

```sql
CREATE TABLE v2_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User-editable info
  name TEXT,  -- NULL = "Sans nom" in UI
  description TEXT,
  project_type TEXT CHECK (project_type IN (
    'construction', 'extension', 'renovation', 
    'amenagement', 'lotissement', 'other'
  )),
  
  -- Auto-calculated info (informational, editable)
  main_address TEXT,
  main_city_id UUID REFERENCES cities(id),  -- ✅ Shared with v1
  main_zone_id UUID REFERENCES zones(id),   -- ✅ Shared with v1
  geo_lon DECIMAL(10, 7),
  geo_lat DECIMAL(10, 7),
  
  -- UI metadata
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT '📁',
  starred BOOLEAN DEFAULT false,
  position INTEGER,
  
  -- Status tracking
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Auto-created, not yet edited
    'active',     -- User edited/using
    'completed',  -- Marked as completed
    'archived'    -- Archived
  )),
  
  -- PLU alerts
  plu_alert_enabled BOOLEAN DEFAULT false,
  plu_last_check_at TIMESTAMP,
  plu_check_frequency TEXT DEFAULT 'monthly' CHECK (
    plu_check_frequency IN ('daily', 'weekly', 'monthly')
  ),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  first_edited_at TIMESTAMP,  -- When user first edited the project
  
  -- Flexible metadata
  metadata JSONB
);

CREATE INDEX idx_v2_projects_user ON v2_projects(user_id);
CREATE INDEX idx_v2_projects_status ON v2_projects(user_id, status);
CREATE INDEX idx_v2_projects_starred ON v2_projects(user_id, starred) 
  WHERE starred = true;
CREATE INDEX idx_v2_projects_active ON v2_projects(user_id) 
  WHERE status IN ('draft', 'active');
```

**Key Design Decisions:**
- ✅ References shared tables: `cities`, `zones`
- ✅ `main_city_id` and `main_zone_id` are **informational only** (not constraints)
- ✅ `status = 'draft'` allows auto-creation without user input
- ✅ `metadata` JSONB for future extensibility

---

### **2. Conversations v2**

```sql
CREATE TABLE v2_conversations (
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
  
  -- Context
  context_metadata JSONB,
  /*
    Example:
    {
      "initial_address": "15 rue de la Paix, Paris",
      "geocoded": {"lon": 2.3522, "lat": 48.8566},
      "city": "Paris",
      "zone": "UG"
    }
  */
  
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

CREATE INDEX idx_v2_conv_user ON v2_conversations(user_id);
CREATE INDEX idx_v2_conv_project ON v2_conversations(project_id);
CREATE INDEX idx_v2_conv_active ON v2_conversations(user_id, is_active) 
  WHERE is_active = true;
CREATE INDEX idx_v2_conv_last_message ON v2_conversations(user_id, last_message_at DESC);
```

**Key Design Decisions:**
- ✅ Always linked to `v2_projects` (NOT optional)
- ✅ No direct `document_id` (decoupled, many-to-many via junction table)
- ✅ `context_metadata` for flexible context storage

---

### **3. Messages v2**

```sql
CREATE TABLE v2_messages (
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
  /*
    Example for address_search:
    {
      "address_input": "15 rue de la Paix",
      "geocoded_address": "15 Rue de la Paix, 75001 Paris",
      "coordinates": {"lon": 2.3522, "lat": 48.8566},
      "city_found": "Paris",
      "zone_found": "UG",
      "documents_found": ["doc-uuid-1", "doc-uuid-2"]
    }
  */
  
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

CREATE INDEX idx_v2_msg_conversation ON v2_messages(conversation_id, created_at);
CREATE INDEX idx_v2_msg_user ON v2_messages(user_id);
CREATE INDEX idx_v2_msg_documents ON v2_messages USING GIN(referenced_documents);
CREATE INDEX idx_v2_msg_turn ON v2_messages(conversation_id, conversation_turn);
```

**Key Design Decisions:**
- ✅ No direct `document_id` column (decoupled)
- ✅ `referenced_documents` array allows multiple document references per message
- ✅ `search_context` captures full context of address searches
- ✅ Compatible with analytics tracking

---

### **4. Conversation ↔ Documents (Many-to-Many)**

```sql
CREATE TABLE v2_conversation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES v2_conversations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,  -- ✅ Shared with v1
  
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
  /*
    Example:
    {
      "trigger_type": "address_search",
      "address": "15 rue de la Paix",
      "query": "Quelle est la hauteur maximale?",
      "message_id": "msg-uuid"
    }
  */
  
  UNIQUE(conversation_id, document_id)
);

CREATE INDEX idx_v2_conv_docs_conversation ON v2_conversation_documents(conversation_id);
CREATE INDEX idx_v2_conv_docs_document ON v2_conversation_documents(document_id);
CREATE INDEX idx_v2_conv_docs_relevance ON v2_conversation_documents(conversation_id, relevance_score DESC);
```

**Key Design Decisions:**
- ✅ Links to **shared** `documents` table (v1 and v2 use same documents)
- ✅ Tracks how document was added to conversation
- ✅ Enables multi-document conversations (zone comparisons)

---

### **5. Project ↔ Documents (Many-to-Many)**

```sql
CREATE TABLE v2_project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,  -- ✅ Shared with v1
  
  -- Metadata
  pinned BOOLEAN DEFAULT false,  -- Important/pinned document
  added_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,  -- User notes about this document for this project
  
  UNIQUE(project_id, document_id)
);

CREATE INDEX idx_v2_proj_docs_project ON v2_project_documents(project_id);
CREATE INDEX idx_v2_proj_docs_pinned ON v2_project_documents(project_id, pinned) 
  WHERE pinned = true;
```

**Key Design Decisions:**
- ✅ Project-level document collection (across all conversations)
- ✅ User can pin important documents
- ✅ User can add notes specific to this project

---

### **6. Research History v2 (Enhanced)**

```sql
CREATE TABLE v2_research_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contextual links
  conversation_id UUID REFERENCES v2_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES v2_messages(id) ON DELETE SET NULL,
  project_id UUID REFERENCES v2_projects(id) ON DELETE SET NULL,
  
  -- Search input
  address_input TEXT NOT NULL,
  search_intent TEXT,
  
  -- Results
  geocoded_address TEXT,
  city_id UUID REFERENCES cities(id),      -- ✅ Shared with v1
  zone_id UUID REFERENCES zones(id),       -- ✅ Shared with v1
  geo_lon DECIMAL(10, 7),
  geo_lat DECIMAL(10, 7),
  
  documents_found UUID[],  -- Documents found for this address
  success BOOLEAN DEFAULT true,
  error_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_v2_research_user ON v2_research_history(user_id, created_at DESC);
CREATE INDEX idx_v2_research_conversation ON v2_research_history(conversation_id);
CREATE INDEX idx_v2_research_project ON v2_research_history(project_id);
```

**Key Design Decisions:**
- ✅ Links to v2 conversations AND projects
- ✅ References shared geographic tables
- ✅ Tracks all address searches across the platform

---

## 🔄 Migration & Coexistence Strategy

### **Phase 1: Deployment (Day 1)**

```sql
-- Deploy v2 tables alongside v1 (zero impact on v1)
CREATE TABLE v2_projects (...);
CREATE TABLE v2_conversations (...);
CREATE TABLE v2_messages (...);
CREATE TABLE v2_conversation_documents (...);
CREATE TABLE v2_project_documents (...);
CREATE TABLE v2_research_history (...);

-- v1 continues running normally
-- v2 starts accepting new data
```

**Impact on v1:** ✅ **ZERO** - v1 doesn't know v2 exists

---

### **Phase 2: Parallel Operation**

```
┌─────────────────────────────────────────────┐
│  USER PERSPECTIVE                           │
├─────────────────────────────────────────────┤
│  mwplu.com (v1)        chat.mwplu.com (v2)  │
│  ─────────────────     ──────────────────   │
│  • Uses v1 tables      • Uses v2 tables     │
│  • Works as before     • New features       │
│  • No changes          • Projects           │
│                        • Multi-docs         │
└─────────────────────────────────────────────┘
```

**Both systems share:**
- `profiles` (same users)
- `cities`, `zones`, `documents` (same geographic data)
- `analytics.*` (both write to same analytics tables)

---

### **Phase 3: Optional Migration Bridge**

For users who want to **migrate their v1 conversations to v2**:

```sql
-- Optional: Migration tracking table
CREATE TABLE migration_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  v1_conversation_id UUID REFERENCES chat_conversations(id),
  v2_conversation_id UUID REFERENCES v2_conversations(id),
  v2_project_id UUID REFERENCES v2_projects(id),
  migrated_at TIMESTAMP DEFAULT NOW(),
  migration_status TEXT DEFAULT 'completed' CHECK (
    migration_status IN ('pending', 'completed', 'failed')
  ),
  error_message TEXT,
  
  UNIQUE(v1_conversation_id)
);

-- Migration function
CREATE FUNCTION migrate_v1_conversation_to_v2(p_v1_conversation_id UUID)
RETURNS TABLE(project_id UUID, conversation_id UUID) AS $$
DECLARE
  v_project_id UUID;
  v_conversation_id UUID;
  v1_conv RECORD;
BEGIN
  -- Fetch v1 conversation
  SELECT * INTO v1_conv FROM chat_conversations 
  WHERE id = p_v1_conversation_id;
  
  -- Create project (draft, unnamed)
  INSERT INTO v2_projects (user_id, status, metadata)
  VALUES (
    v1_conv.user_id, 
    'draft',
    jsonb_build_object('migrated_from_v1', true)
  ) RETURNING id INTO v_project_id;
  
  -- Create conversation
  INSERT INTO v2_conversations (
    user_id,
    project_id,
    conversation_type,
    is_active,
    last_message_at,
    created_at
  ) VALUES (
    v1_conv.user_id,
    v_project_id,
    'address_analysis',
    v1_conv.is_active,
    v1_conv.last_message_at,
    v1_conv.created_at
  ) RETURNING id INTO v_conversation_id;
  
  -- Link document if exists
  IF v1_conv.document_id IS NOT NULL THEN
    INSERT INTO v2_conversation_documents (
      conversation_id,
      document_id,
      added_by,
      relevance_score,
      added_at
    ) VALUES (
      v_conversation_id,
      v1_conv.document_id,
      'migration',
      1.0,
      v1_conv.created_at
    );
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
    cm.role,
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
  
  -- Track migration
  INSERT INTO migration_tracking (
    v1_conversation_id,
    v2_conversation_id,
    v2_project_id,
    migration_status
  ) VALUES (
    p_v1_conversation_id,
    v_conversation_id,
    v_project_id,
    'completed'
  );
  
  RETURN QUERY SELECT v_project_id, v_conversation_id;
END;
$$ LANGUAGE plpgsql;
```

**Migration is OPTIONAL:**
- Users can continue using v1
- v1 conversations can be migrated on-demand
- Original v1 data remains intact (read-only after migration)

---

## 📊 Shared vs. Separate Data

### **Shared Between v1 and v2**

These tables serve **both versions**:

| Table | Usage |
|-------|-------|
| `profiles` | User authentication & profile |
| `user_download_limits` | Download quotas |
| `cities` | Geographic reference |
| `zonings` | PLU zonage reference |
| `zones` | Zone reference |
| `documents` | PLU document storage |
| `typologies` | Document types |
| `analytics.*` | All analytics tables |
| `blog_*` | Blog content |
| `contact_messages` | Contact form |

✅ **Benefit:** No data duplication, single source of truth

---

### **Separate (v1 vs v2)**

| v1 Tables | v2 Tables | Why Separate |
|-----------|-----------|--------------|
| `chat_conversations` | `v2_conversations` | Different structure (1-to-1 vs many-to-many) |
| `chat_messages` | `v2_messages` | Different metadata needs |
| `research_history` | `v2_research_history` | Enhanced context tracking |
| N/A | `v2_projects` | New concept in v2 |
| N/A | `v2_conversation_documents` | New many-to-many relationship |
| N/A | `v2_project_documents` | New project-level organization |

---

## 🔐 Security & RLS

### **Row Level Security (RLS)**

All v2 tables follow same RLS pattern as v1:

```sql
-- Example: v2_projects RLS
ALTER TABLE v2_projects ENABLE ROW LEVEL SECURITY;

-- Users can only see their own projects
CREATE POLICY "Users can view own projects"
  ON v2_projects FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can create own projects"
  ON v2_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON v2_projects FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON v2_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can see all projects
CREATE POLICY "Admins can view all projects"
  ON v2_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
```

**Apply similar policies to:**
- `v2_conversations`
- `v2_messages`
- `v2_conversation_documents`
- `v2_project_documents`
- `v2_research_history`

---

## 📈 Analytics Integration

### **v2 writes to existing analytics tables**

```sql
-- When v2 creates a chat message, also log to analytics
INSERT INTO analytics.chat_events (
  conversation_id,      -- Can be v1 or v2 conversation
  message_id,
  document_id,
  user_id,
  model_name,
  tokens_total,
  cost_total,
  -- ... other fields
  metadata
) VALUES (
  v2_conversation_id,   -- ✅ v2 conversation ID
  v2_message_id,        -- ✅ v2 message ID
  document_id,          -- ✅ Shared document
  user_id,              -- ✅ Shared user
  'claude-3-5-sonnet',
  1500,
  0.015,
  jsonb_build_object('source', 'v2')  -- ✅ Tag as v2
);
```

**Analytics can differentiate:**
- `metadata->>'source' = 'v1'` → v1 events
- `metadata->>'source' = 'v2'` → v2 events

---

## 🎯 Benefits of This Architecture

| Aspect | Benefit |
|--------|---------|
| **Zero risk to v1** | v1 tables untouched, continues working |
| **Progressive rollout** | Deploy v2 alongside v1, migrate users gradually |
| **Reversibility** | Can disable v2 without affecting v1 |
| **Data integrity** | Shared tables ensure consistent geographic data |
| **Analytics continuity** | Both versions write to same analytics |
| **No data duplication** | Users, documents, cities shared between versions |
| **Clear separation** | `v2_` prefix makes ownership obvious |
| **Easy testing** | Test v2 in production without affecting v1 users |

---

## 🚀 Deployment Checklist

### **Pre-Deployment**
- [ ] Review all v2 table definitions
- [ ] Create migration scripts
- [ ] Set up RLS policies for v2 tables
- [ ] Test foreign key constraints
- [ ] Verify indexes are created

### **Deployment Day**
- [ ] Run v2 table creation scripts
- [ ] Verify v1 still works (run test queries)
- [ ] Deploy v2 application code
- [ ] Test v2 address search → project creation
- [ ] Monitor database performance

### **Post-Deployment**
- [ ] Monitor v2 adoption metrics
- [ ] Set up optional v1 → v2 migration for interested users
- [ ] Track analytics for both v1 and v2
- [ ] Plan eventual v1 deprecation (if desired)

---

## 🔮 Future Considerations

### **Option 1: Keep Both Forever**
- v1 continues for users who prefer simple interface
- v2 for users who need project organization
- Both coexist indefinitely

### **Option 2: Gradual Deprecation**
- After 6-12 months, offer migration tool
- Sunset v1 interface
- Keep v1 tables for historical data (read-only)

### **Option 3: Full Migration**
- Migrate all v1 conversations to v2 projects
- Archive v1 tables
- Single unified interface

---

## 📝 Summary

This architecture provides:
- ✅ **Zero downtime** - v1 keeps working
- ✅ **Zero risk** - v1 tables unchanged
- ✅ **Maximum flexibility** - Progressive migration, reversible
- ✅ **Clean separation** - Clear v1 vs v2 boundaries
- ✅ **Shared data** - No duplication of users, documents, cities
- ✅ **Future-proof** - Can evolve v2 independently

**Key Principle:** Build the future without breaking the past.