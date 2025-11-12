'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { UseEnrichmentReturn } from '@/app/(app)/chat/[conversation_id]/useEnrichment';

interface LoadingAssistantMessageProps {
  enrichment: UseEnrichmentReturn;
}

type LoadingStage = 'step1' | 'step2' | 'step3' | 'fallback';

const LOADING_MESSAGES: Record<LoadingStage, string> = {
  step1: 'Vérification de la zone concernée...',
  step2: 'Récupération des documents sources...',
  step3: 'Récupération de l\'analyse correspondante...',
  fallback: 'Vérification des données...',
};

export function LoadingAssistantMessage({ enrichment }: LoadingAssistantMessageProps) {
  const { resolvedTheme } = useTheme();
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('step1');
  const [mounted, setMounted] = useState(false);

  // Determine theme-aware logo path
  const logoSrc = resolvedTheme === 'dark' 
    ? '/square-white-plu.svg' 
    : '/square-black-plu.svg';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine loading stage based on enrichment progress
  useEffect(() => {
    const { progress, status } = enrichment;

    // Step 1: When zones or municipality operations are running
    if (progress.zones === 'loading' || progress.municipality === 'loading') {
      setLoadingStage('step1');
      return;
    }

    // Step 2: When document operation is running
    if (progress.document === 'loading') {
      setLoadingStage('step2');
      return;
    }

    // Step 3: When enrichment is completing but not yet done
    // Check if we have zones/municipality success but document is still processing
    if (
      (progress.zones === 'success' || progress.municipality === 'success') &&
      status === 'enriching'
    ) {
      setLoadingStage('step3');
      return;
    }

    // Fallback: When enrichment is in progress but no specific stage detected
    if (status === 'enriching') {
      setLoadingStage('fallback');
      return;
    }

    // Default to step1 if status is pending
    if (status === 'pending') {
      setLoadingStage('step1');
    }
  }, [enrichment.progress, enrichment.status]);

  const currentMessage = LOADING_MESSAGES[loadingStage];

  return (
    <div
      className={cn(
        'flex gap-2 px-3 py-2 sm:px-4 sm:py-2.5',
        'justify-start'
      )}
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
          'max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 transition-all duration-200',
          'bg-white text-gray-900 shadow-sm border border-gray-200 hover:border-gray-300'
        )}
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

