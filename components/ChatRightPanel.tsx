'use client';

import { X, FileText, Map, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapCard, MapData } from '@/components/chat/artifacts/MapCard';
import { DocumentCard, DocumentData } from '@/components/chat/artifacts/DocumentCard';
import type { ArtifactState } from '@/lib/stores/artifactStore';
import type { MapArtifactData, DocumentArtifactData } from '@/types/artifacts';

interface ChatRightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  artifacts: {
    zone: ArtifactState | null;
    map: ArtifactState | null;
    document: ArtifactState | null;
  };
  activeTab: 'map' | 'document';
  onTabChange: (tab: 'map' | 'document') => void;
  onRetry?: () => void; // Optional for error recovery
  onMapRenderComplete?: () => void;
  onDocumentRenderComplete?: () => void;
}

type ArtifactStatus = 'skeleton' | 'loading' | 'ready' | 'error';

export function ChatRightPanel({ 
  isOpen, 
  onClose, 
  artifacts,
  activeTab, 
  onTabChange, 
  onRetry,
  onMapRenderComplete,
  onDocumentRenderComplete
}: ChatRightPanelProps) {
  // Map artifact state
  const mapArtifactState = artifacts.map;
  const mapStatus: ArtifactStatus = mapArtifactState
    ? mapArtifactState.status === 'loading'
      ? 'loading'
      : mapArtifactState.status === 'ready'
      ? 'ready'
      : mapArtifactState.status === 'error'
      ? 'error'
      : 'skeleton'
    : 'skeleton';
  
  const mapData: MapData | null = mapArtifactState?.data
    ? {
        lat: (mapArtifactState.data as MapArtifactData).center.lat,
        lon: (mapArtifactState.data as MapArtifactData).center.lon,
        zoneGeometry: (mapArtifactState.data as MapArtifactData).geometry,
      }
    : null;

  // Document artifact state
  const documentArtifactState = artifacts.document;
  const documentStatus: ArtifactStatus = documentArtifactState
    ? documentArtifactState.status === 'loading'
      ? 'loading'
      : documentArtifactState.status === 'ready'
      ? 'ready'
      : documentArtifactState.status === 'error'
      ? 'error'
      : 'skeleton'
    : 'skeleton';
  
  const documentData: DocumentData | null = documentArtifactState?.data
    ? {
        htmlContent: (documentArtifactState.data as DocumentArtifactData).htmlContent || null,
        documentId: (documentArtifactState.data as DocumentArtifactData).documentId || null,
      }
    : null;

  // Tab status indicators - use artifact status directly
  const mapTabStatus = mapStatus === 'ready'
    ? 'ready'
    : mapStatus === 'error'
    ? 'error'
    : 'loading';
  
  const documentTabStatus = documentStatus === 'ready'
    ? 'ready'
    : documentStatus === 'error'
    ? 'error'
    : 'loading';

  // Retry handlers
  const handleRetryMap = () => {
    if (onRetry) {
      onRetry();
    }
  };

  const handleRetryDocument = () => {
    if (onRetry) {
      onRetry();
    }
  };

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
                {mapTabStatus === 'loading' && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                {mapTabStatus === 'ready' && (
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
                {documentTabStatus === 'loading' && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                {documentTabStatus === 'ready' && (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                )}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'map' && (
                <div className="h-full animate-in fade-in duration-300">
                  <MapCard
                    data={mapData ?? undefined}
                    onRetry={handleRetryMap}
                    status={mapStatus}
                    className="h-full"
                    onRenderComplete={onMapRenderComplete}
                  />
                </div>
              )}

              {activeTab === 'document' && (
                <div className="h-full animate-in fade-in duration-300">
                  <DocumentCard
                    data={documentData ?? undefined}
                    onRetry={handleRetryDocument}
                    status={documentStatus}
                    className="h-full"
                    onRenderComplete={onDocumentRenderComplete}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
