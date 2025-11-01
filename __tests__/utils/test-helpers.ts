import { render } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { vi } from 'vitest';

export const TEST_USER_ID = 'test-user-id';

export interface MockUser {
  id: string;
  email: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  aud: string;
  created_at: string;
}

export interface MockProject {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  municipality: string | null;
  gps_coordinates: any;
  insee_code: string | null;
  document_loaded: boolean;
  map_loaded: boolean;
  artifacts_ready: boolean;
  created_at: string;
  updated_at: string;
}

export interface MockMessage {
  id: string;
  project_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return {
    id: TEST_USER_ID,
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createMockProject(overrides?: Partial<MockProject>): MockProject {
  return {
    id: 'project-123',
    user_id: TEST_USER_ID,
    name: '15 Rue des Fustiers',
    address: '15 Rue des Fustiers, 75001 Paris',
    municipality: 'Paris',
    gps_coordinates: [2.3397, 48.8606],
    insee_code: '75056',
    document_loaded: false,
    map_loaded: false,
    artifacts_ready: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockMessage(overrides?: Partial<MockMessage>): MockMessage {
  return {
    id: 'message-123',
    project_id: 'project-123',
    role: 'user',
    content: 'Test message',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function mockRouter() {
  const mockPush = vi.fn();
  const mockReplace = vi.fn();
  const mockRefresh = vi.fn();
  const mockBack = vi.fn();
  const mockForward = vi.fn();
  const mockPrefetch = vi.fn();

  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
    back: mockBack,
    forward: mockForward,
    prefetch: mockPrefetch,
  } as any);

  return {
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
    back: mockBack,
    forward: mockForward,
    prefetch: mockPrefetch,
  };
}

export function mockParams(params: Record<string, string>) {
  const useParamsMock = vi.fn();
  useParamsMock.mockReturnValue(params);
  require('next/navigation').useParams = useParamsMock;
}

export async function waitForLoadingToFinish() {
  const { queryByText, waitFor } = await import('@testing-library/react');
  await waitFor(() => {
    expect(queryByText(/Chargement/)).not.toBeInTheDocument();
  });
}

// Render helper with router context
export function renderWithProviders(ui: React.ReactElement, options?: any) {
  return render(ui, options);
}

