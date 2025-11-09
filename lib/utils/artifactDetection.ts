/**
 * Artifact Detection Utility
 * 
 * Detects which artifacts should be displayed for assistant messages
 * based on message content analysis and available enrichment data.
 * 
 * This provides backward compatibility for existing messages without metadata,
 * and can be used as a fallback when metadata is missing.
 */

export interface ArtifactReference {
  type: 'zone' | 'map' | 'document';
  artifactId: string; // e.g., `zone-${zoneId}`, `map-${conversationId}`
  reason: 'first-message' | 'keyword-match' | 'regulation-context';
  timestamp?: string;
}

export interface EnrichmentData {
  cityId?: string;
  zoneId?: string;
  zoningId?: string;
  mapGeometry?: any;
  documentData?: {
    documentId: string;
    [key: string]: any;
  };
  conversationId?: string;
}

/**
 * Generate a consistent artifact ID for a given artifact type
 */
export function getArtifactId(
  type: 'zone' | 'map' | 'document',
  enrichmentData: EnrichmentData
): string {
  switch (type) {
    case 'zone':
      return `zone-${enrichmentData.zoneId || enrichmentData.zoningId || enrichmentData.cityId || 'unknown'}`;
    case 'map':
      return `map-${enrichmentData.zoneId || enrichmentData.conversationId || 'unknown'}`;
    case 'document':
      return `document-${enrichmentData.documentData?.documentId || 'unknown'}`;
    default:
      return `${type}-unknown`;
  }
}

/**
 * Check if an artifact type should be shown based on available data
 */
export function shouldShowArtifact(
  type: 'zone' | 'map' | 'document',
  enrichmentData: EnrichmentData
): boolean {
  switch (type) {
    case 'zone':
      return !!enrichmentData.cityId;
    case 'map':
      return !!enrichmentData.mapGeometry;
    case 'document':
      return !!enrichmentData.documentData;
    default:
      return false;
  }
}

/**
 * Detect which artifacts should be shown for an assistant message
 * 
 * Rules:
 * 1. First assistant message (index === 1): Always show zone artifact if cityId exists
 * 2. Map mentions: Show map if pattern matches and mapGeometry exists
 * 3. Document mentions: Show document if pattern matches and documentData exists
 * 4. Regulation context: Show BOTH map and document if regulation keywords match
 * 5. Otherwise: No artifacts (keep chat clean)
 * 
 * @param message - The assistant message content
 * @param enrichmentData - Available enrichment data
 * @param messageIndex - Index of the message in the conversation (0-based, user messages included)
 * @returns Array of artifact references to display
 */
export function detectArtifactsForMessage(
  message: string,
  enrichmentData: EnrichmentData,
  messageIndex: number
): ArtifactReference[] {
  const artifacts: ArtifactReference[] = [];
  const lowerMessage = message.toLowerCase();

  // Rule 1: First assistant message (index === 0 means first assistant message)
  // Show zone artifact if this is the first assistant message and we have city data
  if (messageIndex === 0 && shouldShowArtifact('zone', enrichmentData)) {
    artifacts.push({
      type: 'zone',
      artifactId: getArtifactId('zone', enrichmentData),
      reason: 'first-message',
      timestamp: new Date().toISOString(),
    });
  }

  // Rule 2: Map mentions
  // Pattern: carte, map, zonage, plan, géographique
  const mapPattern = /carte|map|zonage|plan|géographique/i;
  if (mapPattern.test(message) && shouldShowArtifact('map', enrichmentData)) {
    // Check if we already have a map artifact (from regulation context)
    if (!artifacts.some(a => a.type === 'map')) {
      artifacts.push({
        type: 'map',
        artifactId: getArtifactId('map', enrichmentData),
        reason: 'keyword-match',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Rule 3: Document mentions
  // Pattern: document, règlement, PLU, article, prescription
  const documentPattern = /document|règlement|règlement|PLU|article|prescription/i;
  if (documentPattern.test(message) && shouldShowArtifact('document', enrichmentData)) {
    // Check if we already have a document artifact (from regulation context)
    if (!artifacts.some(a => a.type === 'document')) {
      artifacts.push({
        type: 'document',
        artifactId: getArtifactId('document', enrichmentData),
        reason: 'keyword-match',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Rule 4: Regulation context (show both map and document)
  // Pattern: hauteur, recul, emprise, COS, CES, prospect
  const regulationPattern = /hauteur|recul|emprise|COS|CES|prospect/i;
  if (regulationPattern.test(message)) {
    // Add map if available and not already added
    if (shouldShowArtifact('map', enrichmentData) && !artifacts.some(a => a.type === 'map')) {
      artifacts.push({
        type: 'map',
        artifactId: getArtifactId('map', enrichmentData),
        reason: 'regulation-context',
        timestamp: new Date().toISOString(),
      });
    }

    // Add document if available and not already added
    if (shouldShowArtifact('document', enrichmentData) && !artifacts.some(a => a.type === 'document')) {
      artifacts.push({
        type: 'document',
        artifactId: getArtifactId('document', enrichmentData),
        reason: 'regulation-context',
        timestamp: new Date().toISOString(),
      });
    }
  }

  return artifacts;
}

