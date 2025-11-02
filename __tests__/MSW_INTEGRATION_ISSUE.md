# MSW Supabase Interception Issue

## Problem

Supabase REST API requests are failing with `TypeError: fetch failed` before MSW can intercept them. This prevents integration tests that involve Supabase database operations from completing.

## Current Status

- ✅ MSW successfully intercepts: French Address API, Carto APIs, N8N webhook
- ❌ MSW not intercepting: Supabase REST API requests (`POST /rest/v1/conversations`, etc.)

## Technical Details

### Error
```
TypeError: fetch failed
    at node:internal/deps/undici/undici:13502:13
```

This suggests the fetch request is failing at a network level (undici is Node.js's fetch implementation) before MSW can intercept it.

### Configuration

- MSW version: 2.11.6
- Environment: Node.js with jsdom (vitest)
- MSW server: `setupServer` from `msw/node`
- Handler patterns: `https://test.supabase.co/rest/v1/conversations` and `*/rest/v1/conversations`

### Attempted Fixes

1. ✅ Added specific URL patterns matching test Supabase URL
2. ✅ Added wildcard fallback patterns
3. ✅ Moved MSW server initialization before other imports
4. ✅ Added error handling in handlers
5. ✅ Added request logging (no requests intercepted - confirms MSW isn't catching them)

## Root Cause Analysis

Possible reasons:
1. **Fetch implementation conflict**: Supabase client or Node.js undici fetch not being intercepted by MSW
2. **Timing issue**: Requests made before MSW is fully initialized
3. **URL resolution**: Network-level failure before MSW interception layer
4. **MSW Node.js compatibility**: MSW 2.x may need additional configuration for undici

## Impact on Tests

- ✅ Tests that don't require Supabase: **PASSING** (3/5 in create-Conversation.test.tsx)
- ❌ Tests requiring Supabase operations: **FAILING** (2/5 in create-Conversation.test.tsx)

## Integration Test Philosophy

Even with MSW not intercepting Supabase:
- Tests verify actual integration flow (input → processing → output)
- Only external APIs are mocked (not internal logic)
- Component interactions are tested (not mocked)
- Data transformation through system is verified

## Recommended Solutions

### Option 1: Fix MSW Configuration (Preferred)
- Investigate MSW undici/fetch compatibility
- Check if MSW needs additional setup for Node.js environment
- Verify MSW is intercepting at the correct layer

### Option 2: Alternative Mocking Strategy
- Mock Supabase client at a higher level (component level, not HTTP level)
- Use a test Supabase instance/local setup
- Use Supabase test helpers if available

### Option 3: Integration Test with Real Supabase
- Use a dedicated test Supabase Conversation
- Run tests against real (test) database
- True end-to-end integration testing

## Current Workaround

For now, tests are structured correctly for integration testing:
- Inputs are fixed (user actions)
- Integration is tested (components working together)
- Outputs are verified (navigation, UI state)
- External APIs are mocked via MSW (where working)

Once MSW interception is fixed, the failing tests should pass immediately as they're already structured correctly.

