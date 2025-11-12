# Right Panel Integration with Progressive Loading States

## Overview

When coordinates are received during Step 1, a right panel slides in showing a map with the address marker. As enrichment progresses, the map updates with zone polygons, then switches to document tab when analysis is found. The loading messages progress through three stages with corresponding panel updates.

## Implementation Steps

### 1. Right Panel Integration in Chat Page

- **File**: `app/(app)/chat/[conversation_id]/page.tsx`
- Import `ChatRightPanel` and `useArtifactSync` hook
- Add state for panel open/close (`isPanelOpen`)
- Create two-column layout: chat messages (left), right panel (slides in)
- Panel should auto-open when Step 1 begins (coordinates received)

### 2. Step 1: Map Display with Address Marker

- **Trigger**: When coordinates are received (enrichment starts, `zones` or `municipality` operations begin)
- **Action**: 
- Auto-open right panel with slide-in animation
- Set active tab to 'map'
- Initialize map artifact with address coordinates (lon, lat)
- Display Leaflet map showing ONLY address marker (no polygon yet)
- Update LoadingAssistantMessage to show Step 1: "Vérification de la zone concernée..."

### 3. Step 1: Update Map with Zone Polygon

- **Trigger**: When zone-urba API response arrives (`enrichment.data.mapGeometry` available)
- **Action**:
- Update map artifact state with zone geometry (multi-polygon)
- MapCard component renders polygon overlay on existing map
- Map now displays: address marker + zone polygon overlay

### 4. Step 2: Document Query Logic

- **Trigger**: When we have zone, zoning name, and city data available
- **File**: `lib/workers/conversationEnrichment.ts` (document operation, lines 332-426)
- **Action**:
- Check if `zoneId`, `zoningId`, and `cityId` are available
- Query `documents` table for analysis matching:
- `zone_id` = zoneId OR `zoning_id` = zoningId
- AND `city_id` = cityId (if available in documents table)
- If analysis found: Set `documentData.hasAnalysis = true` and load document content
- If not found: Skip document loading (comment out Carto document API call for now)
- Update LoadingAssistantMessage to show Step 2: "Récupération des documents sources..."

### 5. Step 3: Switch to Document Tab

- **Trigger**: When analysis is found in database (Step 2 success, `documentData.documentId` exists)
- **Action**:
- Update LoadingAssistantMessage to show Step 3: "Récupération de l'analyse correspondante..."
- Switch right panel active tab from 'map' to 'document' programmatically
- Load analysis document content from database
- Display document in DocumentCard component
- Right panel remains open showing document tab

### 6. Final State: Analysis Message with Inline Cards

- **Trigger**: When Step 3 completes and analysis is displayed
- **Action**:
- Replace LoadingAssistantMessage with AnalysisFoundMessage
- Message: "Voici l'analyse concernant la zone [zone name]:"
- Show inline artifact cards for BOTH map and document (not just document)
- Right panel remains open on document tab

### 7. Loading Stage Detection Updates

- **File**: `components/LoadingAssistantMessage.tsx`
- Update stage detection logic:
- Step 1: When `progress.zones === 'loading'` OR `progress.municipality === 'loading'` (coordinates received, API calls started)
- Step 2: When `progress.document === 'loading'` AND we have zone/zoning/city data
- Step 3: When `progress.document === 'success'` AND `documentData.documentId` exists
- Fallback: Generic loading message

### 8. Map Artifact State Management

- **File**: `lib/hooks/useArtifactSync.ts` or enrichment integration
- Update map artifact when:
- Coordinates received → Set map center, status 'loading', show address marker
- Zone geometry received → Update with polygon, status 'ready'
- Ensure map artifact syncs with enrichment progress in real-time

### 9. Document Artifact State Management

- **File**: `lib/workers/conversationEnrichment.ts`
- Modify document operation (lines 332-426):
- Query documents table FIRST (before Carto API)
- Match on zone_id/zoning_id + city_id
- If found: Load document content, set `documentData.hasAnalysis = true`
- If not found: Skip (comment out Carto document API call)
- Update document artifact state when analysis is found

### 10. Panel Auto-Open Logic

- **File**: `app/(app)/chat/[conversation_id]/page.tsx`
- Add useEffect to auto-open panel when:
- Conversation has address message
- Enrichment status is 'pending' or 'in_progress'
- Coordinates are available (enrichment started)
- Panel should open smoothly with slide-in animation
- Panel should remain open throughout loading process

## Key Files to Modify

1. `app/(app)/chat/[conversation_id]/page.tsx` - Add right panel, two-column layout, auto-open logic
2. `components/LoadingAssistantMessage.tsx` - Update stage detection for Step 2/3
3. `lib/workers/conversationEnrichment.ts` - Modify document operation to query database first
4. `lib/hooks/useArtifactSync.ts` - Ensure artifact sync updates map/document as data arrives
5. `components/AnalysisFoundMessage.tsx` - Show inline cards for both map and document
6. `components/ChatRightPanel.tsx` - Ensure smooth tab switching works

## Technical Considerations

- **CRITICAL: Sequential Step Progression** - Each step must wait for artifact rendering to complete before progressing:
- Step 1: Wait for map to fully render with address marker before showing Step 1 message
- Step 1 → Step 2: Wait for map to fully render with zone polygon overlay before moving to Step 2
- Step 2 → Step 3: Wait for document query to complete AND document artifact to be ready before moving to Step 3
- Step 3 → Final: Wait for document to fully load and render in DocumentCard before showing final message
- Right panel slides in when Step 1 begins (coordinates received, not when conversation loads)
- Map shows address marker FIRST, then updates with polygon when zone data arrives
- Document query checks zone-zoning-city combination in database
- Tab switching from map to document happens automatically in Step 3 (after document is ready)
- Inline artifact cards appear for BOTH map and document in final state
- Panel remains open throughout entire loading process
- Handle edge cases: no zone polygon (show only marker), no analysis found (skip Step 3)
- Smooth animations for panel slide-in and tab switching
- Use artifact status ('loading', 'ready', 'error') to determine when rendering is complete
- Add delays or status checks to ensure visual rendering completes before step progression