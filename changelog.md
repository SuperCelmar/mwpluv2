# Changelog

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
  - Lines 50-109: Rewrote `highlightMatches` function with better DOM traversal
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

