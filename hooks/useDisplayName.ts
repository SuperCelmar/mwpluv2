'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserProfile } from '@/lib/supabase/queries-profile';
import {
  getCachedDisplayName,
  setCachedDisplayName,
  getDisplayNameFromProfile,
} from '@/lib/utils/profile-display-name';

/**
 * Hook to get and cache user display name
 * Returns pseudo if available, otherwise full_name
 * Caches the result in localStorage to avoid repeated database calls
 */
export function useDisplayName(userId: string | null): {
  displayName: string;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [displayName, setDisplayName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchDisplayName = useCallback(async () => {
    if (!userId) {
      setDisplayName('');
      setLoading(false);
      return;
    }

    // Try to get from cache first
    const cached = getCachedDisplayName(userId);
    if (cached) {
      setDisplayName(cached);
      setLoading(false);
      return;
    }

    // Fetch from database
    try {
      const { profile, error } = await getUserProfile(userId);

      if (error) {
        console.error('Error fetching profile for display name:', error);
        setDisplayName('');
        setLoading(false);
        return;
      }

      if (profile) {
        const name = getDisplayNameFromProfile(profile);
        setDisplayName(name);
        // Cache the result
        if (name) {
          setCachedDisplayName(userId, name);
        }
      } else {
        setDisplayName('');
      }
    } catch (error) {
      console.error('Error fetching display name:', error);
      setDisplayName('');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDisplayName();
  }, [fetchDisplayName]);

  return {
    displayName,
    loading,
    refresh: fetchDisplayName,
  };
}

