/**
 * Utility functions for managing cached user avatar URL
 * Caches the avatar URL in localStorage to avoid repeated database calls
 */

const AVATAR_URL_CACHE_KEY = 'user_avatar_url';
const AVATAR_URL_CACHE_TIMESTAMP_KEY = 'user_avatar_url_timestamp';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedAvatarUrl {
  avatarUrl: string | null;
  userId: string;
  timestamp: number;
}

/**
 * Get cached avatar URL from localStorage
 */
export function getCachedAvatarUrl(userId: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(AVATAR_URL_CACHE_KEY);
    const timestamp = localStorage.getItem(AVATAR_URL_CACHE_TIMESTAMP_KEY);

    if (!cached || !timestamp) return null;

    const cachedData: CachedAvatarUrl = JSON.parse(cached);
    const cacheTimestamp = parseInt(timestamp, 10);

    // Check if cache is for the same user and still valid
    if (
      cachedData.userId === userId &&
      Date.now() - cacheTimestamp < CACHE_DURATION_MS
    ) {
      return cachedData.avatarUrl;
    }

    // Cache expired or for different user, clear it
    clearCachedAvatarUrl();
    return null;
  } catch (error) {
    console.error('Error reading cached avatar URL:', error);
    clearCachedAvatarUrl();
    return null;
  }
}

/**
 * Cache avatar URL in localStorage
 */
export function setCachedAvatarUrl(userId: string, avatarUrl: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    const cachedData: CachedAvatarUrl = {
      avatarUrl,
      userId,
      timestamp: Date.now(),
    };

    localStorage.setItem(AVATAR_URL_CACHE_KEY, JSON.stringify(cachedData));
    localStorage.setItem(AVATAR_URL_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error caching avatar URL:', error);
  }
}

/**
 * Clear cached avatar URL from localStorage
 */
export function clearCachedAvatarUrl(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(AVATAR_URL_CACHE_KEY);
    localStorage.removeItem(AVATAR_URL_CACHE_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Error clearing cached avatar URL:', error);
  }
}





