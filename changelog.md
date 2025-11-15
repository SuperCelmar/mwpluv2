# Changelog

## 2025-11-15 - Schema Helpers & Conversation Metadata

### Added
- **Supabase migrations** `20251215000001_add_branch_metadata_to_conversations.sql` and `20251215000002_add_branch_metadata_to_research_history.sql` to persist `branch_type`, `has_analysis`, `is_rnu`, `primary_document_id`, and `document_metadata`.
- **Vitest coverage** for `lib/supabase/queries.ts` ensuring both the lightweight conversation insert and the initial research history entry write the new metadata defaults.

### Changed
- **Supabase helpers** (`lib/supabase/queries.ts`, `lib/supabase.ts`) now seed the new metadata fields at address selection time and expose the richer column types.
- **Conversation enrichment worker** (`lib/workers/conversationEnrichment.ts`) updates both conversations and research history with branch status, analysis flags, primary document links, and structured document metadata.
- **Frontend chat flow** (`app/(app)/chat/[conversation_id]/page.tsx`, `components/ui/ai-prompt-box.tsx`, `components/ChatInput.tsx`) consumes the metadata to gate the chat input, surface the French tooltip, and keep the prompt UI consistent when a conversation is read-only.
- **Tests & mocks** (`__tests__/integration/chat-branch-state.test.tsx`, `__tests__/lib/supabase/queries.test.ts`, `__tests__/mocks/handlers.ts`, `__tests__/utils/test-helpers.ts`) were refreshed to understand the new columns and to wrap ChatConversationPage in a `QueryClientProvider`.

### Tests
- `npx vitest run __tests__/lib/supabase/queries.test.ts __tests__/integration/chat-branch-state.test.tsx __tests__/components/chat-input.test.tsx`
- Full `npm run test` still fails on `__tests__/integration/create-project.test.tsx` (pre-existing duplicate-hint expectation) plus MSW profile lookups; no new regressions were introduced by this change set.

## 2025-01-13 - Fixed Navigation Buttons in ChatLeftSidebar

### Fixed
- **ChatLeftSidebar Component** (`components/ChatLeftSidebar.tsx`): Fixed non-functional chat and project navigation buttons
  - Chat icon button (collapsed state) now navigates to `/chats` page
  - Project/Folder icon button (collapsed state) now navigates to `/projects` page
  - Chat button (expanded state) now navigates to `/chats` page
  - Projects button (expanded state) now navigates to `/projects` page
  - Replaced TODO comments with actual navigation handlers using `router.push()`

## 2025-01-13 - React Query Refactoring: Eliminate useEffect Misuse

### Changed
- **Complete refactoring to eliminate useEffect misuse across the codebase**:
  - Replaced all data-fetching `useEffect` hooks with React Query (`useQuery` / `useMutation`)
  - Moved derived state from `useEffect` to `useMemo` or render-time computation
  - Added comments to legitimate `useEffect` hooks: `// useEffect: sync with external system` or `// useEffect: DOM manipulation`
  - Preserved all functionality, types, and UI behavior

- **Setup**:
  - Created `lib/queryClient.ts` with QueryClient instance
  - Added `QueryClientProvider` to `app/layout.tsx` wrapping the entire app
  - Created `hooks/useDebounce.ts` for debouncing input fields (uses `useEffect` internally, which is acceptable)

- **Refactored Pages**:
  - `app/(app)/page.tsx`: User auth and address search now use React Query
  - `app/(app)/chats/page.tsx`: Conversations list and search using React Query with debouncing
  - `app/(app)/projects/page.tsx`: Projects list using React Query
  - `app/(app)/profile/page.tsx`: Profile, stats, and analytics using React Query with localStorage caching
  - `app/(app)/settings/page.tsx`: Profile and password change using React Query mutations
  - `app/(app)/chat/[conversation_id]/page.tsx`: Complete refactoring - user, conversation, project, messages, research history all use React Query; message sending uses mutations

- **Refactored Components**:
  - `components/InitialAddressInput.tsx`: Address search with `useDebounce` + `useQuery`
  - `components/AddressInput.tsx`: Address search with `useDebounce` + `useQuery`
  - `components/AppSidebar.tsx`: User auth using React Query
  - `components/settings/LoginHistoryTable.tsx`: Login history using React Query
  - `components/ChatLeftSidebar.tsx`: Conversations list using React Query

- **Legitimate useEffect hooks** (with comments):
  - Auto-scroll in chat page: `// useEffect: DOM manipulation (auto-scroll)`
  - Textarea auto-resize: `// useEffect: DOM manipulation (auto-resize textarea)`
  - Theme sync: `// useEffect: sync with external system (theme)`
  - LocalStorage sync: `// useEffect: sync with external system (localStorage)`
  - Artifact state synchronization: `// useEffect: state synchronization (map/document artifact sync)`
  - UI state transitions: `// useEffect: UI state transition (enrichment completion)`
  - Panel auto-open: `// useEffect: UI behavior (auto-open panel)`

### Technical Details
- All React Query queries use proper `queryKey` formats: `['resource', id]` or `['resource', userId]`
- Mutations invalidate related queries using `queryClient.invalidateQueries()`
- Loading states use `isLoading` from React Query instead of manual `loading` state
- Error handling uses React Query's built-in error states
- Debouncing implemented via custom `useDebounce` hook (acceptable `useEffect` usage for timers)
- Local storage caching integrated with React Query `initialData` and `onSuccess` callbacks

### Impact
- Eliminated all misuse of `useEffect` for data fetching
- Improved code maintainability and consistency
- Better error handling and loading states
- Automatic caching and refetching via React Query
- Reduced unnecessary re-renders
- Better separation of concerns (data fetching vs. side effects)

## 2025-01-13 - User Flow and Technical Process Documentation

### Added
- **Comprehensive User Flow Documentation** (`USER_FLOW_DOCUMENTATION.md`):
  - Complete documentation of the entire user experience flow from address input to final analysis display
  - Detailed technical implementation guide with file paths and line numbers for each step
  - Covers all 8 major phases: Address Input, Conversation Creation, Navigation, Enrichment, Map Display, Document Retrieval, Analysis Message, and Artifact Management
  - Includes verified locations for all previously "to be verified" functions:
    - `checkDuplicateByCoordinates` in `lib/supabase.ts` (lines 309-341)
    - `fetchMunicipality` in `lib/carto-api.ts` (lines 223-303)
    - `getOrCreateCity` in `lib/geo-enrichment.ts` (lines 107-214)
    - `getOrCreateZone` in `lib/geo-enrichment.ts` (lines 338-405)
    - `fetchDocument` in `lib/carto-api.ts` (lines 212-217)
    - Artifact store in `lib/stores/artifactStore.ts` (lines 1-214)
    - DocumentViewer in `components/DocumentViewer.tsx` (lines 1-119)
  - Provides implementation status summary and key files reference
  - Documents progressive loading flow, artifact synchronization, and background enrichment process

### Impact
- Developers can now easily navigate the codebase using the documentation as a guide
- Each technical step includes precise file paths and line numbers for quick reference
- Comprehensive understanding of the sequential process from address input to artifact display
- Documentation serves as a debugging reference and onboarding guide

## 2025-01-13 - Fix Artifact Rendering Status Updates (Critical Bug)

### Fixed
- **CRITICAL BUG**: `renderingStatus` updates were being blocked in `artifactStore`
  - Problem: Early return in `updateArtifact` only checked `status` and `data` changes
  - Result: When `renderingStatus` was updated to 'complete', it was ignored
  - Impact: `isArtifactRendered()` always returned false, breaking step transitions
  - Solution: Added `renderingStatusChanged` check to early return condition

### Changed
- **artifactStore** (`lib/stores/artifactStore.ts`):
  - Fixed early return to check `renderingStatusChanged`
  - Now properly updates `renderingStatus` when `handleMapRenderComplete` or `handleDocumentRenderComplete` are called

- **useArtifactSync** (`lib/hooks/useArtifactSync.ts`):
  - Added detailed logging to `isArtifactRendered` function
  - Shows artifact existence, status, and renderingStatus for debugging

### Impact
- `isArtifactRendered()` now correctly returns true when artifacts finish rendering
- Step transitions in LoadingAssistantMessage will now trigger properly
- Final analysis message transition will work correctly
- User will see proper sequential loading flow

## 2025-01-13 - Add Debug Logging for Progressive Loading Flow

### Added
- **Comprehensive Logging**: Added detailed console logging to debug progressive loading issues
  - LoadingAssistantMessage: Log all step condition checks (Step 1, 2, 3)
  - MapArtifact: Log polygon rendering delay checks and geometry status
  - Chat Page: Log enrichment status changes and transition conditions
  - Render callbacks: Log when map and document rendering completes

### Changed
- **LoadingAssistantMessage Component** (`components/LoadingAssistantMessage.tsx`):
  - Added console logs for each step's condition evaluation
  - Logs show: loadingStage, isMapRendered, hasMapGeometry, progress states
  - Helps identify which conditions are preventing step progression

- **MapArtifact Component** (`components/MapArtifact.tsx`):
  - Added detailed logging for polygon delay logic
  - Logs geometry structure, coordinates, and render states
  - Shows when polygon render is scheduled and triggered

- **Chat Page** (`app/(app)/chat/[conversation_id]/page.tsx`):
  - Enhanced transition logging with all relevant states
  - Added check for `conversation.enrichment_status === 'completed'` as fallback
  - Logs both `enrichment.status` and `conversation.enrichment_status`
  - Shows document content status and render states

### Fixed
- **Enrichment Status Detection**: Now checks both `enrichment.status` and `conversation.enrichment_status`
  - Handles case where enrichment completes but status doesn't update immediately
  - Transition to final message now more reliable

### Impact
- Better visibility into the loading flow progression
- Easier debugging of step transition issues
- Can identify exactly which conditions are failing
- Helps diagnose map polygon rendering problems

## 2025-01-13 - Progressive Loading Flow with Sequential Transitions

### Added
- **Progressive Loading States**: Implemented three-step loading progression with proper timing
  - Step 1: Map displays with marker → polygon appears → stays for 2s
  - Step 2: Document tab opens with skeleton → stays for 1s → analysis fades in
  - Step 3: Final message shows for 1s → fades out completely (including avatar)
  - Final: AnalysisFoundMessage fades in with text effect → inline cards appear sequentially

### Changed
- **LoadingAssistantMessage Component** (`components/LoadingAssistantMessage.tsx`):
  - Refactored to use state machine pattern for step progression
  - Added opacity transitions for smooth message changes (avatar persists throughout)
  - Implemented timing controls: Step 1 (2s), Step 2 (1s), Step 3 (1s before fade out)
  - Added `isFadingOut` prop to trigger external fade out
  - Message text fades in/out between steps while avatar remains visible

- **AnalysisFoundMessage Component** (`components/AnalysisFoundMessage.tsx`):
  - Added `onTextGenerationComplete` callback prop
  - Implemented sequential card appearance: map card first, then document card (500ms delay)
  - Added fade-in animation for the entire component
  - Cards only appear after text generation completes

- **TextGenerateEffect Component** (`components/ui/text-generate-effect.tsx`):
  - Added `onComplete` callback to notify when text generation finishes
  - Callback fires after animation promise resolves

- **DocumentViewer Component** (`components/DocumentViewer.tsx`):
  - Fixed scrolling issue by simplifying CSS structure
  - Changed from nested `overflow-hidden` + `overflow-y-auto` to single `overflow-y-auto`
  - Removed unnecessary wrapper div that was blocking scroll

- **Chat Page** (`app/(app)/chat/[conversation_id]/page.tsx`):
  - Added state management for loading/analysis message transitions
  - Implemented automatic transition from loading to analysis message
  - Document tab now switches in Step 2 (not Step 3) to show skeleton immediately
  - Map artifact can now initialize with just coordinates (geometry is optional)
  - Added `showFinalAnalysisMessage` and `loadingMessageFadingOut` state
  - Transition triggers when enrichment completes and document is rendered

### Fixed
- **Avatar Persistence**: Avatar no longer disappears during loading transitions
- **Document Scrolling**: Users can now scroll through long document content
- **Timing Issues**: Each step now displays for appropriate duration before transitioning
- **Map Display**: Map shows immediately with marker, then adds polygon when data arrives
- **Tab Switching**: Document tab opens with skeleton (Step 2), not after analysis loads (Step 3)
- **Card Sequencing**: Inline cards appear in order after text generation completes

### Impact
- Smoother, more professional loading experience with clear visual progression
- Users can see each stage of the enrichment process
- Better UX with appropriate timing that doesn't feel rushed
- Persistent avatar provides visual continuity throughout all transitions
- Document content is now fully accessible with proper scrolling

## 2025-01-13 - Fix ChatMessageBubble Avatar to Use MWPLU Logo

### Fixed
- **ChatMessageBubble Component** (`components/ChatMessageBubble.tsx`): Replaced generic Bot icon with theme-aware MWPLU logo
  - Now uses the same logo logic as `LoadingAssistantMessage` component
  - Shows `/square-white-plu.svg` for dark theme
  - Shows `/square-black-plu.svg` for light theme
  - Uses `Avatar` component with proper fallback handling
  - Handles SSR with `mounted` state to prevent hydration mismatches

### Changed
- Removed hardcoded `Bot` icon from lucide-react
- Added `useTheme` hook from `next-themes` for theme detection
- Added `useState` and `useEffect` for SSR-safe logo rendering
- Avatar now matches the loading state avatar for consistency

### Impact
- Consistent branding across all assistant messages (loading and regular)
- Theme-aware logo automatically adapts to user's theme preference
- Better visual consistency in chat interface

## 2025-01-13 - Fix Infinite Loop in Chat Page Auto-Open Panel

### Fixed
- **Chat Page** (`app/(app)/chat/[conversation_id]/page.tsx`): Fixed "Maximum update depth exceeded" error when sending new address in new chat
  - Removed `artifactSync` object from `useEffect` dependency arrays (was causing infinite re-renders)
  - Extracted stable methods (`setActiveTab`, `updateArtifact`) from `artifactSync` to use directly in dependencies
  - Added `hasAutoOpenedPanelRef` ref to prevent multiple auto-opens of the right panel
  - Reset ref when conversation changes to allow auto-open for new conversations
  - Updated all `useEffect` hooks that used `artifactSync` to use extracted methods and values instead

### Technical Details
- The `artifactSync` object returned from `useArtifactSync` hook was being recreated on each render
- Including it in dependency arrays caused infinite loops when `setIsPanelOpen(true)` triggered re-renders
- Solution: Extract stable callbacks (`setActiveTab`, `updateArtifact`) which are wrapped in `useCallback` in the hook
- Added ref guard to ensure panel auto-opens only once per conversation
- Dependencies now use specific values (`artifacts.map`, `artifacts.document`, `artifactActiveTab`) instead of entire object

### Impact
- Eliminates runtime error when starting new chats with addresses
- Prevents infinite re-render loops
- Maintains functionality of auto-opening panel when coordinates are received
- More stable and predictable component behavior

## 2025-01-13 - Add Delete Conversation Feature

### Added
- **DeleteConversationDialog Component** (`components/DeleteConversationDialog.tsx`): New dialog component for deleting conversations
  - Shows confirmation dialog before deletion
  - Conditionally prompts to delete associated project if conversation is the only one in the project
  - Two-button layout when project deletion is available: "Delete conversation only" and "Delete conversation and project"
  - Single-button layout for regular conversation deletion
  - Loading state prevents multiple clicks during deletion
  - Disabled state during deletion prevents dialog closure
- **Delete Icon on Conversations List** (`app/(app)/chats/page.tsx`): Added hover-revealed delete icon for each conversation
  - Trash2 icon appears on hover with smooth transition
  - Positioned on the right side of each conversation item
  - Prevents navigation to conversation when clicking delete icon
  - Icon uses muted colors (gray-400) that change to red on hover

### Changed
- **Chats Page** (`app/(app)/chats/page.tsx`): Enhanced with delete functionality
  - Converted conversation items from simple buttons to containers with relative positioning
  - Added state management for delete dialog (open/close, conversation to delete, project name)
  - Added `checkIfOnlyConversationInProject` function to determine if conversation is the only one in its project
  - Added `handleDeleteConversation` function to handle deletion logic
  - Queries Supabase to count active conversations per project
  - Deletes conversation from `v2_conversations` table
  - Optionally deletes project from `v2_projects` table if requested
  - Refreshes conversations list after successful deletion
  - Shows toast notifications for success and error states
  - Handles edge cases: conversations without project_id, error handling

### Technical Details
- Delete icon uses CSS group-hover pattern for visibility control
- Icon opacity transitions from 0 to 100 on hover
- Click event propagation is stopped on delete icon to prevent navigation
- Database queries use existing RLS policies (users can delete their own conversations)
- Project deletion only occurs if user explicitly confirms and conversation is the only one in project
- Loading state prevents double-deletion and provides visual feedback
- Error handling includes user-friendly toast messages

### Impact
- Users can now delete conversations directly from the conversations list
- Smart project deletion prompt prevents orphaned projects
- Improved UX with hover-revealed actions and clear confirmation dialogs
- Proper error handling and loading states ensure reliable deletion process

## 2025-01-13 - Address Conversation Loading UI with Progressive States

### Added
- **TextShimmer Component** (`components/ui/text-shimmer.tsx`): Created animated text shimmer effect component using framer-motion
  - Supports custom colors, duration, and spread for shimmer animation
  - Works in both light and dark themes
  - Uses CSS custom properties for theme-aware colors
- **LoadingAssistantMessage Component** (`components/LoadingAssistantMessage.tsx`): New component that displays during conversation enrichment
  - Shows assistant avatar with theme-aware logo (square-black-plu.svg for light theme, square-white-plu.svg for dark theme)
  - Displays progressive loading states with TextShimmer animation:
    - Step 1: "Vérification de la zone concernée..." (when zones/municipality operations running)
    - Step 2: "Récupération des documents sources..." (when document operation running)
    - Step 3: "Récupération de l'analyse correspondante..." (when analysis processing)
    - Fallback: "Vérification des données..." (if still loading)
  - Automatically updates loading stage based on enrichment progress
- **AnalysisFoundMessage Component** (`components/AnalysisFoundMessage.tsx`): Component displayed when enrichment completes and analysis is found
  - Shows message: "Voici l'analyse concernant la zone [zone name]:" (or fallback text if zone name unavailable)
  - Displays inline artifact card for the document
  - Uses theme-aware logo in avatar
  - Handles cases where zone name is not yet available

### Changed
- **Chat Page** (`app/(app)/chat/[conversation_id]/page.tsx`): Enhanced to show loading and analysis messages
  - Added zone name extraction from research history and enrichment data
  - Shows LoadingAssistantMessage when enrichment is in progress and conversation has address message
  - Shows AnalysisFoundMessage when enrichment completes and document is found
  - Added useEffect to fetch zone name when enrichment completes
  - Zone name is extracted from zones table (description or name field)

### Technical Details
- Loading message only appears for new conversations (when enrichment_status is 'pending' or 'in_progress')
- Uses enrichment progress from `useEnrichment` hook to determine current loading stage
- Theme detection uses `next-themes` hook for logo selection
- Zone name is fetched from database when available (from research_history.zone_id or enrichment.data.zoneId)
- Smooth transition from loading message to analysis message when enrichment completes
- Components handle error states gracefully

### Impact
- Users now see visual feedback during conversation enrichment with progressive loading states
- Better UX with animated loading messages that indicate what's happening
- Analysis results are displayed immediately when found, with inline artifact cards
- Theme-aware logo ensures consistent branding across light and dark themes

## 2025-01-13 - Remove Non-Existent Analytics Tables

### Fixed
- **Analytics Errors**: Fixed `relation "public.user_monthly_usage" does not exist` and `relation "public.chat_events" does not exist` errors by removing queries to non-existent tables
  - Removed query to `user_monthly_usage` table (no longer exists)
  - Removed queries to `chat_events` table (no longer exists)
  - Removed queries to `downloads`, `ratings`, and `comments` tables (no longer used)

### Changed
- **getUserAnalytics Function** (`lib/supabase/queries-profile.ts`):
  - Removed all queries to non-existent tables (`user_monthly_usage`, `chat_events`, `downloads`, `ratings`, `comments`)
  - Now only queries `v2_messages` table for `commandsCount` (still valid)
  - Returns 0 for all analytics fields except `commandsCount` (tables removed)
  - Simplified error handling to only include errors from existing table queries

### Technical Details
- All analytics queries to non-existent tables have been removed
- Removed fields (`messageCount`, `totalCost`, `totalTokens`, `downloadsCount`, `starsCount`, `reviewsCount`) return 0 to maintain API compatibility
- Profile page will no longer show errors when loading analytics
- Only `commandsCount` is now actively queried from `v2_messages` table

## 2025-01-13 - Real-time Display Name Synchronization Across All Components

### Added
- **Event-Based Display Name Updates**: Implemented custom event system to notify all components when user pseudo/display name changes
  - Created `dispatchDisplayNameChanged()` function in `lib/utils/profile-display-name.ts` to broadcast changes
  - Added `getDisplayNameChangedEventName()` export for event listener registration
  - Events are dispatched automatically when cache is updated or cleared

### Improved
- **useDisplayName Hook** (`hooks/useDisplayName.ts`): Now listens for display name change events and updates immediately
  - Added event listener that refreshes display name when cache changes
  - Components using this hook (like sidebar) now update instantly when pseudo is modified
  - Handles both cache updates (immediate) and cache clears (refresh from DB)
- **Profile Page** (`app/(app)/profile/page.tsx`): Optimized cache update flow
  - Removed unnecessary cache clearing before setting new value
  - Now directly updates cache, which automatically notifies all components via event system
  - Display name updates propagate immediately to sidebar and all other components

### Technical Details
- Custom events are dispatched via `window.dispatchEvent()` when display name cache changes
- All components using `useDisplayName` hook automatically listen for these events
- Sidebar profile display now updates instantly when pseudo is modified in profile page
- Works for pseudo, first_name, and last_name changes (since full_name is used as fallback)
- No page refresh or manual cache clearing required

### Impact
- Sidebar profile name updates immediately when pseudo is changed
- All components displaying user display name stay synchronized automatically
- Better user experience with instant visual feedback when profile is updated

## 2025-11-12 - Remove Supabase Sessions Section

### Removed
- **Settings Page** (`app/(app)/settings/page.tsx`): Eliminated the “Sessions actives” card from the Compte tab to drop the unused Supabase session management UI.
- **SessionsList Component** (`components/settings/SessionsList.tsx`): Deleted the dedicated active sessions component and related UI dependencies.
- **Supabase Query** (`lib/supabase/queries-profile.ts`): Removed `getActiveSessions()` helper that proxied Supabase Auth session fetches.

### Changed
- **Tests** (`__tests__/components/settings-page.test.tsx`): Added coverage to ensure the settings screen no longer renders the “Sessions actives” section.

## 2025-01-13 - Profile Avatar Synchronization and Caching

### Added
- **Avatar URL Caching**: Implemented localStorage caching for profile avatar URLs to improve performance and enable instant updates across the app
  - Created `lib/utils/profile-avatar.ts` with `getCachedAvatarUrl()`, `setCachedAvatarUrl()`, and `clearCachedAvatarUrl()` functions
  - Cache duration: 24 hours (same as display name cache)
  - Cache key: `user_avatar_url`
- **useAvatar Hook**: Created `hooks/useAvatar.ts` hook to fetch and cache avatar URLs
  - Similar pattern to `useDisplayName` hook
  - Returns `{ avatarUrl, loading, refresh }`
  - Automatically checks cache first, then fetches from database if needed
- **Sidebar Avatar Display**: Updated `components/AppSidebar.tsx` to display actual avatar images
  - Now uses `AvatarImage` component with cached/database avatar URL
  - Falls back to initials if no avatar is available
  - Uses `useAvatar` hook for automatic caching and updates
- **Chat Message Avatars**: Updated `components/ChatMessage.tsx` and `components/ChatMessageBubble.tsx` to display user profile avatars
  - User messages now show actual profile pictures instead of just icons
  - Uses `useAvatar` hook to fetch and cache avatar URLs
  - Falls back to User icon if no avatar is available
  - Bot messages continue to use Bot icon (no change)

### Improved
- **Profile Avatar Upload**: Enhanced `components/profile/ProfileAvatar.tsx` to automatically update localStorage cache after successful upload
  - Avatar URL is now cached immediately after upload, ensuring instant availability across the app
- **Profile Page**: Updated `app/(app)/profile/page.tsx` to sync avatar URL cache when avatar is updated
  - `handleAvatarUpdate` now updates both local state and localStorage cache

### Technical Details
- Avatar URLs are cached in localStorage with user ID and timestamp for validation
- Cache automatically expires after 24 hours or when user changes
- All avatar displays across the app now use the cached URL for instant updates
- ChatLeftSidebar verified - only uses User icon, no avatar image display needed
- ChatMessage and ChatMessageBubble components updated to display user avatars in chat messages
- ChatMessageBubble now accepts optional `userId` prop for avatar display

## 2025-01-13 - Fix Profile Picture Upload RLS Policy

### Fixed
- **Profile Avatar Upload RLS Error**: Fixed "new row violates row-level security policy" error when uploading profile pictures
  - **Root Cause**: The RLS policies for the `avatars` storage bucket were never applied to the database, and when initially created, they used incorrect logic that didn't handle UUID user IDs correctly
  - **Issue**: User IDs are UUIDs (e.g., `131e8334-6605-4e36-86cd-8cf51e1ef017`) which contain hyphens. The original policy used `split_part(name, '-', 1)` which only extracted the first segment (`131e8334`) instead of the full UUID
  - **Solution**: Updated migration `20250113000001_fix_avatars_storage_rls_policies.sql` with correct policy logic that checks if filename STARTS WITH the user ID using `LIKE` pattern matching
  - **Policies Created**:
    - "Users can upload own avatars" - Allows authenticated users to upload files with their user ID prefix
    - "Users can update own avatars" - Allows users to update their own avatar files
    - "Users can delete own avatars" - Allows users to delete their own avatar files
    - "Anyone can view avatars" - Public read access for avatar images
  - **File Naming Pattern**: Files must be named `{userId}-{timestamp}.{ext}` (e.g., `131e8334-6605-4e36-86cd-8cf51e1ef017-1736789123456.jpg`)
  - **Policy Logic**: Uses `split_part(name, '/', -1) LIKE (auth.uid()::text || '-%')` to check if filename starts with the full user ID

### Technical Details
- Storage RLS policies control access to files in Supabase Storage buckets
- The `storage.objects` table requires RLS policies for INSERT, UPDATE, DELETE, and SELECT operations
- Policies check that the filename starts with the authenticated user's ID to ensure users can only manage their own avatars
- **IMPORTANT**: The migration file has been updated but needs to be applied manually via Supabase Dashboard SQL Editor or CLI due to storage policy permission restrictions in MCP

### Manual Application Required
To apply the fix, run the migration file `supabase/migrations/20250113000001_fix_avatars_storage_rls_policies.sql` via:
1. **Supabase Dashboard**: Go to SQL Editor and paste the migration SQL
2. **Supabase CLI**: Run `supabase db push` (if connected to the project)

## 2025-01-08 (Evening) - Fix Analytics Schema API Access

### Fixed
- **Database Migration** (`supabase/migrations/20250108000005_remove_analytics_views.sql`):
  - Removed unnecessary views `public.user_monthly_usage` and `public.chat_events`
  - Views were created as a workaround but are not needed since analytics schema is properly exposed
  - Tables exist in `analytics.user_monthly_usage` and `analytics.chat_events` and are accessed directly

- **Database Migration** (`supabase/migrations/20250108000002_expose_analytics_schema.sql`):
  - Exposed analytics schema to PostgREST API by granting USAGE and SELECT/INSERT permissions
  - Added RLS policy to allow authenticated users to insert their own chat events
  - Resolves 404 errors when querying `analytics.user_monthly_usage` and `analytics.chat_events`

- **Configuration** (`supabase/config.toml`):
  - Added "analytics" to exposed schemas array for local development
  - PostgREST will now search analytics schema when resolving table names

- **Code Updates**:
  - Updated `lib/supabase/queries-profile.ts`: Changed `.from('analytics.user_monthly_usage')` to `.from('user_monthly_usage')`
  - Updated `lib/supabase/queries-profile.ts`: Changed `.from('analytics.chat_events')` to `.from('chat_events')`
  - Updated `lib/analytics.ts`: Changed `.from('analytics.chat_events')` to `.from('chat_events')`

### Technical Details
- PostgREST doesn't support dot notation (`schema.table`) in `.from()` method
- When schemas are exposed, PostgREST searches them in order to find tables by name
- Tables are accessed directly by name (e.g., `user_monthly_usage`) and PostgREST finds them in the analytics schema
- RLS policies ensure users can only access their own data

### Impact
- Resolves 404 errors: `relation "public.analytics.user_monthly_usage" does not exist`
- Analytics queries now work correctly via REST API
- Profile page can now load user analytics data
- Chat event logging continues to work

### Production Deployment Note
- **IMPORTANT**: After applying migration, expose analytics schema in Supabase Dashboard:
  - Go to Settings > API > Exposed schemas
  - Add "analytics" to the list of exposed schemas
  - This is required for production API access

## 2025-01-08 - Fix Infinite Recursion in Profiles RLS Policies

### Fixed
- **Database Migration** (`supabase/migrations/20250108000001_fix_profiles_rls_recursion.sql`):
  - Fixed infinite recursion error (code: 42P17) in profiles table RLS policies
  - Created `is_admin()` SECURITY DEFINER function to check admin status without triggering RLS
  - Updated "Admins can view all profiles" policy to use `is_admin()` function
  - Updated "Admins can update all profiles" policy to use `is_admin()` function
  - Function bypasses RLS using SECURITY DEFINER to prevent circular policy evaluation

### Technical Details
- The admin policies were querying the `profiles` table directly, which triggered RLS policies again
- This created an infinite recursion loop when checking admin status
- Solution: Created a helper function with SECURITY DEFINER that bypasses RLS when checking admin status
- The function is STABLE and grants execute permission to authenticated users

### Impact
- Resolves 500 Internal Server Error when querying profiles, v2_conversations, and other tables
- Admin users can now properly access all profiles without recursion errors
- All queries that depend on profiles table RLS policies now work correctly

## 2025-01-07 - Add Cached Display Name in Sidebar

### Added
- **Display Name Utility** (`lib/utils/profile-display-name.ts`):
  - Created utility functions to get, set, and clear cached display name in localStorage
  - Cache duration: 24 hours
  - `getDisplayNameFromProfile()`: Returns pseudo if available, otherwise full_name
  - `getCachedDisplayName()`: Retrieves cached display name from localStorage
  - `setCachedDisplayName()`: Caches display name in localStorage
  - `clearCachedDisplayName()`: Clears cached display name

- **Display Name Hook** (`hooks/useDisplayName.ts`):
  - Created `useDisplayName` hook to fetch and cache user display name
  - Automatically checks cache first before querying database
  - Returns display name, loading state, and refresh function

### Changed
- **AppSidebar** (`components/AppSidebar.tsx`):
  - Now displays cached display name (pseudo or full_name) instead of email username
  - Falls back to email username if display name is not available
  - Uses `useDisplayName` hook to fetch and cache the display name
  - Shows loading indicator ("...") while fetching display name

- **Profile Page** (`app/(app)/profile/page.tsx`):
  - Invalidates and updates display name cache when profile is updated
  - Ensures sidebar display name updates immediately after profile changes

### Benefits
- Reduces database calls by caching display name in localStorage
- Improves performance by avoiding repeated profile queries
- Display name updates automatically when profile changes
- Cache expires after 24 hours to ensure fresh data

## 2025-12-06 - Remove user_settings Table and Related Functionality

### Removed
- **Database migration**: Deleted `supabase/migrations/20251206000001_create_user_settings.sql`
  - Removed user_settings table creation
  - Removed automatic settings creation trigger
  - Removed settings-related RLS policies

- **Profile Page** (`app/(app)/profile/page.tsx`):
  - Removed Preferences section (default_city_id, interface_language, ai_response_language)
  - Removed user_settings state and related form fields
  - Removed settings update logic from handleSave and handleCancel
  - Removed unused imports (Select components, MapPin, Languages icons, City type, getCities)

- **Settings Page** (`app/(app)/settings/page.tsx`):
  - Removed "Préférences d'affichage" section (font_size, ui_density, interface_language)
  - Removed "Historique de recherche" section (search_history_retention_days)
  - Removed "Cookies et analytics" section (cookies_consent, analytics_consent)
  - Removed user_settings state and loadSettings logic
  - Removed handleSettingChange function
  - Removed updateUserSettings import

- **Database Queries** (`lib/supabase/queries-profile.ts`):
  - Removed `updateUserSettings()` function
  - Updated `getUserProfile()` to no longer return settings
  - Removed user_settings queries from `exportUserData()`
  - Removed UserSettings type import

- **Type Definitions** (`lib/supabase.ts`):
  - Removed `UserSettings` type definition

### Changed
- Profile page now only manages basic profile fields (pseudo, first_name, last_name, full_name, phone)
- Settings page simplified to focus on account security and theme preferences only

## 2025-12-06 - Update Profile Page to Use Auth last_sign_in_at and Add Analytics

### Changed
- **Profile Page** (`app/(app)/profile/page.tsx`):
  - Now uses `last_sign_in_at` from `auth.users` table instead of `profiles.last_login_at`
  - Fetches last sign-in time directly from Supabase Auth user object
  - Added comprehensive usage analytics section displaying:
    - Message count (from analytics.user_monthly_usage or analytics.chat_events)
    - Commands count (from v2_messages where role = 'user')
    - Stars given (from ratings table)
    - Reviews given (from comments table)
    - Downloads count (from downloads table)
    - Total tokens used (from analytics schema)
    - Total cost (from analytics schema)

- **Database Queries** (`lib/supabase/queries-profile.ts`):
  - Updated `getUserProfile()`: Removed dependency on `profiles.last_login_at`
  - Added `getUserAnalytics()`: New function to fetch user usage statistics from:
    - `analytics.user_monthly_usage` for current month aggregated data
    - `analytics.chat_events` as fallback for message count, cost, and tokens
    - `public.downloads` for download count
    - `public.ratings` for stars count
    - `public.comments` for reviews count
    - `v2_messages` for commands count

### Technical Details
- Analytics data is fetched from the analytics schema using dot notation (`analytics.user_monthly_usage`, `analytics.chat_events`)
- Falls back to aggregating from `chat_events` if monthly usage data is not available
- All analytics queries handle errors gracefully and default to 0 if data is unavailable
- Last sign-in time is now sourced from Supabase Auth, which is the authoritative source

## 2025-12-06 - Build Comprehensive Profile and Settings Pages

### Added
- **Database migrations**:
  - `user_settings` table: Stores user preferences for interface, notifications, privacy, and app behavior
    - Geographic preferences (default_city_id)
    - Language preferences (interface_language, ai_response_language)
    - UI preferences (font_size, ui_density)
    - Notification preferences (notifications_enabled, plu_updates_enabled, inactive_project_reminders, weekly_digest_enabled, marketing_emails_enabled, email_frequency)
    - Privacy preferences (search_history_retention_days, cookies_consent, analytics_consent)
    - Automatic creation trigger for new users
    - RLS policies for user data access
  - `login_history` table: Stores login attempts and session history for security monitoring
    - Tracks IP address, user agent, device type, location
    - Records success/failure status
    - RLS policies for users to view own history
  - `last_login_at` column added to `profiles` table

- **Profile Page** (`app/(app)/profile/page.tsx`): Complete rebuild with comprehensive features
  - Editable avatar with upload functionality (ProfileAvatar component)
  - Editable profile fields: pseudo, full name, phone
  - Account status badge (Active/Suspended/Paused)
  - Member since and last login display
  - Quick stats section showing:
    - Projects created count
    - Documents analyzed count
    - Estimated hours saved
    - Starred projects count
  - Default geographic zone selector (city dropdown)
  - Language preferences (Interface and AI response languages)
  - Edit mode with save/cancel functionality
  - Loading states and error handling

- **Settings Page** (`app/(app)/settings/page.tsx`): Complete rebuild with 7 organized sections
  - **Account & Security Tab**:
    - Change password form with validation
    - Two-Factor Authentication toggle (UI prepared, backend later)
    - Active sessions list (SessionsList component)
    - Login history table (LoginHistoryTable component)
    - Delete account dialog with 30-day delay confirmation
  - **App Preferences Tab**:
    - Theme selection (Light/Dark/System)
    - Font size selector (Small/Medium/Large)
    - UI density selector (Compact/Comfortable/Spacious)
    - Interface language selector
  - **Notifications & Alerts Tab**:
    - In-app notifications toggle
    - PLU updates toggle
    - Inactive project reminders toggle
    - Weekly digest toggle
    - Marketing emails toggle
    - Email frequency selector (Daily/Weekly/Monthly/Never)
  - **Privacy & Data Tab**:
    - Download my data button (DataExportDialog component)
    - Search history retention selector
    - Cookies consent toggle
    - Analytics consent toggle
    - GDPR compliance info
  - **Billing & Subscription Tab**: Placeholder structure for future implementation
  - **Integrations Tab**: Placeholder structure for future implementation
  - **About & Legal Tab**:
    - App version display
    - Links to CGU, Privacy Policy, GDPR
    - Support contact information

- **Supporting Components**:
  - `ProfileAvatar` (`components/profile/ProfileAvatar.tsx`): Editable avatar with file upload
  - `ProfileStats` (`components/profile/ProfileStats.tsx`): Statistics cards display
  - `SettingsSection` (`components/settings/SettingsSection.tsx`): Reusable section wrapper
  - `SettingsRow` (`components/settings/SettingsSection.tsx`): Reusable settings row component
  - `SessionsList` (`components/settings/SessionsList.tsx`): Active sessions display and management
  - `LoginHistoryTable` (`components/settings/LoginHistoryTable.tsx`): Login history table with filtering
  - `DeleteAccountDialog` (`components/settings/DeleteAccountDialog.tsx`): Account deletion confirmation dialog
  - `DataExportDialog` (`components/settings/DataExportDialog.tsx`): Data export UI with JSON/CSV options

- **Database Query Functions** (`lib/supabase/queries-profile.ts`):
  - `getUserProfile()`: Fetch profile + settings
  - `updateUserProfile()`: Update profile fields
  - `updateUserSettings()`: Update settings
  - `getUserStatistics()`: Aggregate stats from projects/documents
  - `getLoginHistory()`: Fetch user login history
  - `logLoginAttempt()`: Log login attempt to history
  - `getActiveSessions()`: Fetch from Supabase Auth
  - `exportUserData()`: Generate JSON/CSV export
  - `requestAccountDeletion()`: Set deletion_requested_at with 30-day delay
  - `updateLastLogin()`: Update last login timestamp
  - `getCities()`: Get all cities for dropdown selection

- **Utility Functions** (`lib/utils/profile-helpers.ts`):
  - `calculateHoursSaved()`: Estimate hours saved based on projects/documents
  - `formatLastLogin()`: Format timestamp for display (relative time)
  - `getAccountStatus()`: Determine status from profile
  - `formatAccountStatus()`: Format status for display
  - `getStatusBadgeColor()`: Get badge color for status

- **Type Definitions** (`lib/supabase.ts`):
  - `UserSettings` type: Complete type definition for user settings
  - `LoginHistory` type: Type definition for login history entries
  - Updated `Profile` type: Added `last_login_at` field

### Changed
- **Profile Page**: Complete rewrite with new features and improved UX
- **Settings Page**: Complete rewrite with tabbed interface and comprehensive settings management

### Technical Details
- All database operations use RLS policies for security
- Settings are automatically created for new users via trigger
- Form validation and error handling throughout
- Loading states and optimistic updates where appropriate
- Toast notifications for user feedback
- Responsive design for mobile and desktop
- Follows existing B/W minimal design aesthetic
- Uses existing UI components (Card, Tabs, Accordion, Input, Select, Switch, Button, etc.)

## 2025-01-XX - Add Search Functionality to Chats Page

### Added
- **Search bar** (`app/(app)/chats/page.tsx`): Added search functionality to the chats page
  - Search input field in the header with search icon and clear button
  - Searches across conversation titles, addresses (from context_metadata), and message content
  - Real-time search with 300ms debounce for performance
  - Results are filtered and sorted by last_message_at
  - Empty state message adapts based on whether search is active
  - Clear button (X) appears when search query is entered

### Technical Details
- Search implementation:
  - Client-side filtering for conversation titles and addresses (from loaded conversations)
  - Database query for message content using PostgreSQL ILIKE for case-insensitive pattern matching
  - Results are deduplicated and sorted by last activity time
- State management:
  - `allConversations`: Stores all loaded conversations (for client-side filtering)
  - `conversations`: Stores filtered/search results
  - `searchQuery`: Tracks current search input
- Search covers:
  1. Conversation title (`v2_conversations.title`)
  2. Initial address (`v2_conversations.context_metadata->>'initial_address'`)
  3. Message content (`v2_messages.message`)

## 2025-01-XX - Fix Sidebar Skeleton States for Open/Closed States

### Fixed
- **Sidebar skeleton for open state** (`components/AppSidebar.tsx`): Added skeleton UI when sidebar is open during page load/refresh
  - Sidebar now shows skeleton with logo, navigation links, and user dropdown placeholders when open during loading
  - Prevents sidebar from appearing closed and then reopening on refresh
  - Skeleton matches the open sidebar layout (logo + 3 navigation items + recent conversations section)
- **Hydration error** (`components/ui/sidebar.tsx`, `components/AppSidebar.tsx`): Fixed React hydration mismatch error
  - Added `suppressHydrationWarning` to `DesktopSidebar` motion.div to handle intentional width differences between server and client
  - Sidebar state always initializes as `false` to match server-side rendering
  - State is restored from localStorage in `useLayoutEffect` which runs synchronously before paint
  - Skeleton only shows on client (`typeof window !== 'undefined'`) to prevent server/client content mismatch
  - Prevents hydration errors while maintaining correct sidebar state restoration

### Added
- **Sidebar state utility** (`lib/utils/sidebar-state.ts`): New utility function to read sidebar state from localStorage synchronously
  - `getSidebarState()`: Returns boolean indicating if sidebar should be open
  - Handles server-side rendering gracefully (returns `false` on server)
  - Used for reference but actual state restoration happens in `useLayoutEffect`

### Technical Details
- Sidebar skeleton shows when `open && (isLoading || isInitialRestore) && typeof window !== 'undefined'` 
  - `isLoading = !mounted || !hasRestoredState`
  - `isInitialRestore = initialOpenStateRef.current !== null && !hasRestoredState`
  - This ensures skeleton shows during the brief window when `open` is `true` but `hasRestoredState` is still `false`
- Skeleton includes: logo area, 3 navigation link placeholders, recent conversations section placeholder, and user dropdown placeholder
- State always initializes as `false` to match server, then `useLayoutEffect` restores from localStorage synchronously before paint
- `setHasRestoredState(true)` is delayed using `requestAnimationFrame` to ensure React renders with `open=true` and `hasRestoredState=false` first, allowing skeleton to display
- `suppressHydrationWarning` on DesktopSidebar handles intentional width differences (server: 60px, client: may be 300px)
- `initialOpenStateRef` tracks the initial state from localStorage to help determine if we're in the restoration phase
- This ensures no hydration errors while maintaining correct sidebar state and skeleton display

## 2025-01-XX - Fix Sidebar State Persistence and Hydration Issues

### Fixed
- **Hydration error** (`components/AppSidebar.tsx`): Fixed React hydration mismatch error
  - Sidebar state now always starts as `false` on both server and client to match SSR
  - State is loaded from localStorage only after hydration completes in `useEffect`
  - Prevents server/client HTML mismatch that caused hydration errors
- **Sidebar state persistence** (`components/AppSidebar.tsx`): Fixed sidebar collapsing and unwanted animations on page refresh
  - Added localStorage persistence for sidebar open/closed state
  - State is loaded from localStorage after hydration (not synchronously)
  - Sidebar state is saved to localStorage whenever it changes (after hydration)
  - Uses `isHydrated` flag to control when animations are enabled
- **Animation control** (`components/ui/sidebar.tsx`): Prevented unwanted animations on page refresh
  - `SidebarLink` components now respect `animate` flag - no animation when sidebar is already open on refresh
  - `RecentConversations` component respects `animate` flag - renders immediately without animation when sidebar is already open
  - `DesktopSidebar` sets transition duration to 0 when `animate` is false
  - Avatar username text respects `isHydrated` flag to prevent animation on initial render
- **Logo component** (`components/ui/sidebar.tsx`): Fixed logo re-animation on refresh
  - Logo now defaults to light mode for SSR consistency
  - Only switches to dark mode after client-side hydration completes
  - Prevents logo from animating/re-rendering unnecessarily

### Technical Details
- Sidebar state is persisted in localStorage with key `sidebar-open`
- State always initializes as `false` to match server-side rendering
- `isHydrated` flag tracks when client-side hydration is complete
- `animate={isHydrated}` prop enables animations only after hydration
- All animated components (SidebarLink, RecentConversations, Avatar text) check `animate` flag before animating
- Logo uses `mounted` state to prevent hydration mismatch with theme detection

## 2025-01-XX - Move Sidebar to Route Group Layout

### Changed
- **Route structure**: Refactored to use Next.js route groups for better performance
  - Created `app/(app)/layout.tsx` with shared `AppSidebar` component
  - Moved all authenticated pages into `app/(app)/` route group:
    - `app/page.tsx` → `app/(app)/page.tsx`
    - `app/chats/page.tsx` → `app/(app)/chats/page.tsx`
    - `app/projects/page.tsx` → `app/(app)/projects/page.tsx`
    - `app/project/[id]/page.tsx` → `app/(app)/project/[id]/page.tsx`
    - `app/chat/[conversation_id]/page.tsx` → `app/(app)/chat/[conversation_id]/page.tsx`
    - `app/profile/page.tsx` → `app/(app)/profile/page.tsx`
    - `app/settings/page.tsx` → `app/(app)/settings/page.tsx`
  - Moved `app/chat/[conversation_id]/useEnrichment.ts` → `app/(app)/chat/[conversation_id]/useEnrichment.ts`
- **Sidebar optimization**: `AppSidebar` now renders once at the root layout level instead of re-rendering on every page navigation
  - Removed `AppSidebar` import and usage from all individual pages
  - Removed outer flex container wrappers from pages (now handled by layout)
  - Sidebar persists across navigation without re-mounting

### Technical Details
- Route groups use parentheses `(app)` to organize routes without affecting URL structure
- The layout in `app/(app)/layout.tsx` wraps all authenticated pages with sidebar and flex layout
- Public pages (login/signup) remain outside the route group and don't have sidebar
- This improves performance by preventing sidebar re-renders on navigation

## 2025-01-XX - Page Cleanup and Project Page Redesign

### Removed
- **Dashboard page** (`app/dashboard/page.tsx`): Removed duplicate dashboard page, consolidated to `/projects`
- **PLU page** (`app/plu/page.tsx`): Removed legacy PLU chat interface
- **PLU components** (`components/plu/`): Removed unused PLU-specific components (LeftSidebar, RightPanel, ChatArea, ChatInput, ChatMessage, ContextBadge, EmptyState)
- **Test pages**: Removed all test pages:
  - `app/test-breadcrumb/page.tsx`
  - `app/test-cache/page.tsx`
  - `app/test-enrichment/page.tsx`
  - `app/test-progressive/page.tsx`
  - `app/test-skeletons/page.tsx`

### Changed
- **Route consolidation**: All `/dashboard` redirects updated to `/projects`
  - Updated `app/project/[id]/page.tsx` redirects
- **ProjectCard component** (`components/ProjectCard.tsx`): Updated navigation to go to `/project/[id]` instead of `/chat/[conversation_id]`
- **Project page** (`app/project/[id]/page.tsx`): Complete redesign
  - Now fetches and displays project information (name, type, status, address)
  - Lists all conversations belonging to the project
  - Shows conversation titles, message counts, and last activity
  - Includes AddressInput component to create new conversations directly within the project
  - New conversations are automatically linked to the project (bypasses address checking)
  - Clicking a conversation navigates to `/chat/[conversation_id]`
  - Uses AppSidebar for consistent navigation
  - Responsive layout with proper loading states

### Technical Details
- Project page queries `v2_projects` and `v2_conversations` filtered by `project_id`
- Conversations created from project page are directly linked via `project_id` parameter
- Address input bypasses duplicate checking when creating conversations within a project context
- All conversations display with metadata (address, message count, last activity)

## 2025-11-12 - Fixed Logo Missing on Chat Conversation Page Sidebar

### Fixed
- **AppSidebar component** (`components/AppSidebar.tsx`): Fixed logo not displaying when sidebar is open on chat conversation pages
  - Removed `isChatConversationPage` check that was preventing logo from showing
  - Logo now displays consistently on all pages when sidebar is open
  - Removed unused `pathname` variable and `usePathname` import

## 2025-01-XX - Breadcrumb Header for Chat Conversations

### Added
- **Breadcrumb navigation header** (`components/ConversationBreadcrumb.tsx`): Added breadcrumb component above chat messages showing project name and conversation name
  - Project name displays as clickable text link (navigates to project page) or "Untitled Project" if no project
  - Conversation name displays as plain text without dropdown menu
  - Plain text styling without rounded rectangle borders
  - Positioned above messages, below AppSidebar

### Changed
- **Breadcrumb component** (`components/ConversationBreadcrumb.tsx`): Removed dropdown menu from conversation breadcrumb
  - Removed ConversationActions dropdown menu to prevent blocking conversation name
  - Changed default project name from "Untitled" to "Untitled Project" for clarity
  - Simplified component interface by removing onRename and onDelete props

- **Rename conversation dialog** (`components/RenameConversationDialog.tsx`): Added dialog component for renaming conversations
  - Input field for new conversation title
  - Save and cancel buttons
  - Validates that title is not empty
  - Updates conversation title in database on save

### Changed
- **Chat conversation page** (`app/chat/[conversation_id]/page.tsx`): Enhanced with breadcrumb header and conversation management
  - Fetches project data when `conversation.project_id` exists
  - Added state management for project, rename dialog, and delete dialog
  - Implemented `handleRename` to open rename dialog
  - Implemented `handleSaveRename` to update conversation title in database
  - Implemented `handleDelete` to archive conversation (set `is_active = false`) and redirect to `/chats`
  - Breadcrumb component integrated above ScrollArea
  - Rename and delete dialogs integrated

- **ConversationActions component** (`components/ConversationActions.tsx`): Updated menu text to reference "conversation" instead of "projet"
  - "Renommer le projet" → "Renommer la conversation"
  - "Supprimer le projet" → "Supprimer la conversation"

- **DeleteProjectDialog component** (`components/DeleteProjectDialog.tsx`): Updated text to reference "conversation" instead of "projet"
  - Dialog title: "Supprimer le projet ?" → "Supprimer la conversation ?"
  - Description updated to remove mention of "toutes les conversations associées"

### Technical Details
- Created `ConversationBreadcrumb` component using shadcn breadcrumb components
- Removed Badge components to use plain text styling, preventing text truncation by dropdown icon
- Created `RenameConversationDialog` component using shadcn dialog and input components
- Added project fetching logic in `loadConversation` function
- Conversation name derived from `conversation.title` or `context_metadata.initial_address`
- Project name defaults to "Untitled" if `project.name` is null
- Breadcrumb positioned in flex layout between AppSidebar and ScrollArea
- All handlers include proper error handling and state updates

## 2025-01-XX - Chat Conversation Page Improvements

### Added
- **Sidebar in chat conversation page** (`app/chat/[conversation_id]/page.tsx`): Added AppSidebar to chat conversation pages for navigation
  - Users can now access navigation links and recent conversations from chat pages
  - Sidebar maintains consistent behavior across all pages

### Changed
- **Logo visibility** (`components/AppSidebar.tsx`): Logo is now hidden on chat conversation pages when sidebar is open
  - Logo only shows on non-chat pages to reduce visual clutter during conversations
  - Uses `usePathname` hook to detect chat conversation routes (`/chat/[id]`)
  - Sidebar toggle button remains visible for navigation

- **Initial address as first message** (`app/chat/[conversation_id]/page.tsx`): Initial address from conversation metadata is now displayed as the first message
  - Address from `context_metadata.initial_address` is shown as a user message with type `address_search`
  - Appears before all other messages, even for existing conversations
  - Messages are sorted by `conversation_turn` first, then by `created_at` to ensure proper order
  - Prevents duplicate address messages if address already exists in message history

- **Simplified chat layout** (`app/chat/[conversation_id]/page.tsx`, `components/ui/ai-prompt-box.tsx`): Removed split layout from chat interface
  - Chat interface now uses a clean single-column layout: sidebar + full-width chat area
  - Removed complex `motion.div` positioning animations that created visual splits
  - Input box now uses simple flex layout at bottom instead of fixed positioning
  - Removed two-cell split layout (75%/25%) from PromptInputBox component
  - Logo removed from input box when in chat conversation (only shows on homepage)
  - Ensures consistent, non-split layout throughout the chat interface

### Technical Details
- Added `AppSidebar` import and component to chat conversation page layout
- Modified `loadConversation` function to prepend initial address message when loading conversation
- Added message sorting logic to ensure chronological order
- Used `usePathname` hook in AppSidebar to conditionally render Logo component
- Initial address message uses `conversation_turn: 0` when prepending to existing messages
- Replaced `motion.div` with fixed positioning with simple `flex-none` div for input box
- Removed unused `motion` and `cn` imports from framer-motion

## 2025-01-XX - Profile Dropdown Positioning Fix

### Fixed
- **Profile dropdown menu positioning** (`components/AppSidebar.tsx`): Fixed dropdown menu positioning when sidebar is expanded
  - Changed dropdown to appear above the profile row (`side="top"`) when sidebar is open, instead of extending to the right edge
  - Added conditional z-index (`z-[100]`) to ensure dropdown appears above profile row
  - Maintains original behavior (`side="right"`) when sidebar is collapsed for better space management

### Technical Details
- Conditionally sets `side` prop: `"top"` when sidebar is open, `"right"` when collapsed
- Uses `cn()` utility to conditionally apply `z-[100]` class based on `open` state
- Dropdown now appears directly above the profile button row, improving space management within the sidebar

## 2025-01-XX - Theme-Aware Logo Implementation

### Added
- **Theme-aware logo switching**: All logo instances now automatically switch between dark and white versions based on the current theme
  - White logo (`MWPLU_white.svg`) displays in dark mode
  - Dark logo (`MWPLU.svg`) displays in light mode
  - Updated components:
    - `components/ui/sidebar.tsx` - Logo and LogoIcon components
    - `components/Navbar.tsx` - Navbar logo
    - `components/ChatLeftSidebar.tsx` - Sidebar logo
    - `components/plu/EmptyState.tsx` - Empty state logo
    - `components/plu/LeftSidebar.tsx` - Left sidebar logo
  - Uses `useTheme` hook from `next-themes` with `resolvedTheme` to detect dark mode
  - Includes `mounted` state check to prevent hydration mismatches

### Technical Details
- All logo components now use conditional rendering: `src={isDarkMode ? "/MWPLU_white.svg" : "/MWPLU.svg"}`
- Theme detection pattern: `const isDarkMode = mounted && resolvedTheme === 'dark'`
- Ensures consistent logo appearance across all pages and components

## 2025-11-12 - Theme Selector Fix

### Fixed
- **Theme selector functionality** (`components/ThemeProvider.tsx`): Fixed theme switching (light/dark/system) not working
  - Added required `next-themes` configuration props:
    - `attribute="class"` - Enables `.dark` class toggling on HTML element
    - `defaultTheme="system"` - Defaults to system preference
    - `enableSystem` - Enables system theme detection
    - `disableTransitionOnChange={false}` - Allows smooth theme transitions
  - Theme buttons in AppSidebar and Settings page now properly switch themes
  - Theme preference is now persisted and applied correctly

### Technical Details
- The ThemeProvider was missing critical configuration props required by `next-themes`
- Without `attribute="class"`, the library couldn't apply the `.dark` class to the HTML element
- System theme detection now works correctly when "system" mode is selected

## 2025-01-XX - Sidebar Icon Alignment Fix

### Fixed
- **Sidebar icon alignment** (`components/ui/sidebar.tsx`): Fixed icon positioning to remain left-aligned during sidebar animations
  - Replaced animated `motion.div` wrapper with fixed-width container (`w-5`) for icons
  - Icons now stay in fixed position and don't shift during expand/collapse animations
  - Added `flex-shrink-0` to prevent icon container from shrinking
- **Avatar icon alignment** (`components/AppSidebar.tsx`): Fixed user avatar icon to remain left-aligned consistently
  - Removed conditional `justify-center`/`justify-start` logic
  - Avatar now always uses `justify-start` with fixed-width container
  - Ensures consistent left alignment regardless of sidebar state

### Technical Details
- Icon containers use fixed width (`w-5`) instead of dynamic width based on sidebar state
- Removed `motion.div` animations from icon containers that caused position shifts
- Text labels animate independently without affecting icon positions

## 2025-11-12 - Animated Sidebar Integration

### Added
- **framer-motion dependency**: Installed framer-motion package for sidebar animations
- **Sidebar component** (`components/ui/sidebar.tsx`): New animated sidebar component with:
  - Hover-to-expand functionality on desktop
  - Mobile overlay sidebar with slide animations
  - Recent conversations display when expanded
  - Logo components (Logo and LogoIcon) using MWPLU branding
- **AppSidebar component** (`components/AppSidebar.tsx`): Wrapper component integrating sidebar with:
  - Navigation links (New chats, Chat, Projects)
  - Profile dropdown menu with Settings, Profile, Theme toggle, and Sign out
  - User avatar display
- **ThemeProvider** (`components/ThemeProvider.tsx`): Added next-themes ThemeProvider wrapper
- **New pages**:
  - `/app/chats/page.tsx`: Conversations list page with scrollable conversation list
  - `/app/projects/page.tsx`: Projects page (renamed from dashboard)
  - `/app/profile/page.tsx`: User profile page with account information
  - `/app/settings/page.tsx`: Settings page with theme toggle (light/dark/system)

### Changed
- **Layout** (`app/layout.tsx`): Added ThemeProvider wrapper for theme support
- **Home page** (`app/page.tsx`): Replaced ChatLeftSidebar with AppSidebar
- **Chat page** (`app/chat/[conversation_id]/page.tsx`): Replaced ChatLeftSidebar with AppSidebar, added dark mode support
- **Route updates**: Changed `/dashboard` route to `/projects`:
  - Updated `components/ChatSidebar.tsx` to navigate to `/projects`
  - Updated `app/project/[id]/page.tsx` redirects to `/projects`
  - Updated `middleware.ts` matcher to include `/projects`
- **Sidebar features**:
  - Recent conversations appear on hover and disappear when hover ends
  - Profile menu includes Settings, Profile, Theme toggle, and Sign out
  - Navigation links: New chats (/), Chat (/chats), Projects (/projects)

### Technical Details
- Sidebar expands from 60px to 300px on hover (desktop)
- Mobile sidebar slides in from left as overlay
- Recent conversations fetched from `v2_conversations` table when sidebar opens
- Theme toggle supports light, dark, and system preferences
- All pages updated with dark mode styling support

## 2025-01-XX - Brand Assets Integration

### Added
- **Favicon metadata**: Added favicon configuration to `app/layout.tsx` using Next.js Metadata API
  - References `/favicon/favicon.ico` for browser tab icon

### Changed
- **Brand logo integration**: Replaced text "MWPLU" placeholders with SVG logo image across all components
  - **Navbar**: Replaced text heading with logo (h-8 size)
  - **ChatArea**: Replaced large text heading with logo in initial state (h-20 size)
  - **LeftSidebar (PLU)**: Replaced text heading with logo (h-8 size)
  - **ChatLeftSidebar**: Replaced text heading with logo in expanded state (h-8 size)
  - **EmptyState**: Replaced text heading with logo (h-16 size)
- All logos use Next.js `Image` component for optimized loading with appropriate sizing for each context
- Logo maintains aspect ratio with `w-auto` and uses `priority` flag for above-the-fold instances

## 2025-01-27 - Comprehensive Style Guide Documentation

### Added
- **STYLE_GUIDE.md**: Created comprehensive design system documentation covering:
  - Overview and design philosophy
  - Complete color palette (light & dark themes) with hex values and usage guidelines
  - Typography system (Lato font family, weights, sizes, line heights, responsive adjustments)
  - Spacing system (rem-based scale with usage patterns)
  - Component styles (buttons, forms, cards, badges, alerts, breadcrumbs, chat components, project cards)
  - Shadows & elevation hierarchy
  - Animations & transitions (durations, common patterns, custom keyframes)
  - Border radius scale and usage
  - Opacity & transparency values
  - Common Tailwind CSS usage patterns and utilities
  - Example component reference design code (Button, Card, Badge, Chat Input, Project Card)
  - Responsive design breakpoints and mobile-first approach
  - Dark mode implementation and color adjustments
  - Accessibility guidelines (contrast ratios, focus states, touch targets)
  - Best practices for CSS variables, component styling, theme transitions, and responsive design

## 2025-01-27 - Conversation Card Mobile Optimization

### Changed
- **ConversationCard Component**: Reduced font sizes and padding for mobile to create a rectangular (row) layout instead of square
  - Reduced CardTitle from `text-xl` (20px) to `text-sm` (14px) on mobile, `sm:text-base` (16px) on larger screens
  - Reduced CardDescription from `text-sm` (14px) to `text-xs` (12px) on mobile, `sm:text-sm` (14px) on larger screens
  - Reduced last message text from `text-sm` (14px) to `text-xs` (12px) on mobile, `sm:text-sm` (14px) on larger screens
  - Reduced time info from `text-xs` (12px) to `text-[0.6875rem]` (11px) on mobile, `sm:text-xs` (12px) on larger screens
  - Reduced CardHeader padding from `p-6` (24px) to `p-3` (12px) on mobile, `sm:p-6` (24px) on larger screens
  - Reduced CardContent padding from `p-6` (24px) to `p-3` (12px) on mobile, `sm:p-6` (24px) on larger screens
  - Reduced spacing between elements from `space-y-2` to `space-y-1.5` on mobile, `sm:space-y-2` on larger screens
  - Reduced icon sizes: MapPin from `h-4 w-4` to `h-3 w-3` on mobile, Clock from `h-3 w-3` to `h-2.5 w-2.5` on mobile
  - Reduced gaps from `gap-2` to `gap-1.5` on mobile for tighter spacing

## 2025-01-27 - Messenger/WhatsApp-Style Chat Interface Styling for Mobile

### Changed
- **Chat Message Components**: Reduced font sizes and spacing for mobile-first Messenger/WhatsApp-like experience
  - **ChatMessageBubble**: 
    - Reduced font size from `text-[15px]` to `text-sm` (14px) on mobile, `sm:text-[15px]` on larger screens
    - Reduced padding from `px-4 py-4` to `px-3 py-2` on mobile, `sm:px-4 sm:py-2.5` on larger screens
    - Reduced gap between avatar and message from `gap-3` to `gap-2` on mobile
    - Changed avatars from `h-9 w-9` to `h-8 w-8` on mobile, `sm:h-9 sm:w-9` on larger screens
    - Changed avatars from rounded-lg to rounded-full for more modern look
    - Reduced message bubble padding from `px-5 py-3.5` to `px-3 py-2` on mobile
    - Removed ring/shadow effects for cleaner look
  - **ChatMessage**:
    - Reduced font size to `text-sm` on mobile, `sm:text-base` on larger screens
    - Reduced padding from `py-5 px-6` to `py-2.5 px-3` on mobile, `sm:py-3 sm:px-4` on larger screens
    - Reduced gap from `gap-4` to `gap-2` on mobile, `sm:gap-3` on larger screens
    - Changed avatars to rounded-full and smaller sizes (h-8 w-8 on mobile)
    - Reduced spacing in markdown elements (lists, headings, blockquotes) for mobile
  - **PLU ChatMessage**:
    - Reduced padding from `py-24 px-24` to `py-2 px-3` on mobile, `sm:py-3 sm:px-4` on larger screens
    - Reduced font size to `text-sm` on mobile, `sm:text-[15px]` on larger screens
    - Reduced avatar size from `h-32 w-32` to `h-8 w-8` on mobile, `sm:h-9 sm:w-9` on larger screens
    - Changed avatars to rounded-full
    - Reduced spacing throughout (gaps, margins, padding) for mobile
    - Reduced suggested question button sizes for mobile
  - **Chat Conversation Page**:
    - Reduced ScrollArea padding from `p-4` to `p-2` on mobile, `sm:p-4` on larger screens
    - Reduced spacing between messages from `space-y-4` to `space-y-1` on mobile, `sm:space-y-2` on larger screens
  - **Chat Input Components**:
    - **ChatInput & ChatInputField**:
      - Reduced font size from `text-base` to `text-xs` (12px) on mobile, `sm:text-base` on larger screens
      - Reduced padding from `p-4` to `p-[1px]` (1px) on mobile, `sm:p-4` on larger screens
      - Reduced input container padding from `p-3` to `p-[1px]` (1px) on mobile
      - Reduced gap from `gap-2` to `gap-[2px]` (2px) on mobile
      - Reduced min-height from `min-h-[44px]` to `min-h-[36px]` on mobile
      - Reduced button size from `h-8 w-8` to `h-7 w-7` (28px) on mobile, `sm:h-9 sm:w-9` on larger screens
      - Reduced send icon size from `h-4 w-4` to `h-3.5 w-3.5` (14px) on mobile
      - Reduced right padding from `pr-8` to `pr-7` on mobile
    - **PLU ChatInput**:
      - Reduced font size to `text-xs` (12px) on mobile, `sm:text-base` on larger screens
      - Reduced padding from `p-4` to `p-[1px]` (1px) on mobile
      - Reduced gap from `gap-3` to `gap-[2px]` (2px) on mobile
      - Reduced button size from `h-9 w-9` to `h-7 w-7` (28px) on mobile, `sm:h-10 sm:w-10` on larger screens
      - Reduced send icon size from `h-4 w-4` to `h-3.5 w-3.5` (14px) on mobile
      - Reduced right padding from `pr-12` to `pr-10` on mobile
    - **PLU ChatArea**:
      - Reduced padding from `p-16` to `p-[1px]` (1px) on mobile, `sm:p-4 md:p-6` on larger screens
      - Reduced font size to `text-xs` (12px) on mobile, `sm:text-base` on larger screens
      - Reduced min-height from `min-h-[44px]` to `min-h-[36px]` on mobile
      - Reduced button size from `h-9 w-9` to `h-7 w-7` (28px) on mobile, `sm:h-10 sm:w-10 md:h-11 md:w-11` on larger screens
      - Reduced send icon size from `h-4 w-4` to `h-3.5 w-3.5` (14px) on mobile
      - Reduced right padding from `pr-12` to `pr-10` on mobile
      - Reduced button positioning from `right-2 bottom-2` to `right-1 bottom-1` on mobile
  - **Style Reference CSS**:
    - Added explicit font-size to `.chat-content` and `.chat-content p` (14px mobile, 15px desktop)
    - Updated mobile media query with reduced padding and font sizes

### Files Modified
- `components/ChatMessageBubble.tsx`: Mobile-first responsive styling
- `components/ChatMessage.tsx`: Mobile-first responsive styling
- `components/plu/ChatMessage.tsx`: Mobile-first responsive styling
- `components/ChatInput.tsx`: Mobile-first responsive font and button sizes
- `components/ChatInputField.tsx`: Mobile-first responsive font and button sizes
- `components/plu/ChatInput.tsx`: Mobile-first responsive font and button sizes
- `components/plu/ChatArea.tsx`: Mobile-first responsive font and button sizes (fixed button size typo)
- `app/chat/[conversation_id]/page.tsx`: Reduced spacing between messages
- `style-reference.css`: Added explicit font sizes for chat content

### Result
- More compact, Messenger/WhatsApp-like chat interface on mobile
- Smaller, more readable font sizes optimized for mobile screens (14px mobile, 15px desktop)
- Tighter spacing and padding for better mobile UX
- Appropriately sized buttons and icons for mobile touch targets
- Maintains larger, more comfortable sizing on desktop screens
- Modern rounded-full avatars for cleaner appearance
- Consistent mobile-first design across all chat components

## 2025-01-27 - Removed Mobile Section Padding

### Changed
- **Mobile Section Styling**: Removed padding from `.section` elements on mobile devices
  - Changed mobile media query (`@media (max-width: 767px)`) to set `.section` padding to `0` instead of `var(--spacing-md)`
  - Sections now display edge-to-edge on mobile while maintaining margins and other styles
  - Improves mobile layout by maximizing available screen space

### Files Modified
- `style-reference.css`: Updated mobile media query for `.section` padding

### Result
- Cleaner mobile layout with sections extending to screen edges
- Better use of mobile screen real estate
- Consistent edge-to-edge design on mobile devices

## 2025-01-XX - Enhanced Breadcrumb Component UI Design with Icon Support

### Enhanced
- **Breadcrumb Component**: Improved visual design and user experience
  - Increased spacing between items (gap-2 to gap-3 on larger screens)
  - Enhanced link hover states with smooth underline animation and color transitions
  - Added focus-visible states for better keyboard accessibility
  - Improved separator styling with muted colors for better visual hierarchy
  - Enhanced current page styling with medium font weight and text truncation
  - Added optional `variant` prop with 'subtle' option for background styling
  - Better visual separation with improved separator opacity and sizing
  - **Built-in icon support**: Added `icon` prop to `BreadcrumbLink` and `BreadcrumbPage` components
    - Accepts any Lucide icon component
    - Icons automatically sized (h-4 w-4) and properly spaced
    - Icons use `shrink-0` to prevent compression
    - Works seamlessly with existing hover and focus states
  - **Style Reference Updated**: Updated `style-reference.html` and `style-reference.css` to showcase breadcrumb examples with icons
    - Added three breadcrumb examples: default, with icons, and subtle variant
    - Icons displayed using inline SVG matching Lucide icons
    - Improved CSS styling matching React component improvements
    - Added dark mode support for subtle variant
  - Publish header button now explicitly keeps dark text in light mode (and white in dark mode)

### Files Modified
- `components/ui/breadcrumb.tsx`: Enhanced all breadcrumb sub-components with improved styling and icon support
- `app/test-breadcrumb/page.tsx`: Updated examples to showcase icon usage
- `style-reference.html`: Added breadcrumb examples with icons
- `style-reference.css`: Enhanced breadcrumb styling with icon support and improved hover states

### Result
- More polished and modern breadcrumb navigation
- Better accessibility with focus states
- Improved visual hierarchy and readability
- Smooth hover and transition effects
- Easy icon integration with simple `icon` prop
- Style reference page now accurately reflects component improvements with visual examples

## 2025-01-XX - Improved UI Style Reference: Contrast, Hierarchy, and Personality

### Fixed
- **WCAG AA Contrast Compliance**: Fixed critical contrast issues in dark mode
  - Updated `--text-secondary` from `#d1d5db` to `#e5e7eb` (meets 4.5:1 ratio)
  - Updated `--text-muted` from `#9ca3af` to `#b1b5bb` (WCAG AA compliant)
  - All text now meets minimum 4.5:1 contrast ratio for normal text

### Enhanced
- **Visual Hierarchy**: Improved card elevation and separation
  - Enhanced shadow system for dark mode (stronger shadows with better opacity)
  - Added hover states with `translateY` transforms for cards
  - Improved border colors on hover for better visual feedback
  - Cards now have clearer elevation levels (sm, md, lg)

- **Badge Visibility**: Made badges more prominent and readable
  - Added borders to all badge variants for better definition
  - Enhanced `badge-secondary` with darker background in dark mode (`#333333`)
  - Increased `badge-outline` border width to 1.5px for better visibility
  - Added transitions for smooth interactions

- **Destructive Alerts**: Made error alerts attention-grabbing and RED
  - Light mode: Bright red border (`#ef4444`) with 2px width and subtle glow
  - Dark mode: Dark red background (`#7f1d1d`) with bright red border and glow effect
  - High contrast text colors for maximum readability
  - Added subtle shadow/glow effects for immediate attention

- **Micro-interactions & Personality**: Added subtle animations and warmth
  - Button hover states with `translateY(-1px)` and shadow effects
  - Icon buttons scale to 1.05 on hover
  - Focus states with blue outline and offset for accessibility
  - Form inputs have blue focus rings with subtle shadow
  - Smooth transitions (0.2s ease) throughout for polished feel
  - Component examples have hover shadow effects

- **HTML Examples**: Updated inline styles for better visibility
  - Increased icon sizes for conversation count and timestamps
  - Improved font sizes for better readability
  - Enhanced badge font-weight for prominence

### Files Modified
- `style-reference.css`: Updated CSS variables, enhanced shadows, improved badges, fixed alerts, added micro-interactions
- `style-reference.html`: Updated inline styles for icons and text sizes

### Result
- All text meets WCAG AA accessibility standards
- Clear visual hierarchy with proper elevation and separation
- Destructive alerts immediately grab attention
- More polished, interactive feel while maintaining minimalism
- Better contrast and readability across all components

## 2025-01-XX - Created UI Style Reference Page

### Added
- **Style Reference Page**: Created comprehensive standalone HTML reference page (`style-reference.html`) showcasing all UI components
  - **Purpose**: Visual reference guide for the clean, minimalist Cloud UI aesthetic design system
  - **Features**:
    - Complete component library display (all shadcn/ui components + custom components)
    - Clean Cloud UI styling with generous whitespace and subtle borders
    - Code syntax highlighting matching Cloud UI style (purple keywords, green strings, light blue types)
    - Organized sections for Typography, Buttons, Forms, Cards, Badges, Alerts, Breadcrumbs, and custom components
    - Includes examples of: Navbar, ChatMessage, ChatInput, ProjectCard, ConversationCard
    - Color palette and spacing system documentation
  - **Files Created**:
    - `style-reference.html`: Standalone HTML reference page with all component examples
    - `style-reference.css`: Comprehensive stylesheet with design tokens and component styles
  - **Design Principles Applied**:
    - Light theme only (white/very light grey backgrounds)
    - Generous whitespace and padding throughout
    - Subtle borders (light grey)
    - Clean typography using Lato font
    - Green accents for success/checkmarks
    - Minimal shadows
    - Professional, minimalist aesthetic
  - **Result**: Complete visual reference system for maintaining consistent UI design across the application

## 2025-01-XX - Removed Inline Map Card Component

### Removed
- **Inline Map Card (MapInlineCard)**: Removed the inline map card component that was causing UI bugs where it got stuck over artifact documents
  - **Reason**: Redundant functionality - the zone card ("Zone Grenoble Voir la carte complète") already provides access to the map via the right panel
  - **Changes Made**:
    - Removed `MapInlineCard` function component from `components/InlineArtifactCard.tsx` (~190 lines)
    - Removed 'map' case from switch statement in `InlineArtifactCard`
    - Updated props interface to remove 'map' from type union (`'zone' | 'document'` only)
    - Removed Leaflet imports (MapContainer, TileLayer, Marker, Polygon, L) that were only used by MapInlineCard
    - Removed map artifact generation from `introArtifacts` useMemo in chat page
    - Added filters to exclude map artifacts from rendering in both intro cards and message artifacts
  - **What Was Kept**:
    - `MapArtifact.tsx` component (used in right panel via MapCard)
    - `ZoneInlineCard` component (opens map tab in right panel)
    - Right panel map tab functionality
    - Map artifact store state (still tracked for right panel)
  - **Files Modified**: 
    - `components/InlineArtifactCard.tsx`: Removed MapInlineCard, updated types
    - `app/chat/[conversation_id]/page.tsx`: Removed map artifact generation, added filters
  - **Result**: No more UI bugs with inline map cards overlapping documents. Zone cards remain and provide map access via right panel.

## 2025-01-XX - Fixed Conversation Loading, Progressive Display, and Mobile Card Persistence

### Fixed
- **Previous Conversation Not Showing Content**: Fixed issue where existing conversations didn't display messages when navigating back
  - **Root Cause**: `setLoading(false)` wasn't always called due to early returns and error handling
  - **Solution**: 
    - Moved `setLoading(false)` to `finally` block to guarantee execution
    - Ensure messages are always set (even if empty) before clearing loading state
    - Reset refs (`introSequenceStartedRef`, `hasAutoSwitchedToDocumentRef`) when conversation changes
    - Added useEffect to reset refs on conversation_id change
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` (lines 569-688, 272-276)
  - **Result**: Existing conversations now display messages and content immediately when navigating back

- **Progressive Display Not Happening for New Chats**: Fixed missing progressive "Retrieving map..." display for new conversations
  - **Root Cause**: `introArtifacts` only generated when `enrichment.status !== 'pending'`, but enrichment starts as 'pending'
  - **Solution**:
    - Modified `introArtifacts` logic to show loading cards when enrichment has started (even if status is 'pending')
    - Check if enrichment is in progress: `enrichment.status === 'enriching'` OR `(enrichment.status === 'pending' && conversation?.enrichment_status === 'pending')`
    - Show zone artifact immediately when coordinates are available (even before cityId is set)
    - Show map and document artifacts when enrichment is in progress or data is available
    - Handle null artifact info gracefully by defaulting to 'loading' status
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` (lines 127-232, 1065-1086)
  - **Result**: New conversations now show loading cards immediately with "Récupération de la carte..." messages as enrichment starts

- **InlineCard Persists on Mobile**: Fixed issue where inline artifact cards stayed visible on mobile when navigating away from chat page
  - **Root Cause**: No route-based conditional rendering, artifact store state persisted across route changes
  - **Solution**:
    - Added `usePathname` import from `next/navigation`
    - Added route check in intro artifacts rendering: only render when `pathname?.includes('/chat/')`
    - Added cleanup useEffect to reset artifact refs when navigating away from chat page
    - Handle null artifact info gracefully in rendering
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` (lines 4, 21, 278-289, 1066)
  - **Result**: Inline cards now disappear when navigating away from chat page on mobile

## 2025-01-XX - Fixed Inline Artifact Cards Not Showing for New Conversations

### Fixed
- **Inline Artifact Cards for New Conversations**: Fixed issue where inline artifact cards were not displayed for new conversations without messages
  - **Root Cause**: Cards were only rendered after assistant messages existed, but new conversations without messages should show cards as artifacts become ready during enrichment
  - **Solution**: 
    - Added `introArtifacts` useMemo hook that generates artifact references for new conversations (when `messages.length === 0`)
    - Uses `detectArtifactsForMessage` with empty message and first message index to trigger "first-message" rule
    - Checks artifact store state to progressively show map and document artifacts as they become available
    - Added rendering section that displays intro cards when no messages exist and artifacts are ready
    - Only shows intro cards when enrichment is in progress or complete (not pending)
    - Prevents intro cards from showing for restored conversations (checks `introSequenceStartedRef`)
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx`
    - Added `getArtifactId` import from `artifactDetection.ts`
    - Added `introArtifacts` useMemo hook (lines 126-204)
    - Added intro cards rendering section (lines 1021-1040)
  - **Result**: New conversations without messages now show inline artifact cards progressively as enrichment completes (zone → map → document)

## 2025-01-XX - Fixed Infinite Loop in Artifact Store Updates

### Fixed
- **Infinite Loop Prevention**: Fixed "Maximum update depth exceeded" error in artifact store synchronization
  - Removed `updateArtifact` from useEffect dependency array (Zustand actions are stable)
  - Added change detection guards in useEffect to prevent updates when status/data hasn't changed
  - Added deep equality checks in `updateArtifact` store method to prevent unnecessary state updates
  - Store now returns same state reference if no actual changes occurred (prevents re-renders)

### Technical Details
- Added `needsUpdate` checks before calling `updateArtifact` for zone, map, and document artifacts
- Store method now compares current artifact state with updates before applying changes
- Uses JSON.stringify for deep equality comparison of artifact data
- Prevents infinite loops by ensuring updates only occur when data actually changes

### Files Modified
- `app/chat/[conversation_id]/page.tsx`: Added change detection guards in artifact sync useEffect
- `lib/stores/artifactStore.ts`: Added change detection in `updateArtifact` method to prevent unnecessary updates

## 2025-01-XX - Artifact Synchronization and UX Enhancements

### Added
- **Hybrid Panel Opening**: Right panel now auto-opens on desktop when first artifact becomes ready
  - Desktop (>=768px): Panel auto-opens when any artifact (zone/map/document) becomes ready
  - Mobile (<768px): Panel stays closed until user clicks inline artifact card
  - Auto-open only happens once per conversation (tracked via `hasAutoOpenedRef`)
  - Manual opening via inline card click works on both desktop and mobile

- **Smooth Animations**: Added Claude.ai-style transitions throughout the artifact system
  - Inline artifact cards: Fade-in and slide-up animation when appearing (`animate-in fade-in slide-in-from-bottom-4 duration-300`)
  - Transition duration standardized to 300ms for consistent feel
  - Right panel tab content: Smooth fade-in when switching tabs (`animate-in fade-in duration-300`)
  - All hover states use `duration-300` for smoother interactions

### Changed
- **Variable Naming Standardization**: Standardized artifact tab state management
  - Removed inconsistent `setActiveArtifactTab` reference
  - All tab state now uses `activeTab` and `setActiveTab` from `useArtifactSync` hook exclusively
  - Consistent naming throughout: `app/chat/[conversation_id]/page.tsx`, `components/ChatRightPanel.tsx`, `lib/hooks/useArtifactSync.ts`

- **Panel Opening Logic**: Enhanced with hybrid behavior
  - Auto-opens on desktop when first artifact ready (zone, map, or document)
  - Stays closed on mobile until user interaction
  - Resets auto-open tracking when conversation changes

### Technical Details
- Added `hasAutoOpenedRef` useRef to track panel auto-opening state
- Added useEffect to auto-open panel when artifacts become ready (desktop only)
- Added useEffect to reset auto-open ref on conversation change
- Updated all InlineArtifactCard states (loading, ready, error) with animations
- Enhanced ChatRightPanel tab content with fade-in animations
- All transitions use Tailwind's built-in animation utilities for performance

### Files Modified
- `app/chat/[conversation_id]/page.tsx`: Hybrid panel opening, naming standardization
- `components/InlineArtifactCard.tsx`: Smooth animations for all card states
- `components/ChatRightPanel.tsx`: Tab content fade-in animations
- `lib/hooks/useArtifactSync.ts`: Already had consistent naming (verified)

## 2025-11-XX - Track Artifacts Per Assistant Message

### Added
- **Artifact Detection Utility**: Created `lib/utils/artifactDetection.ts` with pattern-based artifact detection
  - `detectArtifactsForMessage()`: Detects which artifacts to show based on message content and enrichment data
  - Keyword pattern matching for map (carte, map, zonage, plan), document (document, règlement, PLU), and regulation context (hauteur, recul, COS, CES)
  - Helper functions: `getArtifactId()`, `shouldShowArtifact()`
  - Detection rules:
    1. First assistant message: Always show zone artifact if cityId exists
    2. Map mentions: Show map if pattern matches and mapGeometry exists
    3. Document mentions: Show document if pattern matches and documentData exists
    4. Regulation context: Show both map and document if regulation keywords match
    5. Otherwise: No artifacts (keep chat clean)

### Changed
- **Message Metadata Storage**: Updated `handleSendMessage` in `app/chat/[conversation_id]/page.tsx` to store artifact references in message metadata
  - New assistant messages now include `metadata.artifacts` array with artifact references
  - Format: `{ artifacts: [{ type, artifactId, reason, timestamp }] }`
  - Artifacts are detected using `detectArtifactsForMessage()` before message insertion
- **Hybrid Message Enrichment**: Implemented message enrichment with metadata-first approach
  - Priority 1: Use stored `metadata.artifacts` for new messages (explicit tracking)
  - Priority 2: Fallback to pattern detection for existing messages (backward compatibility)
  - Messages are enriched on load using `useMemo` hook for performance
- **Artifact State Mapping**: Created `artifactMap` to map artifact references to actual data and status
  - Maps artifact IDs to enrichment data (zone, map, document)
  - Tracks artifact status (loading, ready, error) from enrichment progress
  - Provides data structures compatible with `InlineArtifactCard` component
- **Message Rendering**: Updated message rendering to display inline artifact cards
  - Inline cards appear after assistant messages when artifacts are detected
  - Cards sync with artifact state from enrichment hook
  - Clicking cards opens right panel with appropriate tab (zone → map tab)

### Technical Implementation
- **Hybrid Approach**: Combines explicit metadata storage (new messages) with pattern detection (existing messages)
- **Backward Compatibility**: Existing conversations work immediately via pattern detection
- **Future-Proof**: New messages store explicit artifact references for reliability
- **Performance**: Uses `useMemo` for message enrichment and artifact mapping to avoid unnecessary recalculations

### Files Created
- `lib/utils/artifactDetection.ts`: Artifact detection utility with pattern matching

### Files Modified
- `app/chat/[conversation_id]/page.tsx`: 
  - Added artifact detection on message creation
  - Implemented message enrichment with hybrid approach
  - Added artifact state mapping
  - Updated message rendering to show inline cards

## 2025-11-XX - Inline Artifact Preview Cards

### Added
- **InlineArtifactCard Component**: Created inline artifact preview cards that sync with ChatRightPanel
  - **ZoneInlineCard**: Shows zone analysis summary with status indicators (loading, ready, error)
    - Displays zone name, type, INSEE code, constructibility status
    - "Voir la carte complète" button that opens map tab in right panel
  - **MapInlineCard**: Shows interactive map thumbnail with zone polygon preview
    - Small Leaflet map (128px height) with disabled interactions for preview
    - Shows zone polygon and center marker
    - "Ouvrir la carte interactive" button
  - **DocumentInlineCard**: Shows document metadata summary
    - Displays document title, type, zone reference, update date
    - "Lire le document" button
- **Artifact Types**: Created `types/artifacts.ts` with TypeScript interfaces
  - `ZoneArtifactData`: Complete zone information structure
  - `MapArtifactData`: Map geometry and metadata structure
  - `DocumentArtifactData`: Document content and metadata structure
  - `ArtifactStatus`: Union type for loading states

### Changed
- **InlineArtifactCard**: Completely replaced existing component with new three-variant implementation
  - New props interface: `type`, `artifactId`, `status`, `data`, `onViewInPanel`
  - Zone cards route to map tab when clicked (per user requirement)
  - MWPLU brand styling: black/white/grey color scheme, Lato font

### Technical Implementation
- **Component Structure**: Main component routes to appropriate variant based on `type` prop
- **Map Thumbnail**: Uses Leaflet with disabled interactions (no zoom, drag, scroll)
- **Status Indicators**: Loading spinner (Loader2), checkmark (CheckCircle), error icon (AlertCircle)
- **Visual Design**: Compact cards that fit in chat flow with hover effects and smooth transitions
- **Integration**: Clicking anywhere on card calls `onViewInPanel()` to sync with ChatRightPanel

### Files Created
- `types/artifacts.ts`: Artifact type definitions for zone, map, and document data structures

### Files Modified
- `components/InlineArtifactCard.tsx`: Complete replacement with new three-variant implementation

## 2025-01-XX - Lazy Loading for Artifact Cards with Progressive Reveal

### Added
- **Artifact Card Components**: Created lazy-loading artifact card components with progressive reveal
  - **ZoneAnalysisCard**: Displays zone analysis data with skeleton → loading → ready → error states
  - **MapCard**: Wraps MapArtifact with lazy loading states and smooth transitions
  - **DocumentCard**: Wraps DocumentViewer with lazy loading states and smooth transitions
  - All cards support: `skeleton` (immediate), `loading` (fetching), `ready` (content), `error` (retry)

### Changed
- **ChatRightPanel**: Refactored to orchestrate artifact loading states using enrichment progress
  - Internal state management for each artifact (map, document)
  - Updates artifact states based on `useEnrichment` progress (`loading` | `success` | `error`)
  - Smooth transitions from skeleton → loading → ready with no layout shift
  - Proper error handling with retry functionality
- **Chat Page**: Updated to pass enrichment progress instead of status to ChatRightPanel
  - Uses `enrichment.progress.map` and `enrichment.progress.document` directly
  - Simplified status mapping logic

### Technical Implementation
- **Artifact States**: Each artifact card manages 4 states:
  - `skeleton`: Shows ArtifactSkeleton immediately on mount
  - `loading`: Shows spinner with loading message
  - `ready`: Shows actual content (MapArtifact, DocumentViewer, or zone analysis)
  - `error`: Shows ErrorCard with retry button
- **Progressive Updates**: ChatRightPanel updates artifact states as enrichment completes
  - Uses `useEffect` to sync with enrichment progress
  - Prevents infinite loops by using functional state updates
- **Smooth Transitions**: All state changes use CSS transitions (`transition-opacity duration-300`)
- **Error Recovery**: Error states show retry button that triggers enrichment retry
- **No Layout Shift**: Skeleton components match content dimensions to prevent layout shift

### Files Created
- `components/chat/artifacts/ZoneAnalysisCard.tsx`: Zone analysis card with lazy loading
- `components/chat/artifacts/MapCard.tsx`: Map artifact card with lazy loading
- `components/chat/artifacts/DocumentCard.tsx`: Document artifact card with lazy loading

### Files Modified
- `components/ChatRightPanel.tsx`:
  - Added internal artifact state management
  - Orchestrates artifact loading based on enrichment progress
  - Uses new artifact card components instead of direct rendering
- `app/chat/[conversation_id]/page.tsx`:
  - Updated to pass `mapProgress` and `documentProgress` instead of status
  - Removed unused `getArtifactStatus` helper function

### User Experience
- **Before**: Artifacts tried to load data on mount, blocking UI if data not ready
- **After**: Artifacts show skeleton immediately, load data progressively, smooth transitions
- **Result**: Better perceived performance, no layout shift, graceful error handling

## 2025-01-XX - Progressive Loading: Show Interface Immediately, Enrich in Background

### Changed
- **Chat Page Interface**: Refactored to show interface immediately without blocking on enrichment
  - **Removed Blocking Behavior**: Eliminated `artifactsLoading` spinner that blocked the entire UI
  - **Immediate UI Display**: Messages, address header, and input field now appear immediately on page load (< 100ms)
  - **Background Enrichment**: Uses `useEnrichment` hook to run enrichment in background without blocking interaction
  - **Progressive Artifact Rendering**: Artifacts appear progressively as enrichment completes using skeleton loaders
  - **Non-Blocking Input**: Users can type and send messages immediately, even during enrichment

### Technical Implementation
- **Removed State**: Removed `artifactsLoading`, `introStatus`, `enrichmentStep`, `enrichmentStatus` blocking states
- **Progressive Updates**: Map and document data update progressively as enrichment completes
- **Status Mapping**: Maps `enrichment.progress.map` and `enrichment.progress.document` to artifact status
- **Skeleton Loaders**: ChatRightPanel shows `MapSkeleton` and `DocumentSkeleton` during loading
- **Error Handling**: Enrichment errors show retry buttons but don't break the page
- **Edge Cases**: 
  - Already-enriched conversations skip enrichment and show artifacts immediately
  - Enrichment marked complete but missing data triggers enrichment hook retry
  - Artifacts show as 'ready' if data exists even when enrichment isn't needed

### Files Modified
- `app/chat/[conversation_id]/page.tsx`:
  - Removed blocking `artifactsLoading` spinner (lines 645-671)
  - Always show messages and input field immediately
  - Progressive data updates via `useEnrichment` hook
  - Map enrichment progress to artifact status for skeleton loaders
  - Connect retry functions to enrichment hook
  - Handle edge cases for already-enriched conversations

### User Experience
- **Before**: Page blocked on enrichment, users waited 2-5 seconds before seeing interface
- **After**: Interface visible immediately, artifacts load progressively in background
- **Result**: Users can interact with chat immediately while enrichment runs in background

## 2025-01-03 - Fixed Zone Creation Race Condition in Enrichment Worker

### Fixed
- **Zone Creation Never Called**: Fixed critical issue where `getOrCreateZone()` was never successfully called, leaving `zone_id` as null in enriched conversations
  - **Root Cause**: Race condition in parallel operation execution - the `zone` operation was checking for `result.zoningId` before the parallel `zoning` operation completed, failing validation, and throwing an error that was silently caught by `Promise.allSettled()`
  - **Solution**: Implemented proper polling mechanism with 20 retries (2 seconds total) to wait for `result.zoningId` to be set by the parallel zoning operation
  - Added fallback mechanism: if polling times out, the zone operation creates the zoning itself using the same logic
  - Enhanced error logging with detailed state information to diagnose future issues
  - **Files Modified**: `lib/workers/conversationEnrichment.ts` (zone operation, lines 277-330)
  - **Result**: Zone creation now works reliably with proper dependency management between parallel operations

### Technical Details
- Zone operation now waits up to 2 seconds for `result.zoningId` to be set by parallel operations
- Detailed logging at each stage: polling attempts, fallback creation, validation state, success/failure
- Improved error messages that include both `zoningId` and `zoneCode` values for debugging
- Fallback mechanism ensures zone creation succeeds even if the parallel zoning operation is delayed
- All operations still run in parallel, but dependencies are now properly managed with polling

## 2025-01-XX - Mobile Panel Behavior and Tab Auto-Switch

### Fixed
- **Mobile Panel Auto-Open**: Right panel no longer auto-opens on mobile devices
  - Added desktop detection using window width >= 768px (matches Tailwind `md:` breakpoint)
  - Panel only auto-opens on desktop when artifacts start loading
  - On mobile: Panel stays closed until user explicitly opens it via inline artifact cards
  - Desktop detection updates on window resize for responsive behavior

- **Tab Sequencing**: Map tab now auto-switches to document tab when document becomes ready
  - Map tab is active by default when artifacts start loading
  - Tab stays on map during map loading and document loading phases
  - Automatically switches to document tab when `introStatus.document` becomes 'ready'
  - Only switches if currently on map tab (won't override user's manual tab selection)
  - Once switched to document, user can manually switch back to map

### Changed
- **Panel Opening Logic**: Conditional panel opening based on device type
  - `startIntroSequence()`: Only opens panel on desktop (line 304-306)
  - Map loading phase: Only opens panel on desktop (line 1131-1133)
  - Mobile users see chat interface only, artifacts accessible via inline cards

- **Tab Auto-Switch**: Added useEffect to auto-switch tabs based on document readiness
  - Monitors `introStatus.document` and `activeArtifactTab` state
  - Switches to document tab when document status changes from 'loading' to 'ready'
  - Logs tab switch for debugging: `[TAB_SWITCH] Document is ready, auto-switching to document tab`

### Technical Details
- Desktop detection: `window.innerWidth >= 768` with SSR safety check
- Resize listener: Updates desktop state on window resize
- Tab switch logic: Only triggers when document becomes ready AND currently on map tab
- Prevents auto-switch if user manually switched to document tab before it was ready

### Files Modified
- `app/chat/[conversation_id]/page.tsx`:
  - Added `isDesktop` state and useEffect for desktop detection
  - Made panel opening conditional in `startIntroSequence()` and map loading phase
  - Added useEffect for auto-switching to document tab when ready

## 2025-01-XX - Tabbed Artifact Panel with Status Indicators

### Added
- **Skeleton Components**: Created loading placeholders for artifacts
  - `components/skeletons/MapSkeleton.tsx` - Shimmer placeholder for map loading
  - `components/skeletons/DocumentSkeleton.tsx` - Text line skeletons for document loading
  - `components/ui/ErrorCard.tsx` - Error display component with retry button support

- **Tabbed Layout**: Enhanced ChatRightPanel with tabbed interface
  - Two tabs: "Carte" (Map) and "Document" with status indicators
  - Active tab highlighted with blue underline and white background
  - Loading spinners (Loader2) shown in tabs when artifacts are loading
  - Checkmarks (CheckCircle) shown when artifacts are ready
  - Tab state managed externally by parent component for enrichment control

- **Status-Based Rendering**: Content rendering based on artifact status
  - Map tab: Shows MapSkeleton when loading, MapArtifact when ready, ErrorCard on error
  - Document tab: Shows DocumentSkeleton when loading, DocumentViewer when ready, ErrorCard on error
  - Full height for each tab content area with proper scrolling

### Changed
- **ChatRightPanel Component**: Complete UI restructure
  - Reordered tabs: "Carte" first, then "Document" (previously Document first)
  - Updated props interface: Added `mapStatus`, `documentStatus`, `onRetryMap`, `onRetryDocument`
  - Changed tab type order from `'document' | 'map'` to `'map' | 'document'`
  - Separated header from tabs with "Analyse du PLU" title
  - Tab buttons use flex layout with centered icons, text, and status badges
  - Improved mobile responsiveness with proper close button visibility

- **Parent Page Integration**: Updated `app/chat/[conversation_id]/page.tsx`
  - Changed `activeArtifactTab` default from `'document'` to `'map'`
  - Updated tab type order to `'map' | 'document'` throughout
  - Added `getArtifactStatus()` helper to map `ArtifactPhase` to component status type
  - Passes status props and retry handlers to ChatRightPanel
  - Retry handlers are stubs (TODO for Phase 5 implementation)

### Technical Details
- Tab state remains external (parent-controlled) for enrichment flow management
- Status mapping: `'ready'` → `'ready'`, everything else → `'loading'` (no error handling yet)
- Skeleton components use Tailwind `animate-pulse` for shimmer effect
- Error handlers are optional props defined now, implementation deferred to Phase 5
- Icons: Map, FileText, CheckCircle, Loader2, AlertCircle, X from lucide-react

### Files Modified
- `components/ChatRightPanel.tsx` - Complete UI restructure with tabs and status rendering
- `app/chat/[conversation_id]/page.tsx` - Updated tab state, added status mapper, passes new props
- Created `components/skeletons/MapSkeleton.tsx` - New file
- Created `components/skeletons/DocumentSkeleton.tsx` - New file  
- Created `components/ui/ErrorCard.tsx` - New file

## 2024-12-05 - Lightweight Conversation Creation

### Added
- **Lightweight Conversation Creation**: Instant conversation creation (< 200ms) by deferring all expensive operations
  - New `createLightweightConversation()` function in `lib/supabase/queries.ts` for minimal record creation
  - Background enrichment on chat page instead of blocking navigation
  - `enrichment_status` field on `v2_conversations` to track background processing state
  - Database migration to make `project_id` nullable in `v2_conversations`

### Changed
- **app/page.tsx**: Simplified `handleAddressSubmit` to create lightweight conversation and navigate immediately
  - Removed all API calls (municipality, zone) from address submission flow
  - Removed all geo-enrichment (city, zoning, zone creation) from address submission flow
  - Removed project creation from address submission flow
  - Removed research_history creation from address submission flow
  - Navigation now happens in < 200ms instead of 3-5 seconds

- **app/chat/[conversation_id]/page.tsx**: Enhanced to handle background enrichment
  - Automatically starts enrichment when conversation has `enrichment_status = 'pending'`
  - Creates project during enrichment phase (not at conversation creation)
  - Creates research_history during enrichment phase
  - Updates project and research_history with enriched data (city_id, zone_id)
  - Updates `enrichment_status` to track progress ('pending' → 'in_progress' → 'completed'/'failed')
  - Chat interface visible immediately, even while enrichment runs

- **lib/supabase.ts**: Updated `V2Conversation` type
  - Made `project_id` nullable (string | null)
  - Added `enrichment_status` field ('pending' | 'in_progress' | 'completed' | 'failed')

### Database Changes
- **Migration**: `20251205000001_make_conversations_lightweight.sql`
  - Made `project_id` nullable in `v2_conversations`
  - Updated foreign key constraint to allow NULL (ON DELETE SET NULL)
  - Added `enrichment_status` field with CHECK constraint
  - Added index for enrichment status queries

### Performance
- Navigation time reduced from 3-5 seconds to < 200ms
- User sees chat interface immediately
- Enrichment completes in background (2-3 seconds) without blocking UI
- No ghost project records created before user engagement

## 2025-01-XX (Conversation Cache Utilities)

### Added
- **Conversation Cache Utilities**: Added utility functions and React hook for caching enrichment data
  - **Files Created**:
    - `lib/utils/conversationCache.ts` - Cache management utilities
    - `hooks/useConversationCache.ts` - React hook for cache access
  - **Features**:
    - `getCachedConversationData(conversationId)` - Retrieves cached enrichment data with TTL validation (7 days)
    - `setCachedConversationData(conversationId, data)` - Stores cache in `v2_conversations.context_metadata.enrichment_cache`
    - `isCacheValid(timestamp)` - Validates cache age against TTL
    - `useConversationCache(conversationId)` - React hook with automatic loading and refresh capability
  - **Cache Structure**: Stores zone_geometry (GeoJSON), zone_name, city_name, insee_code, has_analysis, document_summary (optional), cache_version
  - **TTL**: 7 days (604,800,000 ms)
  - **Implementation Details**:
    - Cache stored in `context_metadata.enrichment_cache` nested field (preserves other metadata)
    - Graceful error handling throughout
    - TypeScript types for all functions
    - Comprehensive JSDoc comments

## 2025-01-XX (Optimize Duplicate Address Check - Run Before API Calls)

### Optimized
- **Duplicate Check Before API Calls**: Duplicate address check now runs BEFORE expensive IGN API calls
  - **Problem**: Previously called Carto Municipality API and Zone-Urba API before checking for duplicates, wasting API quota and time
  - **Solution**: 
    - Added `checkDuplicateByCoordinates()` function in `lib/supabase.ts` that checks for existing addresses within 50 meters
    - Uses PostGIS RPC function if available, otherwise falls back to client-side Haversine distance calculation
    - Moved duplicate check to Step 0 (before all API calls) in `handleAddressSubmit`
  - **Files Modified**:
    - `lib/supabase.ts` - Added `checkDuplicateByCoordinates()` and `checkDuplicateByCoordinatesFallback()` functions
    - `app/page.tsx` - Refactored `handleAddressSubmit` to check duplicates first, before API calls
    - `app/layout.tsx` - Added `Toaster` component for toast notifications
  - **Features Added**:
    - Toast notification shown when duplicate is detected: "Analyse existante trouvée - Vous avez déjà analysé cette adresse. Redirection..."
    - Analytics logging for `duplicate_detected` events
    - Graceful handling when coordinates are null (skips coordinate-based check, continues with existing flow)
  - **Result**: 
    - No API calls made when duplicate exists
    - User redirected to existing conversation immediately
    - API quota saved for duplicate submissions
    - Faster response time for duplicate addresses

## 2025-11-02 (Sync Inline Cards with Artifact Completion + Fix Zone ID Retrieval)

### Fixed
- **Inline Card Status Not Synced with Artifacts**: Cards now become "ready" only when actual artifacts complete processing
  - **Map Card**: Becomes ready when `mapData.isLoading === false` (map fully rendered with zone highlighted)
  - **Document Card**: Becomes ready when `documentData.htmlContent` is set (document retrieved and loaded)
  - Removed timer-based status updates from `startIntroSequence()` that set statuses after delays
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` - Added `setIntroStatus` calls when artifacts complete
  - **Result**: Cards now accurately reflect artifact loading state instead of showing fake ready states

- **Inline Cards Visibility Fix**: Cards now hide properly after first message
  - **Root Cause**: Condition was checking `showIntro && messages.length === 0` but `showIntro` was never properly managed
  - **Solution**: Changed condition to `messages.length === 0 && (introStatus.map === 'ready' || introStatus.document === 'ready')`
  - Cards now appear when artifacts are ready AND disappear when messages exist, regardless of `showIntro` state
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` - Updated inline cards render condition
  - **Result**: Cards properly hide after user sends their first message

- **Zone ID Not Retrieved After Failed Creation**: Fixed bug where `getOrCreateZone` errors silently prevented zone ID retrieval
  - **Root Cause**: `getOrCreateZone` throws on database insert errors, but code didn't catch these errors or query for existing zones
  - **Solution**: Wrapped all 4 `getOrCreateZone` calls in try-catch blocks with fallback to query existing zones by libelle
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` - Added error handling in Step 3, Step 4 (post), and map loading sections
  - **Result**: When zone creation fails (e.g., unique constraint violation), code now queries database for existing zone ID and continues properly

- **Zone Lookup Case Sensitivity**: Fixed bug where zone lookups failed due to case mismatch between libelle values
  - **Root Cause**: PostgreSQL `.eq()` operator is case-sensitive, so queries like `zones.name = 'UBa'` would fail if database had 'uba' or 'UBA'
  - **Solution**: Changed all zone name lookups from `.eq('name', zoneLibelleFromAPI)` to `.ilike('name', zoneLibelleFromAPI)` for case-insensitive matching
  - **Files Modified**: 
    - `app/chat/[conversation_id]/page.tsx` - Updated 6 zone queries in Step 3, Step 4 (post), and fallback sections
    - `lib/geo-enrichment.ts` - Updated `getOrCreateZone` lookup to use `.ilike()`, and fallback zoning name lookup
  - **Result**: Zone lookups now succeed regardless of case variations in zone names (e.g., 'UBa', 'uba', 'UBA' all match)

## 2025-11-02 (Fixed Inline Cards Still Showing for Existing Conversations)

### Fixed
- **Inline Artifact Cards Still Appearing**: Fixed bug where inline artifact cards were still showing for existing conversations with messages
  - **Root Cause**: `restoreConversationStateInstant` had a comment saying "Don't show inline cards" but never actually called `setShowIntro(false)`
  - **Solution**:
    - Added explicit `setShowIntro(false)` call in `restoreConversationStateInstant` function
    - Added defensive check in render condition: `{showIntro && messages.length === 0 && (` to prevent cards from showing when messages exist
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx`
  - **Result**: Existing conversations with messages now correctly hide inline artifact cards - only new conversations show them

## 2025-01-15 (Instant Artifact Cards on Conversation Load)

### Fixed
- **No Loading for Existing Conversations**: Eliminated unnecessary loading states when opening existing conversations
  - **Problem**: When loading existing conversations, inline artifact cards showed loading spinners even though all data was already in the database
  - **Root Causes** (Fixed all loopholes):
    1. State was being reset to idle/loading BEFORE checking if conversation was complete
    2. useEffect was overwriting restored mapData state with loading state
    3. Race conditions between multiple state updates causing intermediate renders with incomplete state
    4. Missing guard to prevent intro sequence from running on restored conversations
  - **Solution** (Option C - Lazy Loading):
    - Added detection for "complete" conversations (has `city_id`, `zone_id`, and messages)
    - Created `restoreConversationStateInstant` function with **zero database fetching**
    - **Moved state resets**: Only reset state for incomplete/new conversations, skip resets for complete conversations
    - **Set intro ref**: Set `introSequenceStartedRef.current = true` to prevent intro sequence from running
    - **Added useEffect guard**: Prevent useEffect from overwriting already-loaded mapData (isLoading: false)
    - **Option C Implementation**: Skip ALL database fetching in `restoreConversationStateInstant` - just set minimal state (IDs and coordinates) and close loading immediately
    - **Lazy loading**: Right panel will load geometry and document HTML when user opens it (not eagerly)
    - **No inline cards**: Don't show inline artifact cards for existing conversations with messages
    - For complete conversations: Set `artifactsLoading = false` immediately (no async operations), messages appear instantly
    - For incomplete conversations: Resets state and runs existing enrichment flow with loading sequence and inline cards
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` - Updated `restoreConversationStateInstant` to skip all fetching (Option C)
  - **Result**: Existing conversations with messages show messages **instantly** with zero loading time - right panel loads data lazily when opened

## 2025-11-02 (Fixed Enrichment Flow Order - fetchZoneUrba First)

### Fixed
- **Enrichment Flow Order**: Refactored `enrichConversationData` to call `fetchZoneUrba` FIRST before any other API calls
  - **Step 1**: `fetchZoneUrba` with GPS coordinates → gets `libelle`, `typezone`, and `MultiPolygon` geometry
  - **Step 2**: City database check/creation (using context metadata)
  - **Step 3**: Zones/zoning database check using API data (libelle → zones.name, typezone → zonings.code)
  - **Step 4**: Database check for existing analysis in `documents` table by `zone_id`
  - **Step 5** (conditional): Only call `fetchMunicipality` and `fetchDocument` if:
    - No analysis exists in database AND
    - We have `zone_id`/`zoning_id` (zone is covered)
  - Removed duplicate document retrieval phase that was happening after map loading

### Changed
- **Removed Early API Calls**: 
  - `fetchMunicipality` is no longer called in Step 1 - moved to Step 5 (conditional)
  - `fetchDocument` is no longer called in Step 3 - moved to Step 5 (conditional)
- **Smart Analysis Check**: System now checks database for existing analysis BEFORE calling any external APIs
- **Optimized Flow**: When analysis exists in database, municipality and document APIs are skipped entirely

### Files Modified
- `app/chat/[conversation_id]/page.tsx` - Refactored `enrichConversationData` function with correct API call order


All notable changes to this project will be documented in this file.

## 2025-01-XX - Optimized Redundant API Calls and Flow

### Fixed
- **Removed Redundant API Calls**: Eliminated multiple redundant calls to `fetchZoneUrba` API
  - **Problem**: The API was called 3-4 times for the same zone data, causing unnecessary delays (5+ seconds) and increased API load
  - **Root Cause**: 
    - Step 4 made an API call to get libelle
    - Post-enrichment section made another call
    - Third location (when only zoningId known) made another call
    - MAP_ARTIFACT_START made a fourth call just to get geometry
  - **Solution**: 
    - Added cache variables (`cachedZonesFromAPI`, `cachedZoneGeometry`) at the start of `enrichConversationData`
    - First API call caches the response (zones and geometry)
    - All subsequent sections check cache first before making API calls
    - Geometry is extracted from cached response instead of making separate calls
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` (lines ~283-285, ~437-499, ~609-675, ~749-813, ~883-953)

- **Reduced Artificial Delay**: Reduced map loading delay from 2000ms to 200ms
  - **Problem**: 2-second artificial delay was slowing down document retrieval unnecessarily
  - **Solution**: Reduced delay to 200ms (10x faster) - still allows UI to update smoothly but doesn't block document retrieval
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` (line ~968)
  - **Benefits**: Documents now load almost immediately after zone data is retrieved instead of waiting 5+ seconds

- **Geometry Caching**: Geometry is now cached and reused instead of fetched separately
  - Geometry extracted from first API call and stored in `cachedZoneGeometry`
  - MAP_ARTIFACT_START now uses cached geometry instead of making API call
  - Geometry saved to database when zone is created/updated
  - **Benefits**: Faster map loading, reduced API calls

## 2025-01-XX - Fixed Zone Selection Logic in Document Query

### Fixed
- **Zone Selection by Libelle**: Fixed zone selection logic to always filter by libelle (zone name) when querying zones from the database
  - **Problem**: When multiple zones exist in the same zoning (e.g., "UC1" and "UCRU11"), the code was selecting the first zone returned by the database without filtering by libelle, causing incorrect document retrieval
  - **Root Cause**: Three locations in `app/chat/[conversation_id]/page.tsx` were fetching zones using `.limit(1)` without filtering by `zones.name`:
    - Lines ~437-450: Initial zone fetching during enrichment
    - Lines ~548-560: Post-enrichment zone fetching
    - Lines ~607-624: Zone fetching when only zoningId is known
  - **Solution**: 
    - Always fetch from API first when coordinates are available to get the correct libelle
    - Filter database queries by libelle (`zones.name`) to ensure the correct zone is selected
    - Added comprehensive validation logging before document queries to detect zone/libelle mismatches
    - Falls back gracefully when libelle is not available (takes first zone but logs a warning)
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` (lines ~420-526, ~577-673, ~694-771, ~889-945)
  - **Benefits**: 
    - Ensures correct zone is selected when multiple zones exist in the same zoning
    - Prevents document retrieval for wrong zones (e.g., UCRU11 instead of UC1)
    - Provides validation logging to catch future issues

## 2025-01-XX - Added Zonings Code Column and Fixed Mapping Logic

### Added
- **Zonings Code Column**: Added `code` column to `zonings` table for direct mapping from Carto API `typezone` field
  - Migration: `supabase/migrations/20251102000014_add_code_to_zonings.sql`
  - Maps `typezone` values (U, AU, N, A) directly to `zonings.code`
  - Existing zonings populated with codes based on names
  - Index created on `code` column for performance

### Fixed
- **Mapping Logic**: Updated to use `typezone → zonings.code` instead of `typezone → zonings.name`
  - `features[].properties.typezone` → `zonings.code` (new mapping)
  - `features[].properties.libelle` → `zones.name` (already correct ✓)
  - Updated `getOrCreateZoning()` in `lib/geo-enrichment.ts` to:
    - Look up existing zonings by `code` instead of `name`
    - Create new zonings with both `code` and `name`
    - Update existing zonings with missing codes
  - Updated `Zoning` type in `lib/supabase.ts` to include `code` field

- **Document Query Simplification**: Simplified document lookup to use BOTH `zones.id` AND `zonings.id`
  - **Problem**: Previous implementation used complex libelle lookup
  - **Solution**: After mapping operations, we have both `zones.id` and `zonings.id`, so query directly:
    - `documents WHERE zone_id = zones.id AND zoning_id = zonings.id`
  - **Benefits**: 
    - Simpler, more direct query
    - More precise matching (both zone and zoning must match)
    - No need for additional zone lookup by name
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` (lines ~616-647)

## 2025-01-XX - Fixed Document Query and Reverted v2_research_history Migration

### Fixed
- **Document Query by Zone Name**: Fixed document lookup to filter by `zones.name` (libelle) instead of just `zone_id` UUID (NOTE: This was later simplified in the next update)
  - **Problem**: When zone-urba API returns `libelle = "UA1"`, the system was getting documents for wrong zones (e.g., "UCRU11" instead of "UA1")
  - **Root Cause**: Document query was using `zone_id` UUID which could match any zone in the same zoning, not the specific zone matching the libelle value
  - **Solution**: 
    - Added `zoneLibelle` to zoneData state to store the libelle value (e.g., "UA1")
    - Modified document query to first find the zone_id that matches the libelle within the zoning
    - Query documents using the specific zone_id that matches the libelle
    - Falls back to zone_id or zoning_id if libelle is not available
  - **Files Modified**: `app/chat/[conversation_id]/page.tsx` (lines ~42-47, ~421-433, ~531-550, ~616-671)

- **Reverted v2_research_history Migration**: Reverted the change from `zone_id` to `zoning_id` in `v2_research_history` table
  - **Problem**: Migration `20251102000010_replace_zone_id_with_zoning_id.sql` changed the schema to use `zoning_id`, but we need `zone_id` to store specific zone information
  - **Solution**: Created migration `20251102000013_revert_zoning_id_to_zone_id.sql` to:
    - Drop `zoning_id` column and its index
    - Add back `zone_id` column with foreign key to `zones(id)`
    - Add index on `zone_id`
  - **Code Updates**:
    - `lib/supabase.ts`: Updated `V2ResearchHistory` type - changed `zoning_id` back to `zone_id`
    - `lib/geo-enrichment.ts`: 
      - `enrichResearchWithGeoData()`: Uses `zone_id` instead of `zoning_id` when updating research_history
      - `checkExistingResearch()`: Changed parameter from `zoningId` to `zoneId`, queries by `zone_id` instead of `zoning_id`
    - `app/page.tsx`: Uses `zone_id` for research_history operations
    - `app/chat/[conversation_id]/page.tsx`: Uses `zone_id` when updating research_history, reads `zone_id` from research instead of `zoning_id`
  - **Files Modified**: 
    - `supabase/migrations/20251102000013_revert_zoning_id_to_zone_id.sql` (new)
    - `lib/supabase.ts`
    - `lib/geo-enrichment.ts`
    - `app/page.tsx`
    - `app/chat/[conversation_id]/page.tsx`

### Technical Details
- Document query now correctly matches documents to specific zones by libelle value (e.g., "UA1")
- Research history now stores `zones.id` instead of `zoning.id` for more precise zone tracking
- Maintains backward compatibility with fallback queries when libelle is not available
- Zone libelle is fetched from database when zoneId is available and stored in zoneData state

## 2025-01-XX - Added JSON Console Logs for API Responses

### Debugging Enhancement

Added comprehensive JSON console logging for all Carto API calls to help verify data connection and response structure, especially for the zone-urba API which provides zone and zoning information.

### Changes Made

#### lib/carto-api.ts - Added JSON Response Logging
- **fetchZoneUrba**: Added `console.log('[API_CALL] fetchZoneUrba JSON response:', JSON.stringify(data, null, 2))` after parsing response
  - This is the primary API that returns zone and zoning data needed for database connection verification
- **fetchZones**: Added JSON response logging with formatted output
- **fetchDocuments**: Added JSON response logging with formatted output  
- **fetchMunicipality**: Added JSON response logging for both code paths (INSEE code and coordinates)
- **fetchCartoAPIs**: Already had JSON logging for zone-urba (line 36), no changes needed

All JSON logs use `JSON.stringify(data, null, 2)` for readable formatted output with consistent `[API_CALL]` prefix for easy filtering in browser console.

This enables verification that the API responses contain the correct zone and zoning data structure before it's processed and stored in the database.

## 2025-11-02 (Late Evening) - Removed Tabs Component & Simplified Document Viewer

### Major Refactoring

**Problem**: The Radix UI Tabs component was causing layout issues where inactive TabsContent elements with `hidden` attribute were still taking up space in the flex layout, pushing the map content down and breaking scrolling.

**Solution**: Replaced the Tabs component with simple conditional rendering, making document and map views truly independent and mutually exclusive.

**Quick Fix Applied**: Added `flex flex-col` to content area container to ensure proper height propagation for scrolling (line 84 in ChatRightPanel.tsx).

### Changes Made

#### 1. ChatRightPanel.tsx - Complete Refactor
- **Removed**: Radix UI `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` components
- **Replaced with**: Simple conditional rendering using `activeTab === 'document'` and `activeTab === 'map'`
- **Custom tab buttons**: Created styled buttons that mimic tab behavior with proper active states
- **Benefits**:
  - Only one component (DocumentViewer OR MapArtifact) is rendered at a time
  - No hidden elements taking up space in the layout
  - Cleaner flex hierarchy: Container → Header → Content area → Active component
  - Map now fills the full available height correctly
  
**New Structure**:
```tsx
<div className="flex-1 flex flex-col">
  {/* Header with custom tab buttons */}
  <div className="border-b">
    <button onClick={() => onTabChange('document')}>Document</button>
    <button onClick={() => onTabChange('map')}>Carte</button>
  </div>
  
  {/* Content - conditional rendering */}
  <div className="flex-1 min-h-0">
    {activeTab === 'document' && <DocumentViewer />}
    {activeTab === 'map' && <MapArtifact />}
  </div>
</div>
```

#### 2. DocumentViewer.tsx - Major Simplification
- **Removed all search functionality**:
  - Search state: `searchTerm`, `currentMatch`, `totalMatches`
  - Search useEffect with DOM manipulation
  - Functions: `highlightMatches`, `scrollToCurrentMatch`, `clearHighlights`, `goToNextMatch`, `goToPreviousMatch`
  - Search bar UI (input field + navigation buttons)
  
- **Removed fullscreen feature**:
  - `isFullscreen` state
  - Maximize/Minimize button
  - Fixed positioning logic
  
- **Removed unused imports**:
  - `useState`, `useEffect`, `useRef` from React
  - `ChevronUp`, `ChevronDown`, `Maximize2`, `Minimize2` from lucide-react
  - `Button` component
  - `cn` utility
  
- **Result**: Clean, focused component that only displays the document with proper scrolling

**Simplified Structure**:
```tsx
<div className="flex flex-col h-full">
  <div className="border-b">Document PLU</div>
  <div className="flex-1 min-h-0 px-8 py-6">
    <div className="h-full overflow-y-auto">
      <div dangerouslySetInnerHTML={{ __html: enhancedHtml }} />
    </div>
  </div>
</div>
```

### Technical Benefits

1. **Proper Flex Height Propagation**:
   - No interference from Tabs component's internal state management
   - Direct parent-child relationship ensures height flows correctly
   - `min-h-0` works as expected without hidden siblings

2. **Eliminated Layout Bugs**:
   - Inactive tabs no longer occupy space
   - Map fills full height when active
   - Document scrolls properly when active

3. **Reduced Complexity**:
   - Removed ~150 lines of search functionality code
   - Removed ~30 lines of fullscreen logic
   - Removed dependency on Radix UI Tabs
   - DocumentViewer: 314 lines → 91 lines (71% reduction)

4. **Better Performance**:
   - Only one artifact component mounted at a time
   - No DOM manipulation for search highlights
   - Simpler render cycle

### Files Modified

- `components/ChatRightPanel.tsx`:
  - Lines 1-134: Complete rewrite using conditional rendering
  - Removed Tabs import, added custom tab button styling
  
- `components/DocumentViewer.tsx`:
  - Lines 1-45: Simplified from 314 lines to 91 lines
  - Kept only: props interface, component render, and `sanitizeAndEnhanceHtml` function
  - Removed: All state, hooks, search logic, fullscreen logic

### User Experience

- Document scrolls smoothly without needing to expand
- Map displays at full height when selected
- Tab switching is instant (no hidden DOM elements)
- Cleaner, simpler interface without unnecessary features

## 2025-11-02 (Evening) - Fixed Scrolling with Tabs Visible & Search Functionality

### Issues Fixed

1. **Document scrolling not working when tabs are visible**
   - **Problem**: When viewing document in right panel with tabs showing, content was not scrollable
   - **Symptom**: Scrolling only worked when clicking expand icon (fullscreen mode)
   - **Root Cause**: `TabsContent` component had `overflow-hidden` class which prevented scrolling through the hierarchy
   - **Solution**: 
     - Removed `overflow-hidden` from TabsContent
     - Made both TabsContent elements always use `flex-1 min-h-0` instead of conditional
     - This allows proper flex height propagation: Tabs → TabsContent → DocumentViewer → Scroll Container

2. **Search bar not working properly**
   - **Problem**: Search functionality was not highlighting matches or had errors
   - **Issues Found**:
     - No escaping of special regex characters (e.g., searching for "." would match any character)
     - DOM manipulation errors when highlighting across element boundaries
     - No error handling for edge cases
   - **Solution**:
     - Added regex character escaping for search terms
     - Improved highlight algorithm to work in reverse order (prevents DOM offset issues)
     - Added try-catch blocks with proper error logging
     - Added text node normalization after clearing highlights
     - Skip empty text nodes to improve performance
     - Better error handling in `highlightMatches` and `clearHighlights` functions

### Files Modified

- `components/ChatRightPanel.tsx`:
  - Line 76-78: Removed conditional and `overflow-hidden` from document TabsContent
  - Line 83: Removed conditional from map TabsContent, added `min-h-0`
  
- `components/DocumentViewer.tsx`:
  - Lines 25-48: Improved search useEffect with regex escaping and error handling
  - Lines 50-109: Rewritten `highlightMatches` function with better DOM traversal
  - Lines 128-150: Enhanced `clearHighlights` with normalization and error handling

### Technical Details

**Flex Container Hierarchy (Now Fixed)**:
```
ChatRightPanel root: flex flex-col
  ↓
Tabs: flex-1 flex flex-col
  ↓
TabsContent: flex-1 min-h-0 (no overflow-hidden!) ✓
  ↓
DocumentViewer: h-full min-h-0 flex flex-col
  ↓
Toolbar: flex-shrink-0 (fixed height)
  ↓
Padding Container: flex-1 min-h-0
  ↓
Scroll Container: h-full overflow-y-auto ✓ SCROLLS HERE
  ↓
Content: no height constraints (triggers scroll)
```

**Search Algorithm Improvements**:
1. Escape special regex characters: `term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`
2. Reverse-order highlighting: Prevents offset changes from affecting subsequent matches
3. Normalization: Merges adjacent text nodes after removing highlight spans
4. Error boundaries: Graceful degradation if DOM manipulation fails

### Testing Checklist

- [x] Document scrolls smoothly with tabs visible
- [x] Document scrolls in fullscreen mode
- [x] Map tab still works correctly
- [x] Search bar accepts input
- [x] Search highlights all matches
- [x] Can navigate between search matches with arrows
- [x] Search counter shows correct match numbers
- [x] Special characters in search don't cause errors
- [x] Clear search removes all highlights

## 2025-11-02 (Document Scrolling - Final Fix with Proper Architecture)

### Problem Analysis

**Original Issue**: Document content could not be scrolled despite multiple attempts to fix height constraints.

**Root Cause**: 
1. Component was initially empty (blank file)
2. When recreated, padding was applied to the wrong element
3. The scroll container and padding container were the same element, causing conflicts

**Height Chain Before Fix**:
```
Page: h-screen (viewport height)
  ↓ full height ✓
Main container: flex-1
  ↓ full height ✓
Header: shrink-0 (fixed)
  ↓
Content area: flex-1 overflow-hidden
  ↓ full height ✓
ChatRightPanel: h-full (PROBLEM - h-full doesn't work in overflow-hidden flex)
  ↓ constraints lost ❌
Tabs: flex-1 flex flex-col
  ↓
TabsContent: min-h-0 flex-1
  ↓
DocumentViewer: h-full min-h-0 (missing implementation)
  ↓
Scroll container: flex-1 overflow-y-auto (no height to work with)
```

**Key Issue**: The `<div className="flex-1 flex overflow-hidden">` parent of ChatRightPanel has `overflow-hidden`, which means `h-full` on ChatRightPanel doesn't receive proper height constraints. The element needs `flex-1` applied at the ChatRightPanel level, OR the parent needs to properly propagate height.

### Solution Implemented - Correct Architecture

**Key Insight**: Padding and scrolling must be on **separate elements**:
- **Parent**: Fixed size container WITH padding (creates margins around content)
- **Child**: Fills parent and scrolls (overflow happens here)
- **Content**: Unlimited height (triggers scroll when exceeds parent)

**Final Structure**:
```jsx
<div className="flex flex-col h-full min-h-0">
  
  // Toolbar: fixed height, never scrolls
  <div className="flex-shrink-0">
    {/* Search bar, title */}
  </div>
  
  // PARENT: Fixed container WITH padding
  <div className="flex-1 min-h-0 px-8 py-6">
    
    // CHILD: Fills parent, scrolls when content overflows
    <div className="h-full overflow-y-auto">
      
      // CONTENT: Can be any height
      <div dangerouslySetInnerHTML={{ __html }} />
      
    </div>
  </div>
  
</div>
```

**Why This Works**:
- Parent (`flex-1 min-h-0 px-8 py-6`): Takes remaining space, padding creates margins
- Child (`h-full overflow-y-auto`): Fills 100% of parent (minus padding), scrolls when needed
- Content: No height constraints, can expand infinitely, triggers scroll

**Critical Height Classes Explained**:
- `h-full`: Takes parent's full height
- `min-h-0`: Allows flex children to be smaller than their content (critical for scrolling)
- `flex-1`: Takes all remaining flex space
- `overflow-y-auto`: Shows scrollbar when content exceeds height
- `flex-shrink-0`: Toolbar doesn't compress, maintains natural height

### How It Works Now - Three-Layer Architecture

1. **DocumentViewer Root** (`h-full min-h-0`):
   - Receives full height from TabsContent
   - Flex column container for toolbar + content area

2. **Toolbar** (`flex-shrink-0`):
   - Fixed natural height, never scrolls
   - Contains search bar and controls
   - Always visible at top

3. **Padding Container** (`flex-1 min-h-0 px-8 py-6`):
   - Gets all remaining space after toolbar
   - **Applies padding** - creates visual margins
   - Does NOT scroll itself

4. **Scroll Container** (`h-full overflow-y-auto`):
   - Nested inside padding container
   - Fills 100% of parent's height (accounting for padding)
   - **This element scrolls** when content overflows

5. **Content** (HTML content):
   - No padding, no height constraints
   - Can be any height
   - When exceeds scroll container height, triggers scrollbar

### Why Previous Approaches Failed

1. **ScrollArea Component Issue**:
   - Requires specific viewport context
   - Doesn't work well with dynamic content in flex containers
   - Native `overflow-y-auto` is more reliable

2. **Padding on Wrong Element** (Critical):
   - Previous implementation had padding on the content div INSIDE scroll container
   - This meant padding scrolled away with content
   - Correct: Padding must be on PARENT of scroll container
   - This creates fixed margins around the scrollable area

3. **Single Element for Both Jobs**:
   - Tried to make one div both hold padding AND scroll
   - Doesn't work - these must be separate responsibilities
   - **Parent**: Fixed size + padding (boundary)
   - **Child**: Scrolls within that boundary

### Files Modified
- `components/DocumentViewer.tsx` - Complete implementation with proper flex/height structure

### Result
Users can now:
- ✓ Scroll through entire document content
- ✓ See native browser scrollbar
- ✓ Use keyboard to scroll (Page Up/Down, Space, etc.)
- ✓ Toolbar stays fixed at top
- ✓ Search highlighting scrolls to match
- ✓ Document is fully accessible regardless of length

## 2025-11-02 (Document Scrolling Fix)

### Fixed
- **Document Scrolling**: Fixed critical issue where users could not scroll through document content
  - **Root Cause**: ScrollArea component from Radix UI lacked proper height constraints from parent flex containers
  - **Solution**: 
    - Added `min-h-0 overflow-hidden` to TabsContent in `ChatRightPanel.tsx` to allow proper flex shrinking
    - Replaced ScrollArea component with native `overflow-y-auto` div for more reliable scrolling
    - Added `min-h-0` to DocumentViewer root container and scroll container for proper height propagation
    - Added `shrink-0` to toolbar to prevent it from shrinking
    - Updated search match scrolling to work correctly with new scroll container

### Changed
- **Scrolling Implementation**: Replaced ScrollArea with native browser scrolling
  - More reliable and predictable scrolling behavior
  - Better performance for long documents
  - Maintains all existing functionality (search, highlighting, navigation)
  - Improved scroll-to-match functionality that properly centers search results

### Technical Details
- **Height Constraints**: Fixed flex container chain with proper `min-h-0` classes
  - TabsContent: `min-h-0 overflow-hidden` allows flex children to shrink
  - DocumentViewer root: `h-full min-h-0` ensures proper height propagation
  - Scroll container: `flex-1 min-h-0 overflow-y-auto` enables scrolling
  - Toolbar: `shrink-0` prevents it from being compressed

### Files Modified
- `components/ChatRightPanel.tsx` - Added height constraints to TabsContent
- `components/DocumentViewer.tsx` - Replaced ScrollArea with native overflow scrolling, improved scroll-to-match

### Result
Users can now scroll through entire document content using mouse wheel, trackpad, or scrollbar. Document content is fully accessible and readable.

## 2025-11-02 (Document Viewer Optimization & Right Panel Enhancement)

### Added
- **DocumentViewer Component**: New dedicated component for rendering PLU documents with PDF-like styling
  - Modern document display with proper typography and spacing
  - Full-text search functionality with match highlighting
  - Search navigation (previous/next match buttons)
  - Fullscreen toggle for expanded viewing
  - Match counter showing current position in document (e.g., "3/12")
  - Smooth highlighting animation on search matches
  - Professional toolbar with document title and controls

- **Enhanced HTML Rendering**: Improved HTML content styling with comprehensive CSS framework
  - Proper heading hierarchy (h1-h6) with distinct sizes and spacing
  - Professional typography with Lato font and proper contrast
  - Improved list styling (ordered and unordered)
  - Enhanced table rendering with alternating row colors
  - Better blockquote styling with left border and background
  - Code block styling with syntax highlighting readiness
  - Image handling with rounded corners and shadows
  - Definition list support (dl, dt, dd)
  - Link styling with hover effects
  - Section/article styling with visual separation

- **Global CSS Enhancements**: Added comprehensive styles in `app/globals.css`
  - `.document-viewer-content` component layer with complete typography rules
  - Proper spacing and margins for all HTML elements
  - Color scheme matching project guidelines (grays and blacks)
  - Scroll margin for heading navigation
  - Animation for search match highlights
  - Table alternating row backgrounds for improved readability

### Changed
- **Right Panel Width**: Increased from 40% to 50% (split screen now 50/50)
  - Updated `ChatRightPanel.tsx` width from `md:w-[40%]` to `md:w-1/2`
  - Provides more space for document reading and viewing
  - Better balance between chat and document panels
  - Improves usability for complex document navigation

- **Document Tab Layout**: Replaced basic prose styling with professional DocumentViewer
  - Removed ScrollArea wrapper from document tab
  - Removed basic inline styling
  - Replaced with comprehensive DocumentViewer component

- **Header Styling**: Improved right panel header
  - Added consistent padding and styling
  - Better alignment of tabs and close button
  - More professional appearance

### Technical Details
- **Search Implementation**: Uses DOM TreeWalker API for efficient text node traversal
  - Case-insensitive search with regex support
  - Real-time match counting
  - Smooth scrolling to current match
  - Memory-efficient highlight management (clears previous highlights)

- **HTML Enhancement**: Custom `sanitizeAndEnhanceHtml()` function
  - Parses HTML content safely
  - Applies Tailwind classes to existing elements
  - Maintains document structure and semantics
  - Non-destructive (doesn't remove existing content)

- **Responsive Design**: Works seamlessly across devices
  - Desktop: Full 50% panel width
  - Tablet: Full-width modal with 50% height
  - Mobile: Full-screen modal with proper spacing

### Files Modified
- `components/DocumentViewer.tsx` - New file
- `components/ChatRightPanel.tsx` - Updated to use DocumentViewer and increase width
- `app/globals.css` - Added comprehensive document styling

### UI/UX Improvements
- **Readability**: Proper contrast, spacing, and typography
- **Navigation**: Search functionality helps users find information quickly
- **Professional Look**: PDF-like appearance inspires confidence
- **Performance**: Efficient DOM manipulation and search highlighting
- **Accessibility**: Proper heading hierarchy and semantic HTML support

## 2025-11-02 (HTML Document Display in Document Tab)

### Added
- **HTML Content Display**: Document tab now displays HTML content from the `documents` table when available
  - Added `documentData` state to store HTML content and document ID
  - Modified `enrichConversationData` to capture and store `html_content` when a document is found
  - Pass `documentHtml` prop to `ChatRightPanel` from the chat page
  - Rendered HTML content using `dangerouslySetInnerHTML` with prose styling

### Changed
- **Removed Zoom Controls**: Removed zoom functionality from document tab
  - Deleted zoom state variable
  - Deleted zoom in/out buttons and percentage display
  - Deleted unused `ZoomIn` and `ZoomOut` imports from lucide-react
  - Removed `transform: scale()` styling

### Files Modified
- `app/chat/[conversation_id]/page.tsx` - Added document state and HTML capture logic
- `components/ChatRightPanel.tsx` - Updated interface, removed zoom controls, added HTML rendering

## 2025-11-02 (Map Full Height Layout Fix)

### Fixed
- **Map Full Height Display**: Fixed Leaflet map only filling bottom portion of right panel, leaving white space above
  - **Root Cause**: 
    1. Nested div structure with conflicting `flex-1` and `h-full` combinations prevented proper height propagation
    2. Inactive document `TabsContent` had `flex-1` class causing it to take up space even when `hidden=""`, preventing map tab from filling full height
  - **Solution**: 
    - Simplified nested div structure in `ChatRightPanel` map `TabsContent` - removed unnecessary wrapper divs
    - Removed `rounded-lg border` constraints from `MapArtifact` wrapper that prevented edge-to-edge filling
    - Added `p-0` to `TabsContent` to remove padding
    - Added `flex-1` to `MapArtifact` wrapper to ensure it fills flex container
    - **Conditionally apply `flex-1`**: Only apply `flex-1` class when tab is active to prevent inactive hidden tabs from participating in flex layout calculations
  - **Result**: Map now fills entire right panel tab area from top to bottom with no white space
  - **Files Modified**:
    - `components/ChatRightPanel.tsx` - Simplified map tab structure, removed nested divs, conditionally apply flex-1 based on activeTab
    - `components/MapArtifact.tsx` - Removed border/rounded corners, added flex-1 for proper filling

## 2025-11-02 (Grid Layout and Panel Header Improvements)

### Changed
- **Grid Layout for Artifact Cards**: Changed `InlineArtifactCard` container from vertical stack to 2-column grid layout
  - Maps and Documents now display side-by-side on medium+ screens (`md:grid-cols-2`)
  - Cards stack vertically on mobile devices (`grid-cols-1`)
  - Same gap spacing maintained (`gap-3`)
  - File: `app/chat/[conversation_id]/page.tsx` (line 1011)
  
- **Simplified Right Panel Header**: Removed "Documents PLU" title and integrated close button with tabs
  - Tabs (Document, Carte) now on same line as close button (X icon)
  - Tabs on left, close button on right
  - Cleaner, more compact header design
  - File: `components/ChatRightPanel.tsx` (lines 46-75)
  
- **Full-Width Map Display**: Removed padding from map container to fill entire available space
  - Map now displays edge-to-edge in tab content area
  - Better utilization of panel space for geographic visualization
  - File: `components/ChatRightPanel.tsx` (line 141)

### Files Modified
- `app/chat/[conversation_id]/page.tsx`
- `components/ChatRightPanel.tsx`

## 2025-11-02 (Inline Artifact Intro Layer)

### Added
- **Claude-style artefact introduction** at the top of new conversations in `app/chat/[conversation_id]/page.tsx`.
  - Assistant posts a `"Carte chargée"` message followed by two inline artefact cards (map and document) that mirror Claude's conversation flow.
  - Cards open the right-panel artefact tabs and reflect loading status (loading → ready) while the map/document are prepared.
- **`InlineArtifactCard` component** to render reusable artefact chips with MWPLU colours and status feedback.
- **Right panel tab coordination** by wiring `ChatRightPanel` to accept `activeTab` and `onTabChange` props so inline cards can focus the relevant artefact.

### Changed
- Replaced the previous loading simulation with an orchestrated intro sequence that shows the map first, then the document, while keeping the panel open by default.
- Updated the conversation scroll area spacing so the intro cards and subsequent chat messages stack cleanly.
- Discarded the in-progress UI tests for this iteration per product request to focus solely on the interaction polish.

### Files
- `app/chat/[conversation_id]/page.tsx`
- `components/InlineArtifactCard.tsx` *(new)*
- `components/ChatRightPanel.tsx`

## 2025-11-02 (Claude-Style Collapsible Sidebar with Light Theme)

### Redesigned - Collapsible Sidebar with Light Theme (Claude Style)
- **Sidebar Navigation**: Claude-style collapsible navigation with light theme
  - **Collapsible**: Toggle between 64px (icon-only) and 280px (expanded) widths
  - **Light Theme**: Uses project's color scheme (white, greys, black)
  - **Clean Lucide Icons**: Plus, MessageSquare, Folder, User, ChevronLeft, Menu
  - **Toggle Button**: ChevronLeft when expanded, Menu when collapsed (always visible)
  
- **Collapsed State (64px)**:
  - Menu icon toggle button at top
  - Plus icon → "Nouvelle recherche" with tooltip
  - MessageSquare icon → "Chat" with tooltip
  - Folder icon → "Projets" with tooltip
  - User avatar icon → "Profil" dropdown menu with Paramètres and Déconnexion
  
- **Expanded State (280px)**:
  - MWPLU logo at top with ChevronLeft toggle button
  - "Nouvelle recherche" button (black background with Plus icon)
  - "Chat" navigation button with MessageSquare icon
  - "Projets" navigation button with Folder icon
  - "Récents" section with scrollable list of recent conversations
    - Shows up to 20 most recent conversations in descending order
    - Conversation titles, last activity time
    - Click to navigate to conversation
  - "Profil" dropdown menu at bottom

### Color Scheme
Following project guidelines from `project_context.md`:
- **Background**: `#FFFFFF` (white)
- **Border**: `#E5E5E5` (light grey) 
- **Icon color**: `#333333` (dark grey) normal state
- **Icon color hover**: `#000000` (black) on hover
- **Hover background**: `#F5F5F5` (very light grey)
- **Active conversation**: `#E5E5E5` (light grey)
- **Button**: `#000000` with `#1a1a1a` hover

### Modified Files
- `components/ChatLeftSidebar.tsx` - Complete redesign:
  - Added collapse/expand state management with `collapsed` prop (default: true)
  - Added toggle button with Menu/ChevronLeft icons (always visible)
  - Conditional rendering: collapsed vs expanded layout
  - Recent conversations list loaded from V2 conversations
  - Query: All user's active conversations ordered by last_message_at descending
  - Tooltips on all icons in collapsed state
  - Navigation buttons in expanded state
  - ScrollArea for recent chats list
  - Light theme styling with inline styles matching project guidelines
  - User dropdown menu with logout functionality
- `app/chat/[conversation_id]/page.tsx`:
  - No changes needed (sidebar manages its own state)
- `app/page.tsx`:
  - No changes needed (sidebar manages its own state)

### Technical Details
- Uses inline styles: `style={{ backgroundColor: '#FFFFFF' }}` for consistency with project
- Hover states: `onMouseEnter/Leave` with inline color changes
- Icons: All Lucide React icons (Plus, MessageSquare, Folder, User, ChevronLeft, Menu)
- Tooltips: `TooltipProvider` wrapping entire sidebar
- Smooth transitions: `transition-all duration-300 ease-in-out` for width changes
- Recent chats: Loads up to 20 conversations, sorted by last_message_at descending
- Current conversation highlight: Shows active conversation in different background color

## 2025-11-02 (Fix Document Query Loop) - UPDATED

### Fixed - Document Query Loop and RLS Issues
- **Issue**: Infinite loop in document fetching causing repeated Carto API calls and 400/403 errors
- **Root Causes**:
  1. Query used non-existent `city_id` column on `documents` table (400 Bad Request)
  2. Missing RLS policies on `documents` table blocking INSERT operations (403 Forbidden)
  3. React Strict Mode double-invoke causing enrichment function to run multiple times
  4. No guard to prevent re-execution of enrichment process
  
- **Solutions**:
  1. **Fixed Document Query**: Removed `city_id` filter from document lookup query (lines 510-516)
     - Query now correctly uses only `zone_id` and `zoning_id` columns
     - Built query conditionally - only adds filters for non-null values
     - Handles case where both `zoneId` and `zoningId` are null (skips query, completes flow)
   
  2. **Added RLS Policies**: Created migration `20251102000012_add_rls_policies_documents.sql`
     - Enabled RLS on `documents` table
     - Policy: All authenticated users can SELECT all documents (documents are shared/public resources)
     - Policy: Authenticated users can INSERT documents (for placeholder creation)
     - Policy: Only admins can UPDATE/DELETE documents
   
  3. **Prevented Re-execution Loop**: Added `useRef` guard `enrichmentInProgressRef`
     - Checks guard before calling `enrichConversationData()`
     - Sets guard to `true` at start of enrichment, `false` in finally block
     - Prevents React Strict Mode double-invoke from causing loops
     - Guard resets after completion (success or error) to allow future executions
   
  4. **Improved Error Handling**:
     - Wrapped `fetchDocument` call in try-catch to prevent errors from breaking flow
     - Document INSERT failures are logged but don't stop the process
     - Always sets `artifactsLoading` to false even on errors to prevent UI stuck state
     - Added comprehensive error logging with `[DOCUMENT_CHECK_*]` prefixes

### Modified Files
- `app/chat/[conversation_id]/page.tsx`:
  - Added `useRef` import
  - Added `enrichmentInProgressRef` guard to track enrichment state
  - Fixed document query to remove `city_id` and handle null values conditionally
  - Added outer try-catch-finally block to reset guard always
  - Improved error handling for Carto API calls and document creation
- `supabase/migrations/20251102000012_add_rls_policies_documents.sql` - New migration for documents RLS policies

### Technical Details
- Document query now works with partial matches (zoneId only, zoningId only, or both)
- Query is skipped entirely if both IDs are null, but flow still completes
- RLS policies allow all authenticated users to read/insert documents (shared resources)
- Guard prevents multiple simultaneous enrichment executions
- Error handling ensures UI never gets stuck in loading state

## 2025-11-02 (Map and Document Artifact Flow) - UPDATED

### Fixed - Artifact Flow Always Runs
- **Issue**: Chat page was skipping map and document flow when `city_id` already existed in research record
- **Root Cause**: Early return when `isEnrichmentComplete` (city_id !== null) prevented map/document stages from running
- **Solution**: Removed early exit logic; enrichment now reuses existing data and always proceeds to map and document stages
- **Behavior**: Map and document artifact flow now runs every time chat page loads, whether data is fresh or existing
- **Result**: Users always see the map load and document retrieval, even when navigating to existing conversations

### Added - Complete Map and Document Display Flow
- **Map Artifact Component**: Created `components/MapArtifact.tsx` with interactive Leaflet map
  - Displays map centered on address coordinates with OpenStreetMap tiles
  - Renders zone polygon with highlighted styling from multipolygon geometry data
  - Shows address marker at provided coordinates
  - Includes zoom and pan controls
  - Handles loading states and missing data gracefully
  
- **Zone Geometry Storage**: Added `geometry` JSONB column to `zones` table
  - Stores multipolygon GeoJSON from Carto API for map visualization
  - Avoids repeated API calls by caching geometry in database
  - Migration: `20251102000011_add_geometry_to_zones.sql` with GIN index for performance
  - Updated `getOrCreateZone()` to accept and store geometry parameter
  
- **Enriched Document Retrieval Logic**: Three-case document lookup system
  - **Case 1**: Full analysis available (content_json + html_content populated) → Display analysis, enable chat
  - **Case 2**: Source PLU only (source_plu_url but no analysis) → Display PDF, disable chat
  - **Case 3**: No document record → Create placeholder with typology_id and optional source_plu_url
  - Lookup by exact match: `(zone_id, zoning_id, city_id)`
  
- **Map Loading Stages**: Enhanced enrichment flow with new stages
  - `map_loading`: Right panel slides in, map starts loading with 2-second animation
  - `map_ready`: Map rendered with highlighted zone polygon
  - `document_check`: Document lookup begins
  - `complete`: Full flow finished
  - All stages include comprehensive console logging for debugging

### Modified Files
- `supabase/migrations/20251102000011_add_geometry_to_zones.sql` - New migration for geometry column
- `components/MapArtifact.tsx` - New Leaflet map component with zone highlighting
- `components/ChatRightPanel.tsx` - Integrated map artifact with tab switching
- `lib/geo-enrichment.ts` - Added geometry parameter to `getOrCreateZone()`
- `app/page.tsx` - Pass zone geometry when creating zones
- `app/chat/[conversation_id]/page.tsx` - Complete enrichment flow with map and document retrieval
- `package.json` - Added Leaflet dependencies (leaflet, react-leaflet@4.2.1, @types/leaflet)

### Dependencies
- `leaflet`: ^1.9.4 (map library)
- `react-leaflet`: ^4.2.1 (React wrapper, compatible with React 18)
- `@types/leaflet`: (TypeScript definitions)

### Technical Details
- Map component uses dynamic imports to avoid SSR issues with Leaflet
- Geometry stored as GeoJSON multipolygon format
- Fixed Leaflet marker icon issue in Next.js using CDN-hosted images
- Right panel slides in smoothly when map loading starts
- Console logs prefixed: `[MAP_ARTIFACT_*]`, `[DOCUMENT_CHECK_*]`, `[DOCUMENT_DISPLAY]`, `[FLOW_COMPLETE]`
- System messages filtered from display (only user/assistant shown in chat)

## 2025-11-02 (Research History: Replace zone_id with zoning_id)

### Changed - Research History Schema
- **Replaced zone_id with zoning_id**: Changed `v2_research_history` table to use `zoning_id` instead of `zone_id` for more precise duplicate detection
  - **Reason**: Zoning ID is more precise than zone ID since zones belong to zonings (zoning is the parent entity)
  - **Migration**: Created migration `20251102000010_replace_zone_id_with_zoning_id.sql` that:
    - Drops `zone_id` column
    - Adds `zoning_id` column with foreign key to `zonings(id)`
    - Adds index on `zoning_id` for performance
  - **Updated Duplicate Detection**: `checkExistingResearch()` now checks for `user_id`, `city_id`, and `zoning_id` instead of `zone_id`
  - **Benefits**:
    - More accurate duplicate detection (zoning level is more appropriate than zone level)
    - Zoning ID is always available (even for RNU cases where we create RNU zoning)
    - Better reflects the data hierarchy (zoning → zone)

### Modified Files
- `supabase/migrations/20251102000010_replace_zone_id_with_zoning_id.sql` - New migration file
- `lib/supabase.ts` - Updated `V2ResearchHistory` type: `zone_id` → `zoning_id`
- `lib/geo-enrichment.ts`:
  - `enrichResearchWithGeoData()` - Tracks and uses `zoning_id` instead of `zone_id`
  - `checkExistingResearch()` - Updated parameter from `zoneId` to `zoningId`, queries by `zoning_id`
- `app/page.tsx` - Tracks `zoningId`, passes to `checkExistingResearch()`, inserts `zoning_id` in research_history
- `app/chat/[conversation_id]/page.tsx` - Tracks `zoningId`, updates research_history with `zoning_id`
- `__tests__/utils/test-helpers.ts` - Updated mock data: `zone_id` → `zoning_id`

### Technical Details
- All foreign key relationships remain valid (zoning_id → zonings table)
- Zoning ID is always available because we create/get zoning before zones
- RNU cases create an RNU zoning, so `zoning_id` is always set
- Duplicate matching: Same `user_id` + `city_id` + `zoning_id`

## 2025-11-02 (Research History Fix)

### Fixed - Research History Update Loophole
- **Missing UPDATE RLS Policy**: Added UPDATE policy to `v2_research_history` table to allow linking conversation_id and project_id after record creation
  - **Root cause**: Table had SELECT and INSERT policies but was missing UPDATE policy, causing all UPDATE operations to silently fail
  - **Impact**: Conversation and project IDs were not being saved to research history records, breaking the linkage between research, conversations, and projects
  - **Solution**: Created migration `20251102000009_add_update_policy_research_history.sql` adding RLS policy allowing users to update their own research history records
  - **Affected locations**:
    - `app/page.tsx` (line 225-237) - Linking conversation and project IDs after creation
    - `lib/geo-enrichment.ts` (line 85-98) - Adding city_id and zone_id during enrichment
    - `app/chat/[conversation_id]/page.tsx` (lines 261-283, 392-417) - Enrichment updates for city and zone IDs
  - **Error Handling**: Added comprehensive error handling and logging to all research history update operations to catch and diagnose failures
  - **Logging**: All updates now log errors to console for debugging: `[DB_UPDATE]`, `[ENRICHMENT]` prefixes

#### Notes
- Non-destructive fix: Only adds missing RLS policy and error handling
- All existing research history records remain intact
- Migration is backward compatible with existing code
- Error handling ensures silent failures are now visible in logs
- After migration, all research history updates will succeed and properly link conversations/projects

## 2025-11-02 (Rollback - Workflow Restructure)

### Changed - Address Search Workflow
- **Restructured Address Analysis Flow**: Moved Carto API calls to execute before creating database records
  - **Previous Flow**: Created project/conversation immediately → Navigated to chat → Enriched data in background
  - **New Flow**: Call Carto APIs first → Enrich database → Check for duplicates → Create records or navigate to existing conversation
  - **Benefits**:
    - User sees loading state immediately on address input page
    - Duplicate detection happens before creating new records
    - Database enrichment happens upfront with proper city/zone/zoning IDs

- **Added Duplicate Detection**: Check for existing conversations before creating new ones
  - Added `checkExistingResearch()` function in `lib/geo-enrichment.ts`
  - Queries `v2_research_history` for matching `city_id` + `zone_id` + `user_id`
  - If duplicate found, navigates directly to existing conversation instead of creating new one
  - Prevents duplicate projects/conversations for same address search

- **Enhanced Loading State**: Added visual loading indicator on address input page
  - Shows spinner and message "Analyse en cours..." during API calls
  - Displays helpful text: "Récupération des informations de la commune et du PLU"
  - Button replaced with loading state during processing

### Modified Files
- `app/page.tsx` - Complete rewrite of `handleAddressSubmit()`:
  - Step 1: Call `fetchMunicipality()` API with INSEE code
  - Step 2: Call `fetchZoneUrba()` API with coordinates
  - Step 3: Enrich database (get/create city, zoning, zone)
  - Step 4: Check for existing research with `checkExistingResearch()`
  - Step 5-9: Create new records only if no duplicate found
- `components/InitialAddressInput.tsx` - Added loading state UI when `disabled={true}`
- `lib/geo-enrichment.ts` - Added `checkExistingResearch()` helper function

### Technical Details
- Duplicate matching: Same `city_id` + `zone_id` (which implicitly means same zoning since zone belongs to zoning)
- Navigation: If duplicate found, navigates to `/chat/{existing_conversation_id}`
- Error handling: API failures gracefully handled, continues with fallback data when possible
- Type safety: Added null checks for `cityId`, `zoneId`, and INSEE codes

## 2025-11-02 (Late Night - Continued)

### Fixed - City Update Error Handling
- **Error Handling for City Updates**: Added proper error checking and logging to city update operations in `lib/geo-enrichment.ts`
  - **Issue**: City updates (INSEE code and lowercase name) were failing silently due to missing error handling
  - **Root cause**: Update query wasn't checking for errors, making debugging impossible
  - **Solution**: 
    - Added error destructuring to update query: `const { error: updateError } = await supabase...`
    - Added error logging: `console.error('Error updating city:', updateError)`
    - Added success logging: `console.log('Updated city ${cityByName.id} with:', updates)`
    - Update failures no longer break the flow - function continues with existing city ID even if update fails
  - **Impact**: Now able to diagnose and fix city update issues (e.g., missing UPDATE RLS policy)
  - **Related**: UPDATE RLS policy was added separately to migration to allow authenticated users to update cities

#### Notes
- Error handling follows same pattern as city creation (non-throwing for updates, throwing for creation failures)
- Logging helps track which cities are being enriched with INSEE codes and lowercase names
- Graceful degradation: Function continues working even if updates fail (preserves existing functionality)

## 2025-11-02 (Late Night)

### Fixed - Database Connection Issue
- **Cities Table INSEE Code Support**: Fixed 403/400 error when creating cities in production
  - Root cause: Frontend was attempting to use INSEE codes (e.g., "38185") as UUID primary keys
  - Secondary issue: Missing RLS policies on shared reference tables (cities, zonings, zones)
  - Created migration `20251102000008_add_insee_code_to_cities.sql`:
    - Added `insee_code VARCHAR` column to cities table
    - Created unique index on `insee_code` to prevent duplicates
    - Made column nullable to preserve existing cities without INSEE codes
    - Enabled RLS on cities, zonings, and zones tables
    - Added public read policies for all authenticated users
    - Added authenticated insert policies for cities, zonings, and zones
  - Enhanced `lib/geo-enrichment.ts` `getOrCreateCity()` function with smart lookup:
    - Changed query from `.eq('id', inseeCode)` to `.eq('insee_code', inseeCode)`
    - Changed insert from `{id: inseeCode, name: communeName}` to `{insee_code: inseeCode, name: communeName}`
    - Now properly uses auto-generated UUID for primary key
    - **Smart lookup logic**: Tries INSEE code first, falls back to city name search
    - **Progressive enrichment**: Updates existing cities with INSEE code if found by name but missing INSEE
    - **No duplicates**: Prevents creating duplicate cities when city exists with only name
  - Updated `City` TypeScript type in `lib/supabase.ts`:
    - Added `insee_code: string | null` field to match database schema

#### Notes
- Non-destructive: existing cities and all foreign key relationships preserved
- Existing city UUIDs remain unchanged
- All references from v2_projects, v2_research_history, and zonings tables remain intact
- Shared reference tables (cities, zonings, zones) are now publicly readable with authenticated insert permissions
- City lookup now handles legacy data without INSEE codes gracefully

## 2025-11-02 (Late Evening - Continued)

### Fixed - V2 Architecture Consistency
- **NewConversationModal V2 Migration**: Updated `components/NewConversationModal.tsx` to create v2 projects and conversations instead of v1
  - Now creates `v2_projects` with user-provided name and project_type
  - Creates linked `v2_conversation` with conversation_type 'general'
  - Sets project status to 'active' when user provides a name (vs 'draft' for auto-created)
  - Added all project types to select dropdown: construction, extension, renovation, amenagement, lotissement, other
  - Navigates to `/chat/[conversation_id]` with the new v2 conversation

- **Project Page V2 Migration**: Updated `app/project/[id]/page.tsx` to use v2 tables throughout
  - Changed imports from `ChatConversation`, `ChatMessage` to `V2Conversation`, `V2Message`
  - Updated all queries: `chat_conversations` → `v2_conversations`, `chat_messages` → `v2_messages`, `research_history` → `v2_research_history`
  - Added user authentication checks to all fetch functions
  - Updated message inserts to include `message_type` field
  - Updated conversation updates to include `message_count` tracking
  - Changed delete operation to archive (set `is_active: false`, `archived_at`) instead of hard delete
  - Research history now links to conversation_id

- **ChatSidebar V2 Support**: Updated `components/ChatSidebar.tsx` to work with v2 conversations
  - Changed from `Conversation[]` to `V2Conversation[]` type
  - Updated to use `title` and `context_metadata.initial_address` instead of `name` and `address`
  - Fixed navigation route from `/Conversation/[id]` to `/chat/[id]` for consistency

#### Notes
- All legacy files now consistently use v2 architecture
- V1 tables remain untouched and functional (non-destructive migration preserved)
- Both `/project/[id]` and `/chat/[conversation_id]` routes now work with v2 data

## 2025-11-02 (Late Evening)

### Completed - V2 Migration Tasks

#### Added
- **ChatLeftSidebar V2 Integration**: Updated `components/ChatLeftSidebar.tsx` to display v2 projects hierarchically
  - Queries `v2_projects` with nested `v2_conversations` via Supabase select
  - Displays projects with expandable/collapsible conversation lists
  - Shows project icon, name (or "Sans nom" for drafts), main address, and conversation count
  - Auto-expands project containing the current active conversation
  - Click project toggles expand/collapse; click conversation navigates to chat
  - Collapsed sidebar state shows project icons (first 5)
  - Maintains backward compatibility with existing UI patterns

- **Analytics Integration**: Added v2 message analytics logging
  - Created `lib/analytics.ts` with `logChatEvent()` function
  - Writes to `analytics.chat_events` table with `source: 'v2'` metadata tag
  - Supports all analytics fields: tokens, costs, response times, document references, etc.
  - Updated `app/chat/[conversation_id]/page.tsx` to log analytics after v2_messages insert
  - Logs both user and assistant messages separately
  - Graceful error handling (analytics failures don't break chat)

- **V1 to V2 Migration Script**: Created optional migration tools in `supabase/migrations/20251102000007_migrate_v1_to_v2.sql`
  - **Migration Tracking Table**: `migration_tracking` tracks all migrations with status and error logging
  - **Single Migration Function**: `migrate_v1_conversation_to_v2()` migrates one v1 conversation to v2
    - Creates v2_project (draft, unnamed)
    - Creates v2_conversation linked to project
    - Migrates all messages to v2_messages (maps document_id to referenced_documents array)
    - Links document via v2_conversation_documents if document_id exists
    - Preserves timestamps and conversation turn order
    - Prevents duplicate migrations
  - **Batch Migration Function**: `migrate_user_v1_to_v2()` migrates all active v1 conversations for a user
  - **RLS Policies**: Users can view own migration records, admins can view all
  - Migration is optional and non-destructive (v1 data remains intact)

#### Changed
- **ChatLeftSidebar Data Model**: Switched from flat v1 conversations list to hierarchical v2 projects view
  - Old: Single list of `chat_conversations` 
  - New: Projects containing nested conversations with expand/collapse UI

#### Files Modified
- `components/ChatLeftSidebar.tsx` - Complete rewrite for v2 projects display
- `lib/analytics.ts` - New file for analytics helper functions
- `app/chat/[conversation_id]/page.tsx` - Added analytics logging after message inserts
- `supabase/migrations/20251102000007_migrate_v1_to_v2.sql` - New migration file

#### Notes
- Migration functions use `SECURITY DEFINER` for proper permission handling
- Analytics integration is flexible - can be enhanced to capture model_name, tokens, costs from API responses
- Migration script preserves all v1 data and allows selective migration per user
- Sidebar maintains all existing functionality (collapsed state, navigation, highlighting)

## 2025-11-02 (Evening)

### Enhanced
- **ProjectCard Component**: Enhanced `components/ProjectCard.tsx` with full feature set from product specification
  - **Starred Projects**: Added star icon indicator (yellow filled star) when `project.starred === true`
  - **Draft Styling**: Draft projects with `name === null` now display "Sans nom" in italic, gray text (`text-gray-500 italic`)
  - **Project Type Display**: Added project type badge with French labels:
    - construction → "Construction"
    - extension → "Extension"
    - renovation → "Rénovation"
    - amenagement → "Aménagement"
    - lotissement → "Lotissement"
    - other → "Autre"
  - **Color Accent**: Applied `project.color` as subtle left border accent (4px) when set and not default gray
  - **Visual Hierarchy**: Improved layout with star icon positioned next to project name
  - All enhancements maintain backward compatibility and existing functionality (navigation, status badges, conversation count)

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


## 2025-11-09

### Redesigned
- **ChatMessage Components**: Complete UI/UX overhaul of bot message components
  - **ChatMessage.tsx**: Enhanced full-width message layout
    - Improved contrast: Bot messages now use white background with subtle gray border-left accent
    - Better visual hierarchy: Added colored left border (blue for user, gray for bot)
    - Enhanced avatar design: Bot avatar uses blue-50 background with blue-700 text (WCAG AA compliant)
    - Added hover states: Subtle background color transitions on bot messages
    - Improved spacing: Increased padding (py-5) and gap (gap-4) for better readability
    - Max-width constraint: Content limited to max-w-4xl for optimal reading width
    - Markdown support: Bot messages now render markdown with proper typography hierarchy
    - Accessibility: Added ARIA labels, semantic HTML (role="article"), proper contrast ratios
  
  - **ChatMessageBubble.tsx**: Enhanced bubble-style message layout
    - Improved contrast: Bot bubbles use white background with gray ring border (was gray-100)
    - Better avatar visibility: Bot avatar uses blue-50/blue-700 (was gray-200/gray-700)
    - Enhanced shadows: Added subtle shadow-sm with hover elevation
    - Consistent spacing: Standardized padding (px-5 py-3.5) and gap (gap-3)
    - Better typography: Increased font size to 15px (was text-sm) for improved readability
    - Ring borders: Added ring-1 borders for better definition
    - Accessibility: Added ARIA labels and semantic HTML
  
  - **Typography Improvements**:
    - Markdown rendering for bot messages with styled components
    - Proper heading hierarchy (h1, h2, h3) with appropriate sizing
    - Styled lists (ul, ol) with proper spacing
    - Code blocks with gray background and border
    - Link styling with blue-600 color and hover states
    - Blockquote styling with left border accent
    - All text meets WCAG AA contrast requirements (4.5:1 minimum)

### Fixed
- **Visual Hierarchy**: Resolved white-on-white contrast issues
- **Accessibility**: Added proper ARIA labels and semantic HTML structure
- **Color Contrast**: All text now meets WCAG AA standards
- **Component Consistency**: Standardized spacing and styling patterns

### Technical Details
- Bot avatar: `bg-blue-50 text-blue-700 ring-blue-200` (4.7:1 contrast ratio)
- Bot message background: `bg-white` with `border-l-2 border-l-gray-300`
- User message background: `bg-gray-50/50` with `border-l-2 border-l-blue-500`
- Content max-width: `max-w-4xl` for optimal reading experience
- Markdown support via react-markdown with custom component styling

### Improved
- **Conversation Card Reference**: Tuned spacing and typography in `style-reference.css`/`style-reference.html` to match Claude-level whitespace
  - Header padding now asymmetrical for tighter title/description grouping
  - Title sizing/weight adjusted for better hierarchy against body copy
  - Message preview and timestamp spacing balanced for cleaner rhythm
  - Introduced `.conversation-card-meta` flex helper for timestamp row alignment

## 2025-11-12

### Added
- **Sidebar Toggle Alignment Test**: Created `__tests__/components/sidebar-toggle.test.tsx` to lock the toggle button layout on the sidebar.

### Fixed
- **Sidebar Toggle Layout**: Updated `components/ui/sidebar.tsx` so the collapsed toggle button uses left alignment and consistent padding/icon wrapper, matching other sidebar controls.


## 2025-01-07

### Fixed
- **Profile Avatar Upload**: Fixed avatar upload functionality in `components/profile/ProfileAvatar.tsx`
  - Fixed file path issue: removed double `avatars/` prefix (bucket name was already 'avatars')
  - Added cleanup logic to delete old avatar files when uploading new ones
  - Improved error handling with better error messages and cleanup on failure
  - Now uses `updateUserProfile` function for consistency with profile updates

### Added
- **Storage RLS Policies**: Created migration `20250107000001_setup_avatars_storage.sql`
  - Added RLS policies for avatars storage bucket
  - Users can only upload/update/delete their own avatars (files starting with their user ID)
  - Public read access for avatar images
  - Note: The 'avatars' bucket must be created manually in Supabase Dashboard (Storage > Buckets > New Bucket)

- **Profiles RLS Policies**: Created migration `20250107000002_add_profiles_rls_policies.sql`
  - Added RLS policies for profiles table
  - Users can view and update their own profiles
  - Admins can view and update all profiles
  - Users can create their own profile records
