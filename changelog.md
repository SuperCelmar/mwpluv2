# Changelog

All notable changes to this project will be documented in this file.

## 2025-11-02

### Added
- **Dashboard V2 Projects**: Updated dashboard to display v2 projects instead of v1 conversations
  - Created `components/ProjectCard.tsx` - Displays project information with:
    - Project name (or "Sans nom" if null)
    - Project icon and color
    - Status badge (draft/active/completed/archived)
    - Main address with MapPin icon
    - Conversation count badge
    - Last activity timestamp
    - Click navigates to most recent conversation
  - Updated `app/dashboard/page.tsx` to query v2_projects with joined conversations
    - Queries projects with `status IN ('draft', 'active')`
    - Joins conversations to get count and most recent activity
    - Updates empty state text for projects
    - Maintains existing "Nouveau Projet" button and NewConversationModal

### Added
- **V2 Database Schema (Non-destructive migration)**: Implemented complete v2 database architecture running alongside v1
  - **6 New V2 Tables**:
    - `v2_projects` - User projects with status tracking, PLU alerts, and project metadata
    - `v2_conversations` - Conversations always linked to projects (required `project_id`)
    - `v2_messages` - Enhanced messages with `referenced_documents[]`, `referenced_zones[]`, intent detection, and search context
    - `v2_conversation_documents` - Many-to-many junction: conversations ↔ documents
    - `v2_project_documents` - Many-to-many junction: projects ↔ documents (with pinning and notes)
    - `v2_research_history` - Enhanced research history linking to conversations, messages, and projects
  
  - **Type Definitions**: Added complete TypeScript types in `lib/supabase.ts`:
    - `V2Project`, `V2Conversation`, `V2Message`, `V2ConversationDocument`, `V2ProjectDocument`, `V2ResearchHistory`
    - Carto API response types: `CartoAPIResult`, `CartoZone`, `CartoDocument`, `CartoMunicipality`
  
  - **Application Integration**: Updated core pages to use v2 tables:
    - `app/page.tsx` - Creates v2 projects and conversations with Carto API integration
    - `app/chat/[conversation_id]/page.tsx` - Loads v2 conversations and messages
    - All v2 tables use shared reference tables (`cities`, `zones`, `documents`, `profiles`)

### Changed
- **Carto API Integration**: Switched from MSW mocks to real API calls
  - Removed Carto API MSW handlers (tests now use real `apicarto.ign.fr` endpoints)
  - Updated `lib/carto-api.ts` with proper API function signatures:
    - `fetchZoneUrba()` - Supports both GPS coordinates and INSEE code parameters
    - `fetchDocument()` - Wrapper for document API
    - `fetchMunicipality()` - Overloaded to support string or object parameters
    - `fetchCartoAPIs()` - Improved error handling (graceful failures return empty arrays)
  - Fixed API response type mappings to match actual Carto API schema:
    - Zone properties: `libelle` (zone code) instead of `code_zone`
    - Municipality properties: `insee` and `name` instead of `code_insee` and `nom_commune`
  
- **Geo Enrichment**: Updated `lib/geo-enrichment.ts` to use correct Carto API field names
  - Uses `libelle` as zone code (from Carto API)
  - Uses `libelong` or `libelle` as zone name fallback
  - Municipality API parameter changed from `code_insee` to `insee`

### Updated
- **Test Infrastructure**: Added v2 table handlers in `__tests__/mocks/handlers.ts`
  - Mock handlers for all 6 v2 tables (POST, GET, PATCH operations)
  - V2 mock data generators in `__tests__/utils/test-helpers.ts`:
    - `createMockV2Project()`, `createMockV2Conversation()`, `createMockV2Message()`, `createMockV2ResearchHistory()`
  
- **Test Files**: Updated integration tests for v2 schema
  - `__tests__/integration/create-project.test.tsx` - Tests v2 project + conversation creation flow
  - `__tests__/integration/load-conversation.test.tsx` - Tests v2 conversation loading with artifacts
  - `__tests__/integration/send-message.test.tsx` - Tests v2 message sending
  - `__tests__/integration/carto-apis.test.tsx` - Updated to use real API calls and correct field names

### Fixed
- **Duplicate Type Definitions**: Removed duplicate v2 mock generator functions in `__tests__/utils/test-helpers.ts`
  - Fixed TypeScript compilation errors caused by duplicate exports

### Documentation
- **Migration Strategy**: Comprehensive v2 migration strategy documented in `docs/migration_v2_strategy.md`
  - Non-destructive side-by-side architecture
  - V1 tables remain completely unchanged
  - Shared reference tables used by both v1 and v2
  - Complete SQL schema definitions for all v2 tables

### Notes
- **V1 Compatibility**: All v1 tables (`chat_conversations`, `chat_messages`, `research_history`) remain unchanged and functional
- **Shared Tables**: `cities`, `zones`, `zonings`, `documents`, `typologies`, `profiles` are shared between v1 and v2
- **Carto API**: Tests now make real network requests to `apicarto.ign.fr` (slower but verifies actual API integration)
- **Migration Path**: V2 schema designed for progressive migration with zero downtime

## 2025-11-02 (Afternoon)

### Added
- **SQL Migration Files**: Created complete SQL migrations for all 6 v2 tables in `supabase/migrations/`:
  - `20251102000001_create_v2_projects.sql` - Projects table with indexes and RLS policies
  - `20251102000002_create_v2_conversations.sql` - Conversations table with indexes and RLS policies
  - `20251102000003_create_v2_messages.sql` - Messages table with GIN indexes and RLS policies
  - `20251102000004_create_v2_conversation_documents.sql` - Conversation-documents junction with RLS
  - `20251102000005_create_v2_project_documents.sql` - Project-documents junction with RLS
  - `20251102000006_create_v2_research_history.sql` - Enhanced research history with RLS
  
  Each migration file includes:
  - `CREATE TABLE IF NOT EXISTS` for safety
  - All indexes specified in the migration strategy
  - Complete RLS policies (users can manage own data, admins can view all)
  - Documentation comments explaining fields and relationships
  - Non-destructive design (no modifications to existing v1 tables)

### Notes
- **Ready for Deployment**: All SQL migrations are production-ready and follow PostgreSQL best practices
- **RLS Security**: All tables have row-level security enabled from creation
- **Index Optimization**: Includes partial indexes for common queries (starred projects, active conversations)
- **Foreign Key Cascade**: Proper CASCADE and SET NULL behaviors for data integrity

## 2025-11-01

### Added
- Integration testing infrastructure with Vitest + React Testing Library + MSW
- Test configuration (`vitest.config.ts`) with jsdom environment and path aliases
- MSW handlers for mocking external APIs:
  - Supabase Auth and REST API endpoints
  - French Address API (api-adresse.data.gouv.fr)
  - N8N webhook for AI responses
- Integration test suites:
  - `create-Conversation.test.tsx` - tests Conversation creation flow from home page
  - `send-message.test.tsx` - tests message sending and AI response
  - `load-Conversation.test.tsx` - tests artifact loading simulation
- Test utilities and helpers in `__tests__/utils/test-helpers.ts`:
  - Mock data generators (users, Conversations, messages)
  - Router mocking utilities
  - Async test helpers
- Test scripts in package.json:
  - `npm test` - run tests
  - `npm run test:ui` - run tests with UI
  - `npm run test:coverage` - run tests with coverage

### Installation
- Added dependencies: vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom, msw, @vitejs/plugin-react
- Configured test environment with proper path resolution and setup files

### Notes
- Supabase auth mocking requires special handling for JWT tokens and localStorage
- Tests are set up as integration tests focusing on user flows rather than unit tests
- MSW intercepts network requests at the HTTP level for realistic testing

## 2025-11-01 (Afternoon)

### Fixed
- **Supabase Auth Mocking**: Fixed authentication in tests by mocking `supabase.auth.getUser()` directly at module level in `__tests__/setup.ts`
  - Removed unused MSW auth handler (getUser() doesn't make HTTP requests)
  - All tests now properly authenticate

### Added
- **Carto API MSW Handlers**: Added handlers for three Carto API endpoints in `__tests__/mocks/handlers.ts`:
  - `GET https://apicarto.ign.fr/api/gpu/zone-urba` - Urban planning zones (MultiPolygon GeoJSON)
  - `GET https://apicarto.ign.fr/api/gpu/document` - PLU/POS/CC/PSMV/SUP documents
  - `GET https://apicarto.ign.fr/api/gpu/municipality` - Municipality information
  - All handlers support `geom` (GeoJSON) and `code_insee` parameters
  - Return realistic GeoJSON FeatureCollection responses

- **Carto API Test Helpers**: Added utility functions in `__tests__/utils/test-helpers.ts`:
  - `createMockZoneUrbaResponse()` - Generate zone polygon FeatureCollection
  - `createMockDocumentResponse()` - Generate document metadata (handles RNU vs PLU)
  - `createMockMunicipalityResponse()` - Generate municipality info
  - `createMockZonePolygon()` - Generate individual zone polygons
  - `createMockGeoJSONPoint()` - Generate Point geometry

- **Integration Tests**: Added two new test files:
  - `__tests__/integration/carto-apis.test.tsx` - Tests all Carto API endpoints, parameter validation, error handling, and GeoJSON structure
  - `__tests__/integration/map-artifacts.test.tsx` - Tests map display, zone highlighting, artifact stacking (ready for implementation)

### Improved
- **Test Precision**: Updated all test files to use exact placeholder text matching:
  - Changed from `/Ex: 15 rue des Fustiers/` to `/Ex: 15 rue des Fustiers, Paris 75001/`
  - Files updated: `create-Conversation.test.tsx`, `send-message.test.tsx`, `load-Conversation.test.tsx`

### Documentation
- Updated `__tests__/README.md`:
  - Added Carto API and Map Artifacts test coverage sections
  - Documented Carto API testing approach
  - Added notes on known limitations (features not yet implemented)
  - Updated mocking strategy to include Carto APIs
  
- Updated `__tests__/IMPLEMENTATION_NOTES.md`:
  - Marked Supabase auth issue as resolved
  - Added Carto API integration section
  - Documented map artifact testing strategy
  - Updated summary to reflect complete implementation

### Notes
- Carto API integration tests verify API endpoints are ready for implementation
- Map artifact tests verify data structures are ready for UI rendering
- All tests follow existing patterns and are prepared for future feature implementations

## 2025-11-01 (Late Evening)

### Major Refactor - Supabase Schema Alignment

#### Changed
- **Database Schema Alignment**: Updated all Supabase integrations to match the documented schema in `supabase/README.md`
  - **Table Names**: Changed from `Conversations` → `chat_conversations` and `messages` → `chat_messages` throughout codebase
  - **Field Names**: Updated field references to match schema:
    - `Conversation_id` → `conversation_id` in chat_messages
    - `content` → `message` in chat_messages
    - Added proper fields: `document_id`, `conversation_turn`, `reply_to_message_id`, `metadata`
  - **Type Definitions**: Updated `lib/supabase.ts` with complete type definitions:
    - Added `ChatConversation`, `ChatMessage`, `Profile`, `City`, `Zone`, `Zoning`, `Document`, `Typology`, `ResearchHistory`
    - Kept legacy aliases (`Conversation`, `Message`) for backward compatibility during migration

#### Updated Files
- **Core Types**: `lib/supabase.ts` - Complete schema-aligned TypeScript types
- **Main Pages**:
  - `app/page.tsx` - Address submission now creates `chat_conversations` and stores address in `research_history`
  - `app/chat/[conversation_id]/page.tsx` - Updated to use new table names and fields
  - `app/dashboard/page.tsx` - Lists conversations instead of Conversations
  - `app/Conversation/[id]/page.tsx` - Updated to work with conversations schema
- **Components**:
  - `components/NewConversationModal.tsx` - Creates conversations
  - `components/ChatLeftSidebar.tsx` - Lists conversations
  - `components/ConversationCard.tsx` - Displays conversation data
- **Test Infrastructure**:
  - `__tests__/utils/supabase-mock.ts` - Updated mocks to support both old and new table names
  - `__tests__/mocks/handlers.ts` - Added MSW handlers for `chat_conversations` and `chat_messages`, kept legacy handlers for compatibility

#### Removed
- **Migration Files**: Deleted `supabase/migrations/` files as instructed - code now references actual database structure

#### Data Model Changes
- **Address Storage**: Address metadata now stored in `research_history` table instead of conversation table
- **Conversation Structure**: Conversations now reference `document_id` for PLU documents
- **Message Structure**: Messages include `conversation_turn`, `reply_to_message_id`, `metadata` fields

#### Backward Compatibility
- Test mocks support both old (`Conversations`, `messages`) and new (`chat_conversations`, `chat_messages`) table names
- Legacy type aliases maintained in `lib/supabase.ts` for gradual migration

## 2025-11-01 (Evening)

### Refactored
- **Integration Test Structure**: Verified and enhanced tests to follow proper integration testing principles
  - Tests verify actual integration flow: Input → Processing → Output
  - Only external APIs are mocked (French Address API, Carto APIs, N8N webhook)
  - Internal component integration is tested, not mocked
  - Added integration flow comments to test assertions
  
### Fixed
- **Router Mocking**: Fixed `mockRouter()` function to properly handle Next.js router mocking in vitest
  - Changed from `vi.mocked()` to direct mock function access
  - Router mocking now works correctly (3/5 tests passing)
  
### Added
- **MSW Handler Improvements**: Enhanced Supabase REST API handlers
  - Added specific URL patterns for test Supabase URL
  - Added wildcard fallback patterns
  - Improved error handling in handlers
  - Moved MSW server initialization before other imports

### Documentation
- **MSW Integration Issue**: Created `__tests__/MSW_INTEGRATION_ISSUE.md` documenting Supabase request interception issue
  - Issue: Supabase requests failing with "fetch failed" before MSW can intercept
  - Root cause analysis and recommended solutions
  - Impact on tests (2/5 tests blocked, but structure is correct)
  
- **Integration Test Philosophy**: Enhanced test comments to clarify:
  - What inputs are provided (fixed test data)
  - How data flows through integration
  - What outputs are verified
  - What's mocked (external APIs) vs what's tested (integration)

### Known Issues
- **MSW Supabase Interception**: Supabase REST API requests not being intercepted by MSW
  - Currently blocks 2 tests in `create-Conversation.test.tsx`
  - Tests are correctly structured - will pass once MSW interception is fixed
  - Workaround: Tests verify integration flow up to Supabase call
  - See `__tests__/MSW_INTEGRATION_ISSUE.md` for details

