'use client';

import { ArtifactSkeleton } from '../ArtifactSkeleton';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { DocumentViewer } from '@/components/DocumentViewer';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DocumentData {
  htmlContent: string | null;
  documentId: string | null;
}

interface DocumentCardProps {
  data?: DocumentData;
  onLoad?: () => Promise<DocumentData>;
  onRetry?: () => void;
  status: 'skeleton' | 'loading' | 'ready' | 'error';
  className?: string;
  onRenderComplete?: () => void;
}

export function DocumentCard({ 
  data, 
  onLoad, 
  onRetry,
  status, 
  className,
  onRenderComplete
}: DocumentCardProps) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else if (onLoad) {
      // Fallback to onLoad if onRetry not provided
      onLoad().catch(error => {
        console.error('[DocumentCard] Error loading data:', error);
      });
    }
  };

  // Skeleton state - show immediately
  if (status === 'skeleton') {
    return (
      <div className={cn(
        'transition-opacity duration-300',
        'h-full w-full overflow-y-auto',
        className
      )}>
        <div className="p-6">
          <ArtifactSkeleton type="document" />
        </div>
      </div>
    );
  }

  // Loading state - when data is being fetched
  if (status === 'loading') {
    return (
      <div className={cn(
        'h-full w-full flex items-center justify-center p-6',
        'transition-opacity duration-300',
        className
      )}>
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Chargement du document...</h3>
            <p className="text-sm text-gray-600">
              Préparation du contenu
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
          message="Document indisponible" 
          onRetry={(onRetry || onLoad) ? handleRetry : undefined}
        />
      </div>
    );
  }

  // Ready state - show actual document
  if (status === 'ready') {
    return (
      <div className={cn(
        'h-full w-full transition-all duration-300 ease-in-out',
        className
      )}>
        <DocumentViewer 
          htmlContent={data?.htmlContent ?? null}
          onRenderComplete={onRenderComplete}
        />
      </div>
    );
  }

  // Fallback - shouldn't reach here but show skeleton
  return (
    <div className={cn(
      'transition-opacity duration-300',
      'h-full w-full overflow-y-auto',
      className
    )}>
      <div className="p-6">
        <ArtifactSkeleton type="document" />
      </div>
    </div>
  );
}

