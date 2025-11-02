# Test Report: Conversation Creation with Correct Metadata

## Test Name
`should create Conversation with correct metadata`

## What is Being Tested
This test verifies that when a Conversation is created, it includes all the correct metadata fields:
- Address information (full label)
- Municipality name
- GPS coordinates
- INSEE code
- Initial artifact states (document_loaded, map_loaded, artifacts_ready)

## Inputs

### Test Setup
- **Component**: `Home` component
- **Mocked APIs**:
  - Supabase REST API: `POST */rest/v1/Conversations`
  - French Address API (for address search)
- **Router Mock**: `mockRouter()` for navigation tracking
- **Address Data**: Selected address with complete information

### Selected Address Data
```typescript
{
  properties: {
    label: "15 Rue des Fustiers, 75001 Paris",
    name: "15 Rue des Fustiers",
    city: "Paris",
    postcode: "75001",
    citycode: "75056",
    context: "75, Paris, Île-de-France",
    x: 2.3397,
    y: 48.8606
  },
  geometry: {
    type: "Point",
    coordinates: [2.3397, 48.8606]
  }
}
```

### User Actions
1. Type "15 rue" in address input
2. Wait for suggestions to appear
3. Click on address suggestion
4. Click submit button to create Conversation

## Data Processing

### 1. Address Selection
(Same as previous tests - user selects address from suggestions)

### 2. Conversation Creation Request

**Data Mapping:**
```typescript
const addressLabel = address.properties.label;
// "15 Rue des Fustiers, 75001 Paris"

await supabase.from('Conversations').insert({
  user_id: userId,                    // "test-user-id"
  name: addressLabel,                  // "15 Rue des Fustiers, 75001 Paris"
  address: addressLabel,               // "15 Rue des Fustiers, 75001 Paris"
  municipality: address.properties.city, // "Paris"
  gps_coordinates: address.geometry?.coordinates || null, // [2.3397, 48.8606]
  insee_code: address.properties.citycode || null,        // "75056"
  document_loaded: false,
  map_loaded: false,
  artifacts_ready: false,
})
```

**Field-by-Field Mapping:**

| Field | Source | Expected Value |
|-------|--------|----------------|
| `user_id` | `userId` (from auth) | `"test-user-id"` |
| `name` | `address.properties.label` | `"15 Rue des Fustiers, 75001 Paris"` |
| `address` | `address.properties.label` | `"15 Rue des Fustiers, 75001 Paris"` |
| `municipality` | `address.properties.city` | `"Paris"` |
| `gps_coordinates` | `address.geometry.coordinates` | `[2.3397, 48.8606]` |
| `insee_code` | `address.properties.citycode` | `"75056"` |
| `document_loaded` | Hardcoded | `false` |
| `map_loaded` | Hardcoded | `false` |
| `artifacts_ready` | Hardcoded | `false` |

### 3. Expected Request Payload

**JSON Body Sent to API:**
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

### 4. MSW Handler Processing

**Handler Enhancement Needed:**
The current handler stores the Conversation but the test comment suggests verifying the actual request payload:

```typescript
// Note: In a real test, we'd verify the POST to /rest/v1/Conversations
// included the correct address, municipality, gps_coordinates, and insee_code
// This would be done by checking MSW request history
```

**How to Verify (Future Enhancement):**
```typescript
// Could access request body in test:
const requestHistory = server.events.getRequests();
const ConversationRequest = requestHistory.find(req => 
  req.url.includes('/rest/v1/Conversations') && req.method === 'POST'
);
const requestBody = await ConversationRequest.json();
expect(requestBody.municipality).toBe('Paris');
expect(requestBody.insee_code).toBe('75056');
```

### 5. Response with Auto-Generated Fields

**MSW Handler Adds:**
```typescript
{
  id: `Conversation-${ConversationIdCounter++}`,  // "Conversation-1"
  created_at: new Date().toISOString(),  // "2024-01-01T00:00:00.000Z"
  updated_at: new Date().toISOString(),  // "2024-01-01T00:00:00.000Z"
  ...originalFields
}
```

### 6. Test Assertions

**Current Test:**
```typescript
await waitFor(() => {
  expect(routerMocks.push).toHaveBeenCalled();
});
```

**Missing Assertions** (noted in test comment):
- Verify POST request body contains correct fields
- Verify municipality is "Paris"
- Verify gps_coordinates are [2.3397, 48.8606]
- Verify insee_code is "75056"
- Verify address is correct label

## Expected Output

### Successful Conversation Creation

**Request Should Include:**
- ✅ Correct user_id mapping
- ✅ Full address label in both `name` and `address` fields
- ✅ Municipality extracted from address properties
- ✅ GPS coordinates from geometry (WGS84 format: [lon, lat])
- ✅ INSEE code from citycode property
- ✅ All artifact flags set to `false` initially

**Response Should Include:**
- ✅ All original fields plus:
  - Generated `id` (e.g., "Conversation-1")
  - `created_at` timestamp
  - `updated_at` timestamp

**Navigation Should:**
- ✅ Router.push called with `/chat/Conversation-{id}`
- ✅ Conversation ID matches created Conversation

### Complete Conversation Object
```typescript
{
  id: "Conversation-1",
  user_id: "test-user-id",
  name: "15 Rue des Fustiers, 75001 Paris",
  address: "15 Rue des Fustiers, 75001 Paris",
  municipality: "Paris",
  gps_coordinates: [2.3397, 48.8606],
  insee_code: "75056",
  document_loaded: false,
  map_loaded: false,
  artifacts_ready: false,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z"
}
```

## Actual Output

### Test Execution Results
- **Status**: ❌ **FAIL**
- **Duration**: ~1387ms
- **Assertion Failed**: `routerMocks.push` was never called

### Error Message
```
AssertionError: expected "vi.fn()" to be called at least once

Number of calls: 0
```

### Observed Behavior

1. ✅ Address search completed
2. ✅ Address selection completed  
3. ✅ Submit button clicked
4. ✅ `handleAddressSubmit` function executed
5. ❌ **Conversation creation failed**: `TypeError: fetch failed`
6. ❌ Navigation never occurred
7. ❌ Cannot verify metadata because request never succeeded

### Error Details
```
Error creating Conversation: {
  message: 'TypeError: fetch failed',
  details: 'TypeError: fetch failed\n' +
    '    at node:internal/deps/undici/undici:13502:13\n' +
    '    at processTicksAndRejections (node:internal/task_queues:105:5)\n' +
    '    at handleAddressSubmit (/Users/.../app/page.tsx:36:54)',
  hint: '',
  code: ''
}
```

### Root Cause

**Same Issue as Test 4**: Supabase fetch requests are not being intercepted by MSW, causing Conversation creation to fail before metadata can be verified.

### Data Flow (What Should Happen)

```
Address Selection:
  address.properties.city → "Paris"
  address.geometry.coordinates → [2.3397, 48.8606]
  address.properties.citycode → "75056"
  
Component Processing:
  municipality = address.properties.city
  gps_coordinates = address.geometry.coordinates
  insee_code = address.properties.citycode
  
API Request (should be):
  POST /rest/v1/Conversations
  Body: {
    municipality: "Paris",
    gps_coordinates: [2.3397, 48.8606],
    insee_code: "75056",
    ...
  }
  
❌ Fetch fails before MSW can intercept
```

## Test Result

❌ **FAIL** - Test did not complete successfully

### Summary
- The test is designed to verify metadata correctness
- Data mapping logic appears correct based on component code
- Cannot verify actual metadata because Conversation creation fails
- The test structure is sound, but execution is blocked by API interception issue

### Issues Identified

1. **Cannot Verify Metadata**: Due to fetch failure, we cannot confirm:
   - Request payload contains correct fields
   - Data mapping is accurate
   - Values are properly extracted from address object

2. **Missing Assertions**: The test comment indicates planned assertions for metadata verification that cannot be executed

3. **Same Root Cause**: Identical to Test 4 - MSW not intercepting Supabase requests

### Recommendations

1. **Fix MSW Interception**: Resolve the fetch interception issue (same as Test 4)
2. **Add Metadata Assertions**: Once requests succeed, add assertions like:
   ```typescript
   // Access MSW request history
   const requests = server.events.getRequests();
   const ConversationReq = requests.find(...);
   const body = await ConversationReq.json();
   
   expect(body.municipality).toBe('Paris');
   expect(body.gps_coordinates).toEqual([2.3397, 48.8606]);
   expect(body.insee_code).toBe('75056');
   ```

3. **Verify Data Mapping**: Confirm all address properties map correctly:
   - `city` → `municipality`
   - `coordinates` → `gps_coordinates`
   - `citycode` → `insee_code`

### Notes
- The component code shows correct data extraction logic
- GPS coordinates are in correct format [longitude, latitude]
- All required fields are being included in insert payload
- The failure is purely infrastructure (MSW interception), not logic
- Once API calls succeed, metadata verification should work correctly

