'use client';

import { useState } from 'react';
import { X, FileText, Map, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ChatRightPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatRightPanel({ isOpen, onClose }: ChatRightPanelProps) {
  const [activeTab, setActiveTab] = useState('document');
  const [zoom, setZoom] = useState(100);

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
            ? 'translate-x-0 w-full md:w-[40%]'
            : 'translate-x-full md:translate-x-0 w-0 md:w-0'
        )}
      >
        {isOpen && (
          <>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-gray-900">Documents PLU</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="border-b">
                <TabsList className="w-full justify-start rounded-none bg-transparent h-auto p-0">
                  <TabsTrigger
                    value="document"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Document
                  </TabsTrigger>
                  <TabsTrigger
                    value="map"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent"
                  >
                    <Map className="h-4 w-4 mr-2" />
                    Carte
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="document" className="flex-1 flex flex-col mt-0">
                <div className="border-b p-2 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setZoom((prev) => Math.max(50, prev - 25))}
                      disabled={zoom <= 50}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-600 min-w-[60px] text-center">
                      {zoom}%
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setZoom((prev) => Math.min(200, prev + 25))}
                      disabled={zoom >= 200}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <div
                      className="bg-white border rounded-lg shadow-sm p-8 mx-auto"
                      style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                    >
                      <div className="aspect-[210/297] flex items-center justify-center bg-gray-50 rounded-md">
                        <div className="text-center space-y-4 p-8">
                          <FileText className="h-16 w-16 mx-auto text-gray-400" />
                          <div className="space-y-2">
                            <h3 className="font-semibold text-gray-900">Document PLU</h3>
                            <p className="text-sm text-gray-600">
                              Le document PLU sera affiché ici
                            </p>
                          </div>
                          <div className="space-y-3 text-left bg-white rounded-md p-4 border">
                            <div className="text-sm">
                              <p className="font-medium text-gray-900 mb-1">Zone Uc</p>
                              <p className="text-gray-600 text-xs">Zone urbaine centre</p>
                            </div>
                            <div className="text-sm">
                              <p className="font-medium text-gray-900 mb-1">Hauteur max</p>
                              <p className="text-gray-600 text-xs">12 mètres (R+3)</p>
                            </div>
                            <div className="text-sm">
                              <p className="font-medium text-gray-900 mb-1">Emprise sol</p>
                              <p className="text-gray-600 text-xs">60% maximum</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="map" className="flex-1 flex flex-col mt-0">
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    <div className="aspect-square bg-gray-50 rounded-lg border flex items-center justify-center">
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
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </>
  );
}
