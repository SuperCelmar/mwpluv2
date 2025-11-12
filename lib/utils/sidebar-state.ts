/**
 * Utility to read sidebar state synchronously from localStorage
 * This is used to determine the initial sidebar state before React hydration
 */
export function getSidebarState(): boolean {
  if (typeof window === 'undefined') {
    return false; // Default to closed on server
  }
  
  try {
    const savedState = localStorage.getItem('sidebar-open');
    return savedState === 'true';
  } catch (error) {
    // If localStorage is not available or throws an error, default to closed
    return false;
  }
}

