# Test Report: Initial State Rendering

## Test Name
`should render initial state with welcome message and address input`

## What is Being Tested
This test verifies that the Home page (`app/page.tsx`) correctly renders its initial state after authentication. It checks that:
- The loading state disappears after authentication completes
- The welcome message "Bienvenue sur MWPLU" is displayed
- The descriptive text about entering an address is shown
- The address input field is present and accessible

## Inputs

### Test Setup
- **Component**: `Home` component from `app/page.tsx`
- **Authentication**: Mocked via `vi.spyOn(supabase.auth, 'getUser')` in `__tests__/setup.ts`
- **Router**: Mocked using `mockRouter()` helper function
- **Mock Data**: Test user with ID `test-user-id`

### User Actions
- None - this is a render-only test
- The test waits for the authentication check to complete before asserting

## Data Processing

### 1. Component Render
```
render(<Home />)
```
- React Testing Library renders the Home component
- Component mounts and executes `useEffect` hook

### 2. Authentication Check
```
useEffect(() => {
  checkAuth();
}, []);
```
- `checkAuth()` function is called on mount
- Makes async call to `supabase.auth.getUser()`
- Mocked to return: `{ data: { user: {...} }, error: null }`

### 3. State Updates
- `setLoading(false)` - loading state is cleared
- `setUserId(user.id)` - user ID is stored in state

### 4. Component Rendering Flow
- Initial render shows "Chargement..." (loading state)
- After auth completes, loading state is removed
- `InitialAddressInput` component is rendered with:
  - Welcome message: "Bienvenue sur MWPLU"
  - Description: "Entrez l'adresse de votre projet pour commencer l'analyse du PLU"
  - Address input with placeholder: "Ex: 15 rue des Fustiers, Paris 75001"

### 5. Test Assertions
- Waits for loading text to disappear: `waitFor(() => expect(screen.queryByText('Chargement...')).not.toBeInTheDocument())`
- Verifies welcome message exists
- Verifies description text exists
- Verifies input field exists by placeholder text

## Expected Output

### UI Elements Should Be Visible
1. **Welcome Title**: "Bienvenue sur MWPLU"
   - Rendered in `InitialAddressInput` component
   - Styled as `text-3xl font-bold text-gray-900`

2. **Description Text**: "Entrez l'adresse de votre projet pour commencer l'analyse du PLU"
   - Rendered below the title
   - Styled as `text-lg text-gray-600`

3. **Address Input Field**
   - Placeholder: "Ex: 15 rue des Fustiers, Paris 75001"
   - Includes MapPin icon on the left
   - Enabled and focused by default (`autoFocus` prop)

### State After Test
- `loading: false`
- `userId: 'test-user-id'`
- Loading indicator not visible
- All expected UI elements rendered

## Actual Output

### Test Execution Results
- **Status**: ✅ **PASS**
- **Duration**: ~38ms
- **Assertions**: All passed

### Observed Behavior
1. Component rendered successfully
2. Authentication check completed
3. Loading state disappeared after authentication
4. All UI elements were found in the DOM:
   - Welcome message element found
   - Description text element found
   - Input field with correct placeholder found

### DOM Structure Verified
```html
<div class="flex h-screen overflow-hidden bg-white">
  <div class="flex-1 flex items-center justify-center">
    <div class="flex flex-col items-center justify-center h-full px-4">
      <div class="max-w-2xl w-full space-y-8">
        <!-- Welcome message and input elements -->
      </div>
    </div>
  </div>
</div>
```

## Test Result

✅ **PASS** - Test completed successfully

### Summary
The test confirms that:
- Authentication flow works correctly in test environment
- Component properly handles async authentication
- Loading states are managed correctly
- All expected UI elements render after authentication completes
- No errors or warnings during execution

### Notes
- The test uses `waitFor` to handle async authentication, ensuring the test doesn't fail due to timing issues
- Mock authentication bypasses actual HTTP requests, making the test fast and reliable
- The test validates the initial user experience before any user interaction

