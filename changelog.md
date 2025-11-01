# Changelog

All notable changes to this project will be documented in this file.

## 2025-11-01

### Added
- Integration testing infrastructure with Vitest + React Testing Library + MSW
- Test configuration (`vitest.config.ts`) with jsdom environment and path aliases
- MSW handlers for mocking external APIs:
  - Supabase Auth and REST API endpoints
  - French Address API (api-adresse.data.gouv.fr)
  - N8N webhook for AI responses
- Integration test suites:
  - `create-project.test.tsx` - tests project creation flow from home page
  - `send-message.test.tsx` - tests message sending and AI response
  - `load-project.test.tsx` - tests artifact loading simulation
- Test utilities and helpers in `__tests__/utils/test-helpers.ts`:
  - Mock data generators (users, projects, messages)
  - Router mocking utilities
  - Async test helpers
- Test scripts in package.json:
  - `npm test` - run tests
  - `npm run test:ui` - run tests with UI
  - `npm run test:coverage` - run tests with coverage

### Installation
- Added dependencies: vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom, msw, @vitejs/plugin-react
- Configured test environment with proper path resolution and setup files

### Notes
- Supabase auth mocking requires special handling for JWT tokens and localStorage
- Tests are set up as integration tests focusing on user flows rather than unit tests
- MSW intercepts network requests at the HTTP level for realistic testing

