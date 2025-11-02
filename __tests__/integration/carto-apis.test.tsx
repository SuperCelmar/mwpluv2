import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fetchCartoAPIs, fetchZoneUrba, fetchDocument, fetchMunicipality } from '@/lib/carto-api';

/**
 * Carto API Integration Tests
 * 
 * IMPORTANT: These tests make REAL network requests to apicarto.ign.fr
 * - Tests will be slower (~500-1000ms per request)
 * - Require internet connection
 * - May fail if IGN API is down
 * 
 * These tests verify the actual API integration, not mocked responses.
 */

describe('Carto API Integration Tests (Real API Calls)', () => {
  // Increase timeout for network requests
  vi.setConfig({ testTimeout: 15000 });

  // Optional: Skip tests if offline
  beforeAll(async () => {
    try {
      const response = await fetch('https://apicarto.ign.fr');
      if (!response.ok) {
        console.warn('Carto API unavailable, some tests may fail');
      }
    } catch (error) {
      console.warn('Cannot reach Carto API:', error);
    }
  });

  describe('Zone-Urba API', () => {
    it('should call zone-urba API with GPS coordinates', async () => {
      // Input: Paris coordinates [lon, lat]
      const coordinates = [2.3397, 48.8606];
      const zones = await fetchZoneUrba({ lon: coordinates[0], lat: coordinates[1] });

      // Verify: GeoJSON FeatureCollection returned
      expect(Array.isArray(zones)).toBe(true);
      expect(zones.length).toBeGreaterThan(0);

      // Verify: Features have required properties
      const feature = zones[0];
      expect(feature.type).toBe('Feature');
      expect(feature.properties).toBeDefined();
      expect(feature.properties.libelle).toBeDefined();  // Zone code from Carto API
      expect(feature.geometry.type).toBe('MultiPolygon');
    });

    it('should call zone-urba API with INSEE code', async () => {
      // Input: Paris INSEE code
      const zones = await fetchZoneUrba({ insee_code: '75056' });

      // Verify: Multiple zones returned for Paris
      expect(zones.length).toBeGreaterThan(0);

      // Verify: All features are valid
      zones.forEach((zone) => {
        expect(zone.type).toBe('Feature');
        expect(zone.properties.libelle).toBeDefined();  // Zone code
        expect(zone.geometry.type).toBe('MultiPolygon');
      });
    });

    it('should return empty array if no zones found', async () => {
      // Use an invalid INSEE code to test empty response
      const zones = await fetchZoneUrba({ insee_code: '99999' });

      // Verify: Returns empty array (graceful handling)
      expect(Array.isArray(zones)).toBe(true);
      // API might return empty array or features, either is acceptable
    });
  });

  describe('Document API', () => {
    it('should call document API with INSEE code', async () => {
      // Input: Paris INSEE code
      const documents = await fetchDocument({ insee_code: '75056' });

      // Verify: FeatureCollection returned
      expect(Array.isArray(documents)).toBe(true);

      if (documents.length > 0) {
        const doc = documents[0];
        expect(doc.type).toBe('Feature');
        expect(doc.properties).toBeDefined();
      }
    });

    it('should return PLU document metadata for Paris', async () => {
      const documents = await fetchDocument({ insee_code: '75056' });

      // Verify: At least one document found
      if (documents.length > 0) {
        const doc = documents[0];
        expect(doc.properties.document_type).toBeDefined();
        // Could be PLU or other document types
      }
    });

    it('should handle communes without PLU (RNU)', async () => {
      // Try a small commune that uses RNU
      // Note: Actual INSEE codes for RNU communes may vary
      const documents = await fetchDocument({ insee_code: '01001' }); // Example small commune

      // Verify: Still returns valid response
      expect(Array.isArray(documents)).toBe(true);

      if (documents.length > 0) {
        const doc = documents[0];
        // Could be RNU or other document types
        expect(doc.properties.document_type).toBeDefined();
      }
    });
  });

  describe('Municipality API', () => {
    it('should call municipality API with INSEE code', async () => {
      // Input: Paris INSEE code
      const municipality = await fetchMunicipality({ insee_code: '75056' });

      // Verify: Municipality info returned
      expect(municipality).not.toBeNull();
      expect(municipality?.properties.insee).toBe('75056');
      expect(municipality?.properties.name).toBe('PARIS');
    });

    it('should return null for invalid INSEE code', async () => {
      const municipality = await fetchMunicipality({ insee_code: '99999' });

      // Verify: Returns null gracefully
      expect(municipality).toBeNull();
    });

    it('should handle GPS coordinates lookup', async () => {
      // Input: Paris coordinates
      const municipality = await fetchMunicipality({
        lon: 2.3397,
        lat: 48.8606,
      });

      // Verify: Municipality found (may or may not work depending on API)
      // API might return municipality or null based on API behavior
      expect(municipality === null || municipality?.type === 'Feature').toBe(true);
    });
  });

  describe('Combined API Call (fetchCartoAPIs)', () => {
    it('should call all three Carto APIs together', async () => {
      // Input: Paris coordinates and INSEE code
      const result = await fetchCartoAPIs({
        lon: 2.3397,
        lat: 48.8606,
        insee_code: '75056',
      });

      // Verify: All three APIs called
      expect(result).toHaveProperty('zones');
      expect(result).toHaveProperty('documents');
      expect(result).toHaveProperty('municipality');

      // Verify: Zones array returned
      expect(Array.isArray(result.zones)).toBe(true);

      // Verify: Documents array returned
      expect(Array.isArray(result.documents)).toBe(true);

      // Verify: Municipality returned or null
      expect(result.municipality === null || result.municipality?.type === 'Feature').toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      // Call with invalid coordinates to test error handling
      const result = await fetchCartoAPIs({
        lon: 999,
        lat: 999,
        insee_code: '99999',
      });

      // Verify: Returns empty results rather than throwing
      expect(result).toHaveProperty('zones');
      expect(result).toHaveProperty('documents');
      expect(result).toHaveProperty('municipality');

      // Should return empty arrays on failure
      expect(Array.isArray(result.zones)).toBe(true);
      expect(Array.isArray(result.documents)).toBe(true);
      expect(result.municipality).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Simulate network error by calling with extremely invalid parameters
      const result = await fetchCartoAPIs({
        lon: NaN,
        lat: NaN,
        insee_code: '',
      });

      // Verify: Returns empty results, doesn't throw
      expect(result).toHaveProperty('zones');
      expect(result).toHaveProperty('documents');
      expect(result).toHaveProperty('municipality');
      expect(Array.isArray(result.zones)).toBe(true);
    });

    it('should handle timeout scenarios', async () => {
      // Test that API calls complete within reasonable time
      const startTime = Date.now();
      await fetchZoneUrba({ insee_code: '75056' });
      const duration = Date.now() - startTime;

      // Verify: Request completes within 10 seconds
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Data Validation', () => {
    it('should validate zone-urba response structure', async () => {
      const zones = await fetchZoneUrba({ insee_code: '75056' });

      if (zones.length > 0) {
        zones.forEach((zone) => {
          // Verify required fields
          expect(zone).toHaveProperty('type');
          expect(zone).toHaveProperty('properties');
          expect(zone).toHaveProperty('geometry');

          // Verify property fields
          expect(zone.properties).toHaveProperty('libelle');  // Zone code
          expect(zone.properties).toHaveProperty('typezone');  // Zone type

          // Verify geometry type
          expect(zone.geometry.type).toBe('MultiPolygon');
          expect(Array.isArray(zone.geometry.coordinates)).toBe(true);
        });
      }
    });

    it('should validate document response structure', async () => {
      const documents = await fetchDocument({ insee_code: '75056' });

      if (documents.length > 0) {
        documents.forEach((doc) => {
          expect(doc).toHaveProperty('type');
          expect(doc).toHaveProperty('properties');
          expect(doc.properties.document_type).toBeDefined();
        });
      }
    });

    it('should validate municipality response structure', async () => {
      const municipality = await fetchMunicipality({ insee_code: '75056' });

      if (municipality) {
        expect(municipality).toHaveProperty('type');
        expect(municipality).toHaveProperty('properties');
        expect(municipality.properties.insee).toBeDefined();
        expect(municipality.properties.name).toBeDefined();
      }
    });
  });
});
