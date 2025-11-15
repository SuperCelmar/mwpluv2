# User Flow and Technical Process Documentation

## Overview

This document provides a comprehensive guide to the user experience and technical implementation of the MWPLU address analysis system. Each step includes file paths and line numbers where the relevant code is implemented.

## Table of Contents

1. Address Input and Search
2. Address Selection and Conversation Creation
3. Navigation to Chat Page
4. Background Enrichment Process
5. Map Display and Zone Visualization
6. Document Retrieval and Analysis
7. Final Analysis Message Display
8. Artifact Rendering and Panel Management

---

## 1. Address Input and Search

### User Experience

- User types an address in the input field on the home page
- After 3+ characters, address suggestions appear in a dropdown
- User can select an address from suggestions or continue typing

### Technical Implementation

#### 1.1 Address Input Component

**File**: `app/(app)/page.tsx`

- **Lines 35-47**: `handleAddressInputChange` function
  - Debounced address search triggered when query length >= 3
  - Calls `searchAddress` API function
  - Updates suggestions state

**File**: `components/InitialAddressInput.tsx`

- **Lines 22-49**: `useEffect` hook for debounced address search
  - 300ms debounce timer
  - Calls `searchAddress` when query length >= 3
  - Updates suggestions and loading state

#### 1.2 Address Search API Call

**File**: `lib/address-api.ts`

- **Lines 22-59**: `searchAddress` function
  - Calls French government address API: `https://api-adresse.data.gouv.fr/search/`
  - Returns up to 5 address suggestions
  - Extracts coordinates, city, INSEE code, postcode

#### 1.3 Address Selection

**File**: `app/(app)/page.tsx`

- **Lines 49-54**: `handleAddressSelect` function
  - Sets selected address
  - Updates input query with full address label
  - Hides suggestions dropdown

**File**: `components/InitialAddressInput.tsx`

- **Lines 51-64**: `handleSelect` function
  - Updates query with selected address label
  - Hides suggestions
  - Sets selectedAddress state

---

## 2. Address Submission and Conversation Creation

### User Experience

- User clicks submit button or presses Enter
- System checks for duplicate addresses
- Creates a lightweight conversation record
- Navigates immediately to chat page

### Technical Implementation

#### 2.1 Address Submit Handler

**File**: `app/(app)/page.tsx`

- **Lines 56-129**: `handleAddressSubmit` function
  - Validates user ID
  - Checks for duplicate by coordinates (lines 78-102)
  - Creates lightweight conversation (lines 106-112)
  - Navigates to chat page (line 119)

#### 2.2 Duplicate Check

**File**: `lib/supabase.ts`

- **Lines 309-341**: `checkDuplicateByCoordinates` function
  - First tries RPC function `check_duplicate_by_coordinates` (lines 318-323)
  - Falls back to client-side distance calculation (line 335)
  - Uses Haversine formula to calculate distance within 50 meters
  - Queries recent research history records (lines 354-362)
  - Returns conversation ID if duplicate found, null otherwise

- **Lines 347-400**: `checkDuplicateByCoordinatesFallback` function
  - Client-side fallback when RPC is not available
  - Queries last 50 research history records with coordinates
  - Calculates distance for each record
  - Returns duplicate if found within 50 meters

#### 2.3 Lightweight Conversation Creation

**File**: `lib/supabase/queries.ts`

- **Lines 13-54**: `createLightweightConversation` function
  - Creates minimal conversation record in `v2_conversations` table
  - Stores address, coordinates, INSEE code in `context_metadata`
  - Sets `enrichment_status` to 'pending'
  - Does NOT create project or fetch API data (happens in background)
  - Returns conversation ID

**Database Schema**:

- Table: `v2_conversations`
- Fields: `user_id`, `title`, `context_metadata`, `enrichment_status`
- `context_metadata` contains: `initial_address`, `geocoded: {lon, lat}`, `city`, `insee_code`

---

## 3. Navigation to Chat Page

### User Experience

- User is immediately redirected to `/chat/[conversation_id]`
- Chat page loads conversation data
- Enrichment process starts automatically in background

### Technical Implementation

#### 3.1 Chat Page Initialization

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 58-61**: `useEffect` hook on mount
  - Calls `checkAuthAndLoadConversation`
- **Lines 486-497**: `checkAuthAndLoadConversation` function
  - Validates user authentication
  - Loads conversation data

#### 3.2 Conversation Loading

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 499-693**: `loadConversation` function
  - **Lines 504-509**: Loads conversation from database
  - **Lines 525-542**: Loads project if `project_id` exists
  - **Lines 545-565**: Loads existing messages
  - **Lines 567-619**: Adds initial address as first message if no messages exist
  - **Lines 621-651**: Loads research history for context
  - **Lines 653-683**: Loads artifacts for completed conversations

#### 3.3 Initial Address Message

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 571-590**: Creates address message object
  - `message_type: 'address_search'`
  - Contains initial address from `context_metadata`
  - Added to messages array if no messages exist

---

## 4. Background Enrichment Process

### User Experience

The chat experience now follows the seven-step progressive plan defined in `new_chat_process.md`:

1. **Step 1 – Coordinates received:** the right panel auto-opens on the map tab and the LoadingAssistantMessage shows “Vérification de la zone concernée...”.
2. **Step 2 – Map marker render:** Leaflet mounts with only the address marker; once `handleMapRenderComplete` fires, the UI waits ~2s before moving on.
3. **Step 3 – Polygon overlay:** when `mapGeometry` arrives the polygon animates in, `buildBoundsFromPolygons` reframes the camera, and the loading copy stays in Step 1 until the overlay is visible.
4. **Step 4 – Document lookup:** the enrichment worker queries Supabase for an existing analysis and streams progress to `useEnrichment`.
5. **Step 5 – Document tab switch:** as soon as a document ID exists, the document tab slides into focus and Step 2 (“Récupération des documents sources...”) begins.
6. **Step 6 – Analysis reveal:** when HTML content renders, Step 3 (“Récupération de l'analyse correspondante...”) fades out and `AnalysisFoundMessage` takes over with inline cards for both map and document.
7. **Step 7 – Panel persistence:** the panel stays open and stage transitions are gated by render callbacks so we never advance until the artifact and message state agree.

### Technical Implementation

#### 4.0 Progressive Panel Flow Reference

- **Spec Source**: `new_chat_process.md` (lines 1-133) documents the seven explicit milestones and is now mirrored verbatim in code.
- **Coordinator Effects**: `app/(app)/chat/[conversation_id]/page.tsx` (lines 98-208, 219-400, 445-484, 1013-1084) wires `useEnrichment`, `useArtifactSync`, and the panel state machine so each step flips exactly once. `handleMapRenderComplete` / `handleDocumentRenderComplete` gate the stage transitions surfaced to `LoadingAssistantMessage`.
- **Progress Driver**: `app/(app)/chat/[conversation_id]/useEnrichment.ts` (lines 42-228) streams partial data + `progress` flags for `zones`, `municipality`, `document`, etc., which `LoadingAssistantMessage` inspects before allowing Step 2 or Step 3.
- **Loading Script**: `components/LoadingAssistantMessage.tsx` (lines 25-214) reads both `enrichment.progress` and artifact render booleans to orchestrate the 2s / 1s delays between stages and never advances until the preceding artifact `onRenderComplete` fires.
- **Final Reveal**: `components/AnalysisFoundMessage.tsx` (lines 19-175) animates the concluding copy and kicks off inline artifact hydration once the loading script reports completion.

#### 4.1 Enrichment Hook Initialization

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Line 45**: `useEnrichment` hook called
  - Monitors conversation enrichment status
  - Triggers enrichment if status is 'pending' or 'in_progress'

**File**: `app/(app)/chat/[conversation_id]/useEnrichment.ts`

- **Lines 42-212**: `useEnrichment` hook
  - **Lines 52-69**: `needsEnrichment` function checks if enrichment needed
  - **Lines 120-128**: `useEffect` triggers enrichment when needed
  - **Lines 73-112**: `createLoaders` wraps enrichment worker
  - **Lines 115-117**: Uses `useProgressiveLoading` to track progress

#### 4.2 Enrichment Worker Execution

**File**: `lib/workers/conversationEnrichment.ts`

- **Lines 43-579**: `enrichConversation` function

**Step 4.2.1: Load Conversation Context**

- **Lines 78-86**: Loads conversation from database
- **Lines 88-92**: Updates enrichment_status to 'in_progress'
- **Lines 94-103**: Extracts context metadata (INSEE code, coordinates, address)

**Step 4.2.2: Create Project and Research History**

- **Lines 108-134**: Creates project if `project_id` is null
- **Lines 136-164**: Creates research_history record if doesn't exist

**Step 4.2.3: Independent Operations (Parallel)**

- **Lines 171-207**: Independent operations that run in parallel
  - **Lines 172-188**: `zones` operation
    - Calls `fetchZoneUrba` API (line 176)
    - Returns zone features with geometry
  - **Lines 190-206**: `municipality` operation
    - Calls `fetchMunicipality` API (line 194)
    - Returns municipality data with RNU flag

**Step 4.2.4: Zone-Urba API Call**

**File**: `lib/carto-api.ts`

- **Lines 142-181**: `fetchZoneUrba` function
  - Calls IGN Carto API: `https://apicarto.ign.fr/api/gpu/zone-urba`
  - Uses coordinates or INSEE code
  - Returns GeoJSON features with zone geometry

**Step 4.2.5: Municipality API Call**

**File**: `lib/carto-api.ts`

- **Lines 223-303**: `fetchMunicipality` function
  - Overloaded to support both string and object parameters (lines 223-228)
  - Calls IGN Carto API: `https://apicarto.ign.fr/api/gpu/municipality`
  - Uses INSEE code (lines 248-271) or coordinates (lines 272-298)
  - Returns municipality data with RNU flag and properties

**Step 4.2.6: Dependent Operations (Parallel)**

- **Lines 229-464**: Dependent operations that need results from independent ops
  - **Lines 230-248**: `city` operation
    - Calls `getOrCreateCity` (line 239)
    - Creates/retrieves city record
  - **Lines 250-275**: `zoning` operation
    - Waits for cityId (lines 255-259)
    - Calls `getOrCreateZoning` (line 266)
    - Creates zoning based on typezone or RNU
  - **Lines 277-330**: `zone` operation
    - Waits for zoningId (lines 283-288)
    - Calls `getOrCreateZone` (line 319)
    - Creates zone with geometry from API
  - **Lines 332-426**: `document` operation (Steps 4-5 from `new_chat_process.md`)
    - Waits for zoneId/zoningId (lines 335-344) and skips entirely if neither exists to avoid noisy Supabase scans.
    - Queries `documents` (lines 396-405) with the precise `zone_id` / `zoning_id` filters and limits to one row so we only ever hydrate a single artifact.
    - When `html_content` or `content_json` exists (lines 411-424) it sets `result.documentData`, updates `branchType` to `non_rnu_analysis`, and streams partial progress so the document tab can appear immediately.
    - If nothing is found and the branch is non-RNU (lines 436-475) it calls `fetchDocument` just once to seed a placeholder record, marks `branchType` as `non_rnu_source`, and still surfaces a `documentId` for UI Step 2.
    - Falls back to `rnu`/`non_rnu_source` when no analysis exists so the downstream UI knows whether Step 3 (analysis copy) should play.
  - **Lines 428-463**: `map` operation
    - Extracts zone geometry from API response (lines 432-435)
    - Falls back to database if needed (lines 439-451)

**Step 4.2.7: Database Updates**

- **Lines 476-508**: Updates database with enriched data
  - **Lines 480-489**: Updates research_history with city_id, zone_id
  - **Lines 492-508**: Updates conversation context_metadata and enrichment_status
- **Lines 9-44**: `ensureDocumentLinks` helper upserts into `v2_conversation_documents` and `v2_project_documents`, guaranteeing that any `documentId` emitted in Steps 4‑6 is linked in Supabase (matches tables observed in project `ofeyssipibktmbfebibo`).

**Step 4.2.8: Geo Enrichment Helpers**

**File**: `lib/geo-enrichment.ts`

- **Lines 107-214**: `getOrCreateCity` function
  - Looks up city by INSEE code first (lines 112-121)
  - Falls back to name lookup if not found (lines 127-159)
  - Updates missing INSEE codes or names (lines 136-157)
  - Creates new city if not found (lines 170-213)
  - Handles duplicate key errors from race conditions (lines 181-206)

- **Lines 242-333**: `getOrCreateZoning` function
  - Maps typezone to zoning name using `mapTypezoneToZoningName` (line 256)
  - Looks up zoning by code and city_id (lines 267-280)
  - Updates missing code if found (lines 286-298)
  - Creates new zoning if not found (lines 315-332)

- **Lines 338-405**: `getOrCreateZone` function
  - Looks up zone by code within zoning (lines 348-353)
  - Updates geometry if provided and missing (lines 359-371)
  - Creates new zone with geometry if not found (lines 386-404)

---

## 5. Map Display and Zone Visualization

### User Experience

- Right panel auto-opens when coordinates are received
- Map tab shows address marker initially
- Zone polygon appears when geometry is available
- Loading message updates: "Vérification de la zone concernée..."

### Technical Implementation

#### 5.1 Panel Auto-Open

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 445-468**: `useEffect` hook for auto-opening panel
  - Checks for coordinates in context_metadata
  - Checks for address message
  - Checks if enrichment is in progress
  - Opens panel and sets active tab to 'map' (lines 465-466)

#### 5.2 Map Artifact Initialization

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 98-149**: `useEffect` hook syncing map artifact
  - **Lines 106-115**: Creates MapArtifactData with coordinates
  - **Lines 118-123**: Initializes map artifact if doesn't exist
  - **Lines 125-147**: Updates map artifact when geometry arrives
  - **Lines 470-476**: `handleMapRenderComplete` toggles the artifact rendering status so Step 1 can advance only after the Leaflet marker + base tile layer finish mounting.

#### 5.3 Map Artifact Store

**File**: `lib/hooks/useArtifactSync.ts`

- **Lines 81-179**: `useArtifactSync` hook
  - **Lines 92-96**: Initializes conversation state on mount
  - **Lines 99-109**: Subscribes to conversation artifact state
  - **Lines 112-117**: Provides updateArtifact method

**File**: `lib/stores/artifactStore.ts`

- **Lines 1-214**: Artifact store implementation
  - Zustand store for artifact state management
  - **Lines 70-93**: `initializeConversation` method
  - **Lines 96-167**: `updateArtifact` method with deep equality checks
  - **Lines 169-200**: `setActiveTab` method
  - **Lines 202-209**: `resetConversation` method
  - **Lines 211-213**: `getConversationState` method
  - Manages artifact state per conversation
  - Tracks status: 'loading', 'ready', 'error'
  - Tracks renderingStatus: 'pending', 'complete'

#### 5.4 Map Rendering

**File**: `components/ChatRightPanel.tsx`

- **Lines 26-200**: `ChatRightPanel` component
  - **Lines 34-52**: Extracts map artifact state and data
  - **Lines 74-78**: Determines map tab status
  - Renders MapCard component

**File**: `components/chat/artifacts/MapCard.tsx`

- **Lines 24-121**: `MapCard` component
  - **Lines 95-120**: Ready state renders MapArtifact
  - Passes geometry, center coordinates, loading state

**File**: `components/MapArtifact.tsx`

- **Lines 57-261**: `MapArtifact` component
  - Uses Leaflet for map rendering
  - Displays address marker
  - Overlays zone polygon when geometry available
  - Calls `onRenderComplete` when map is rendered
  - Waits for `mapCreated && markerRendered` before flipping `shouldRenderPolygon`, adds a pseudo-random 1‑2 s delay so the panel visibly transitions from Step 1 (marker) to Step 3 (polygon), and re-computes bounds via `buildBoundsFromPolygons` for a smooth fit.

#### 5.5 Loading Message Display

**File**: `components/LoadingAssistantMessage.tsx`

- **Lines 25-214**: `LoadingAssistantMessage` component
  - **Lines 52-83**: Step 1 logic
    - Shows "Vérification de la zone concernée..."
    - Waits for map to be rendered
    - 2 second delay after map marker rendered
  - **Lines 85-118**: Step 2 logic
    - Shows "Récupération des documents sources..."
    - Waits for document ID
    - 1 second delay after document skeleton shown
  - **Lines 120-141**: Step 3 logic
    - Shows "Récupération de l'analyse correspondante..."
    - Waits for document to be rendered
    - 1 second delay before fade out
  - Reads `enrichment.progress.zones`, `.municipality`, and `.document` plus the artifact render flags to guard each transition; if Step 3 copy is not available for the branch (RNU), it reuses Step 2 messaging per `getBranchLoadingMessages`.

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 1052-1065**: Renders LoadingAssistantMessage
  - Only shows when enrichment is in progress
  - Checks if address message exists
  - Checks if final analysis message not shown

#### 5.6 Map Geometry Utilities & Camera Fit

- **File**: `lib/utils/mapGeometry.ts` (lines 1-91) normalizes both `Polygon` and `MultiPolygon` payloads into Leaflet rings via `geometryToLeafletPolygons` and exposes `buildBoundsFromPolygons` so Step 3 can zoom out to the full zone envelope.
- **File**: `components/MapArtifact.tsx` (lines 115-158, 193-241) consumes those helpers and only calls `onRenderComplete` once the polygon’s `add` event fires, which feeds back into `useArtifactSync` so `MapCard` status flips to `'ready'`.

---

## 6. Document Retrieval and Analysis

### User Experience

- Panel switches to document tab when document ID is found
- Document skeleton shows while content loads
- Loading message: "Récupération des documents sources..."
- Then: "Récupération de l'analyse correspondante..."

### Technical Implementation

#### 6.1 Document Query in Enrichment

**File**: `lib/workers/conversationEnrichment.ts`

- **Lines 332-426**: `document` operation
  - **Lines 396-405**: Queries the Supabase `documents` table with both `zone_id` and `zoning_id` filters (limit 1) to honor Step 4’s “DB first” rule.
  - **Lines 411-433**: When an analysis already exists, sets `result.documentData`, bumps `branchType` to `non_rnu_analysis`, and emits progress so the document tab can render immediately.
  - **Lines 436-475**: If no analysis exists and the municipality is not RNU, calls `fetchDocument` once to seed a placeholder record (`non_rnu_source` branch) but still returns a valid `documentId` for Step 2.
  - **Lines 479-555**: Ensures `branchType` falls back to either `'rnu'` or `'non_rnu_source'` so downstream UI knows whether to show Step 3 copy and includes document metadata in the Supabase updates.
- **Lines 9-44**: `ensureDocumentLinks` is invoked after success to upsert `v2_conversation_documents` / `v2_project_documents`, keeping the Supabase tables in sync with the artifacts that power Steps 5‑7.

**File**: `lib/carto-api.ts`

- **Lines 212-217**: `fetchDocument` function
  - Wrapper for `fetchDocuments` function
  - Calls IGN Carto document API only when Supabase has no analysis for the requested zoning (Step 4 fallback)
  - Returns document metadata and URLs so a placeholder row can be inserted

- **Lines 186-207**: `fetchDocuments` function
  - Calls IGN Carto API: `https://apicarto.ign.fr/api/gpu/document`
  - Uses INSEE code parameter
  - Returns array of document features

#### 6.2 Document Artifact Initialization

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 152-208**: `useEffect` hook syncing document artifact
  - **Lines 153-165**: Creates DocumentArtifactData when documentId found
  - **Lines 170-182**: Initializes the artifact via `updateArtifactState` and immediately calls `setArtifactTab('document')` (Step 5) so the right panel animates to the document.
  - **Lines 184-205**: Updates document artifact when HTML content arrives, which triggers Step 3 once `handleDocumentRenderComplete` (lines 478-484) flips the rendering status to `'complete'`.

#### 6.3 Document Rendering

**File**: `components/ChatRightPanel.tsx`

- **Lines 54-71**: Extracts document artifact state and data
- **Lines 80-84**: Determines document tab status
- Renders DocumentCard component
- Uses `artifactSync.activeTab` to stay consistent with inline-card clicks and automatically opens the correct tab when Step 5 fires.

**File**: `components/chat/artifacts/DocumentCard.tsx`

- **Lines 23-121**: `DocumentCard` component
  - **Lines 31-92**: Loading/skeleton state
  - **Lines 95-107**: Ready state renders DocumentViewer
  - Passes htmlContent to viewer
- Calls `onRenderComplete` once the sanitized HTML is flushed to the DOM so Step 3 can fade the loading banner.

**File**: `components/DocumentViewer.tsx`

- **Lines 1-119**: DocumentViewer component
  - **Lines 11-58**: Main component with HTML content rendering
  - **Lines 16-28**: Calls `onRenderComplete` when HTML content is available
  - **Lines 31-58**: Renders sanitized HTML content with proper styling
  - **Lines 64-116**: `sanitizeAndEnhanceHtml` function
    - Parses HTML and applies Tailwind classes
    - Enhances typography and document structure
    - Adds visual separation to sections
  - Serves as the authoritative trigger for Step 3 → final state transition because `LoadingAssistantMessage` waits for `isDocumentRendered === true`.

---

## 7. Final Analysis Message Display

### User Experience

- Loading message fades out
- Final analysis message appears: "Voici l'analyse concernant la zone [zoneName]:"
- Inline artifact cards appear below message
- Map and document cards show previews

### Technical Implementation

#### 7.1 Transition Logic

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 219-256**: `useEffect` hook for transition
  - Checks if document content exists
  - Checks if document is rendered
  - Checks if enrichment is complete
  - Triggers fade out of loading message (line 242)
  - Shows final analysis message after fade (line 246)

#### 7.2 Analysis Message Creation

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 258-443**: `useEffect` hook saving analysis message
  - **Lines 266-286**: Validates conditions before saving
  - **Lines 288-297**: Checks if message already exists
  - **Lines 299-317**: Double-checks database for duplicates
  - **Lines 322-371**: Creates artifact references
    - Map artifact with geometry metadata (lines 332-350)
    - Document artifact with documentId (lines 352-371)
  - **Lines 379-382**: Creates message text with zone name
  - **Lines 384-400**: Inserts message into database
  - **Lines 411-414**: Adds message to local state

#### 7.3 Analysis Message Component

**File**: `components/AnalysisFoundMessage.tsx`

- **Lines 19-175**: `AnalysisFoundMessage` component
  - **Lines 130-139**: Text generation with typewriter effect
  - **Lines 143-171**: Renders inline artifact cards after text completes
    - Map card (lines 146-156)
    - Document card (lines 158-169)

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 1067-1084**: Renders AnalysisFoundMessage
  - Only shows when `showFinalAnalysisMessage` is true
  - Passes enrichment data and zone name
  - Handles text generation complete callback

#### 7.4 Inline Artifact Cards

**File**: `components/InlineArtifactCard.tsx`

- **Lines 204-395**: Map and Document inline card components
  - Shows preview of artifact
  - "Voir la carte complète" / "Lire le document" buttons
  - Opens artifact in right panel when clicked

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 1013-1047**: Renders inline artifact cards for messages
  - Checks message metadata for artifact references
  - Gets artifact data from artifact store
  - Renders cards after text generation completes
  - Always instantiates both the map and document inline card variants for the final analysis message so Step 6 from `new_chat_process.md` is honored even if only one artifact was interacted with previously.

---

## 8. Artifact Rendering and Panel Management

### User Experience

- Artifacts sync between inline cards and right panel
- Clicking inline card opens full artifact in panel
- Panel tabs show loading/ready/error status
- Map and document render progressively

### Technical Implementation

#### 8.1 Artifact State Management

**File**: `lib/stores/artifactStore.ts`

- **Lines 1-214**: Artifact store implementation
  - Zustand store for artifact state
  - Per-conversation artifact tracking
  - Status: 'loading', 'ready', 'error'
  - RenderingStatus: 'pending', 'complete'
  - **Lines 7-13**: `ArtifactState` interface definition
  - **Lines 18-22**: `ConversationArtifacts` interface
  - **Lines 27-30**: `ConversationArtifactState` interface
  - **Lines 35-68**: `ArtifactStore` interface with all methods

#### 8.2 Artifact Sync Hook

**File**: `lib/hooks/useArtifactSync.ts`

- **Lines 81-179**: `useArtifactSync` hook
  - **Lines 112-117**: `updateArtifact` method
  - **Lines 120-125**: `setActiveTab` method
  - **Lines 128-136**: `openArtifactInPanel` method
  - **Lines 146-168**: `isArtifactRendered` method

#### 8.3 Rendering Completion Tracking

**File**: `app/(app)/chat/[conversation_id]/page.tsx`

- **Lines 470-484**: Render completion handlers
  - `handleMapRenderComplete` (lines 471-476)
  - `handleDocumentRenderComplete` (lines 478-484)
  - Updates artifact renderingStatus to 'complete'

#### 8.4 Right Panel Component

**File**: `components/ChatRightPanel.tsx`

- **Lines 26-200**: `ChatRightPanel` component
  - **Lines 99-200**: Renders panel UI
  - Tab switching (lines 140-180)
  - Map tab (lines 145-155)
  - Document tab (lines 157-175)
  - Close button (lines 177-180)

---

## Implementation Status Summary

### Fully Implemented

- ✅ Address search and autocomplete
- ✅ Lightweight conversation creation
- ✅ Background enrichment process
- ✅ Map display with zone polygon
- ✅ Document retrieval and display
- ✅ Loading message progression
- ✅ Final analysis message
- ✅ Inline artifact cards
- ✅ Right panel with tabs
- ✅ Artifact state synchronization

### Key Files Reference

**Address Input**:

- `app/(app)/page.tsx` (lines 35-129)
- `components/InitialAddressInput.tsx` (lines 22-84)
- `lib/address-api.ts` (lines 22-59)

**Conversation Creation**:

- `lib/supabase/queries.ts` (lines 13-54)
- `lib/supabase.ts` (lines 309-400) - Duplicate check functions

**Enrichment**:

- `app/(app)/chat/[conversation_id]/useEnrichment.ts` (lines 42-212)
- `lib/workers/conversationEnrichment.ts` (lines 43-579)
- `lib/carto-api.ts` (lines 142-303) - Zone, municipality, and document APIs
- `lib/geo-enrichment.ts` (lines 107-405) - City, zoning, and zone helpers

**Chat Page**:

- `app/(app)/chat/[conversation_id]/page.tsx` (lines 23-1142)

**Artifacts**:

- `lib/hooks/useArtifactSync.ts` (lines 81-179)
- `lib/stores/artifactStore.ts` (lines 1-214)
- `components/ChatRightPanel.tsx` (lines 26-200)
- `components/chat/artifacts/MapCard.tsx` (lines 24-121)
- `components/chat/artifacts/DocumentCard.tsx` (lines 23-121)
- `components/InlineArtifactCard.tsx` (lines 204-395)
- `components/MapArtifact.tsx` (lines 57-261)
- `components/DocumentViewer.tsx` (lines 1-119)

**Loading States**:

- `components/LoadingAssistantMessage.tsx` (lines 25-214)
- `components/AnalysisFoundMessage.tsx` (lines 19-175)

---

## Notes

- All file paths are relative to the workspace root
- Line numbers are approximate and may shift with code changes
- The system uses progressive loading to show updates as data arrives
- Artifact state is synchronized between inline cards and right panel
- Enrichment runs in background without blocking UI
- All API calls use IGN Carto APIs (zone-urba, municipality, document)
- Database operations use Supabase client with proper error handling
- Artifact rendering status is tracked separately from data status for progressive display

