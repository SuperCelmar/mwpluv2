import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  TEST_USER_ID,
} from '@/__tests__/utils/test-helpers';
import type { UseEnrichmentReturn } from '@/app/(app)/chat/[conversation_id]/useEnrichment';
import type { ConversationBranch } from '@/types/enrichment';

const mockUseEnrichment = vi.fn<[], UseEnrichmentReturn>();
let promptBoxProps: any = null;

vi.mock('@/app/(app)/chat/[conversation_id]/useEnrichment', () => ({
  useEnrichment: (...args: any[]) => mockUseEnrichment(...(args as [])),
}));

vi.mock('@/components/ui/ai-prompt-box', () => ({
  PromptInputBox: (props: any) => {
    promptBoxProps = props;
    return <div data-testid="prompt-input-box" />;
  },
}));

vi.mock('@/components/ChatRightPanel', () => ({
  ChatRightPanel: () => <div data-testid="right-panel" />,
}));

function buildEnrichmentBranch(branchType: ConversationBranch, overrides: Partial<UseEnrichmentReturn['data']> = {}): UseEnrichmentReturn {
  return {
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
      branchType,
      documentData: {
        documentId: `${branchType}-doc`,
        htmlContent: branchType === 'non_rnu_analysis' ? '<p>Analyse</p>' : null,
        hasAnalysis: branchType === 'non_rnu_analysis',
      },
      mapGeometry: { type: 'Point', coordinates: [0, 0] },
      ...overrides,
    },
  };
}

describe('ChatConversationPage branch-driven states', () => {
  beforeEach(() => {
    mockUseEnrichment.mockReset();
    promptBoxProps = null;
    mockRouter();
    mockParams({ conversation_id: 'conversation-branch' });

    const baseConversation = createMockV2Conversation({
      id: 'conversation-branch',
      project_id: 'project-branch',
      enrichment_status: 'pending',
      context_metadata: {
        initial_address: 'Test Address',
        geocoded: { lon: 2.3, lat: 48.85 },
        city: 'Paris',
        insee_code: '75056',
      },
    });

    const baseResearch = createMockV2ResearchHistory({
      conversation_id: 'conversation-branch',
      user_id: TEST_USER_ID,
    });

    server.use(
      http.get('*/rest/v1/v2_conversations', () => HttpResponse.json([baseConversation])),
      http.get('*/rest/v1/v2_messages', () => HttpResponse.json([])),
      http.get('*/rest/v1/v2_research_history', () => HttpResponse.json([baseResearch]))
    );
  });

  function renderPage() {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ChatConversationPage params={{ conversation_id: 'conversation-branch' }} />
      </QueryClientProvider>
    );
  }

  it('keeps chat enabled for RNU branch', async () => {
    mockUseEnrichment.mockReturnValue(buildEnrichmentBranch('rnu'));

    renderPage();

    await waitFor(() => expect(promptBoxProps).not.toBeNull());
    expect(promptBoxProps?.disabled).toBeFalsy();
    expect(promptBoxProps?.disabledTooltip).toBeUndefined();
  });

  it('disables chat input with tooltip when only source document exists', async () => {
    mockUseEnrichment.mockReturnValue(buildEnrichmentBranch('non_rnu_source'));

    renderPage();

    await waitFor(() => expect(promptBoxProps).not.toBeNull());
    expect(promptBoxProps?.disabled).toBe(true);
    expect(promptBoxProps?.disabledTooltip).toBe('Impossible de discuter avec ce document.');
  });

  it('enables chat input when analysis is available', async () => {
    mockUseEnrichment.mockReturnValue(buildEnrichmentBranch('non_rnu_analysis'));

    renderPage();

    await waitFor(() => expect(promptBoxProps).not.toBeNull());
    expect(promptBoxProps?.disabled).toBeFalsy();
  });

  it('uses persisted branch metadata when enrichment hook has no branch data', async () => {
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
    } as UseEnrichmentReturn);

    const persistedConversation = createMockV2Conversation({
      id: 'conversation-branch',
      project_id: 'project-branch',
      branch_type: 'non_rnu_source',
      has_analysis: false,
    });

    server.use(
      http.get('*/rest/v1/v2_conversations', () => HttpResponse.json([persistedConversation])),
      http.get('*/rest/v1/v2_messages', () => HttpResponse.json([])),
      http.get('*/rest/v1/v2_research_history', () => HttpResponse.json([]))
    );

    renderPage();

    await waitFor(() => expect(promptBoxProps).not.toBeNull());
    expect(promptBoxProps?.disabled).toBe(true);
    expect(promptBoxProps?.disabledTooltip).toBe('Impossible de discuter avec ce document.');
  });

  it('falls back to research history branch metadata when conversation branch is pending', async () => {
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
    } as UseEnrichmentReturn);

    const researchEntry = createMockV2ResearchHistory({
      conversation_id: 'conversation-branch',
      branch_type: 'non_rnu_source',
      has_analysis: false,
    });

    const pendingConversation = createMockV2Conversation({
      id: 'conversation-branch',
      project_id: 'project-branch',
      branch_type: 'pending',
    });

    server.use(
      http.get('*/rest/v1/v2_conversations', () => HttpResponse.json([pendingConversation])),
      http.get('*/rest/v1/v2_messages', () => HttpResponse.json([])),
      http.get('*/rest/v1/v2_research_history', () => HttpResponse.json([researchEntry]))
    );

    renderPage();

    await waitFor(() => expect(promptBoxProps).not.toBeNull());
    expect(promptBoxProps?.disabled).toBe(true);
    expect(promptBoxProps?.disabledTooltip).toBe('Impossible de discuter avec ce document.');
  });

  it('prefers document metadata branch type when conversation branch is pending', async () => {
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
    } as UseEnrichmentReturn);

    const conversationWithMetadata = createMockV2Conversation({
      id: 'conversation-branch',
      project_id: 'project-branch',
      branch_type: 'pending',
      document_metadata: {
        branch_type: 'non_rnu_analysis',
        panel_state: { active_tab: 'document' },
      },
      has_analysis: true,
    });

    server.use(
      http.get('*/rest/v1/v2_conversations', () => HttpResponse.json([conversationWithMetadata])),
      http.get('*/rest/v1/v2_messages', () => HttpResponse.json([])),
      http.get('*/rest/v1/v2_research_history', () => HttpResponse.json([]))
    );

    renderPage();

    await waitFor(() => expect(promptBoxProps).not.toBeNull());
    expect(promptBoxProps?.disabled).toBeFalsy();
    expect(promptBoxProps?.disabledTooltip).toBeUndefined();
  });
});
