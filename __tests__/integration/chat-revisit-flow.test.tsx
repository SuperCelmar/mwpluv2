import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

import ChatConversationPage from '@/app/(app)/chat/[conversation_id]/page';
import type { UseEnrichmentReturn } from '@/app/(app)/chat/[conversation_id]/useEnrichment';
import { server } from '@/__tests__/mocks/server';
import {
  mockRouter,
  mockParams,
  createMockV2Conversation,
  createMockV2Message,
} from '@/__tests__/utils/test-helpers';

const mockUseEnrichment = vi.fn<[], UseEnrichmentReturn>();

vi.mock('@/app/(app)/chat/[conversation_id]/useEnrichment', () => ({
  useEnrichment: (...args: any[]) => mockUseEnrichment(...(args as [])),
}));

let rightPanelProps: any = null;

vi.mock('@/components/ChatRightPanel', () => ({
  ChatRightPanel: (props: any) => {
    rightPanelProps = props;
    return <div data-testid="right-panel" />;
  },
}));

vi.mock('@/components/ui/ai-prompt-box', () => ({
  PromptInputBox: () => <div data-testid="prompt-input-box" />,
}));

beforeAll(() => {
  if (!window.HTMLElement.prototype.scrollTo) {
    window.HTMLElement.prototype.scrollTo = () => {};
  }
});

describe('ChatConversationPage revisit flow', () => {
  beforeEach(() => {
    mockRouter();
    mockParams({ conversation_id: 'conversation-revisit' });
    mockUseEnrichment.mockReset();
    mockUseEnrichment.mockReturnValue({
      status: 'pending',
      retry: vi.fn(),
      progress: {
        enrichment: 'loading',
        zones: 'loading',
        municipality: 'loading',
        city: 'loading',
        zoning: 'loading',
        zone: 'loading',
        document: 'loading',
        map: 'loading',
      },
      data: {},
    });
    rightPanelProps = null;
  });

  function renderConversationPage() {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ChatConversationPage params={{ conversation_id: 'conversation-revisit' }} />
      </QueryClientProvider>
    );
  }

  it('does not render breadcrumb header until a project exists', async () => {
    const lightweightConversation = createMockV2Conversation({
      id: 'conversation-revisit',
      project_id: null,
    });

    server.use(
      http.get('*/rest/v1/v2_conversations', () => HttpResponse.json([lightweightConversation])),
      http.get('*/rest/v1/v2_messages', () => HttpResponse.json([])),
      http.get('*/rest/v1/v2_research_history', () => HttpResponse.json([]))
    );

    renderConversationPage();

    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    expect(screen.queryByTestId('conversation-breadcrumb')).toBeNull();
  });

  it('skips loading assistant message when conversation already completed', async () => {
    const completedConversation = createMockV2Conversation({
      id: 'conversation-revisit',
      project_id: 'project-123',
      enrichment_status: 'completed',
      branch_type: 'non_rnu_analysis',
      has_analysis: true,
      primary_document_id: 'doc-ua1',
      context_metadata: {
        initial_address: '12 Rue de la Liberté, Grenoble',
        geocoded: { lon: 5.7313, lat: 45.1911 },
        city: 'Grenoble',
        insee_code: '38185',
        enrichment_cache: {
          cached_at: new Date().toISOString(),
          zone_geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [5.731, 45.191],
                  [5.7317, 45.191],
                  [5.7317, 45.1913],
                  [5.731, 45.1913],
                  [5.731, 45.191],
                ],
              ],
            ],
          },
          zone_name: 'UA1',
          city_name: 'Grenoble',
          insee_code: '38185',
          has_analysis: true,
          cache_version: 1,
        },
      },
      document_metadata: {
        branch_type: 'non_rnu_analysis',
        zone_name: 'UA1',
        city_name: 'Grenoble',
        document_title: 'PLU Grenoble',
        source_plu_url: 'https://example.com/plu/grenoble',
      },
    });

    const assistantMessage = createMockV2Message({
      id: 'assistant-message-1',
      conversation_id: 'conversation-revisit',
      role: 'assistant',
      message: "Voici l'analyse concernant la zone UA1 :",
      metadata: {
        artifacts: [
          { type: 'map', artifactId: 'map-ua1' },
          { type: 'document', artifactId: 'doc-ua1' },
        ],
      },
    });

    server.use(
      http.get('*/rest/v1/v2_conversations', () => HttpResponse.json([completedConversation])),
      http.get('*/rest/v1/v2_messages', () => HttpResponse.json([assistantMessage])),
      http.get('*/rest/v1/v2_research_history', () => HttpResponse.json([]))
    );

    renderConversationPage();

    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Vérification de la zone concernée...')).toBeNull();
  });

  it('hydrates right panel tab from persisted metadata', async () => {
    const completedConversation = createMockV2Conversation({
      id: 'conversation-revisit',
      project_id: 'project-123',
      enrichment_status: 'completed',
      branch_type: 'non_rnu_analysis',
      has_analysis: true,
      primary_document_id: 'doc-ua1',
      document_metadata: {
        branch_type: 'non_rnu_analysis',
        panel_state: {
          active_tab: 'document',
        },
        artifacts: {
          document: { status: 'ready' },
        },
      },
    });

    server.use(
      http.get('*/rest/v1/v2_conversations', () => HttpResponse.json([completedConversation])),
      http.get('*/rest/v1/v2_messages', () => HttpResponse.json([])),
      http.get('*/rest/v1/v2_research_history', () => HttpResponse.json([]))
    );

    renderConversationPage();

    await waitFor(() => expect(rightPanelProps?.activeTab).toBe('document'));
  });
});

