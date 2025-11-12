import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SettingsPage from '@/app/(app)/settings/page';
import { mockRouter } from '@/__tests__/utils/test-helpers';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/queries-profile', () => ({
  getUserProfile: vi.fn(async () => ({ profile: null, error: null })),
  getLoginHistory: vi.fn(async () => ({ history: [], error: null })),
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    mockRouter();
  });

  it('does not render the active sessions section', async () => {
    render(<SettingsPage />);

    await screen.findByText('Changer le mot de passe');

    expect(screen.queryByText(/Sessions actives/i)).not.toBeInTheDocument();
  });
});

