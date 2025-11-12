'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InlineArtifactCard } from '@/components/InlineArtifactCard';
import type { UseEnrichmentReturn } from '@/app/(app)/chat/[conversation_id]/useEnrichment';
import type { DocumentArtifactData } from '@/types/artifacts';

interface AnalysisFoundMessageProps {
  enrichment: UseEnrichmentReturn;
  zoneName: string;
  onViewInPanel: (type: 'zone' | 'map' | 'document') => void;
}

export function AnalysisFoundMessage({ 
  enrichment, 
  zoneName,
  onViewInPanel 
}: AnalysisFoundMessageProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Determine theme-aware logo path
  const logoSrc = resolvedTheme === 'dark' 
    ? '/square-white-plu.svg' 
    : '/square-black-plu.svg';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Extract document data from enrichment
  const documentData = enrichment.data.documentData;
  const hasDocument = documentData && documentData.documentId;

  // Determine artifact status
  const artifactStatus: 'loading' | 'ready' | 'error' = 
    enrichment.progress.document === 'error' ? 'error' :
    enrichment.progress.document === 'success' && hasDocument ? 'ready' :
    'loading';

  // Prepare document artifact data if available
  let documentArtifactData: DocumentArtifactData | undefined;
  if (documentData && documentData.documentId) {
    // We need to fetch more details about the document, but for now use what we have
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
        'justify-start'
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
        {/* Message Text */}
        <div
          className={cn(
            'max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 transition-all duration-200',
            'bg-white text-gray-900 shadow-sm border border-gray-200 hover:border-gray-300'
          )}
        >
          <p className="text-sm sm:text-[15px] leading-relaxed">
            {zoneName 
              ? `Voici l'analyse concernant la zone ${zoneName}:`
              : 'Voici l\'analyse concernant cette zone:'}
          </p>
        </div>

        {/* Inline Artifact Card */}
        {hasDocument && (
          <div className="max-w-[85%] sm:max-w-[75%]">
            <InlineArtifactCard
              type="document"
              artifactId={documentData.documentId || ''}
              status={artifactStatus}
              data={documentArtifactData}
              onViewInPanel={onViewInPanel}
            />
          </div>
        )}
      </div>
    </div>
  );
}
