'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, V2Conversation, V2ResearchHistory } from '@/lib/supabase';
import { enrichConversation, EnrichmentResult } from '@/lib/workers/conversationEnrichment';
import { useProgressiveLoading } from '@/hooks/useProgressiveLoading';

/**
 * Status of the overall enrichment process
 */
export type EnrichmentStatus = 'pending' | 'enriching' | 'complete' | 'error';

/**
 * Progress status for individual operations
 */
export type OperationProgress = 'loading' | 'success' | 'error';

/**
 * Return type for useEnrichment hook
 */
export interface UseEnrichmentReturn {
  /** Overall enrichment status */
  status: EnrichmentStatus;
  /** Progress status for each operation */
  progress: Record<string, OperationProgress>;
  /** Partial enrichment data as operations complete */
  data: Partial<EnrichmentResult>;
  /** Retry function to re-run enrichment */
  retry: () => void;
}

/**
 * React hook that manages conversation enrichment in the background
 * 
 * Checks if enrichment is needed and runs it in parallel without blocking the UI.
 * Uses useProgressiveLoading to track individual operation progress.
 * 
 * @param conversationId - UUID of the conversation
 * @param conversationData - Conversation data (can be null during loading)
 * @returns Object with status, progress, data, and retry function
 */
export function useEnrichment(
  conversationId: string,
  conversationData: V2Conversation | null
): UseEnrichmentReturn {
  const [overallStatus, setOverallStatus] = useState<EnrichmentStatus>('pending');
  const [enrichmentData, setEnrichmentData] = useState<Partial<EnrichmentResult>>({});
  const enrichmentInProgressRef = useRef(false);
  const retryKeyRef = useRef(0);

  // Check if enrichment is needed
  const needsEnrichment = useCallback(() => {
    if (!conversationData) return false;
    
    // Check enrichment status
    if (conversationData.enrichment_status === 'completed') {
      return false;
    }

    // Check if status is pending or in_progress
    if (conversationData.enrichment_status === 'pending' || 
        conversationData.enrichment_status === 'in_progress') {
      return true;
    }

    // Check if we have city_id/zone_id in research history
    // This is a fallback check
    return true; // Always return true if not completed, let the worker check
  }, [conversationData]);

  // Create loaders for useProgressiveLoading
  // We'll wrap the enrichment function to provide progress tracking
  const createLoaders = useCallback(() => {
    return {
      enrichment: async () => {
        console.log('[USE_ENRICHMENT] Starting enrichment worker');
        setOverallStatus('enriching');
        
        try {
          const result = await enrichConversation(conversationId);
          
          // Update data as enrichment completes
          setEnrichmentData({
            cityId: result.cityId,
            zoneId: result.zoneId,
            zoningId: result.zoningId,
            documentData: result.documentData,
            mapGeometry: result.mapGeometry,
            branchType: result.branchType,
            errors: result.errors,
            operationTimes: result.operationTimes,
          });

          // Check if there were any critical errors
          const hasCriticalErrors = !result.cityId || !result.zoneId;
          
          if (hasCriticalErrors) {
            setOverallStatus('error');
          } else {
            setOverallStatus('complete');
          }

          return result;
        } catch (error) {
          console.error('[USE_ENRICHMENT] Enrichment failed:', error);
          setOverallStatus('error');
          throw error;
        } finally {
          enrichmentInProgressRef.current = false;
        }
      },
    };
  }, [conversationId]);

  // Use progressive loading to track enrichment
  const { status: loaderStatus, errors: loaderErrors, data: loaderData, refresh } = useProgressiveLoading(
    needsEnrichment() && conversationData ? createLoaders() : {}
  );

  // Start enrichment when needed
  useEffect(() => {
    if (!conversationData) return;
    if (enrichmentInProgressRef.current) return;
    if (!needsEnrichment()) return;

    console.log('[USE_ENRICHMENT] Enrichment needed, starting...');
    enrichmentInProgressRef.current = true;
    refresh('enrichment');
  }, [conversationData, needsEnrichment, refresh]);

  // Map loader status to progress for individual operations
  // Track progress based on enrichment result errors and data
  const progress: Record<string, OperationProgress> = {
    enrichment: loaderStatus.enrichment === 'success' ? 'success' : 
                loaderStatus.enrichment === 'error' ? 'error' : 
                'loading',
    // Individual operations progress based on errors
    zones: enrichmentData.errors?.zones ? 'error' : 
           enrichmentData.mapGeometry ? 'success' : 
           overallStatus === 'enriching' ? 'loading' : 'loading',
    municipality: enrichmentData.errors?.municipality ? 'error' : 
                  enrichmentData.cityId ? 'success' : 
                  overallStatus === 'enriching' ? 'loading' : 'loading',
    city: enrichmentData.errors?.city ? 'error' : 
          enrichmentData.cityId ? 'success' : 
          overallStatus === 'enriching' ? 'loading' : 'loading',
    zoning: enrichmentData.errors?.zoning ? 'error' : 
            enrichmentData.zoningId ? 'success' : 
            overallStatus === 'enriching' ? 'loading' : 'loading',
    zone: enrichmentData.errors?.zone ? 'error' : 
          enrichmentData.zoneId ? 'success' : 
          overallStatus === 'enriching' ? 'loading' : 'loading',
    document: enrichmentData.errors?.document ? 'error' : 
              enrichmentData.documentData ? 'success' : 
              overallStatus === 'enriching' ? 'loading' : 'loading',
    map: enrichmentData.errors?.map ? 'error' : 
         enrichmentData.mapGeometry ? 'success' : 
         overallStatus === 'enriching' ? 'loading' : 'loading',
  };

  // Retry function
  const retry = useCallback(() => {
    console.log('[USE_ENRICHMENT] Retrying enrichment');
    enrichmentInProgressRef.current = false;
    retryKeyRef.current += 1;
    setOverallStatus('pending');
    setEnrichmentData({});
    
    // Trigger refresh
    if (conversationData) {
      refresh('enrichment');
    }
  }, [conversationData, refresh]);

  // Update overall status based on loader status
  useEffect(() => {
    if (loaderStatus.enrichment === 'loading' && overallStatus !== 'enriching') {
      setOverallStatus('enriching');
    } else if (loaderStatus.enrichment === 'success' && overallStatus !== 'complete') {
      // Check if we have critical data
      if (enrichmentData.cityId && enrichmentData.zoneId) {
        setOverallStatus('complete');
      } else {
        setOverallStatus('error');
      }
    } else if (loaderStatus.enrichment === 'error' && overallStatus !== 'error') {
      setOverallStatus('error');
    }
  }, [loaderStatus.enrichment, overallStatus, enrichmentData]);

  // Merge loader data with enrichment data
  useEffect(() => {
    if (loaderData.enrichment) {
      const result = loaderData.enrichment as EnrichmentResult;
      setEnrichmentData({
        cityId: result.cityId,
        zoneId: result.zoneId,
        zoningId: result.zoningId,
        documentData: result.documentData,
        mapGeometry: result.mapGeometry,
        branchType: result.branchType,
        errors: result.errors,
        operationTimes: result.operationTimes,
      });
    }
  }, [loaderData.enrichment]);

  return {
    status: overallStatus,
    progress,
    data: enrichmentData,
    retry,
  };
}

