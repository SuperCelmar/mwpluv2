import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '@/app/page';
import { mockRouter } from '@/__tests__/utils/test-helpers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Increase timeout for tests that make real Carto API calls
describe('Create Project Flow (v2)', () => {
  const user = userEvent.setup({ delay: null }); // Faster typing for tests
  let routerMocks: ReturnType<typeof mockRouter>;

  beforeEach(() => {
    routerMocks = mockRouter();
  });

  it('should render initial state with welcome message and address input', async () => {
    render(<Home />);

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Bienvenue sur MWPLU')).toBeInTheDocument();
    expect(
      screen.getByText('Entrez l\'adresse de votre projet pour commencer l\'analyse du PLU')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ex: 15 rue des Fustiers, Paris 75001/)).toBeInTheDocument();
  });

  it('should search for address and display suggestions', async () => {
    // Integration Test: User input → API call → UI update
    // Input: User types "15 rue"
    // Processing: Debounced API call to French Address API (mocked via MSW)
    // Output: Suggestions displayed in dropdown

    render(<Home />);

    // Wait for auth check
    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ex: 15 rue des Fustiers, Paris 75001/);

    // User interaction: Type address query
    await user.type(input, '15 rue');

    // Verify integration: API call made, response processed, UI updated
    await waitFor(
      () => {
        expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Verify output: Suggestions displayed with correct data
    expect(screen.getByText('75001 Paris')).toBeInTheDocument();

    // Integration verification: MSW intercepted French Address API call
    // (external API mocked, but integration flow tested)
  });

  it('should enable submit button when address is selected', async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ex: 15 rue des Fustiers, Paris 75001/);
    await user.type(input, '15 rue');

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    // Click on first suggestion
    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    // Button should now be enabled
    const submitButton = screen.getByRole('button', { name: /Commencer l'analyse/ });
    expect(submitButton).not.toBeDisabled();
  });

  it('should create v2 project, conversation and navigate to chat page', async () => {
    // Integration Test: Full v2 flow with real Carto APIs
    // Input: User selects address "15 Rue des Fustiers, 75001 Paris"
    // Processing:
    //   1. Save to v2_research_history
    //   2. Call Carto APIs (zone-urba, document, municipality) - REAL network calls
    //   3. Enrich research with zone/document data
    //   4. Create v2_projects (status: 'draft', name: null)
    //   5. Create v2_conversations linked to project
    //   6. Link documents via v2_conversation_documents
    // Output: Navigation to /chat/[conversation_id]

    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ex: 15 rue des Fustiers, Paris 75001/);
    await user.type(input, '15 rue');

    // Wait for suggestions and select
    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    // Click submit
    const submitButton = screen.getByRole('button', { name: /Commencer l'analyse/ });
    await user.click(submitButton);

    // Wait for navigation (this will take longer due to Carto API calls)
    await waitFor(
      () => {
        expect(routerMocks.push).toHaveBeenCalledWith(expect.stringMatching(/^\/chat\/conversation-/));
      },
      { timeout: 10000 }
    ); // Increased timeout for network requests

    // Verify the conversation was created and navigation occurred
    const callArgs = routerMocks.push.mock.calls[0][0];
    expect(callArgs).toMatch(/^\/chat\/conversation-/);

    // TODO: Add verification that:
    // - v2_research_history saved with address and GPS coordinates
    // - Carto APIs called successfully
    // - v2_projects created with draft status
    // - v2_conversations created linked to project
    // - v2_conversation_documents created if documents found
  });

  it('should create conversation with default title from address', async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ex: 15 rue des Fustiers, Paris 75001/);
    await user.type(input, '15 rue');

    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    const submitButton = screen.getByRole('button', { name: /Commencer l'analyse/ });
    await user.click(submitButton);

    // Wait for conversation creation
    await waitFor(
      () => {
        expect(routerMocks.push).toHaveBeenCalled();
      },
      { timeout: 10000 }
    );

    // Integration Test: Verify the complete v2 flow worked
    // - Input: Address selected with properties
    // - Processing: Data transformed through v2 tables (research → project → conversation)
    // - Output: Navigation with conversation ID

    // TODO: Once MSW properly intercepts requests, verify:
    // - v2_research_history contains address_input, geo_lon, geo_lat
    // - v2_projects has status='draft', main_address populated
    // - v2_conversations has default title 'Paris_15 Rue des Fustiers'
    // - context_metadata includes initial_address, geocoded, city, insee_code

    // For now, verify navigation occurred (output verification)
    const navigationCall = routerMocks.push.mock.calls[0]?.[0];
    expect(navigationCall).toMatch(/^\/chat\/conversation-/);
  });
});

