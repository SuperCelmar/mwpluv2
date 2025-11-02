import '@testing-library/jest-dom';
import { server } from './mocks/server';
import { resetMockData } from './mocks/handlers';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { TEST_USER_ID } from './utils/test-helpers';

/**
 * Test Setup Notes:
 * 
 * - Supabase: Mocked via MSW handlers (v1 and v2 tables)
 * - French Address API: Mocked via MSW
 * - N8N Webhook: Mocked via MSW
 * - Carto APIs: REAL network calls to apicarto.ign.fr
 *   - Tests making Carto API calls will be slower (network requests)
 *   - These tests require internet connection
 *   - Consider increasing test timeout for Carto API tests
 */

// IMPORTANT: Start MSW server FIRST, before any imports that might make network requests
// This ensures MSW can intercept all fetch calls
beforeAll(() => {
  // Start MSW server immediately - before any other initialization
  server.listen({ 
    onUnhandledRequest: (request) => {
      // Only warn about unhandled requests that look like API calls
      // NOTE: Carto API requests to apicarto.ign.fr are now REAL network calls
      // (not mocked) - so they won't trigger warnings
      if (request.url.includes('supabase') || 
          request.url.includes('rest/v1') || 
          request.url.includes('api-adresse') ||
          request.url.includes('n8n')) {
        console.warn('Unhandled MSW request:', request.method, request.url);
      }
    }
  });
});

// Mock Supabase auth.getUser() after MSW is started
// This must be done in a separate beforeAll to ensure MSW is ready
beforeAll(async () => {
  // Import supabase after MSW is started
  const { supabase } = await import('@/lib/supabase');
  
  vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
    data: {
      user: {
        id: TEST_USER_ID,
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2024-01-01T00:00:00.000Z',
      },
    },
    error: null,
  });
});

// Reset handlers after each test and clean up DOM
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockData();
});

// Close server after all tests
afterAll(() => {
  server.close();
  vi.restoreAllMocks();
});

