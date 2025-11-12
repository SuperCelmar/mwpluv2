/**
 * Utility functions for managing cached user profile
 * Caches the full profile in localStorage to avoid repeated database calls
 */

const PROFILE_CACHE_KEY = 'user_profile';
const PROFILE_CACHE_TIMESTAMP_KEY = 'user_profile_timestamp';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedProfile {
  profile: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    phone: string | null;
    pseudo: string | null;
    avatar_url: string | null;
    is_admin: boolean;
    deletion_requested_at: string | null;
    deletion_scheduled_for: string | null;
    deletion_reason: string | null;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
  };
  userId: string;
  timestamp: number;
}

/**
 * Get cached profile from localStorage
 */
export function getCachedProfile(userId: string): CachedProfile['profile'] | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    const timestamp = localStorage.getItem(PROFILE_CACHE_TIMESTAMP_KEY);

    if (!cached || !timestamp) return null;

    const cachedData: CachedProfile = JSON.parse(cached);
    const cacheTimestamp = parseInt(timestamp, 10);

    // Check if cache is for the same user and still valid
    if (
      cachedData.userId === userId &&
      Date.now() - cacheTimestamp < CACHE_DURATION_MS
    ) {
      return cachedData.profile;
    }

    // Cache expired or for different user, clear it
    clearCachedProfile();
    return null;
  } catch (error) {
    console.error('Error reading cached profile:', error);
    clearCachedProfile();
    return null;
  }
}

/**
 * Cache profile in localStorage
 */
export function setCachedProfile(userId: string, profile: CachedProfile['profile']): void {
  if (typeof window === 'undefined') return;

  try {
    const cachedData: CachedProfile = {
      profile,
      userId,
      timestamp: Date.now(),
    };

    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cachedData));
    localStorage.setItem(PROFILE_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error caching profile:', error);
  }
}

/**
 * Clear cached profile from localStorage
 */
export function clearCachedProfile(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem(PROFILE_CACHE_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Error clearing cached profile:', error);
  }
}

