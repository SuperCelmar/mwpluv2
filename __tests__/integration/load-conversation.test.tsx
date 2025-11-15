import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatConversationPage from '@/app/(app)/chat/[conversation_id]/page';
import { mockRouter, mockParams, createMockV2Conversation } from '@/__tests__/utils/test-helpers';
import { server } from '@/__tests__/mocks/server';
import { http, HttpResponse } from 'msw';

let originalElementScrollTo: typeof Element.prototype.scrollTo | undefined;

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

describe('Load Conversation Flow (v2)', () => {
  beforeAll(() => {
    originalElementScrollTo = Element.prototype.scrollTo;
  });

  beforeEach(() => {
    mockRouter();
    mockParams({ conversation_id: 'conversation-123' });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(Element.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    // Mock v2 conversation fetch
    const mockConversation = createMockV2Conversation({
      id: 'conversation-123',
      document_count: 1, // Has documents, will trigger artifact loading
    });

    server.use(
      http.get('*/rest/v1/v2_conversations', () => {
        return HttpResponse.json([mockConversation]);
      }),
      http.get('*/rest/v1/v2_messages', () => {
        return HttpResponse.json([]);
      }),
      http.get('*/rest/v1/v2_research_history', () => {
        return HttpResponse.json([]);
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalElementScrollTo) {
      Object.defineProperty(Element.prototype, 'scrollTo', {
        configurable: true,
        writable: true,
        value: originalElementScrollTo,
      });
    } else {
      delete (Element.prototype as any).scrollTo;
    }
  });

  afterAll(() => {
    if (originalElementScrollTo) {
      Object.defineProperty(Element.prototype, 'scrollTo', {
        configurable: true,
        writable: true,
        value: originalElementScrollTo,
      });
    } else {
      delete (Element.prototype as any).scrollTo;
    }
  });

  function renderConversationPage() {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ChatConversationPage params={{ conversation_id: 'conversation-123' }} />
      </QueryClientProvider>
    );
  }

  it('should show loading screen when artifacts are not ready', async () => {
    renderConversationPage();

    // Wait for initial auth check
    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    // Should show loading artifacts screen
    expect(screen.getByText(/Préparation de votre analyse PLU/)).toBeInTheDocument();
    expect(screen.getByText(/Chargement du document PLU/)).toBeInTheDocument();
    expect(screen.getByText(/Chargement de la carte cadastrale/)).toBeInTheDocument();
  });

  it('should update document_loaded state after 1.5s', async () => {
    renderConversationPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    // Advance time by 1.5s
    vi.advanceTimersByTime(1500);

    // Wait for document loaded indicator
    await waitFor(() => {
      expect(screen.getByText(/✓ Document PLU chargé/)).toBeInTheDocument();
    });
  });

  it('should update map_loaded and artifacts_ready after 3s', async () => {
    renderConversationPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    // Advance time by 3s
    vi.advanceTimersByTime(3000);

    // Wait for both indicators
    await waitFor(() => {
      expect(screen.getByText(/✓ Carte cadastrale chargée/)).toBeInTheDocument();
    });

    // Should show ready state
    await waitFor(() => {
      expect(screen.getByText(/Vos documents sont prêts/)).toBeInTheDocument();
    });
  });

  it('should enable input after artifacts are ready', async () => {
    renderConversationPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    // Input should be disabled during loading
    const textarea = screen.getByPlaceholderText(/Ex: 15 rue des Fustiers, Paris 75001/) as HTMLTextAreaElement;
    expect(textarea).toBeDisabled();

    // Advance time by 3s
    vi.advanceTimersByTime(3000);

    // Wait for input to be enabled
    await waitFor(() => {
      expect(textarea).not.toBeDisabled();
    });
  });

  it('should open right panel after artifacts are ready', async () => {
    renderConversationPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    // Advance time by 3s
    vi.advanceTimersByTime(3000);

    // Wait for panel to be visible
    await waitFor(() => {
      expect(screen.getByText(/Documents PLU/)).toBeInTheDocument();
    });
  });

  it('should show loading indicators in correct order', async () => {
    renderConversationPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    // Initially both should be loading
    expect(screen.getByText(/⏳ Chargement du document PLU/)).toBeInTheDocument();
    expect(screen.getByText(/⏳ Chargement de la carte cadastrale/)).toBeInTheDocument();

    // After 1.5s, document should be loaded
    vi.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(screen.getByText(/✓ Document PLU chargé/)).toBeInTheDocument();
      expect(screen.getByText(/⏳ Chargement de la carte cadastrale/)).toBeInTheDocument();
    });

    // After 3s total, both should be loaded
    vi.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(screen.getByText(/✓ Document PLU chargé/)).toBeInTheDocument();
      expect(screen.getByText(/✓ Carte cadastrale chargée/)).toBeInTheDocument();
    });
  });
});







