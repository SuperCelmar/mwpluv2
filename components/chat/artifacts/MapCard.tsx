'use client';

import { ArtifactSkeleton } from '../ArtifactSkeleton';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { MapArtifact } from '@/components/MapArtifact';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MapData {
  lat: number;
  lon: number;
  zoneGeometry?: any;
}

interface MapCardProps {
  data?: MapData;
  onLoad?: () => Promise<MapData>;
  onRetry?: () => void;
  status: 'skeleton' | 'loading' | 'ready' | 'error';
  className?: string;
  onRenderComplete?: () => void;
}

export function MapCard({ 
  data, 
  onLoad, 
  onRetry,
  status, 
  className,
  onRenderComplete
}: MapCardProps) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else if (onLoad) {
      // Fallback to onLoad if onRetry not provided
      onLoad().catch(error => {
        console.error('[MapCard] Error loading data:', error);
      });
    }
  };

  // Skeleton state - show immediately
  if (status === 'skeleton') {
    return (
      <div className={cn(
        'transition-opacity duration-300',
        'h-full w-full',
        className
      )}>
        <ArtifactSkeleton type="map" className="h-full" />
      </div>
    );
  }

  // Loading state - when data is being fetched
  if (status === 'loading') {
    return (
      <div className={cn(
        'h-full w-full flex items-center justify-center bg-gray-50',
        'transition-opacity duration-300',
        className
      )}>
        <div className="text-center space-y-4 p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
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

  // Error state - show error message with retry
  if (status === 'error') {
    return (
      <div className={cn(
        'h-full w-full flex items-center justify-center p-8',
        'transition-opacity duration-300',
        className
      )}>
        <ErrorCard 
          message="Carte indisponible" 
          onRetry={(onRetry || onLoad) ? handleRetry : undefined}
        />
      </div>
    );
  }

  // Ready state - show actual map
  if (status === 'ready' && data) {
    return (
      <div className={cn(
        'h-full w-full transition-all duration-300 ease-in-out',
        className
      )}>
        <MapArtifact
          lat={data.lat}
          lon={data.lon}
          zoneGeometry={data.zoneGeometry}
          isLoading={false}
          onRenderComplete={onRenderComplete}
        />
      </div>
    );
  }

  // Fallback - shouldn't reach here but show skeleton
  return (
    <div className={cn(
      'transition-opacity duration-300',
      'h-full w-full',
      className
    )}>
      <ArtifactSkeleton type="map" className="h-full" />
    </div>
  );
}

