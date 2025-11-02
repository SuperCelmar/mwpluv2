# Migration Application Steps for Supabase Dashboard

## Overview
Apply all 8 migrations in order through the Supabase SQL Editor.

**Project**: `ofeyssipibktmbfebibo`  
**URL**: https://supabase.com/dashboard/project/ofeyssipibktmbfebibo

---

## Step-by-Step Instructions

### 1. Access SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: `ofeyssipibktmbfebibo`
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"** button

### 2. Apply Migrations in Order

**IMPORTANT**: Apply migrations in this exact order. Each migration depends on the previous ones.

---

#### Migration 1: Foundation Tables
**File**: `supabase/migrations/20241001000000_create_shared_tables.sql`

1. Open the file: `supabase/migrations/20241001000000_create_shared_tables.sql`
2. Copy ALL the SQL content (lines 1-96)
3. Paste into SQL Editor
4. Click **"Run"** button (or press Cmd/Ctrl + Enter)
5. ✅ Verify: Should see "Success. No rows returned"

**Creates**: `cities`, `zonings`, `zones`, `typologies`, `documents`, `profiles`

---

#### Migration 2: V2 Projects
**File**: `supabase/migrations/20251102000001_create_v2_projects.sql`

1. Click **"New query"** in SQL Editor
2. Open: `supabase/migrations/20251102000001_create_v2_projects.sql`
3. Copy ALL SQL content
4. Paste and **Run**
5. ✅ Verify: "Success. No rows returned"

**Creates**: `v2_projects` table with RLS policies

---

#### Migration 3: V2 Conversations
**File**: `supabase/migrations/20251102000002_create_v2_conversations.sql`

1. **New query**
2. Open: `supabase/migrations/20251102000002_create_v2_conversations.sql`
3. Copy ALL SQL content
4. Paste and **Run**
5. ✅ Verify: "Success. No rows returned"

**Creates**: `v2_conversations` table with RLS policies

---

#### Migration 4: V2 Messages
**File**: `supabase/migrations/20251102000003_create_v2_messages.sql`

1. **New query**
2. Open: `supabase/migrations/20251102000003_create_v2_messages.sql`
3. Copy ALL SQL content
4. Paste and **Run**
5. ✅ Verify: "Success. No rows returned"

**Creates**: `v2_messages` table with RLS policies

---

#### Migration 5: Conversation Documents Junction
**File**: `supabase/migrations/20251102000004_create_v2_conversation_documents.sql`

1. **New query**
2. Open: `supabase/migrations/20251102000004_create_v2_conversation_documents.sql`
3. Copy ALL SQL content
4. Paste and **Run**
5. ✅ Verify: "Success. No rows returned"

**Creates**: `v2_conversation_documents` junction table with RLS policies

---

#### Migration 6: Project Documents Junction
**File**: `supabase/migrations/20251102000005_create_v2_project_documents.sql`

1. **New query**
2. Open: `supabase/migrations/20251102000005_create_v2_project_documents.sql`
3. Copy ALL SQL content
4. Paste and **Run**
5. ✅ Verify: "Success. No rows returned"

**Creates**: `v2_project_documents` junction table with RLS policies

---

#### Migration 7: Research History
**File**: `supabase/migrations/20251102000006_create_v2_research_history.sql`

1. **New query**
2. Open: `supabase/migrations/20251102000006_create_v2_research_history.sql`
3. Copy ALL SQL content
4. Paste and **Run**
5. ✅ Verify: "Success. No rows returned"

**Creates**: `v2_research_history` table with RLS policies

---

#### Migration 8: Migration Tools
**File**: `supabase/migrations/20251102000007_migrate_v1_to_v2.sql`

1. **New query**
2. Open: `supabase/migrations/20251102000007_migrate_v1_to_v2.sql`
3. Copy ALL SQL content
4. Paste and **Run**
5. ✅ Verify: "Success. No rows returned"

**Creates**: 
- `migration_tracking` table
- `migrate_v1_conversation_to_v2()` function
- `migrate_user_v1_to_v2()` function

---

## Verification Steps

After applying all migrations, verify the tables exist:

1. In SQL Editor, create a new query
2. Run this verification query:

```sql
-- Check all v2 tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'v2_%'
ORDER BY table_name;
```

**Expected output**: Should show:
- `v2_conversation_documents`
- `v2_conversations`
- `v2_messages`
- `v2_project_documents`
- `v2_projects`
- `v2_research_history`
- `migration_tracking`

---

## Troubleshooting

### Error: "relation already exists"
- **Cause**: Table already created (likely from previous attempt)
- **Solution**: Safe to ignore - migrations use `IF NOT EXISTS`

### Error: "permission denied"
- **Cause**: Not using service role or missing permissions
- **Solution**: Ensure you're logged in as project owner/admin

### Error: "relation does not exist"
- **Cause**: Missing dependency (previous migration not applied)
- **Solution**: Check that you applied migrations in order 1→8

### Error: "function already exists"
- **Cause**: Function was created previously
- **Solution**: Can use `CREATE OR REPLACE FUNCTION` or drop existing first

---

## Quick Checklist

- [ ] Migration 1: Foundation tables ✅
- [ ] Migration 2: v2_projects ✅
- [ ] Migration 3: v2_conversations ✅
- [ ] Migration 4: v2_messages ✅
- [ ] Migration 5: v2_conversation_documents ✅
- [ ] Migration 6: v2_project_documents ✅
- [ ] Migration 7: v2_research_history ✅
- [ ] Migration 8: Migration tools ✅
- [ ] Verification query run ✅

---

## Alternative: Using Supabase CLI

If you prefer CLI instead of dashboard:

```bash
# Install Supabase CLI (if not already)
npm install -g supabase

# Link to your project
supabase link --project-ref ofeyssipibktmbfebibo

# Apply all migrations
supabase db push
```

This will apply all migrations from the `supabase/migrations/` folder automatically.

