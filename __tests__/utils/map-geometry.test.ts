import { describe, it, expect } from 'vitest';
import {
  geometryToLeafletPolygons,
  buildBoundsFromPolygons,
} from '@/lib/utils/mapGeometry';

describe('geometryToLeafletPolygons', () => {
  it('returns empty array when geometry is missing', () => {
    expect(geometryToLeafletPolygons(undefined)).toEqual([]);
    expect(geometryToLeafletPolygons(null)).toEqual([]);
  });

  it('converts Polygon coordinates to Leaflet format', () => {
    const polygonGeometry = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [2.0, 48.0],
          [2.1, 48.0],
          [2.1, 48.1],
          [2.0, 48.1],
          [2.0, 48.0],
        ],
      ],
    };

    const result = geometryToLeafletPolygons(polygonGeometry);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toEqual([48.0, 2.0]);
    expect(result[0][2]).toEqual([48.1, 2.1]);
  });

  it('merges all rings from MultiPolygon geometries', () => {
    const multiPolygonGeometry = {
      type: 'MultiPolygon' as const,
      coordinates: [
        [
          [
            [1.0, 45.0],
            [1.2, 45.0],
            [1.2, 45.2],
            [1.0, 45.2],
            [1.0, 45.0],
          ],
        ],
        [
          [
            [3.0, 46.0],
            [3.3, 46.0],
            [3.3, 46.3],
            [3.0, 46.3],
            [3.0, 46.0],
          ],
        ],
      ],
    };

    const result = geometryToLeafletPolygons(multiPolygonGeometry);
    expect(result).toHaveLength(2);
    expect(result[0][0]).toEqual([45.0, 1.0]);
    expect(result[1][1]).toEqual([46.0, 3.3]);
  });

  it('builds bounds array including the map center', () => {
    const polygons = geometryToLeafletPolygons({
      type: 'Polygon',
      coordinates: [
        [
          [6.0, 44.0],
          [6.2, 44.0],
          [6.2, 44.2],
          [6.0, 44.2],
          [6.0, 44.0],
        ],
      ],
    });

    const bounds = buildBoundsFromPolygons(polygons, { lat: 43.9, lon: 5.9 });
    expect(bounds[0]).toEqual([43.9, 5.9]);
    expect(bounds).toHaveLength(polygons[0].length + 1);
  });
});


