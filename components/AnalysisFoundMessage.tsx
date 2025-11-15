'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InlineArtifactCard } from '@/components/InlineArtifactCard';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import type { UseEnrichmentReturn } from '@/app/(app)/chat/[conversation_id]/useEnrichment';
import type { DocumentArtifactData } from '@/types/artifacts';
import { getFinalAssistantCopy } from '@/lib/utils/branchMetadata';
import type { ConversationBranch } from '@/types/enrichment';

interface AnalysisFoundMessageProps {
  enrichment: UseEnrichmentReturn;
  zoneName: string;
  onViewInPanel: (type: 'zone' | 'map' | 'document') => void;
  onTextGenerationComplete?: () => void;
}

export function AnalysisFoundMessage({ 
  enrichment, 
  zoneName,
  onViewInPanel,
  onTextGenerationComplete 
}: AnalysisFoundMessageProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [textGenerationComplete, setTextGenerationComplete] = useState(false);
  const [showMapCard, setShowMapCard] = useState(false);
  const [showDocumentCard, setShowDocumentCard] = useState(false);

  // Determine theme-aware logo path
  const logoSrc = resolvedTheme === 'dark' 
    ? '/square-white-plu.svg' 
    : '/square-black-plu.svg';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle text generation completion
  const handleTextGenerationComplete = () => {
    setTextGenerationComplete(true);
    if (onTextGenerationComplete) {
      onTextGenerationComplete();
    }
    
    // Show map card immediately after text completes
    setTimeout(() => {
      setShowMapCard(true);
      
      // Show document card 500ms later
      setTimeout(() => {
        setShowDocumentCard(true);
      }, 500);
    }, 100);
  };

  // Extract document and map data from enrichment
  const documentData = enrichment.data.documentData;
  const hasDocument = documentData && documentData.documentId;
  const hasMap = enrichment.data.mapGeometry !== null && enrichment.data.mapGeometry !== undefined;

  const branchType: ConversationBranch =
    (enrichment.data?.branchType as ConversationBranch) ||
    (documentData?.hasAnalysis ? 'non_rnu_analysis' : 'non_rnu_source');
  const finalCopy = getFinalAssistantCopy({
    branchType,
    zoneName,
  });

  // Determine artifact status
  const documentStatus: 'loading' | 'ready' | 'error' = 
    enrichment.progress.document === 'error' ? 'error' :
    enrichment.progress.document === 'success' && hasDocument ? 'ready' :
    'loading';

  const mapStatus: 'loading' | 'ready' | 'error' = 
    enrichment.progress.map === 'error' ? 'error' :
    enrichment.progress.map === 'success' && hasMap ? 'ready' :
    'loading';

  // Prepare document artifact data if available
  let documentArtifactData: DocumentArtifactData | undefined;
  if (documentData && documentData.documentId) {
    documentArtifactData = {
      documentId: documentData.documentId,
      title: 'Règlement PLU',
      type: 'PLU',
      cityName: '', // Will be filled from context
      inseeCode: '', // Will be filled from context
      hasAnalysis: documentData.hasAnalysis || false,
    };
  }

  return (
    <div
      className={cn(
        'flex gap-2 px-3 py-2 sm:px-4 sm:py-2.5',
        'justify-start animate-in fade-in duration-300'
      )}
      role="article"
      aria-label="Assistant analysis message"
    >
      {/* Assistant Avatar with Logo */}
      <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
        {mounted && (
          <img
            src={logoSrc}
            alt="MWPLU Logo"
            className="h-full w-full rounded-full object-contain p-1"
          />
        )}
        <AvatarFallback className="bg-blue-50 text-blue-700 transition-all duration-200">
          <div className="h-full w-full flex items-center justify-center">
            {mounted ? (
              <img
                src={logoSrc}
                alt="MWPLU Logo"
                className="h-5 w-5 object-contain"
              />
            ) : (
              <div className="h-4 w-4 bg-blue-600 rounded" />
            )}
          </div>
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div className="flex-1 min-w-0 max-w-4xl space-y-3">
        {/* Message Text with Typewriter Effect */}
        <div
          className={cn(
            'max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 transition-all duration-200',
            'bg-white text-gray-900 shadow-sm border border-gray-200 hover:border-gray-300'
          )}
        >
          <div className="text-sm sm:text-[15px] leading-relaxed">
            <div className="space-y-2">
              <TextGenerateEffect
                words={finalCopy.title}
                className="font-normal text-sm sm:text-[15px] no-margin"
                filter={true}
                duration={0.5}
                onComplete={handleTextGenerationComplete}
              />
              {finalCopy.description && (
                <p className="text-xs text-gray-600">{finalCopy.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Inline Artifact Cards - Show sequentially after text generation */}
        {textGenerationComplete && (
          <div className="max-w-[85%] sm:max-w-[75%] space-y-3">
            {/* Map artifact card */}
            {hasMap && showMapCard && (
              <div className="animate-in fade-in duration-300">
                <InlineArtifactCard
                  type="map"
                  artifactId="map"
                  status={mapStatus}
                  data={undefined}
                  onViewInPanel={onViewInPanel}
                />
              </div>
            )}
            
            {/* Document artifact card */}
            {hasDocument && showDocumentCard && (
              <div className="animate-in fade-in duration-300">
                <InlineArtifactCard
                  type="document"
                  artifactId={documentData.documentId || ''}
                  status={documentStatus}
                  data={documentArtifactData}
                  onViewInPanel={onViewInPanel}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
