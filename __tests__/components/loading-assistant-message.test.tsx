import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LoadingAssistantMessage } from '@/components/LoadingAssistantMessage';
import type { UseEnrichmentReturn } from '@/app/(app)/chat/[conversation_id]/useEnrichment';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

type BranchType = 'rnu' | 'non_rnu_analysis' | 'non_rnu_source';

function createEnrichmentStub(
  overrides: Partial<UseEnrichmentReturn> & {
    data?: Partial<UseEnrichmentReturn['data']> & {
      branchType?: BranchType;
    };
  } = {}
): UseEnrichmentReturn {
  return {
    status: overrides.status || 'enriching',
    retry: overrides.retry || vi.fn(),
    progress: {
      enrichment: 'loading',
      zones: 'loading',
      municipality: 'loading',
      city: 'loading',
      zoning: 'loading',
      zone: 'loading',
      document: 'loading',
      map: 'loading',
      ...(overrides.progress || {}),
    },
    data: {
      documentData: overrides.data?.documentData || null,
      mapGeometry: overrides.data?.mapGeometry || null,
      ...(overrides.data as Record<string, unknown>),
    },
  };
}

describe('LoadingAssistantMessage branching copy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows RNU copy on step 2 when branch is rnu', () => {
    const enrichment = createEnrichmentStub({
      data: {
        branchType: 'rnu',
        documentData: {
          documentId: 'doc-rnu',
          hasAnalysis: false,
          htmlContent: null,
        },
      },
    });

    render(
      <LoadingAssistantMessage
        enrichment={enrichment}
        isMapRendered
        isDocumentRendered={false}
      />
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.getByText('Récupération du RNU...')).toBeInTheDocument();
  });

  it('shows non-RNU analysis copy and reaches step 3 when analysis exists', () => {
    const enrichment = createEnrichmentStub({
      data: {
        branchType: 'non_rnu_analysis',
        documentData: {
          documentId: 'doc-analysis',
          hasAnalysis: true,
          htmlContent: '<p>Analyse prête</p>',
        },
      },
    });

    render(
      <LoadingAssistantMessage
        enrichment={enrichment}
        isMapRendered
        isDocumentRendered
      />
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(
      screen.getByText('Vérification de la présence d\'analyse...')
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(
      screen.getByText('Récupération de l\'analyse correspondante...')
    ).toBeInTheDocument();
  });

  it('never shows step 3 when branch is non-RNU without analysis', () => {
    const enrichment = createEnrichmentStub({
      data: {
        branchType: 'non_rnu_source',
        documentData: {
          documentId: 'doc-source',
          hasAnalysis: false,
          htmlContent: null,
        },
      },
    });

    render(
      <LoadingAssistantMessage
        enrichment={enrichment}
        isMapRendered
        isDocumentRendered={false}
      />
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(
      screen.getByText('Vérification de la présence d\'analyse...')
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.queryByText('Récupération de l\'analyse correspondante...')
    ).not.toBeInTheDocument();
  });
});
