'use client';

import { useState } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function RightPanel() {
  const { isRightPanelOpen, setRightPanelOpen, getCurrentConversation } = useChatStore();
  const [activeTab, setActiveTab] = useState('document');
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 45;

  const currentConversation = getCurrentConversation();

  if (!isRightPanelOpen) return null;

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 150));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  return (
    <div
      className={cn(
        'w-[400px] flex flex-col h-screen animate-in slide-in-from-right duration-400'
      )}
      style={{
        backgroundColor: '#FFFFFF',
        borderLeft: '1px solid #E5E5E5'
      }}
    >
      <div className="flex items-center justify-between p-16" style={{ borderBottom: '1px solid #E5E5E5' }}>
        <h3 className="font-semibold" style={{ color: '#000000' }}>Détails du PLU</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setRightPanelOpen(false)}
          className="h-32 w-32"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F5F5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X className="h-16 w-16" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList
          className="w-full rounded-none h-48"
          style={{
            borderBottom: '1px solid #E5E5E5',
            backgroundColor: '#FFFFFF'
          }}
        >
          <TabsTrigger
            value="document"
            className="flex-1 rounded-none data-[state=active]:shadow-none"
            style={{ color: '#000000' }}
            onMouseEnter={(e) => {
              if (activeTab !== 'document') {
                e.currentTarget.style.backgroundColor = '#F5F5F5';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'document') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Document officiel
          </TabsTrigger>
          <TabsTrigger
            value="analysis"
            className="flex-1 rounded-none data-[state=active]:shadow-none"
            style={{ color: '#000000' }}
            onMouseEnter={(e) => {
              if (activeTab !== 'analysis') {
                e.currentTarget.style.backgroundColor = '#F5F5F5';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'analysis') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Analyse
          </TabsTrigger>
          <TabsTrigger
            value="map"
            className="flex-1 rounded-none data-[state=active]:shadow-none"
            style={{ color: '#000000' }}
            onMouseEnter={(e) => {
              if (activeTab !== 'map') {
                e.currentTarget.style.backgroundColor = '#F5F5F5';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'map') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Carte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="document" className="flex-1 flex flex-col mt-0">
          <div
            className="flex items-center justify-between p-12"
            style={{
              borderBottom: '1px solid #E5E5E5',
              backgroundColor: '#F5F5F5'
            }}
          >
            <div className="flex items-center gap-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="h-32 w-32"
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E5E5E5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ZoomOut className="h-16 w-16" />
              </Button>
              <span className="text-sm font-medium w-64 text-center" style={{ color: '#000000' }}>
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 150}
                className="h-32 w-32"
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E5E5E5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ZoomIn className="h-16 w-16" />
              </Button>
            </div>

            <div className="flex items-center gap-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-32 w-32"
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E5E5E5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ChevronLeft className="h-16 w-16" />
              </Button>
              <span className="text-sm" style={{ color: '#666666' }}>
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-32 w-32"
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E5E5E5')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ChevronRight className="h-16 w-16" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-16">
              <div
                className="rounded-lg overflow-hidden"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E5E5',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top center'
                }}
              >
                <div className="aspect-[210/297] flex items-center justify-center" style={{ backgroundColor: '#FAFAFA' }}>
                  <div className="text-center space-y-16 p-32">
                    <FileText className="h-64 w-64 mx-auto" style={{ color: '#E5E5E5' }} />
                    <div className="space-y-8">
                      <h4 className="font-semibold" style={{ color: '#333333' }}>
                        PLU de {currentConversation?.city}
                      </h4>
                      <p className="text-sm" style={{ color: '#666666' }}>Page {currentPage}</p>
                      <p className="text-xs" style={{ color: '#999999' }}>
                        Zone {currentConversation?.zoneLabel?.split(' - ')[0]}
                      </p>
                    </div>
                    <div className="mt-24 space-y-12 text-left max-w-xs mx-auto">
                      <div className="p-12 rounded-lg" style={{ backgroundColor: '#FFF9C4', border: '1px solid #FFF176' }}>
                        <p className="text-xs font-medium" style={{ color: '#333333' }}>Article 10 - Hauteur</p>
                        <p className="text-xs mt-4" style={{ color: '#666666' }}>
                          La hauteur maximale est fixée à 12 mètres
                        </p>
                      </div>
                      <div className="p-12 rounded-lg" style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9' }}>
                        <p className="text-xs font-medium" style={{ color: '#333333' }}>Article 9 - Emprise</p>
                        <p className="text-xs mt-4" style={{ color: '#666666' }}>
                          L'emprise au sol ne peut excéder 60%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="analysis" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-16 space-y-16">
              <div className="space-y-12">
                <h4 className="font-semibold" style={{ color: '#000000' }}>Points clés</h4>
                {currentConversation?.highlights.map((highlight, index) => (
                  <div
                    key={index}
                    className="p-12 rounded-lg"
                    style={{
                      backgroundColor: '#F5F5F5',
                      border: '1px solid #E5E5E5'
                    }}
                  >
                    <p className="text-sm" style={{ color: '#333333' }}>{highlight}</p>
                  </div>
                ))}
              </div>

              <div className="pt-16 space-y-12" style={{ borderTop: '1px solid #E5E5E5' }}>
                <h4 className="font-semibold" style={{ color: '#000000' }}>Informations du PLU</h4>
                <div className="space-y-8 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: '#666666' }}>Date d'approbation</span>
                    <span className="font-medium" style={{ color: '#000000' }}>{currentConversation?.pluDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#666666' }}>Commune</span>
                    <span className="font-medium" style={{ color: '#000000' }}>{currentConversation?.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#666666' }}>Zone</span>
                    <span className="font-medium" style={{ color: '#000000' }}>
                      {currentConversation?.zoneLabel?.split(' - ')[0]}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="map" className="flex-1 mt-0">
          <div className="h-full flex items-center justify-center p-16" style={{ backgroundColor: '#F5F5F5' }}>
            <div className="text-center space-y-8">
              <div className="text-4xl">🗺️</div>
              <p className="text-sm" style={{ color: '#666666' }}>Carte cadastrale</p>
              <p className="text-xs" style={{ color: '#999999' }}>Fonctionnalité à venir</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
