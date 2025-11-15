import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatConversationPage from '@/app/(app)/chat/[conversation_id]/page';
import {
  mockRouter,
  mockParams,
  createMockV2Conversation,
  createMockV2ResearchHistory,
  TEST_USER_ID,
} from '@/__tests__/utils/test-helpers';
import { server } from '@/__tests__/mocks/server';
import {
  getChatApiRequests,
  recordChatApiRequest,
  getV2MessagesStore,
} from '@/__tests__/mocks/handlers';
import { http, HttpResponse } from 'msw';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock('@/components/ui/ai-prompt-box', () => {
  const React = require('react');
  return {
    PromptInputBox: ({ onSend, isLoading, disabled }: any) => {
      const [value, setValue] = React.useState('');
      return (
        <div data-testid="prompt-input-box">
          <textarea
            placeholder="Posez votre question..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => {
              if (!isLoading && !disabled && value.trim()) {
                onSend(value.trim());
                setValue('');
              }
            }}
            disabled={isLoading || disabled || !value.trim()}
          >
            Envoyer
          </button>
        </div>
      );
    },
  };
});

vi.mock('@/app/(app)/chat/[conversation_id]/useEnrichment', () => ({
  useEnrichment: () => ({
    status: 'complete',
    retry: vi.fn(),
    progress: {
      enrichment: 'success',
      zones: 'success',
      municipality: 'success',
      city: 'success',
      zoning: 'success',
      zone: 'success',
      document: 'success',
      map: 'success',
    },
    data: {
      branchType: 'non_rnu_analysis',
      documentData: {
        documentId: 'doc-mock',
        hasAnalysis: true,
        htmlContent: '<p>Analyse</p>',
      },
      mapGeometry: null,
    },
  }),
}));

describe('Send Message Flow (v2)', () => {
  const user = userEvent.setup({ delay: null });
  let routerMocks: ReturnType<typeof mockRouter>;

  beforeAll(() => {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(() => {
    routerMocks = mockRouter();
    mockParams({ conversation_id: 'conversation-123' });

    // Mock v2 conversation and research history
    const mockConversation = createMockV2Conversation({
      id: 'conversation-123',
      document_count: 0, // No docs = no artifact loading
    });

    const mockResearch = createMockV2ResearchHistory({
      conversation_id: 'conversation-123',
      geocoded_address: '15 Rue des Fustiers, 75001 Paris',
    });

    server.use(
      http.get('*/rest/v1/v2_conversations', () => {
        return HttpResponse.json([mockConversation]);
      }),
      http.get('*/rest/v1/v2_messages', () => {
        return HttpResponse.json([]);
      }),
      http.get('*/rest/v1/v2_research_history', () => {
        return HttpResponse.json([mockResearch]);
      })
    );
  });

  function renderChatPage() {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ChatConversationPage params={{ conversation_id: 'conversation-123' }} />
      </QueryClientProvider>
    );
  }

  it('relays payload to chat API with conversation metadata', async () => {
    renderChatPage();

    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    const textarea = (await screen.findByPlaceholderText(/Posez votre question/)) as HTMLTextAreaElement;
    await user.type(textarea, 'Quelles sont les règles de construction ?');

    const sendButton = screen.getByRole('button', { name: /Envoyer/ });
    await user.click(sendButton);

    await waitFor(() => {
      expect(getChatApiRequests().length).toBeGreaterThan(0);
    });

    const payload = getChatApiRequests()[0];
    expect(payload.conversation_id).toBe('conversation-123');
    expect(payload.user_id).toBe(TEST_USER_ID);
    expect(payload.message).toContain('Quelles sont les règles de construction');
    expect(payload.message_id).toBeTruthy();
    expect(payload.context_metadata?.initial_address).toBe('15 Rue des Fustiers, 75001 Paris');
  });

  it('keeps user message when chat API responds with error', async () => {
    server.use(
      http.post('*/api/chat', async ({ request }) => {
        const body = await request.json();
        recordChatApiRequest(body);
        return HttpResponse.json({ error: 'failure' }, { status: 500 });
      })
    );

    renderChatPage();

    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    const textarea = (await screen.findByPlaceholderText(/Posez votre question/)) as HTMLTextAreaElement;
    await user.type(textarea, 'Message qui échoue');

    const sendButton = screen.getByRole('button', { name: /Envoyer/ });
    await user.click(sendButton);

    await waitFor(() => {
      expect(getChatApiRequests().length).toBe(1);
    });

    await waitFor(() => {
      expect(
        getV2MessagesStore().some(
          (msg) => msg.conversation_id === 'conversation-123' && msg.message === 'Message qui échoue'
        )
      ).toBe(true);
    });
  });
});

