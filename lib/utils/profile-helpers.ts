import { Profile } from '@/lib/supabase';

/**
 * Calculate estimated hours saved based on projects and documents analyzed
 * Rough estimation: ~2 hours per project, ~0.5 hours per document
 */
export function calculateHoursSaved(
  projectsCount: number,
  documentsCount: number
): number {
  const hoursPerProject = 2;
  const hoursPerDocument = 0.5;
  const totalHours = projectsCount * hoursPerProject + documentsCount * hoursPerDocument;
  return Math.round(totalHours);
}

/**
 * Format last login timestamp for display
 */
export function formatLastLogin(lastLoginAt: string | null): string {
  if (!lastLoginAt) {
    return 'Jamais';
  }

  const now = new Date();
  const lastLogin = new Date(lastLoginAt);
  const diffMs = now.getTime() - lastLogin.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'À l\'instant';
  } else if (diffMins < 60) {
    return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  } else if (diffHours < 24) {
    return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  } else if (diffDays === 1) {
    return 'Hier';
  } else if (diffDays < 7) {
    return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  } else {
    return lastLogin.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

/**
 * Determine account status from profile
 */
export function getAccountStatus(profile: Profile | null): 'active' | 'suspended' | 'paused' {
  if (!profile) {
    return 'active';
  }

  // Check if deletion is requested
  if (profile.deletion_requested_at) {
    return 'paused';
  }

  // For now, all accounts are active unless deletion is requested
  // Future: add suspended status based on admin flag or other criteria
  return 'active';
}

/**
 * Format account status for display
 */
export function formatAccountStatus(status: 'active' | 'suspended' | 'paused'): string {
  const statusMap = {
    active: 'Actif',
    suspended: 'Suspendu',
    paused: 'En pause',
  };
  return statusMap[status];
}

/**
 * Get status badge color
 */
export function getStatusBadgeColor(status: 'active' | 'suspended' | 'paused'): string {
  const colorMap = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  };
  return colorMap[status];
}

