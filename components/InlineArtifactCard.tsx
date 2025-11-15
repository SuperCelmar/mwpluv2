'use client';

import { useEffect, useRef } from 'react';
import { MapPin, Map, FileText, Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import type { ZoneArtifactData, MapArtifactData, DocumentArtifactData } from '@/types/artifacts';

// Dynamically import Leaflet components for map thumbnail
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

// Fix for default marker icon issue in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

interface InlineArtifactCardProps {
  type: 'zone' | 'map' | 'document';
  artifactId: string;
  status: 'loading' | 'ready' | 'error';
  data?: ZoneArtifactData | MapArtifactData | DocumentArtifactData;
  onViewInPanel: (type: 'zone' | 'map' | 'document') => void;
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

// Zone Inline Card Component
function ZoneInlineCard({ 
  status, 
  data, 
  onViewInPanel 
}: { 
  status: 'loading' | 'ready' | 'error'; 
  data?: ZoneArtifactData; 
  onViewInPanel: () => void;
}) {
  const handleClick = () => {
    onViewInPanel();
  };

  if (status === 'loading') {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'w-full rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm',
          'transition-all duration-300 cursor-pointer hover:shadow-md',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 shrink-0">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Analyse de la zone</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Analyse en cours...</span>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Vérification de la zone...
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-900">
              <span>Voir les détails</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'w-full rounded-xl border border-red-200 bg-red-50 px-4 py-4 shadow-sm',
          'transition-all duration-300 cursor-pointer hover:shadow-md',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-red-900">Erreur d'analyse</h3>
            </div>
            <p className="text-xs text-red-700 mb-3">
              Impossible de charger l'analyse de la zone
            </p>
            <div className="flex items-center gap-1 text-xs font-medium text-red-900">
              <span>Réessayer</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ready state
  const zoneData = data as ZoneArtifactData | undefined;
  const zoneLabel = zoneData?.zoneLibelle || zoneData?.zoneName || 'Zone';
  const cityName = zoneData?.cityName || '';
  const zoneType = zoneData?.zoningType || '';
  const inseeCode = zoneData?.inseeCode || '';
  const isConstructible = zoneData?.isConstructible ?? null;

  return (
    <div
      onClick={handleClick}
      className={cn(
        'w-full rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm',
        'transition-all duration-300 cursor-pointer hover:shadow-md',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 shrink-0">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Zone {zoneData?.zoneLibelle ? `${zoneData.zoneLibelle} - ${cityName}` : cityName}
            </h3>
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          </div>
          {zoneData?.zoneName && (
            <p className="text-xs text-gray-600 mb-3">{zoneData.zoneName}</p>
          )}
          <div className="space-y-1.5 text-xs text-gray-600">
            {zoneType && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <span>Type: {zoneType === 'U' ? 'Urbain (U)' : zoneType}</span>
              </div>
            )}
            {inseeCode && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <span>INSEE: {inseeCode}</span>
              </div>
            )}
            {isConstructible !== null && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <span>Constructible: {isConstructible ? 'Oui' : 'Non'}</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-900">
            <span>Voir la carte complète</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Map Inline Card Component
function MapInlineCard({ 
  status, 
  data, 
  onViewInPanel 
}: { 
  status: 'loading' | 'ready' | 'error'; 
  data?: MapArtifactData; 
  onViewInPanel: () => void;
}) {
  const mapRef = useRef<any>(null);

  const handleClick = () => {
    onViewInPanel();
  };

  const mapData = data as MapArtifactData | undefined;
  const center = mapData?.center || { lat: 0, lon: 0 };
  const geometry = mapData?.geometry;
  
  // Convert geometry for Leaflet
  const leafletCoords = geometry && geometry.type === 'MultiPolygon' 
    ? convertGeoJSONToLeaflet(geometry.coordinates[0] || [])
    : [];

  // Calculate bounds for map thumbnail
  const getBounds = () => {
    const bounds: [number, number][] = [[center.lat, center.lon]];
    
    if (geometry && geometry.type === 'MultiPolygon' && geometry.coordinates) {
      // For MultiPolygon, coordinates is number[][][][]
      // First level: array of polygons
      for (const polygon of geometry.coordinates as any) {
        // polygon is number[][][] (array of rings)
        for (const ring of polygon) {
          // ring is number[][] (array of [lon, lat] pairs)
          for (const coord of ring) {
            if (Array.isArray(coord) && coord.length >= 2) {
              const [lonCoord, latCoord] = coord;
              bounds.push([latCoord, lonCoord]);
            }
          }
        }
      }
    }
    
    return bounds;
  };

  if (status === 'loading') {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'w-full rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm',
          'transition-all duration-300 cursor-pointer hover:shadow-md',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 shrink-0">
            <Map className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Carte de zonage</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Chargement de la carte...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'w-full rounded-xl border border-red-200 bg-red-50 px-4 py-4 shadow-sm',
          'transition-all duration-300 cursor-pointer hover:shadow-md',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-red-900">Carte indisponible</h3>
            </div>
            <p className="text-xs text-red-700 mb-3">
              Impossible de charger la carte
            </p>
            <div className="flex items-center gap-1 text-xs font-medium text-red-900">
              <span>Réessayer</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ready state
  const zoneLabel = mapData?.zoneLibelle 
    ? `${mapData.zoneLibelle}${mapData.cityName ? ` • ${mapData.cityName}` : ''}`
    : mapData?.cityName || '';

  return (
    <div
      onClick={handleClick}
      className={cn(
        'w-full rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm',
        'transition-all duration-300 cursor-pointer hover:shadow-md',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 shrink-0">
            <Map className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Carte de zonage</h3>
        </div>
        
        {/* Map thumbnail */}
        {center.lat && center.lon && (
          <div className="w-full h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative">
            <MapContainer
              center={[center.lat, center.lon]}
              zoom={leafletCoords.length > 0 ? 15 : 16}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
              scrollWheelZoom={false}
              dragging={false}
              doubleClickZoom={false}
              touchZoom={false}
              boxZoom={false}
              keyboard={false}
              ref={(map) => {
                if (map && leafletCoords.length > 0) {
                  setTimeout(() => {
                    const bounds = getBounds();
                    map.fitBounds(bounds as any, { padding: [10, 10] });
                  }, 100);
                }
              }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              <Marker position={[center.lat, center.lon]} />
              
              {leafletCoords.length > 0 && leafletCoords.map((polygonCoords, index) => (
                <Polygon
                  key={index}
                  positions={polygonCoords}
                  pathOptions={{
                    color: '#3B82F6',
                    fillColor: '#93C5FD',
                    fillOpacity: 0.3,
                    weight: 2,
                    opacity: 0.8,
                  }}
                />
              ))}
            </MapContainer>
          </div>
        )}
        
        {zoneLabel && (
          <p className="text-xs text-gray-600">{zoneLabel}</p>
        )}
        
        <div className="flex items-center gap-1 text-xs font-medium text-gray-900">
          <span>Ouvrir la carte interactive</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}

// Document Inline Card Component
function DocumentInlineCard({ 
  status, 
  data, 
  onViewInPanel 
}: { 
  status: 'loading' | 'ready' | 'error'; 
  data?: DocumentArtifactData; 
  onViewInPanel: () => void;
}) {
  const handleClick = () => {
    onViewInPanel();
  };

  if (status === 'loading') {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'w-full rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm',
          'transition-all duration-300 cursor-pointer hover:shadow-md',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Règlement PLU</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Chargement du document...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        onClick={handleClick}
        className={cn(
          'w-full rounded-xl border border-red-200 bg-red-50 px-4 py-4 shadow-sm',
          'transition-all duration-300 cursor-pointer hover:shadow-md',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-red-900">Document indisponible</h3>
            </div>
            <p className="text-xs text-red-700 mb-3">
              Impossible de charger le document
            </p>
            <div className="flex items-center gap-1 text-xs font-medium text-red-900">
              <span>Réessayer</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ready state
  const docData = data as DocumentArtifactData | undefined;
  const title = docData?.title || 'Règlement PLU';
  const docType = docData?.type || 'PLU';
  const zoneLibelle = docData?.zoneLibelle;
  const cityName = docData?.cityName || '';
  const sourceDate = docData?.sourceDate;
  const hasAnalysis = docData?.hasAnalysis ?? false;

  // Format date if available
  const formattedDate = sourceDate 
    ? new Date(sourceDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <div
      onClick={handleClick}
      className={cn(
        'w-full rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm',
        'transition-all duration-300 cursor-pointer hover:shadow-md',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          </div>
          <p className="text-xs text-gray-600 mb-3">
            {hasAnalysis ? 'Analyse disponible' : 'Document source'}
          </p>
          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">•</span>
              <span>Type: {docType} {cityName}</span>
            </div>
            {zoneLibelle && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <span>Zone: {zoneLibelle}</span>
              </div>
            )}
            {formattedDate && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <span>Mis à jour: {formattedDate}</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-900">
            <span>Lire le document</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Main InlineArtifactCard Component
export function InlineArtifactCard({ 
  type, 
  artifactId, 
  status, 
  data, 
  onViewInPanel 
}: InlineArtifactCardProps) {
  const handleViewInPanel = () => {
    // Zone cards should open map tab (per user requirement)
    if (type === 'zone') {
      onViewInPanel('map');
    } else {
      onViewInPanel(type);
    }
  };

  switch (type) {
    case 'zone':
      return (
        <ZoneInlineCard 
          status={status} 
          data={data as ZoneArtifactData} 
          onViewInPanel={handleViewInPanel}
        />
      );
    case 'map':
      return (
        <MapInlineCard 
          status={status} 
          data={data as MapArtifactData} 
          onViewInPanel={handleViewInPanel}
        />
      );
    case 'document':
      return (
        <DocumentInlineCard 
          status={status} 
          data={data as DocumentArtifactData} 
          onViewInPanel={handleViewInPanel}
        />
      );
    default:
      return null;
  }
}
