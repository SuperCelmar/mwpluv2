import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisFoundMessage } from '@/components/AnalysisFoundMessage';
import type { UseEnrichmentReturn } from '@/app/(app)/chat/[conversation_id]/useEnrichment';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@/components/ui/text-generate-effect', () => {
  const React = require('react');
  return {
    TextGenerateEffect: ({ words, onComplete }: { words: string; onComplete?: () => void }) => {
      React.useEffect(() => {
        onComplete?.();
      }, [onComplete]);
      return <span>{words}</span>;
    },
  };
});

vi.mock('@/components/InlineArtifactCard', () => ({
  InlineArtifactCard: ({ type }: { type: string }) => <div data-testid={`inline-${type}`} />,
}));

function createEnrichmentStub(
  overrides: Partial<UseEnrichmentReturn> & {
    data?: Partial<UseEnrichmentReturn['data']> & { branchType?: string };
  } = {}
): UseEnrichmentReturn {
  return {
    status: overrides.status || 'complete',
    retry: overrides.retry || vi.fn(),
    progress: {
      enrichment: 'success',
      zones: 'success',
      municipality: 'success',
      city: 'success',
      zoning: 'success',
      zone: 'success',
      document: 'success',
      map: 'success',
      ...(overrides.progress || {}),
    },
    data: {
      documentData: overrides.data?.documentData || {
        documentId: 'doc-id',
        hasAnalysis: true,
        htmlContent: '<p>Analyse</p>',
      },
      mapGeometry: overrides.data?.mapGeometry || {},
      ...(overrides.data as Record<string, unknown>),
    },
  };
}

describe('AnalysisFoundMessage variants', () => {
  it('renders RNU copy when branch is rnu', () => {
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
      <AnalysisFoundMessage
        enrichment={enrichment}
        zoneName=""
        onViewInPanel={vi.fn()}
      />
    );

    expect(screen.getByText('Voici le RNU.')).toBeInTheDocument();
  });

  it('renders source document copy when no analysis is available', () => {
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
      <AnalysisFoundMessage
        enrichment={enrichment}
        zoneName="UA1"
        onViewInPanel={vi.fn()}
      />
    );

    expect(
      screen.getByText("Nous n'avons pas encore couvert cette zone.")
    ).toBeInTheDocument();
    expect(
      screen.getByText('Voici le lien vers le document source.')
    ).toBeInTheDocument();
  });

  it('renders analysis copy with zone name for non-RNU with analysis', () => {
    const enrichment = createEnrichmentStub({
      data: {
        branchType: 'non_rnu_analysis',
        documentData: {
          documentId: 'doc-analysis',
          hasAnalysis: true,
          htmlContent: '<p>Analyse complète</p>',
        },
      },
    });

    render(
      <AnalysisFoundMessage
        enrichment={enrichment}
        zoneName="UA1 Grenoble"
        onViewInPanel={vi.fn()}
      />
    );

    expect(
      screen.getByText("Voici l'analyse de la zone UA1 Grenoble.")
    ).toBeInTheDocument();
  });
});
