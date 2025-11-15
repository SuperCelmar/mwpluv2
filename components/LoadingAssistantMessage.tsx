'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { UseEnrichmentReturn } from '@/app/(app)/chat/[conversation_id]/useEnrichment';
import type { ConversationBranch } from '@/types/enrichment';

interface LoadingAssistantMessageProps {
  enrichment: UseEnrichmentReturn;
  isMapRendered?: boolean;
  isDocumentRendered?: boolean;
  isFadingOut?: boolean;
}

type LoadingStage = 'step1' | 'step2' | 'step3';

export function LoadingAssistantMessage({ 
  enrichment, 
  isMapRendered = false,
  isDocumentRendered = false,
  isFadingOut = false
}: LoadingAssistantMessageProps) {
  const { resolvedTheme } = useTheme();
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('step1');
  const [mounted, setMounted] = useState(false);
  const [messageOpacity, setMessageOpacity] = useState(1);
  const branchType: ConversationBranch =
    (enrichment.data?.branchType as ConversationBranch) ||
    (enrichment.data?.documentData?.hasAnalysis ? 'non_rnu_analysis' : 'non_rnu_source');
  const shouldShowAnalysisStep = branchType === 'non_rnu_analysis';
  const step2Message =
    branchType === 'rnu'
      ? 'Récupération du RNU...'
      : 'Vérification de la présence d\'analyse...';
  const step3Message = 'Récupération de l\'analyse correspondante...';
  
  // Track timestamps for timing control
  const mapPolygonRenderedTimestamp = useRef<number | null>(null);
  const documentSkeletonTimestamp = useRef<number | null>(null);
  const step1MinDelayRef = useRef<NodeJS.Timeout | null>(null);
  const step2MinDelayRef = useRef<NodeJS.Timeout | null>(null);
  const step3MinDelayRef = useRef<NodeJS.Timeout | null>(null);

  // Determine theme-aware logo path
  const logoSrc = resolvedTheme === 'dark' 
    ? '/square-white-plu.svg' 
    : '/square-black-plu.svg';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Step 1: Map marker displayed, wait for polygon, then 2s delay
  useEffect(() => {
    const { progress, data } = enrichment;
    
    console.log('[LOADING_MESSAGE] Step 1 check:', {
      loadingStage,
      isMapRendered,
      hasMapGeometry: !!data.mapGeometry,
      timestampExists: !!mapPolygonRenderedTimestamp.current,
      progressZones: progress.zones,
      progressMunicipality: progress.municipality
    });
    
    // Check if we're in Step 1 and map is rendered (marker only, not polygon)
    // Polygon rendering is cosmetic and shouldn't block step progression
    if (loadingStage === 'step1' && isMapRendered && !mapPolygonRenderedTimestamp.current) {
      console.log('[LOADING_MESSAGE] Step 1: Map marker rendered, starting 2s delay');
      mapPolygonRenderedTimestamp.current = Date.now();
      
      // After 2 seconds, transition to Step 2
      step1MinDelayRef.current = setTimeout(() => {
        console.log('[LOADING_MESSAGE] Step 1: 2s delay complete, transitioning to Step 2');
        // Fade out message
        setMessageOpacity(0);
        // After fade out, switch to Step 2
        setTimeout(() => {
          setLoadingStage('step2');
          setMessageOpacity(1);
        }, 300); // Match fade duration
      }, 2000);
    }
  }, [loadingStage, isMapRendered, enrichment.data.mapGeometry]);

  // Step 2: Document skeleton shown, wait 1s, then fade in analysis
  useEffect(() => {
    const { progress, data } = enrichment;
    
    console.log('[LOADING_MESSAGE] Step 2 check:', {
      loadingStage,
      hasDocumentId: !!data.documentData?.documentId,
      hasHtmlContent: !!data.documentData?.htmlContent,
      timestampExists: !!documentSkeletonTimestamp.current,
      progressDocument: progress.document
    });
    
    // Check if we're in Step 2 and document skeleton is showing
    if (loadingStage === 'step2' && data.documentData?.documentId && !documentSkeletonTimestamp.current) {
      console.log('[LOADING_MESSAGE] Step 2: Document skeleton showing, starting 1s delay');
      documentSkeletonTimestamp.current = Date.now();
      
      // After 1 second, check if document content is ready
      step2MinDelayRef.current = setTimeout(() => {
        console.log('[LOADING_MESSAGE] Step 2: 1s delay complete');
        // If document has content and analysis is expected, transition to Step 3
        if (shouldShowAnalysisStep && data.documentData?.htmlContent) {
          console.log('[LOADING_MESSAGE] Step 2: Document content ready, transitioning to Step 3');
          // Fade out message
          setMessageOpacity(0);
          // After fade out, switch to Step 3
          setTimeout(() => {
            setLoadingStage('step3');
            setMessageOpacity(1);
          }, 300);
        }
      }, 1000);
    }
  }, [loadingStage, enrichment.data.documentData]);

  // Step 3: Analysis message shown, wait 1s, then start fade out
  useEffect(() => {
    const { data } = enrichment;
    
    console.log('[LOADING_MESSAGE] Step 3 check:', {
      loadingStage,
      isDocumentRendered,
      hasHtmlContent: !!data.documentData?.htmlContent
    });
    
    // Check if we're in Step 3 and document is rendered
    if (
      shouldShowAnalysisStep &&
      loadingStage === 'step3' &&
      isDocumentRendered &&
      data.documentData?.htmlContent
    ) {
      console.log('[LOADING_MESSAGE] Step 3: Document rendered, starting 1s delay before fade out');
      
      // After 1 second, start fade out
      step3MinDelayRef.current = setTimeout(() => {
        console.log('[LOADING_MESSAGE] Step 3: 1s delay complete, starting fade out');
        setMessageOpacity(0);
        // Component will be unmounted by parent after fade completes
      }, 1000);
    }
  }, [loadingStage, isDocumentRendered, enrichment.data.documentData]);

  // Handle external fade out request
  useEffect(() => {
    if (isFadingOut) {
      setMessageOpacity(0);
    }
  }, [isFadingOut]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (step1MinDelayRef.current) clearTimeout(step1MinDelayRef.current);
      if (step2MinDelayRef.current) clearTimeout(step2MinDelayRef.current);
      if (step3MinDelayRef.current) clearTimeout(step3MinDelayRef.current);
    };
  }, []);

  const currentMessage =
    loadingStage === 'step1'
      ? 'Vérification de la zone concernée...'
      : loadingStage === 'step2'
        ? step2Message
        : step3Message;

  return (
    <div
      className={cn(
        'flex gap-2 px-3 py-2 sm:px-4 sm:py-2.5',
        'justify-start transition-opacity duration-300'
      )}
      style={{ opacity: messageOpacity }}
      role="article"
      aria-label="Assistant loading message"
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

      {/* Loading Message Bubble */}
      <div
        className={cn(
          'max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5',
          'bg-white text-gray-900 shadow-sm border border-gray-200 hover:border-gray-300'
        )}
        key={loadingStage}
      >
        <div className="flex items-center gap-2">
          <TextShimmer 
            className="text-sm sm:text-[15px] leading-relaxed"
            duration={1.5}
          >
            {currentMessage}
          </TextShimmer>
        </div>
      </div>
    </div>
  );
}

