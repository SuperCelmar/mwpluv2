'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import {
  geometryToLeafletPolygons,
  type SupportedGeometry,
  buildBoundsFromPolygons,
} from '@/lib/utils/mapGeometry';

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
  onRenderComplete?: () => void;
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

export function MapArtifact({ lat, lon, zoneGeometry, isLoading, onRenderComplete }: MapArtifactProps) {
  const mapRef = useRef<any>(null);
  const [mapCreated, setMapCreated] = useState(false);
  const [markerRendered, setMarkerRendered] = useState(false);
  const [polygonRendered, setPolygonRendered] = useState(false);
  const [shouldRenderPolygon, setShouldRenderPolygon] = useState(false);
  const renderCompleteCalled = useRef(false);
  const polygonDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const supportedGeometry = zoneGeometry as SupportedGeometry;
  const leafletPolygons = useMemo(
    () => geometryToLeafletPolygons(supportedGeometry),
    [supportedGeometry]
  );

  useEffect(() => {
    console.log('[MAP_ARTIFACT] Component mounted:', { lat, lon, hasGeometry: !!zoneGeometry, isLoading });
  }, [lat, lon, zoneGeometry, isLoading]);

  // Reset polygon rendered state when geometry changes
  useEffect(() => {
    setPolygonRendered(false);
    setShouldRenderPolygon(false);
    renderCompleteCalled.current = false; // Allow callback to be called again when geometry changes
    
    // Clear any existing timeout
    if (polygonDelayTimeoutRef.current) {
      clearTimeout(polygonDelayTimeoutRef.current);
      polygonDelayTimeoutRef.current = null;
    }
  }, [leafletPolygons]);

  // Delay polygon rendering by 1-2 seconds after map and marker are ready
  useEffect(() => {
    const hasGeometry = leafletPolygons.length > 0;
    
    console.log('[MAP_ARTIFACT] Polygon delay check:', {
      mapCreated,
      markerRendered,
      hasGeometry,
      coordsLength: leafletPolygons.length,
      shouldRenderPolygon,
      zoneGeometryType: zoneGeometry?.type,
      coordinatesExist: !!zoneGeometry?.coordinates
    });
    
    if (mapCreated && markerRendered && hasGeometry && !shouldRenderPolygon) {
      // Random delay between 1-2 seconds (1500ms average)
      const delay = 1000 + Math.random() * 1000;
      console.log(`[MAP_ARTIFACT] Scheduling polygon render after ${delay}ms delay`);
      
      polygonDelayTimeoutRef.current = setTimeout(() => {
        console.log('[MAP_ARTIFACT] Delay complete, rendering polygon');
        setShouldRenderPolygon(true);
      }, delay);
    }

    return () => {
      if (polygonDelayTimeoutRef.current) {
        clearTimeout(polygonDelayTimeoutRef.current);
        polygonDelayTimeoutRef.current = null;
      }
    };
  }, [mapCreated, markerRendered, shouldRenderPolygon, leafletPolygons, zoneGeometry]);

  // Helper function to calculate map bounds
  const getBounds = () => {
    const bounds: [number, number][] = [[lat, lon]];
    
    if (leafletPolygons.length > 0) {
      const polygonBounds = buildBoundsFromPolygons(leafletPolygons);
      bounds.push(...polygonBounds);
    }
    
    return bounds;
  };

  // Re-render map bounds after polygon is rendered
  useEffect(() => {
    if (polygonRendered && mapRef.current && leafletPolygons.length > 0) {
      setTimeout(() => {
        const bounds = getBounds();
        mapRef.current.fitBounds(bounds as any, { padding: [20, 20] });
        console.log('[MAP_ARTIFACT] Map bounds re-adjusted after polygon render');
      }, 100);
    }
  }, [polygonRendered, leafletPolygons, lat, lon]);

  // Track rendering completion
  useEffect(() => {
    if (isLoading || !lat || !lon) {
      return;
    }

    const hasGeometry = leafletPolygons.length > 0;
    const needsPolygon = hasGeometry;
    
    // Check if all required elements are rendered
    const allRendered = mapCreated && markerRendered && (!needsPolygon || polygonRendered);
    
    if (allRendered && onRenderComplete && !renderCompleteCalled.current) {
      // Small delay to ensure visual rendering is complete
      setTimeout(() => {
        console.log('[MAP_ARTIFACT] Rendering complete, calling onRenderComplete');
        renderCompleteCalled.current = true;
        onRenderComplete();
      }, 150);
    }
  }, [mapCreated, markerRendered, polygonRendered, leafletPolygons, isLoading, lat, lon, onRenderComplete]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
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
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
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
    <div className="w-full h-full flex-1 overflow-hidden">
      <MapContainer
        center={[lat, lon]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        whenCreated={(map) => {
          console.log('[MAP_ARTIFACT] Map created successfully');
          mapRef.current = map;
          setMapCreated(true);
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Address marker */}
        <Marker 
          position={[lat, lon]}
          eventHandlers={{
            add: () => {
              console.log('[MAP_ARTIFACT] Marker rendered');
              setMarkerRendered(true);
            }
          }}
        >
          {/* You can add a popup here if needed */}
        </Marker>

        {/* Zone polygon highlight - only render after delay */}
        {shouldRenderPolygon && leafletPolygons.length > 0 && leafletPolygons.map((polygonCoords, index) => (
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
            eventHandlers={{
              add: () => {
                console.log('[MAP_ARTIFACT] Polygon rendered');
                setPolygonRendered(true);
              }
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}

