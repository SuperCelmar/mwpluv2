# Test Report: Conversation Creation and Navigation

## Test Name
`should create Conversation and navigate to chat page`

## What is Being Tested
This test verifies the complete Conversation creation flow:
- User can submit the form after selecting an address
- Conversation is created in Supabase database (via mocked API)
- Router navigation occurs after successful Conversation creation
- Navigation includes the correct Conversation ID in the URL

## Inputs

### Test Setup
- **Component**: `Home` component
- **Mocked APIs**:
  - Supabase REST API: `POST */rest/v1/Conversations`
  - French Address API (for search)
- **Router Mock**: `mockRouter()` with tracked `push` function
- **User Actions**: Full workflow from search to submission

### User Action Sequence
1. Type "15 rue" to search addresses
2. Wait for suggestions
3. Click on suggestion to select address
4. Click submit button ("Commencer l'analyse")

### Mock Conversation Data
When Conversation is created, mock handler returns:
```json
{
  "id": "Conversation-1",
  "user_id": "test-user-id",
  "name": "15 Rue des Fustiers, 75001 Paris",
  "address": "15 Rue des Fustiers, 75001 Paris",
  "municipality": "Paris",
  "gps_coordinates": [2.3397, 48.8606],
  "insee_code": "75056",
  "document_loaded": false,
  "map_loaded": false,
  "artifacts_ready": false,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Data Processing

### 1. Address Selection Phase
(Same as Test 3 - user selects address from suggestions)

### 2. Submit Button Click
```typescript
await user.click(submitButton)
```
- Triggers `handleSubmit` function in `InitialAddressInput`
- Which calls `onAddressSubmit(selectedAddress)`

### 3. Conversation Creation Handler
```typescript
// In app/page.tsx
const handleAddressSubmit = async (address: AddressSuggestion) => {
  if (!userId) return;

  setSendingMessage(true);
  const addressLabel = address.properties.label;

  try {
    const { data: Conversation, error: ConversationError } = await supabase
      .from('Conversations')
      .insert({
        user_id: userId,
        name: addressLabel,
        address: addressLabel,
        municipality: address.properties.city,
        gps_coordinates: address.geometry?.coordinates || null,
        insee_code: address.properties.citycode || null,
        document_loaded: false,
        map_loaded: false,
        artifacts_ready: false,
      })
      .select()
      .maybeSingle();

    if (ConversationError || !Conversation) {
      console.error('Error creating Conversation:', ConversationError);
      setSendingMessage(false);
      return;
    }

    router.push(`/chat/${Conversation.id}`);
  } catch (error) {
    console.error('Error creating conversation:', error);
    setSendingMessage(false);
  }
};
```

### 4. Supabase Insert Request

**Request Details:**
- **Method**: POST
- **URL**: `https://test.supabase.co/rest/v1/Conversations`
- **Headers**: 
  - `apikey`: test-anon-key
  - `Authorization`: Bearer token (if needed)
  - `Content-Type`: application/json
  - `Prefer`: return=representation

**Request Body:**
```json
{
  "user_id": "test-user-id",
  "name": "15 Rue des Fustiers, 75001 Paris",
  "address": "15 Rue des Fustiers, 75001 Paris",
  "municipality": "Paris",
  "gps_coordinates": [2.3397, 48.8606],
  "insee_code": "75056",
  "document_loaded": false,
  "map_loaded": false,
  "artifacts_ready": false
}
```

### 5. MSW Handler Processing

**Handler in `__tests__/mocks/handlers.ts`:**
```typescript
http.post('*/rest/v1/Conversations', async ({ request }) => {
  const body = await request.json() as any;
  const newConversation = {
    ...body,
    id: `Conversation-${ConversationIdCounter++}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockConversations.push(newConversation);
  return HttpResponse.json([newConversation]);
})
```

**Processing Steps:**
1. MSW intercepts POST request
2. Extracts request body
3. Generates new Conversation ID (`Conversation-1`, `Conversation-2`, etc.)
4. Adds timestamps (`created_at`, `updated_at`)
5. Stores Conversation in mock data array
6. Returns array with created Conversation

### 6. Response Processing

**Response Received:**
```json
[{
  "id": "Conversation-1",
  "user_id": "test-user-id",
  "name": "15 Rue des Fustiers, 75001 Paris",
  ...
}]
```

- Component receives response in `data: Conversation`
- Conversation object extracted from array (first element)

### 7. Navigation Trigger

**If Success:**
```typescript
router.push(`/chat/${Conversation.id}`);
```
- Constructs URL: `/chat/Conversation-1`
- Calls router's `push` method
- Navigation should occur (in real app, but mocked in test)

**If Error:**
- Logs error to console
- Sets `setSendingMessage(false)`
- Returns early (no navigation)

### 8. Test Assertions
```typescript
await waitFor(() => {
  expect(routerMocks.push).toHaveBeenCalledWith(
    expect.stringMatching(/^\/chat\/Conversation-/)
  );
});

const callArgs = routerMocks.push.mock.calls[0][0];
expect(callArgs).toMatch(/^\/chat\/Conversation-/);
```

## Expected Output

### Successful Flow

1. **Conversation Created**
   - POST request succeeds
   - Conversation ID generated (`Conversation-1`, `Conversation-2`, etc.)
   - Conversation data stored in mock database

2. **Router Navigation**
   - `router.push()` called with URL: `/chat/Conversation-{id}`
   - URL pattern matches: `/^\/chat\/Conversation-/`

3. **State After Submission**
   - `sendingMessage: false` (if successful) or `true` (if still processing)
   - Conversation exists in mock data store

### Router Call Expected
```typescript
routerMocks.push.mock.calls = [
  ['/chat/Conversation-1']
]
```

## Actual Output

### Test Execution Results
- **Status**: ❌ **FAIL**
- **Duration**: ~1421ms
- **Assertion Failed**: `routerMocks.push` was never called

### Error Message
```
AssertionError: expected "vi.fn()" to be called with arguments: [ StringMatching /^\/chat\/Conversation-/ ]

Number of calls: 0
```

### Observed Behavior

1. ✅ Address search completed
2. ✅ Address selection completed
3. ✅ Submit button click registered
4. ✅ `handleAddressSubmit` function called
5. ❌ **Conversation creation failed**: `TypeError: fetch failed`
6. ❌ Navigation never occurred (because Conversation creation failed)
7. ❌ Router `push` was never called

### Error Details
```
Error creating Conversation: {
  message: 'TypeError: fetch failed',
  details: 'TypeError: fetch failed\n' +
    '    at node:internal/deps/undici/undici:13502:13\n' +
    '    at processTicksAndRejections (node:internal/dask_queues:105:5)\n' +
    '    at handleAddressSubmit (/Users/.../app/page.tsx:36:54)',
  hint: '',
  code: ''
}
```

### Root Cause Analysis

**Issue**: The Supabase client is making a fetch request that is not being intercepted by MSW.

**Possible Reasons:**
1. **URL Mismatch**: Supabase client might be using a different URL format than expected
2. **MSW Configuration**: MSW might not be properly intercepting Supabase requests
3. **Fetch Implementation**: Supabase might be using a fetch implementation that MSW doesn't intercept
4. **Request Headers**: Special headers or request format might not match MSW patterns

**MSW Handler Pattern:**
- Handler uses: `*/rest/v1/Conversations` (should match any domain)
- Supabase URL: `https://test.supabase.co/rest/v1/Conversations`
- Expected to match, but fetch is failing before MSW can intercept

### Network Request Flow (Actual)
```
User clicks submit
  ↓
handleAddressSubmit called
  ↓
supabase.from('Conversations').insert(...)
  ↓
Fetch request to https://test.supabase.co/rest/v1/Conversations
  ↓
❌ Fetch fails (network error)
  ↓
Error caught, ConversationError set
  ↓
Early return (no navigation)
  ↓
router.push() never called ❌
```

## Test Result

❌ **FAIL** - Test did not complete successfully

### Summary
- The test workflow up to Conversation creation works correctly
- User interactions (typing, selecting, clicking) all function properly
- The failure occurs at the Supabase API call level
- MSW is not successfully intercepting the Supabase REST API request
- As a result, navigation never occurs because Conversation creation fails

### Issues Identified

1. **Supabase Request Interception**: MSW handlers need to be verified for Supabase request patterns
2. **Fetch Configuration**: May need to configure Supabase client or MSW differently
3. **Error Handling**: Component handles errors gracefully, but test cannot verify navigation

### Recommendations

1. **Verify MSW Handler Patterns**: Ensure `*/rest/v1/Conversations` pattern matches Supabase requests
2. **Check Supabase Client Configuration**: Verify URL and headers in test environment
3. **Add Request Logging**: Log actual request URLs to see what Supabase is sending
4. **Consider Direct Mocking**: May need to mock `supabase.from()` directly instead of HTTP interception

### Notes
- The test structure and assertions are correct
- The failure is in the integration layer (API interception)
- This is an infrastructure issue, not a logic issue
- Once Supabase requests are properly intercepted, this test should pass

