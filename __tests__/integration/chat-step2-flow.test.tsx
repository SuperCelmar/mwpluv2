import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

import ChatConversationPage from '@/app/(app)/chat/[conversation_id]/page';
import { server } from '@/__tests__/mocks/server';
import {
  mockRouter,
  mockParams,
  createMockV2Conversation,
  createMockV2ResearchHistory,
} from '@/__tests__/utils/test-helpers';
import type { UseEnrichmentReturn } from '@/app/(app)/chat/[conversation_id]/useEnrichment';
import type { ConversationBranch } from '@/types/enrichment';

const mockUseEnrichment = vi.fn<[], UseEnrichmentReturn>();

vi.mock('@/app/(app)/chat/[conversation_id]/useEnrichment', () => ({
  useEnrichment: (...args: any[]) => mockUseEnrichment(...(args as [])),
}));

let documentRendered = false;

const artifactSyncStub = {
  artifacts: {
    zone: null,
    map: { status: 'ready', renderingStatus: 'complete', data: null },
    document: null,
  },
  activeTab: 'map',
  setActiveTab: vi.fn(),
  updateArtifact: vi.fn(),
  openArtifactInPanel: vi.fn((type: 'zone' | 'map' | 'document') => (type === 'zone' ? 'map' : type)),
  resetArtifacts: vi.fn(),
  isArtifactRendered: (type: 'zone' | 'map' | 'document') => {
    if (type === 'map') return true;
    if (type === 'document') return documentRendered;
    return false;
  },
};

vi.mock('@/lib/hooks/useArtifactSync', () => ({
  useArtifactSync: () => artifactSyncStub,
}));

vi.mock('@/components/ChatRightPanel', () => ({
  ChatRightPanel: () => <div data-testid="right-panel" />,
}));

vi.mock('@/components/ui/ai-prompt-box', () => ({
  PromptInputBox: () => <div data-testid="prompt-input-box" />,
}));

function createEnrichmentState(branchType: ConversationBranch, overrides: Partial<UseEnrichmentReturn['data']> = {}) {
  return {
    status: 'enriching',
    retry: vi.fn(),
    progress: {
      enrichment: 'loading',
      zones: 'success',
      municipality: 'success',
      city: 'success',
      zoning: 'success',
      zone: 'success',
      document: 'success',
      map: 'success',
    },
    data: {
      branchType,
      documentData: {
        documentId: `${branchType}-doc`,
        hasAnalysis: branchType === 'non_rnu_analysis',
        htmlContent: null,
      },
      mapGeometry: { type: 'Point', coordinates: [2.3, 48.85] },
      ...overrides,
    },
  } as UseEnrichmentReturn;
}

function renderConversationPage() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <ChatConversationPage params={{ conversation_id: 'conversation-step2' }} />
    </QueryClientProvider>
  );
}

describe('ChatConversationPage Step 2 loading flows', () => {
  beforeAll(() => {
    if (!window.HTMLElement.prototype.scrollTo) {
      window.HTMLElement.prototype.scrollTo = () => {};
    }
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    documentRendered = false;
    artifactSyncStub.setActiveTab.mockClear();
    artifactSyncStub.updateArtifact.mockClear();
    artifactSyncStub.openArtifactInPanel.mockClear();
    artifactSyncStub.resetArtifacts.mockClear();
    mockUseEnrichment.mockReset();
    mockRouter();
    mockParams({ conversation_id: 'conversation-step2' });

    const baseConversation = createMockV2Conversation({
      id: 'conversation-step2',
      enrichment_status: 'in_progress',
    });

    const baseResearch = createMockV2ResearchHistory({
      conversation_id: 'conversation-step2',
    });

    server.use(
      http.get('*/rest/v1/v2_conversations', () => HttpResponse.json([baseConversation])),
      http.get('*/rest/v1/v2_messages', () => HttpResponse.json([])),
      http.get('*/rest/v1/v2_research_history', () => HttpResponse.json([baseResearch]))
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows Step 2 RNU copy when enrichment branch is rnu', async () => {
    mockUseEnrichment.mockReturnValue(createEnrichmentState('rnu'));

    renderConversationPage();

    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Vérification de la zone concernée...')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    await waitFor(() => {
      expect(screen.getByText('Récupération du RNU...')).toBeInTheDocument();
    });
  });

  it('shows Step 2 non-RNU analysis copy when enrichment branch has analysis', async () => {
    mockUseEnrichment.mockReturnValue(createEnrichmentState('non_rnu_analysis'));

    renderConversationPage();

    await waitFor(() => {
      expect(screen.queryByText(/Chargement de la conversation/)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Vérification de la zone concernée...')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    await waitFor(() => {
      expect(screen.getByText("Vérification de la présence d'analyse...")).toBeInTheDocument();
    });
  });
});

