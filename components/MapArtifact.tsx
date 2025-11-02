'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';

// Dynamically import MapContainer to avoid SSR issues with Leaflet
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), {
  ssr: false
});

const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), {
  ssr: false
});

const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), {
  ssr: false
});

const Polygon = dynamic(() => import('react-leaflet').then(mod => mod.Polygon), {
  ssr: false
});

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

interface MapArtifactProps {
  lat: number;
  lon: number;
  zoneGeometry?: any;
  isLoading?: boolean;
}

// Fix for default marker icon issue in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

/**
 * Convert GeoJSON coordinates to Leaflet LatLng format
 * GeoJSON uses [lon, lat] while Leaflet expects [lat, lon]
 */
function convertGeoJSONToLeaflet(coords: any[][]): [number, number][][] {
  if (!coords || coords.length === 0) return [];
  
  return coords.map(polygon => 
    polygon.map(([lon, lat]) => [lat, lon] as [number, number])
  );
}

export function MapArtifact({ lat, lon, zoneGeometry, isLoading }: MapArtifactProps) {
  const mapRef = useRef<any>(null);

  useEffect(() => {
    console.log('[MAP_ARTIFACT] Component mounted:', { lat, lon, hasGeometry: !!zoneGeometry, isLoading });
  }, [lat, lon, zoneGeometry, isLoading]);

  // Calculate map bounds to include both the marker and the zone polygon
  const getBounds = () => {
    const bounds: [number, number][] = [[lat, lon]];
    
    if (zoneGeometry && zoneGeometry.type === 'MultiPolygon' && zoneGeometry.coordinates) {
      zoneGeometry.coordinates.forEach((polygon: any[][][]) => {
        polygon.forEach((ring: any[][]) => {
          ring.forEach(([lonCoord, latCoord]: any[]) => {
            bounds.push([latCoord, lonCoord]);
          });
        });
      });
    }
    
    return bounds;
  };

  const leafletCoords = zoneGeometry && zoneGeometry.type === 'MultiPolygon' 
    ? convertGeoJSONToLeaflet(zoneGeometry.coordinates[0] || [])
    : [];

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border">
        <div className="text-center space-y-4 p-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Chargement de la carte...</h3>
            <p className="text-sm text-gray-600">
              Préparation de la visualisation
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!lat || !lon) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border">
        <div className="text-center space-y-4 p-8">
          <div className="text-gray-400 text-lg">⚠️</div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Coordonnées manquantes</h3>
            <p className="text-sm text-gray-600">
              Impossible de charger la carte
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-lg border overflow-hidden">
      <MapContainer
        center={[lat, lon]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map) => {
          console.log('[MAP_ARTIFACT] Map created successfully');
          mapRef.current = map;
          
          // Fit bounds to include both marker and polygon
          if (leafletCoords.length > 0) {
            setTimeout(() => {
              const bounds = getBounds();
              map.fitBounds(bounds as any, { padding: [20, 20] });
              console.log('[MAP_ARTIFACT] Map bounds adjusted to include zone');
            }, 100);
          }
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Address marker */}
        <Marker position={[lat, lon]}>
          {/* You can add a popup here if needed */}
        </Marker>

        {/* Zone polygon highlight */}
        {leafletCoords.length > 0 && leafletCoords.map((polygonCoords, index) => (
          <Polygon
            key={index}
            positions={polygonCoords}
            pathOptions={{
              color: '#3B82F6',
              fillColor: '#93C5FD',
              fillOpacity: 0.3,
              weight: 3,
              opacity: 0.8,
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}

