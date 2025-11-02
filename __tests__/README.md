# Integration Tests

This directory contains integration tests for the MWPLU application using Vitest, React Testing Library, and MSW (Mock Service Worker).

## Structure

```
__tests__/
├── integration/           # Integration test files
│   ├── create-Conversation.test.tsx
│   ├── send-message.test.tsx
│   └── load-Conversation.test.tsx
├── mocks/                 # MSW mocks
│   ├── handlers.ts       # API mock handlers
│   └── server.ts         # MSW server setup
├── utils/                 # Test utilities
│   └── test-helpers.ts   # Helper functions
├── setup.ts              # Test setup file
└── README.md             # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

### Create Conversation Flow (`create-Conversation.test.tsx`)
Tests the end-to-end Conversation creation flow:
- Renders initial welcome screen
- Searches for addresses using French Address API
- Selects address from suggestions
- Creates Conversation in Supabase
- Navigates to chat page

### Send Message Flow (`send-message.test.tsx`)
Tests message sending and AI response:
- Loads chat page with existing Conversation
- Displays empty state
- User types and sends message
- Calls /api/chat endpoint
- N8N webhook returns AI response
- Messages saved to database
- UI updates with conversation

### Load Conversation Flow (`load-Conversation.test.tsx`)
Tests artifact loading simulation:
- Loads Conversation with artifacts_ready=false
- Shows loading screen
- Simulates document loading (1.5s)
- Simulates map loading (3s total)
- Enables input after artifacts ready
- Opens right panel

### Carto API Integration (`carto-apis.test.tsx`)
Tests Carto API endpoints and integration:
- Zone-Urba API with GPS coordinates and INSEE code
- Document API for PLU/POS/CC/PSMV/SUP documents
- Municipality API for commune information
- Error handling for API failures
- GeoJSON response structure validation
- Parameter validation (geom, code_insee)

### Map Artifacts (`map-artifacts.test.tsx`)
Tests map display and zone highlighting:
- Map artifact display after zone-urba API call
- Address marker at correct GPS coordinates
- Zone polygon highlighting from API response
- Multiple zone handling
- Zone color/style classification
- Artifact stacking (map first, then document)
- Collapse/expand functionality
- Full integration flow: Address → APIs → Map → Zones → Document

## Mocking Strategy

We use MSW to mock all external APIs at the network level:

### Supabase
- Auth endpoints (GET /auth/v1/user)
- REST API (GET/POST/PATCH /rest/v1/conversations, /rest/v1/messages)

### External APIs
- French Address API (api-adresse.data.gouv.fr/search)
- N8N Webhook (n8n.automationdfy.com/webhook/api/chat)
- Carto API - Zone-Urba (apicarto.ign.fr/api/gpu/zone-urba)
- Carto API - Document (apicarto.ign.fr/api/gpu/document)
- Carto API - Municipality (apicarto.ign.fr/api/gpu/municipality)

### Router
- Mock next/navigation useRouter and useParams hooks

## Test Utilities

### Mock Data Generators
- `createMockUser()` - generate test user
- `createMockConversation()` - generate test Conversation
- `createMockMessage()` - generate test message

### Router Mocks
- `mockRouter()` - mock Next.js useRouter
- `mockParams()` - mock Next.js useParams

### Async Helpers
- `waitForLoadingToFinish()` - wait for loading states

## Notes

### Supabase Auth
Supabase auth is mocked at module level in `setup.ts` by directly mocking `supabase.auth.getUser()`. This approach is necessary because `getUser()` doesn't make HTTP requests, so MSW cannot intercept it. See `IMPLEMENTATION_NOTES.md` for details.

### Carto API Testing
The Carto API handlers return realistic GeoJSON FeatureCollection responses:
- **Zone-Urba**: Returns MultiPolygon features with zone classifications (Uc, UA, UB, etc.)
- **Document**: Returns document metadata including PLU/POS/CC/PSMV/SUP types and URLs
- **Municipality**: Returns commune information with INSEE codes

All APIs support filtering by:
- `geom`: GeoJSON geometry parameter (Point, Feature, etc.)
- `code_insee`: INSEE commune code

### Map Artifact Testing
Map and zone highlighting tests are prepared for future implementation. Currently, they verify:
- API endpoints are accessible and return correct data structures
- GeoJSON FeatureCollection responses are properly formatted
- Zone polygon data includes necessary properties for rendering

When map components are implemented, these tests will verify:
- Map renders with address marker at GPS coordinates
- Zone polygons are displayed and highlighted
- Multiple artifacts can stack and collapse

### Known Limitations
Some features are not yet implemented in the application:
- Carto API integration in the chat page (APIs are mocked and ready)
- Map component rendering (tests verify data structure readiness)
- Zone polygon visualization on map (tests verify GeoJSON structure)
- Document artifact PDF rendering (tests verify document URL structure)

### Database State
Each test resets mock data using `resetMockData()` in the setup file to ensure test isolation.

### Fake Timers
The load-Conversation tests use `vi.useFakeTimers()` to instantly advance setTimeout calls for the artifact loading simulation.

## Adding New Tests

1. Create a new test file in `__tests__/integration/`
2. Import necessary utilities from `__tests__/utils/test-helpers`
3. Mock router/navigation if needed
4. Use MSW handlers for API mocking
5. Follow existing patterns for async handling

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { mockRouter } from '@/__tests__/utils/test-helpers';

describe('New Feature', () => {
  it('should test new feature', async () => {
    const routerMocks = mockRouter();
    
    // Your test code here
  });
});
```

