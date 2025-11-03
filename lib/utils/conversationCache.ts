import { supabase } from '../supabase';

/**
 * Cache structure for enrichment data stored in v2_conversations.context_metadata
 */
export interface ConversationCacheData {
  cached_at: string; // ISO timestamp
  zone_geometry: any; // GeoJSON geometry
  zone_name: string;
  city_name: string;
  insee_code: string;
  has_analysis: boolean;
  document_summary?: string; // optional
  cache_version: 1;
}

/**
 * Full context metadata structure with enrichment cache nested
 */
interface ConversationCacheMetadata {
  enrichment_cache?: ConversationCacheData;
  [key: string]: any; // Preserve other metadata fields
}

/**
 * Cache TTL in milliseconds (7 days)
 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checks if a cache timestamp is still valid (within 7 days)
 * 
 * @param timestamp - ISO timestamp string to validate
 * @returns true if cache is valid (within TTL), false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = isCacheValid('2024-01-01T00:00:00.000Z');
 * ```
 */
export function isCacheValid(timestamp: string): boolean {
  try {
    const cacheDate = new Date(timestamp);
    const now = new Date();
    const age = now.getTime() - cacheDate.getTime();
    return age >= 0 && age < CACHE_TTL_MS;
  } catch (error) {
    console.error('[CONVERSATION_CACHE] Error validating cache timestamp:', error);
    return false;
  }
}

/**
 * Retrieves cached enrichment data for a conversation
 * 
 * @param conversationId - UUID of the conversation
 * @returns Promise resolving to cached data if valid, null if expired/missing
 * 
 * @example
 * ```typescript
 * const cache = await getCachedConversationData('conversation-uuid');
 * if (cache) {
 *   console.log('Zone:', cache.zone_name);
 * }
 * ```
 */
export async function getCachedConversationData(
  conversationId: string
): Promise<ConversationCacheData | null> {
  try {
    // Query conversation by ID
    const { data, error } = await supabase
      .from('v2_conversations')
      .select('context_metadata')
      .eq('id', conversationId)
      .single();

    if (error) {
      console.error('[CONVERSATION_CACHE] Error fetching conversation:', error);
      return null;
    }

    if (!data || !data.context_metadata) {
      console.log('[CONVERSATION_CACHE] No context_metadata found for conversation:', conversationId);
      return null;
    }

    const metadata = data.context_metadata as ConversationCacheMetadata;
    const cache = metadata.enrichment_cache;

    if (!cache) {
      console.log('[CONVERSATION_CACHE] No enrichment_cache found in metadata');
      return null;
    }

    // Validate cache version
    if (cache.cache_version !== 1) {
      console.warn('[CONVERSATION_CACHE] Invalid cache version:', cache.cache_version);
      return null;
    }

    // Check TTL
    if (!isCacheValid(cache.cached_at)) {
      console.log('[CONVERSATION_CACHE] Cache expired for conversation:', conversationId);
      return null;
    }

    return cache;
  } catch (error) {
    console.error('[CONVERSATION_CACHE] Unexpected error getting cached data:', error);
    return null;
  }
}

/**
 * Sets cached enrichment data for a conversation
 * Merges cache into existing context_metadata to preserve other fields
 * 
 * @param conversationId - UUID of the conversation
 * @param data - Cache data to store (cached_at will be set automatically)
 * @returns Promise that resolves when cache is saved
 * 
 * @example
 * ```typescript
 * await setCachedConversationData('conversation-uuid', {
 *   cached_at: new Date().toISOString(),
 *   zone_geometry: geoJsonData,
 *   zone_name: 'Zone U',
 *   city_name: 'Paris',
 *   insee_code: '75056',
 *   has_analysis: true,
 *   document_summary: 'Summary text',
 *   cache_version: 1
 * });
 * ```
 */
export async function setCachedConversationData(
  conversationId: string,
  data: Omit<ConversationCacheData, 'cached_at'> & { cached_at?: string }
): Promise<void> {
  try {
    // First, get existing context_metadata to merge
    const { data: existingData, error: fetchError } = await supabase
      .from('v2_conversations')
      .select('context_metadata')
      .eq('id', conversationId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" - we'll create new metadata in that case
      console.error('[CONVERSATION_CACHE] Error fetching existing metadata:', fetchError);
      throw fetchError;
    }

    // Merge cache into existing metadata
    const existingMetadata = (existingData?.context_metadata || {}) as ConversationCacheMetadata;
    const updatedMetadata: ConversationCacheMetadata = {
      ...existingMetadata,
      enrichment_cache: {
        ...data,
        cached_at: data.cached_at || new Date().toISOString(),
        cache_version: 1,
      },
    };

    // Update conversation with merged metadata
    const { error: updateError } = await supabase
      .from('v2_conversations')
      .update({ context_metadata: updatedMetadata })
      .eq('id', conversationId);

    if (updateError) {
      console.error('[CONVERSATION_CACHE] Error updating cache:', updateError);
      throw updateError;
    }

    console.log('[CONVERSATION_CACHE] Cache updated successfully for conversation:', conversationId);
  } catch (error) {
    console.error('[CONVERSATION_CACHE] Unexpected error setting cached data:', error);
    throw error;
  }
}

