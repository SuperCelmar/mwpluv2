'use client';

import { X, FileText, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MapArtifact } from '@/components/MapArtifact';
import { DocumentViewer } from '@/components/DocumentViewer';

interface ChatRightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mapProps?: {
    lat: number;
    lon: number;
    zoneGeometry?: any;
    isLoading?: boolean;
  };
  activeTab: 'document' | 'map';
  onTabChange: (tab: 'document' | 'map') => void;
  documentHtml?: string | null;
}

export function ChatRightPanel({ isOpen, onClose, mapProps, activeTab, onTabChange, documentHtml }: ChatRightPanelProps) {

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
            {/* Header with tab buttons */}
            <div className="border-b bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex gap-1">
                  <button
                    onClick={() => onTabChange('document')}
                    className={cn(
                      'inline-flex items-center px-3 py-2 text-sm font-medium transition-colors',
                      'border-b-2 -mb-[1px]',
                      activeTab === 'document'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Document
                  </button>
                  <button
                    onClick={() => onTabChange('map')}
                    className={cn(
                      'inline-flex items-center px-3 py-2 text-sm font-medium transition-colors',
                      'border-b-2 -mb-[1px]',
                      activeTab === 'map'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    <Map className="h-4 w-4 mr-2" />
                    Carte
                  </button>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Content area - only render active tab */}
            <div className="flex-1 min-h-0 flex flex-col">
              {activeTab === 'document' && (
                <DocumentViewer htmlContent={documentHtml ?? null} />
              )}
              
              {activeTab === 'map' && (
                mapProps ? (
                  <MapArtifact
                    lat={mapProps.lat}
                    lon={mapProps.lon}
                    zoneGeometry={mapProps.zoneGeometry}
                    isLoading={mapProps.isLoading}
                  />
                ) : (
                  <div className="h-full bg-gray-50 flex items-center justify-center">
                    <div className="text-center space-y-4 p-8">
                      <Map className="h-16 w-16 mx-auto text-gray-400" />
                      <div className="space-y-2">
                        <h3 className="font-semibold text-gray-900">Carte cadastrale</h3>
                        <p className="text-sm text-gray-600">
                          La carte cadastrale sera affichée ici
                        </p>
                      </div>
                      <div className="bg-white rounded-md p-4 border text-left">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-yellow-200 border border-yellow-400 rounded"></div>
                            <span className="text-gray-700">Zone Uc</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
                            <span className="text-gray-700">Espaces verts</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-blue-200 border border-blue-400 rounded"></div>
                            <span className="text-gray-700">Équipements publics</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
