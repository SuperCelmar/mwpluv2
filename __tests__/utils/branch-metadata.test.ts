import { describe, it, expect } from 'vitest';
import {
  formatBranchBadge,
  buildDuplicateHintMessage,
  buildDocumentMetadataPayload,
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

    expect(payload).toEqual({
      branch_type: 'non_rnu_analysis',
      document_id: 'doc-123',
      zone_code: 'UA1',
      zone_name: 'Centre ancien',
      city_name: 'Paris',
      source_plu_url: 'https://example.com/plu.pdf',
      map_geometry_available: true,
      enriched_at: '2025-01-15T12:00:00.000Z',
    });
  });
});

