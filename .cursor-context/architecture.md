# MWPLU Architecture Context

## Current Stack
- Next.js 14 (App Router)
- Supabase (PostgreSQL + Auth)
- TypeScript
- Tailwind CSS

## Key Files
- `app/page.tsx` - Address submission page
- `app/chat/[conversation_id]/page.tsx` - Main chat interface
- `lib/supabase/queries.ts` - Database operations
- `lib/api/` - External API calls (IGN Carto)

## Database Tables (V2)
- v2_conversations
- v2_messages
- v2_research_history
- v2_projects
- cities, zonings, zones, documents

## External APIs
- IGN Carto API (gpu/municipality, gpu/zone-urba, gpu/document)
- N8N Webhook (AI chat responses)