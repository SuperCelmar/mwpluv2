# Integration Tests

This directory contains integration tests for the MWPLU application using Vitest, React Testing Library, and MSW (Mock Service Worker).

## Structure

```
__tests__/
├── integration/           # Integration test files
│   ├── create-project.test.tsx
│   ├── send-message.test.tsx
│   └── load-project.test.tsx
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

### Create Project Flow (`create-project.test.tsx`)
Tests the end-to-end project creation flow:
- Renders initial welcome screen
- Searches for addresses using French Address API
- Selects address from suggestions
- Creates project in Supabase
- Navigates to chat page

### Send Message Flow (`send-message.test.tsx`)
Tests message sending and AI response:
- Loads chat page with existing project
- Displays empty state
- User types and sends message
- Calls /api/chat endpoint
- N8N webhook returns AI response
- Messages saved to database
- UI updates with conversation

### Load Project Flow (`load-project.test.tsx`)
Tests artifact loading simulation:
- Loads project with artifacts_ready=false
- Shows loading screen
- Simulates document loading (1.5s)
- Simulates map loading (3s total)
- Enables input after artifacts ready
- Opens right panel

## Mocking Strategy

We use MSW to mock all external APIs at the network level:

### Supabase
- Auth endpoints (GET /auth/v1/user)
- REST API (GET/POST/PATCH /rest/v1/projects, /rest/v1/messages)

### External APIs
- French Address API (api-adresse.data.gouv.fr/search)
- N8N Webhook (n8n.automationdfy.com/webhook/api/chat)

### Router
- Mock next/navigation useRouter and useParams hooks

## Test Utilities

### Mock Data Generators
- `createMockUser()` - generate test user
- `createMockProject()` - generate test project
- `createMockMessage()` - generate test message

### Router Mocks
- `mockRouter()` - mock Next.js useRouter
- `mockParams()` - mock Next.js useParams

### Async Helpers
- `waitForLoadingToFinish()` - wait for loading states

## Notes

### Supabase Auth
Supabase auth uses JWT tokens stored in localStorage. The current MSW setup mocks the HTTP endpoint, but may need refinement for full auth flow testing.

### Database State
Each test resets mock data using `resetMockData()` in the setup file to ensure test isolation.

### Fake Timers
The load-project tests use `vi.useFakeTimers()` to instantly advance setTimeout calls for the artifact loading simulation.

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

