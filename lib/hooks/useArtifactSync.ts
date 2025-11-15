'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useArtifactStore, type ArtifactState } from '@/lib/stores/artifactStore';
import { supabase } from '@/lib/supabase';
import {
  mergePanelStateMetadata,
  resolvePanelState,
} from '@/lib/utils/branchMetadata';

interface UseArtifactSyncOptions {
  initialMetadata?: Record<string, any> | null;
}
import type { ZoneArtifactData, MapArtifactData, DocumentArtifactData } from '@/types/artifacts';

/**
 * Return type for useArtifactSync hook
 */
export interface UseArtifactSyncReturn {
  /**
   * Artifact state for all artifact types
   * Each can be null if enrichment hasn't started yet
   */
  artifacts: {
    zone: ArtifactState | null;
    map: ArtifactState | null;
    document: ArtifactState | null;
  };

  /**
   * Currently active tab in the right panel
   */
  activeTab: 'map' | 'document';

  /**
   * Switch the active tab
   */
  setActiveTab: (tab: 'map' | 'document') => void;

  /**
   * Update an artifact's state
   */
  updateArtifact: (
    type: 'zone' | 'map' | 'document',
    updates: Partial<ArtifactState>
  ) => void;

  /**
   * Open artifact in panel and switch to appropriate tab
   * Returns the tab that should be opened (for zone artifacts, returns 'map')
   */
  openArtifactInPanel: (type: 'zone' | 'map' | 'document') => 'map' | 'document';

  /**
   * Reset all artifacts for this conversation
   */
  resetArtifacts: () => void;

  /**
   * Check if an artifact is fully rendered (status 'ready' AND renderingStatus 'complete')
   */
  isArtifactRendered: (type: 'zone' | 'map' | 'document') => boolean;
}

/**
 * React hook for managing shared artifact state between inline cards and right panel
 * 
 * Provides a single source of truth for all artifact data in a conversation.
 * Automatically initializes conversation state on mount.
 * 
 * @param conversationId - UUID of the conversation
 * @returns Object with artifacts, activeTab, and update methods
 * 
 * @example
 * ```typescript
 * const { artifacts, updateArtifact, openArtifactInPanel, activeTab } = 
 *   useArtifactSync(conversationId);
 * 
 * // When enrichment completes
 * updateArtifact('zone', {
 *   status: 'ready',
 *   data: zoneData
 * });
 * 
 * // Open panel and switch tab
 * const tabToOpen = openArtifactInPanel('zone'); // Returns 'map'
 * setRightPanelOpen(true);
 * ```
 */
export function useArtifactSync(
  conversationId: string,
  options: UseArtifactSyncOptions = {}
): UseArtifactSyncReturn {
  // Initialize conversation on mount
  const initializeConversation = useArtifactStore(
    (state) => state.initializeConversation
  );
  const updateArtifact = useArtifactStore((state) => state.updateArtifact);
  const setActiveTab = useArtifactStore((state) => state.setActiveTab);
  const resetConversation = useArtifactStore((state) => state.resetConversation);
  const getConversationState = useArtifactStore((state) => state.getConversationState);

  const [metadataSnapshot, setMetadataSnapshot] = useState<Record<string, any> | null>(
    options.initialMetadata ?? null
  );
  const metadataSignatureRef = useRef<string | null>(null);
  const lastPersistedSignatureRef = useRef<string | null>(null);
  const initialTabAppliedRef = useRef(false);

  const normalizedMetadata = options.initialMetadata ?? null;

  // Track metadata changes from caller and refresh snapshot when it updates
  useEffect(() => {
    const serialized = normalizedMetadata ? JSON.stringify(normalizedMetadata) : null;
    if (metadataSignatureRef.current === serialized) {
      return;
    }
    metadataSignatureRef.current = serialized;
    setMetadataSnapshot(normalizedMetadata);
    initialTabAppliedRef.current = false;
  }, [normalizedMetadata]);

  const resolvedInitialTab = useMemo(() => {
    return resolvePanelState(metadataSnapshot).activeTab;
  }, [metadataSnapshot]);

  // Initialize conversation state on mount
  useEffect(() => {
    if (conversationId) {
      initializeConversation(conversationId, resolvedInitialTab);
    }
  }, [conversationId, initializeConversation, resolvedInitialTab]);

  // Subscribe to conversation state
  const conversationState = useArtifactStore((state) =>
    state.conversations[conversationId]
  );

  // Get current artifacts and active tab
  const artifacts = conversationState?.artifacts ?? {
    zone: null,
    map: null,
    document: null,
  };

  const activeTab =
    conversationState && initialTabAppliedRef.current
      ? conversationState.activeTab
      : resolvedInitialTab ?? 'map';


  // Wrapped update method that includes conversationId
  const handleUpdateArtifact = useCallback(
    (type: 'zone' | 'map' | 'document', updates: Partial<ArtifactState>) => {
      updateArtifact(conversationId, type, updates);
    },
    [conversationId, updateArtifact]
  );

  // Wrapped setActiveTab method
  const handleSetActiveTab = useCallback(
    (tab: 'map' | 'document') => {
      setActiveTab(conversationId, tab);
    },
    [conversationId, setActiveTab]
  );

  // Helper to open artifact in panel
  // Zone artifacts open map tab, others open their own tab
  const handleOpenArtifactInPanel = useCallback(
    (type: 'zone' | 'map' | 'document'): 'map' | 'document' => {
      const tabToOpen = type === 'zone' ? 'map' : type;
      handleSetActiveTab(tabToOpen);
      return tabToOpen;
    },
    [handleSetActiveTab]
  );

  // Reset artifacts
  const handleResetArtifacts = useCallback(() => {
    resetConversation(conversationId);
    // Re-initialize after reset
    initializeConversation(conversationId, resolvedInitialTab);
  }, [conversationId, resetConversation, initializeConversation, resolvedInitialTab]);

  // Check if artifact is fully rendered
  const handleIsArtifactRendered = useCallback(
    (type: 'zone' | 'map' | 'document'): boolean => {
      const artifact = artifacts[type];
      
      console.log(`[ARTIFACT_SYNC] isArtifactRendered check for ${type}:`, {
        exists: !!artifact,
        status: artifact?.status,
        renderingStatus: artifact?.renderingStatus
      });
      
      if (!artifact) return false;
      
      // Artifact is rendered if status is 'ready' AND renderingStatus is 'complete'
      const isRendered = (
        artifact.status === 'ready' &&
        artifact.renderingStatus === 'complete'
      );
      
      console.log(`[ARTIFACT_SYNC] ${type} isRendered:`, isRendered);
      return isRendered;
    },
    [artifacts]
  );

  // Apply initial panel tab from metadata only once per conversation
  useEffect(() => {
    if (!conversationId || !conversationState) {
      return;
    }

    if (initialTabAppliedRef.current) {
      return;
    }

    if (conversationState.activeTab !== resolvedInitialTab) {
      handleSetActiveTab(resolvedInitialTab);
    }
    initialTabAppliedRef.current = true;
  }, [conversationId, conversationState, resolvedInitialTab, handleSetActiveTab]);

  // Persist panel state + artifact readiness to Supabase
  useEffect(() => {
    if (!conversationId || !initialTabAppliedRef.current) {
      return;
    }

    const artifactUpdates: Record<string, any> = {};
    let hasArtifactUpdates = false;

    if (artifacts.map) {
      const prevMap = metadataSnapshot?.artifacts?.map;
      if (
        artifacts.map.status !== prevMap?.status ||
        artifacts.map.renderingStatus !== prevMap?.rendering_status
      ) {
        artifactUpdates.map = {
          status: artifacts.map.status,
          rendering_status: artifacts.map.renderingStatus,
        };
        hasArtifactUpdates = true;
      }
    }

    if (artifacts.document) {
      const prevDoc = metadataSnapshot?.artifacts?.document;
      if (
        artifacts.document.status !== prevDoc?.status ||
        artifacts.document.renderingStatus !== prevDoc?.rendering_status
      ) {
        artifactUpdates.document = {
          status: artifacts.document.status,
          rendering_status: artifacts.document.renderingStatus,
        };
        hasArtifactUpdates = true;
      }
    }

    const shouldUpdateTab =
      metadataSnapshot?.panel_state?.active_tab !== activeTab;

    if (!shouldUpdateTab && !hasArtifactUpdates) {
      return;
    }

    const nextMetadata = mergePanelStateMetadata(metadataSnapshot, {
      activeTab: shouldUpdateTab ? activeTab : undefined,
      artifacts: hasArtifactUpdates ? artifactUpdates : undefined,
    });

    const serialized = JSON.stringify(nextMetadata);
    if (serialized === lastPersistedSignatureRef.current) {
      return;
    }

    lastPersistedSignatureRef.current = serialized;

    (async () => {
      const { error } = await supabase
        .from('v2_conversations')
        .update({ document_metadata: nextMetadata })
        .eq('id', conversationId);

      if (error) {
        console.error('[ARTIFACT_SYNC] Failed to persist panel state', error);
        lastPersistedSignatureRef.current = null;
      }
    })();
  }, [
    conversationId,
    artifacts.map,
    artifacts.document,
    activeTab,
    metadataSnapshot,
  ]);

  return {
    artifacts,
    activeTab,
    setActiveTab: handleSetActiveTab,
    updateArtifact: handleUpdateArtifact,
    openArtifactInPanel: handleOpenArtifactInPanel,
    resetArtifacts: handleResetArtifacts,
    isArtifactRendered: handleIsArtifactRendered,
  };
}
