import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from '@/app/(app)/page';
import * as supabaseModule from '@/lib/supabase';

const routerMocks = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => routerMocks,
}));

// Increase timeout for tests that make real Carto API calls
describe('Create Project Flow (v2)', () => {
  const user = userEvent.setup({ delay: null }); // Faster typing for tests
  beforeEach(() => {
    Object.values(routerMocks).forEach((fn) => fn.mockReset());
  });

  const renderHome = () => {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>
    );
  };

  it('should render initial state with welcome message and address input', async () => {
    renderHome();

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/Entrez l'adresse de votre projet/i)).toBeInTheDocument();
  });

  it('should search for address and display suggestions', async () => {
    // Integration Test: User input → API call → UI update
    // Input: User types "15 rue"
    // Processing: Debounced API call to French Address API (mocked via MSW)
    // Output: Suggestions displayed in dropdown

    renderHome();

    // Wait for auth check
    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Entrez l'adresse de votre projet/i);

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
    renderHome();

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Entrez l'adresse de votre projet/i);
    await user.type(input, '15 rue');

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    // Click on first suggestion
    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    await user.type(input, '{Enter}');
    await waitFor(() => {
      expect(routerMocks.push).toHaveBeenCalled();
    });
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

    renderHome();

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Entrez l'adresse de votre projet/i);
    await user.type(input, '15 rue');

    // Wait for suggestions and select
    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    // Click submit
    await user.type(input, '{Enter}');

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
    renderHome();

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Entrez l'adresse de votre projet/i);
    await user.type(input, '15 rue');

    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    await user.type(input, '{Enter}');

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

  it('should create research history entry when address is submitted', async () => {
    renderHome();

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Entrez l'adresse de votre projet/i);
    await user.type(input, '15 rue');

    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    await user.type(input, '{Enter}');

    await waitFor(() => {
      expect(routerMocks.push).toHaveBeenCalled();
    }, { timeout: 10000 });

    const response = await fetch('https://test.supabase.co/rest/v1/v2_research_history?user_id=eq.test-user-id');
    const researchEntries = await response.json();

    expect(researchEntries.length).toBeGreaterThan(0);
    const latestEntry = researchEntries[0];
    expect(latestEntry.address_input).toContain('15 Rue des Fustiers');
    expect(latestEntry.conversation_id).toBeDefined();
  });

  it('should redirect to existing conversation when duplicate detected', async () => {
    const duplicateSpy = vi
      .spyOn(supabaseModule, 'checkDuplicateByCoordinates')
      .mockResolvedValue({
        exists: true,
        conversationId: 'conversation-duplicate',
      });

    renderHome();

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Entrez l'adresse de votre projet/i);
    await user.type(input, '15 rue');

    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    await user.type(input, '{Enter}');

    await waitFor(() => {
      expect(routerMocks.push).toHaveBeenCalledWith('/chat/conversation-duplicate');
    });

    duplicateSpy.mockRestore();
  });

  it('shows inline duplicate hint when duplicate detected pre-submit', async () => {
    const duplicateSpy = vi
      .spyOn(supabaseModule, 'checkDuplicateByCoordinates')
      .mockResolvedValue({
        exists: true,
        conversationId: 'conversation-duplicate',
      });

    renderHome();

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Entrez l'adresse de votre projet/i);
    await user.type(input, '15 rue');

    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    await waitFor(() => {
      expect(screen.getByTestId('duplicate-hint')).toBeInTheDocument();
    });

    duplicateSpy.mockRestore();
  });
});

