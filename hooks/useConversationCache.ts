'use client';

import { useState, useEffect } from 'react';
import {
  getCachedConversationData,
  setCachedConversationData,
  type ConversationCacheData,
} from '@/lib/utils/conversationCache';

/**
 * Return type for useConversationCache hook
 */
export interface UseConversationCacheReturn {
  /** Cached enrichment data, or null if not available/expired */
  cachedData: ConversationCacheData | null;
  /** Loading state - true while fetching cache */
  isLoading: boolean;
  /** Function to update the cache with new data */
  refreshCache: (data: Omit<ConversationCacheData, 'cached_at'> & { cached_at?: string }) => Promise<void>;
}

/**
 * React hook for managing conversation enrichment cache
 * 
 * Automatically loads cache on mount and provides method to update it.
 * 
 * @param conversationId - UUID of the conversation
 * @returns Object with cachedData, isLoading, and refreshCache function
 * 
 * @example
 * ```typescript
 * function MyComponent({ conversationId }: { conversationId: string }) {
 *   const { cachedData, isLoading, refreshCache } = useConversationCache(conversationId);
 * 
 *   if (isLoading) return <div>Loading cache...</div>;
 *   if (cachedData) {
 *     return <div>Zone: {cachedData.zone_name}</div>;
 *   }
 * 
 *   const handleUpdate = async () => {
 *     await refreshCache({
 *       zone_geometry: geoJson,
 *       zone_name: 'Zone U',
 *       city_name: 'Paris',
 *       insee_code: '75056',
 *       has_analysis: true,
 *       cache_version: 1
 *     });
 *   };
 * 
 *   return <button onClick={handleUpdate}>Update Cache</button>;
 * }
 * ```
 */
export function useConversationCache(
  conversationId: string
): UseConversationCacheReturn {
  const [cachedData, setCachedData] = useState<ConversationCacheData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load cache on mount
  useEffect(() => {
    let mounted = true;

    async function loadCache() {
      if (!conversationId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const cache = await getCachedConversationData(conversationId);
        if (mounted) {
          setCachedData(cache);
        }
      } catch (error) {
        console.error('[useConversationCache] Error loading cache:', error);
        if (mounted) {
          setCachedData(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadCache();

    return () => {
      mounted = false;
    };
  }, [conversationId]);

  /**
   * Updates the cache with new data and refreshes local state
   */
  async function refreshCache(
    data: Omit<ConversationCacheData, 'cached_at'> & { cached_at?: string }
  ): Promise<void> {
    try {
      await setCachedConversationData(conversationId, data);
      // Reload cache to get the updated data with correct timestamp
      const updatedCache = await getCachedConversationData(conversationId);
      setCachedData(updatedCache);
    } catch (error) {
      console.error('[useConversationCache] Error refreshing cache:', error);
      throw error;
    }
  }

  return {
    cachedData,
    isLoading,
    refreshCache,
  };
}

