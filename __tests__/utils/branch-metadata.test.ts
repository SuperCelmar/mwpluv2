import { describe, it, expect } from 'vitest';
import {
  formatBranchBadge,
  buildDuplicateHintMessage,
  buildDocumentMetadataPayload,
  getBranchLoadingMessages,
  getFinalAssistantCopy,
  resolvePanelState,
} from '@/lib/utils/branchMetadata';

describe('formatBranchBadge', () => {
  it('returns Branche RNU for rnu branch', () => {
    expect(formatBranchBadge({ branchType: 'rnu', hasAnalysis: false, isRnu: true })).toBe('Branche RNU');
  });

  it('returns analyse label for analysis branch', () => {
    expect(
      formatBranchBadge({ branchType: 'non_rnu_analysis', hasAnalysis: true, isRnu: false })
    ).toBe('Branche Analyse disponible');
  });

  it('returns source label when no analysis exists', () => {
    expect(
      formatBranchBadge({ branchType: 'non_rnu_source', hasAnalysis: false, isRnu: false })
    ).toBe('Branche Document source');
  });
});

describe('buildDuplicateHintMessage', () => {
  it('mentions branch badge and zone when available', () => {
    const hint = buildDuplicateHintMessage({
      addressLabel: '15 Rue des Fustiers, Paris',
      branchType: 'rnu',
      hasAnalysis: false,
      isRnu: true,
      zoneName: 'UA1',
      lastUpdatedAt: '2025-01-15T12:00:00Z',
    });

    expect(hint.title).toContain('Analyse existante');
    expect(hint.subtitle).toContain('Branche RNU');
    expect(hint.subtitle).toContain('UA1');
  });
});

describe('buildDocumentMetadataPayload', () => {
  it('returns structured metadata with branch type and zone info', () => {
    const payload = buildDocumentMetadataPayload({
      branchType: 'non_rnu_analysis',
      documentId: 'doc-123',
      zoneCode: 'UA1',
      zoneName: 'Centre ancien',
      cityName: 'Paris',
      sourceUrl: 'https://example.com/plu.pdf',
      mapGeometryAvailable: true,
      timestamp: '2025-01-15T12:00:00.000Z',
    });

    expect(payload).toMatchObject({
      branch_type: 'non_rnu_analysis',
      document_id: 'doc-123',
      zone_code: 'UA1',
      zone_name: 'Centre ancien',
      city_name: 'Paris',
      source_plu_url: 'https://example.com/plu.pdf',
      map_geometry_available: true,
      enriched_at: '2025-01-15T12:00:00.000Z',
      artifacts: {
        map: { status: 'ready' },
        document: { status: 'ready' },
      },
    });
    expect(payload).toHaveProperty('artifacts.map.updated_at');
  });
});

describe('getBranchLoadingMessages', () => {
  it('omits step 3 for RNU branch', () => {
    const steps = getBranchLoadingMessages({ branchType: 'rnu' });
    expect(steps.step1).toBe('Vérification de la zone concernée...');
    expect(steps.step2).toBe('Récupération du RNU...');
    expect(steps.step3).toBeUndefined();
  });

  it('returns analysis step 3 for non-RNU analysis branch', () => {
    const steps = getBranchLoadingMessages({ branchType: 'non_rnu_analysis' });
    expect(steps.step2).toBe("Vérification de la présence d'analyse...");
    expect(steps.step3).toBe("Récupération de l'analyse correspondante...");
  });
});

describe('getFinalAssistantCopy', () => {
  it('returns RNU copy without zone name', () => {
    const copy = getFinalAssistantCopy({ branchType: 'rnu' });
    expect(copy.title).toBe('Voici le RNU.');
    expect(copy.description).toBeUndefined();
  });

  it('returns analysis copy with zone name when provided', () => {
    const copy = getFinalAssistantCopy({
      branchType: 'non_rnu_analysis',
      zoneName: 'UA1 Grenoble',
    });
    expect(copy.title).toBe("Voici l'analyse de la zone UA1 Grenoble.");
  });

  it('returns source copy mentioning source document link', () => {
    const copy = getFinalAssistantCopy({
      branchType: 'non_rnu_source',
    });
    expect(copy.title).toContain("Nous n'avons pas encore couvert cette zone");
    expect(copy.description).toContain('document source');
  });
});

describe('resolvePanelState', () => {
  it('returns persisted active tab when metadata contains panel state', () => {
    const state = resolvePanelState({
      panel_state: { active_tab: 'document' },
      branch_type: 'non_rnu_analysis',
    });

    expect(state.activeTab).toBe('document');
  });

  it('defaults to map tab when metadata missing and document not ready', () => {
    const state = resolvePanelState({
      branch_type: 'non_rnu_source',
    });
    expect(state.activeTab).toBe('map');
  });

  it('defaults to document tab when analysis branch is ready and metadata absent', () => {
    const state = resolvePanelState({
      branch_type: 'non_rnu_analysis',
      artifacts: {
        document: { status: 'ready' },
      },
    });
    expect(state.activeTab).toBe('document');
  });
});

