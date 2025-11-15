export type PolygonGeometry = {
  type: 'Polygon';
  coordinates?: number[][][];
};

export type MultiPolygonGeometry = {
  type: 'MultiPolygon';
  coordinates?: number[][][][];
};

export type SupportedGeometry =
  | PolygonGeometry
  | MultiPolygonGeometry
  | null
  | undefined;

export type LeafletPolygon = [number, number][];

const isPolygon = (geometry: SupportedGeometry): geometry is PolygonGeometry =>
  !!geometry && geometry.type === 'Polygon';

const isMultiPolygon = (
  geometry: SupportedGeometry
): geometry is MultiPolygonGeometry =>
  !!geometry && geometry.type === 'MultiPolygon';

function convertRingToLeaflet(ring: number[][]): LeafletPolygon {
  if (!Array.isArray(ring) || ring.length === 0) {
    return [];
  }

  return ring
    .filter((coords) => Array.isArray(coords) && coords.length >= 2)
    .map(([lon, lat]) => [lat, lon]);
}

function convertPolygonToLeaflet(polygon: number[][][]): LeafletPolygon[] {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    return [];
  }

  return polygon
    .map((ring) => convertRingToLeaflet(ring))
    .filter((ring) => ring.length > 0);
}

/**
 * Convert GeoJSON geometry to Leaflet-friendly polygon coordinates.
 * Supports both Polygon and MultiPolygon, including multiple rings/holes.
 */
export function geometryToLeafletPolygons(
  geometry: SupportedGeometry
): LeafletPolygon[] {
  if (!geometry || !geometry.coordinates) {
    return [];
  }

  if (isPolygon(geometry)) {
    return convertPolygonToLeaflet(geometry.coordinates);
  }

  if (isMultiPolygon(geometry)) {
    return geometry.coordinates.flatMap((polygon) =>
      convertPolygonToLeaflet(polygon)
    );
  }

  return [];
}

/**
 * Build bounds array ([lat, lon]) for Leaflet fitBounds using polygons and optional center.
 */
export function buildBoundsFromPolygons(
  polygons: LeafletPolygon[],
  center?: { lat: number; lon: number }
): [number, number][] {
  const bounds: [number, number][] = [];

  if (center) {
    bounds.push([center.lat, center.lon]);
  }

  polygons.forEach((ring) => {
    ring.forEach((coords) => {
      bounds.push(coords);
    });
  });

  return bounds;
}



