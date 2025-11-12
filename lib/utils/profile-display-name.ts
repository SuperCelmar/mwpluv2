/**
 * Utility functions for managing cached user display name
 * Caches the display name in localStorage to avoid repeated database calls
 */

const DISPLAY_NAME_CACHE_KEY = 'user_display_name';
const DISPLAY_NAME_CACHE_TIMESTAMP_KEY = 'user_display_name_timestamp';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedDisplayName {
  displayName: string;
  userId: string;
  timestamp: number;
}

/**
 * Get cached display name from localStorage
 */
export function getCachedDisplayName(userId: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(DISPLAY_NAME_CACHE_KEY);
    const timestamp = localStorage.getItem(DISPLAY_NAME_CACHE_TIMESTAMP_KEY);

    if (!cached || !timestamp) return null;

    const cachedData: CachedDisplayName = JSON.parse(cached);
    const cacheTimestamp = parseInt(timestamp, 10);

    // Check if cache is for the same user and still valid
    if (
      cachedData.userId === userId &&
      Date.now() - cacheTimestamp < CACHE_DURATION_MS
    ) {
      return cachedData.displayName;
    }

    // Cache expired or for different user, clear it
    clearCachedDisplayName();
    return null;
  } catch (error) {
    console.error('Error reading cached display name:', error);
    clearCachedDisplayName();
    return null;
  }
}

/**
 * Cache display name in localStorage
 */
export function setCachedDisplayName(userId: string, displayName: string): void {
  if (typeof window === 'undefined') return;

  try {
    const cachedData: CachedDisplayName = {
      displayName,
      userId,
      timestamp: Date.now(),
    };

    localStorage.setItem(DISPLAY_NAME_CACHE_KEY, JSON.stringify(cachedData));
    localStorage.setItem(DISPLAY_NAME_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error caching display name:', error);
  }
}

/**
 * Clear cached display name from localStorage
 */
export function clearCachedDisplayName(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(DISPLAY_NAME_CACHE_KEY);
    localStorage.removeItem(DISPLAY_NAME_CACHE_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Error clearing cached display name:', error);
  }
}

/**
 * Get display name from profile (pseudo if exists, otherwise full_name)
 */
export function getDisplayNameFromProfile(profile: {
  pseudo: string | null;
  full_name: string | null;
}): string {
  if (profile.pseudo && profile.pseudo.trim()) {
    return profile.pseudo.trim();
  }
  if (profile.full_name && profile.full_name.trim()) {
    return profile.full_name.trim();
  }
  return '';
}

