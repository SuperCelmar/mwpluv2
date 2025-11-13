'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserProfile } from '@/lib/supabase/queries-profile';
import {
  getCachedAvatarUrl,
  setCachedAvatarUrl,
} from '@/lib/utils/profile-avatar';

/**
 * Hook to get and cache user avatar URL
 * Returns avatar_url from profile if available
 * Caches the result in localStorage to avoid repeated database calls
 */
export function useAvatar(userId: string | null): {
  avatarUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAvatarUrl = useCallback(async () => {
    if (!userId) {
      setAvatarUrl(null);
      setLoading(false);
      return;
    }

    // Try to get from cache first
    const cached = getCachedAvatarUrl(userId);
    if (cached !== null) {
      setAvatarUrl(cached);
      setLoading(false);
      return;
    }

    // Fetch from database
    try {
      const { profile, error } = await getUserProfile(userId);

      if (error) {
        console.error('Error fetching profile for avatar URL:', error);
        setAvatarUrl(null);
        setLoading(false);
        return;
      }

      if (profile) {
        const url = profile.avatar_url;
        setAvatarUrl(url);
        // Cache the result
        setCachedAvatarUrl(userId, url);
      } else {
        setAvatarUrl(null);
      }
    } catch (error) {
      console.error('Error fetching avatar URL:', error);
      setAvatarUrl(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAvatarUrl();
  }, [fetchAvatarUrl]);

  return {
    avatarUrl,
    loading,
    refresh: fetchAvatarUrl,
  };
}



