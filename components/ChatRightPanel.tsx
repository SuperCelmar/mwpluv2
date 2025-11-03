'use client';

import { X, FileText, Map, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapArtifact } from '@/components/MapArtifact';
import { DocumentViewer } from '@/components/DocumentViewer';
import { MapSkeleton } from '@/components/skeletons/MapSkeleton';
import { DocumentSkeleton } from '@/components/skeletons/DocumentSkeleton';
import { ErrorCard } from '@/components/ui/ErrorCard';

interface ChatRightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mapProps?: {
    lat: number;
    lon: number;
    zoneGeometry?: any;
    isLoading?: boolean;
  };
  activeTab: 'map' | 'document';
  onTabChange: (tab: 'map' | 'document') => void;
  documentHtml?: string | null;
  mapStatus: 'loading' | 'ready' | 'error';
  documentStatus: 'loading' | 'ready' | 'error';
  onRetryMap?: () => void;
  onRetryDocument?: () => void;
}

export function ChatRightPanel({ 
  isOpen, 
  onClose, 
  mapProps, 
  activeTab, 
  onTabChange, 
  documentHtml,
  mapStatus,
  documentStatus,
  onRetryMap,
  onRetryDocument
}: ChatRightPanelProps) {

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'fixed md:relative right-0 top-0 h-full bg-white border-l z-50',
          'transition-all duration-300 ease-in-out',
          'flex flex-col',
          isOpen
            ? 'translate-x-0 w-full md:w-1/2'
            : 'translate-x-full md:translate-x-0 w-0 md:w-0'
        )}
      >
        {isOpen && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-4 py-3 border-b bg-white">
              <h2 className="font-semibold text-lg">Analyse du PLU</h2>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 md:hidden">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex-none flex border-b bg-gray-50">
              <button
                onClick={() => onTabChange('map')}
                className={cn(
                  'flex-1 px-4 py-3 text-sm font-medium transition-all',
                  'border-b-2 flex items-center justify-center gap-2',
                  activeTab === 'map'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <Map className="h-4 w-4" />
                <span>Carte</span>
                {mapStatus === 'loading' && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                {mapStatus === 'ready' && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </button>

              <button
                onClick={() => onTabChange('document')}
                className={cn(
                  'flex-1 px-4 py-3 text-sm font-medium transition-all',
                  'border-b-2 flex items-center justify-center gap-2',
                  activeTab === 'document'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <FileText className="h-4 w-4" />
                <span>Document</span>
                {documentStatus === 'loading' && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                {documentStatus === 'ready' && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'map' && (
                <div className="h-full">
                  {mapStatus === 'loading' && (
                    <div className="h-full flex items-center justify-center p-4">
                      <MapSkeleton />
                    </div>
                  )}
                  {mapStatus === 'ready' && mapProps && (
                    <MapArtifact
                      lat={mapProps.lat}
                      lon={mapProps.lon}
                      zoneGeometry={mapProps.zoneGeometry}
                      isLoading={false}
                    />
                  )}
                  {mapStatus === 'error' && (
                    <div className="h-full flex items-center justify-center p-8">
                      <ErrorCard 
                        message="Carte indisponible" 
                        onRetry={onRetryMap}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'document' && (
                <div className="h-full overflow-y-auto">
                  {documentStatus === 'loading' && (
                    <div className="p-6">
                      <DocumentSkeleton />
                    </div>
                  )}
                  {documentStatus === 'ready' && (
                    <DocumentViewer htmlContent={documentHtml ?? null} />
                  )}
                  {documentStatus === 'error' && (
                    <div className="h-full flex items-center justify-center p-8">
                      <ErrorCard 
                        message="Document indisponible" 
                        onRetry={onRetryDocument}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
