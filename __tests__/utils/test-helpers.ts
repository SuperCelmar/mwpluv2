import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { V2Project, V2Conversation, V2Message, V2ResearchHistory } from '@/lib/supabase';

export const TEST_USER_ID = 'test-user-id';

export interface MockUser {
  id: string;
  email: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  aud: string;
  created_at: string;
}

export interface MockConversation {
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
  Conversation_id: string;
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

export function createMockConversation(overrides?: Partial<MockConversation>): MockConversation {
  return {
    id: 'Conversation-123',
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
    Conversation_id: 'Conversation-123',
    role: 'user',
    content: 'Test message',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// V2 Mock Generators
export function createMockV2Project(overrides?: Partial<V2Project>): V2Project {
  return {
    id: 'project-123',
    user_id: TEST_USER_ID,
    name: null,  // "Sans nom"
    description: null,
    project_type: null,
    main_address: '15 Rue des Fustiers, 75001 Paris',
    main_city_id: null,
    main_zone_id: null,
    geo_lon: 2.3397,
    geo_lat: 48.8606,
    color: '#6B7280',
    icon: '📁',
    starred: false,
    position: null,
    status: 'draft',
    plu_alert_enabled: false,
    plu_last_check_at: null,
    plu_check_frequency: 'monthly',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    first_edited_at: null,
    metadata: null,
    ...overrides,
  };
}

export function createMockV2Conversation(overrides?: Partial<V2Conversation>): V2Conversation {
  return {
    id: 'conversation-123',
    user_id: TEST_USER_ID,
    project_id: 'project-123',
    conversation_type: 'address_analysis',
    title: 'Paris_15 Rue des Fustiers',
    context_metadata: {
      initial_address: '15 Rue des Fustiers, 75001 Paris',
      geocoded: { lon: 2.3397, lat: 48.8606 },
      city: 'Paris',
      insee_code: '75056',
    },
    branch_type: 'pending',
    has_analysis: false,
    is_rnu: false,
    primary_document_id: null,
    document_metadata: null,
    is_active: true,
    archived_at: null,
    last_message_at: null,
    message_count: 0,
    document_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockV2Message(overrides?: Partial<V2Message>): V2Message {
  return {
    id: 'message-123',
    conversation_id: 'conversation-123',
    user_id: TEST_USER_ID,
    role: 'user',
    message: 'Test message',
    message_type: 'text',
    referenced_documents: null,
    referenced_zones: null,
    referenced_cities: null,
    search_context: null,
    intent_detected: null,
    confidence_score: null,
    ai_model_used: null,
    conversation_turn: 1,
    reply_to_message_id: null,
    metadata: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockV2ResearchHistory(overrides?: Partial<V2ResearchHistory>): V2ResearchHistory {
  return {
    id: 'research-123',
    user_id: TEST_USER_ID,
    conversation_id: 'conversation-123',
    message_id: null,
    project_id: 'project-123',
    address_input: '15 Rue des Fustiers, 75001 Paris',
    search_intent: null,
    geocoded_address: 'Paris',
    city_id: null,
    zoning_id: null,
    geo_lon: 2.3397,
    geo_lat: 48.8606,
    documents_found: null,
    branch_type: 'pending',
    has_analysis: false,
    is_rnu: false,
    primary_document_id: null,
    document_metadata: null,
    success: true,
    error_reason: null,
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

  const routerReturnValue = {
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
    back: mockBack,
    forward: mockForward,
    prefetch: mockPrefetch,
  };

  // Import useRouter from the mocked module dynamically
  const nextNavigation = require('next/navigation');
  const useRouter = nextNavigation.useRouter;
  
  // Ensure useRouter is a mock function and set return value
  // When mocked with vi.mock(), useRouter should be a vi.fn() instance
  if (useRouter && typeof useRouter === 'function') {
    const mockFn = useRouter as any;
    // Try mockReturnValue first, then mockImplementation
    if (typeof mockFn.mockReturnValue === 'function') {
      mockFn.mockReturnValue(routerReturnValue);
    } else if (typeof mockFn.mockImplementation === 'function') {
      mockFn.mockImplementation(() => routerReturnValue);
    } else {
      // Fallback: if useRouter is not a proper mock, we need to make it one
      // This handles the case where vi.mock might not have created a proper mock
      const newMock = vi.fn(() => routerReturnValue);
      // Try to replace it if possible (might not work due to getter)
      try {
        Object.defineProperty(nextNavigation, 'useRouter', {
          value: newMock,
          writable: true,
          configurable: true,
        });
      } catch (e) {
        // If we can't replace it, at least try to configure the existing one
        // This is a fallback that might not work in all cases
      }
    }
  }

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
  const nextNavigation = require('next/navigation');
  const existingUseParams = nextNavigation.useParams;

  if (existingUseParams && typeof existingUseParams === 'function') {
    const mockFn = existingUseParams as any;

    if (typeof mockFn.mockReturnValue === 'function') {
      mockFn.mockReturnValue(params);
      return;
    }

    if (typeof mockFn.mockImplementation === 'function') {
      mockFn.mockImplementation(() => params);
      return;
    }
  }

  const useParamsMock = vi.fn(() => params);

  try {
    Object.defineProperty(nextNavigation, 'useParams', {
      value: useParamsMock,
      writable: true,
      configurable: true,
    });
  } catch (error) {
    try {
      nextNavigation.useParams = useParamsMock;
    } catch (assignError) {
      // As a last resort, do nothing. Tests relying on useParams should handle undefined gracefully.
    }
  }
}

export async function waitForLoadingToFinish() {
  const { queryByText, waitFor } = await import('@testing-library/react');
  const { expect } = await import('vitest');
  await waitFor(() => {
    const loadingElement = queryByText(document.body, /Chargement/);
    expect(loadingElement).toBeNull();
  });
}

// Render helper with router context
export function renderWithProviders(ui: React.ReactElement, options?: any) {
  return render(ui, options);
}

// Carto API test helpers

/**
 * Creates a mock GeoJSON Point for testing
 */
export function createMockGeoJSONPoint(coordinates: [number, number] = [2.3397, 48.8606]) {
  return {
    type: 'Point',
    coordinates,
  };
}

/**
 * Creates a mock GeoJSON MultiPolygon for zone polygons
 */
export function createMockZonePolygon(
  zoneCode: string = 'Uc',
  zoneName: string = 'Zone urbaine centre',
  coordinates: [number, number] = [2.3397, 48.8606]
) {
  // Create a simple square polygon around the coordinates
  const [lon, lat] = coordinates;
  const offset = 0.001; // Small offset for polygon bounds

  return {
    type: 'Feature',
    properties: {
      libelle: zoneName,
      libelle_long: `${zoneCode} - ${zoneName}`,
      code_zone: zoneCode,
      typezone: 'ZU',
    },
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [lon - offset, lat - offset],
            [lon + offset, lat - offset],
            [lon + offset, lat + offset],
            [lon - offset, lat + offset],
            [lon - offset, lat - offset],
          ],
        ],
      ],
    },
  };
}

/**
 * Creates a mock FeatureCollection for zone-urba API response
 */
export function createMockZoneUrbaResponse(
  zones: Array<{ code: string; name: string }> = [
    { code: 'Uc', name: 'Zone urbaine centre' },
  ],
  centerCoordinates: [number, number] = [2.3397, 48.8606]
) {
  return {
    type: 'FeatureCollection',
    features: zones.map((zone) =>
      createMockZonePolygon(zone.code, zone.name, centerCoordinates)
    ),
  };
}

/**
 * Creates a mock document response for document API
 */
export function createMockDocumentResponse(options?: {
  codeInsee?: string;
  isRNU?: boolean;
  documentUrl?: string;
}) {
  const { codeInsee = '75056', isRNU = false, documentUrl } = options || {};

  if (isRNU) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            document_type: 'RNU',
            libelle: 'Règlement National d\'Urbanisme',
          },
        },
      ],
    };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          document_type: 'PLU',
          libelle: 'Plan Local d\'Urbanisme',
          code_insee: codeInsee,
          document_url: documentUrl || `https://example.com/plu/${codeInsee}.pdf`,
        },
      },
    ],
  };
}

/**
 * Creates a mock municipality response
 */
export function createMockMunicipalityResponse(options?: {
  codeInsee?: string;
  name?: string;
  isRnu?: boolean;
}) {
  const { codeInsee = '75056', name = 'Paris', isRnu = false } = options || {};
  const normalizedName = name.toUpperCase();

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          code_insee: codeInsee,
          insee: codeInsee,
          name: normalizedName,
          nom_commune: name,
          code_departement: codeInsee.substring(0, 2),
          is_rnu: isRnu,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [],
        },
      },
    ],
  };
}

