import { describe, it, expect } from 'vitest';
import { fetchCartoAPIs, fetchZoneUrba, fetchDocument, fetchMunicipality } from '@/lib/carto-api';

/**
 * Carto API client tests
 *
 * These tests run against MSW stubs (see __tests__/mocks/handlers.ts) so we can
 * validate the request plumbing without streaming the real IGN payloads.
 */

describe('Carto API client (MSW mocked)', () => {
  it('fetches zone data via zone-urba endpoint', async () => {
    const zones = await fetchZoneUrba({ lon: 2.3397, lat: 48.8606 });
    expect(Array.isArray(zones)).toBe(true);
    expect(zones).not.toHaveLength(0);
    expect(zones[0].properties.libelle).toBeDefined();
    expect(zones[0].geometry.type).toBe('MultiPolygon');
  });

  it('fetches PLU document metadata by INSEE code', async () => {
    const documents = await fetchDocument({ insee_code: '75056' });
    expect(Array.isArray(documents)).toBe(true);
    expect(documents[0].properties.document_type).toBe('PLU');
    expect(documents[0].properties.document_url).toContain('75056');
  });

  it('fetches RNU document metadata for RNU communes', async () => {
    const documents = await fetchDocument({ insee_code: '01001' });
    expect(documents[0].properties.document_type).toBe('RNU');
  });

  it('fetches municipality metadata', async () => {
    const municipality = await fetchMunicipality({ insee_code: '75056' });
    expect(municipality).not.toBeNull();
    expect(municipality?.properties.insee).toBe('75056');
    expect(municipality?.properties.name).toBeDefined();
    expect(municipality?.properties.is_rnu).toBe(false);
  });

  it('aggregates all APIs via fetchCartoAPIs', async () => {
    const result = await fetchCartoAPIs({
      lon: 2.3397,
      lat: 48.8606,
      insee_code: '75056',
    });

    expect(Array.isArray(result.zones)).toBe(true);
    expect(Array.isArray(result.documents)).toBe(true);
    expect(result.municipality?.properties.insee).toBe('75056');
  });
});
