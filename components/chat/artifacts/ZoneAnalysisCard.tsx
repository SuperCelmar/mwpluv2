'use client';

import { ArtifactSkeleton } from '../ArtifactSkeleton';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ZoneAnalysisData {
  zoneId: string | null;
  zoningId: string | null;
  cityId: string | null;
  zoneLibelle: string | null;
  cityName?: string | null;
  zoneName?: string | null;
}

interface ZoneAnalysisCardProps {
  data?: ZoneAnalysisData;
  onLoad?: () => Promise<ZoneAnalysisData>;
  onRetry?: () => void;
  status: 'skeleton' | 'loading' | 'ready' | 'error';
  className?: string;
}

export function ZoneAnalysisCard({ 
  data, 
  onLoad, 
  onRetry,
  status, 
  className 
}: ZoneAnalysisCardProps) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else if (onLoad) {
      // Fallback to onLoad if onRetry not provided
      onLoad().catch(error => {
        console.error('[ZoneAnalysisCard] Error loading data:', error);
      });
    }
  };

  // Skeleton state - show immediately
  if (status === 'skeleton') {
    return (
      <div className={cn('transition-opacity duration-300', className)}>
        <ArtifactSkeleton type="analysis" />
      </div>
    );
  }

  // Loading state - when data is being fetched
  if (status === 'loading') {
    return (
      <div className={cn(
        'rounded-lg border border-gray-200 bg-white shadow-sm p-6',
        'flex flex-col items-center justify-center min-h-[200px]',
        'transition-opacity duration-300',
        className
      )}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-sm text-gray-600">Chargement de l'analyse...</p>
      </div>
    );
  }

  // Error state - show error message with retry
  if (status === 'error') {
    return (
      <div className={cn('transition-opacity duration-300', className)}>
        <ErrorCard 
          message="Impossible de charger l'analyse de la zone" 
          onRetry={(onRetry || onLoad) ? handleRetry : undefined}
        />
      </div>
    );
  }

  // Ready state - show actual content
  if (status === 'ready' && data) {
    return (
      <div className={cn(
        'rounded-lg border border-gray-200 bg-white shadow-sm p-6',
        'transition-all duration-300 ease-in-out',
        className
      )}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Analyse de la zone
          </h3>
          
          <div className="space-y-3">
            {data.zoneLibelle && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Zone</span>
                <span className="text-sm font-medium text-gray-900">
                  {data.zoneLibelle}
                </span>
              </div>
            )}
            
            {data.zoneName && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Nom de la zone</span>
                <span className="text-sm font-medium text-gray-900">
                  {data.zoneName}
                </span>
              </div>
            )}
            
            {data.cityName && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Commune</span>
                <span className="text-sm font-medium text-gray-900">
                  {data.cityName}
                </span>
              </div>
            )}
            
            {data.zoneId && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">ID Zone</span>
                <span className="text-xs font-mono text-gray-500">
                  {data.zoneId.substring(0, 8)}...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback - shouldn't reach here but show skeleton
  return (
    <div className={cn('transition-opacity duration-300', className)}>
      <ArtifactSkeleton type="analysis" />
    </div>
  );
}

