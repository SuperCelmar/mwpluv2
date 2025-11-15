'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, V2Conversation, V2Message, V2ResearchHistory, V2Project } from '@/lib/supabase';
import { logChatEvent, getFirstDocumentId } from '@/lib/analytics';
import { useEnrichment } from './useEnrichment';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { ConversationBreadcrumb } from '@/components/ConversationBreadcrumb';
import { RenameConversationDialog } from '@/components/RenameConversationDialog';
import { DeleteConversationDialog } from '@/components/DeleteProjectDialog';
import { LoadingAssistantMessage } from '@/components/LoadingAssistantMessage';
import { AnalysisFoundMessage } from '@/components/AnalysisFoundMessage';
import { ChatRightPanel } from '@/components/ChatRightPanel';
import { useArtifactSync } from '@/lib/hooks/useArtifactSync';
import { InlineArtifactCard } from '@/components/InlineArtifactCard';
import { getArtifactId } from '@/lib/utils/artifactDetection';
import type { MapArtifactData, DocumentArtifactData } from '@/types/artifacts';
import { toast } from '@/hooks/use-toast';
import type { ConversationBranch } from '@/types/enrichment';
import { determineConversationBranch } from '@/lib/utils/enrichmentBranches';

export default function ChatConversationPage({ params }: { params: { conversation_id: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [zoneName, setZoneName] = useState<string>('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoOpenedPanelRef = useRef(false);
  const analysisMessageSavedRef = useRef(false);
  const [analysisMessageTextComplete, setAnalysisMessageTextComplete] = useState<Record<string, boolean>>({});
  const [showFinalAnalysisMessage, setShowFinalAnalysisMessage] = useState(false);
  const [loadingMessageFadingOut, setLoadingMessageFadingOut] = useState(false);

  // Fetch user authentication using React Query
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return null;
      }
      return user;
    },
    retry: false,
  });

  const userId = user?.id || null;

  // Fetch conversation using React Query
  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: ['conversation', params.conversation_id],
    queryFn: async () => {
      if (!userId) return null;

      const { data: conv, error } = await supabase
        .from('v2_conversations')
        .select('*')
        .eq('id', params.conversation_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!conv) {
        router.push('/');
        return null;
      }
      return conv;
    },
    enabled: !!userId,
    onError: () => {
      router.push('/');
    },
  });

  // Fetch project using React Query (conditional)
  const { data: project } = useQuery({
    queryKey: ['project', conversation?.project_id],
    queryFn: async () => {
      if (!userId || !conversation?.project_id) return null;

      const { data, error } = await supabase
        .from('v2_projects')
        .select('*')
        .eq('id', conversation.project_id)
        .maybeSingle();

      if (error) {
        console.error('[CHAT_PAGE] Error loading project:', error);
        return null;
      }
      return data;
    },
    enabled: !!userId && !!conversation?.project_id,
  });

  // Fetch messages using React Query
  const { data: messagesData = [] } = useQuery({
    queryKey: ['messages', params.conversation_id],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('v2_messages')
        .select('*')
        .eq('conversation_id', params.conversation_id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Compute messages with initial address message if needed
  const messages = useMemo(() => {
    if (!conversation || messagesData.length > 0) {
      return messagesData;
    }

    // Add initial address as first message if it exists and no messages yet
    const initialAddress = conversationContextMetadata?.initial_address;
    if (initialAddress) {
      const addressMessage: V2Message = {
        id: `initial-address-${conversation.id}`,
        conversation_id: params.conversation_id,
        user_id: userId!,
        role: 'user',
        message: initialAddress,
        message_type: 'address_search',
        conversation_turn: 1,
        referenced_documents: null,
        referenced_zones: null,
        referenced_cities: null,
        search_context: null,
        intent_detected: null,
        confidence_score: null,
        ai_model_used: null,
        reply_to_message_id: null,
        metadata: null,
        created_at: conversation.created_at || new Date().toISOString(),
      };
      return [addressMessage];
    }

    return messagesData;
  }, [
    conversation,
    messagesData,
    params.conversation_id,
    userId,
    conversationContextMetadata?.initial_address,
  ]);

  const isFirstMessage = messages.length === 0 || (messages.length === 1 && messages[0].message_type === 'address_search');

  // Fetch research history using React Query
  const { data: researchContext } = useQuery({
    queryKey: ['research-history', params.conversation_id],
    queryFn: async () => {
      if (!userId) return null;

      const { data } = await supabase
        .from('v2_research_history')
        .select('*')
        .eq('conversation_id', params.conversation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return data || null;
    },
    enabled: !!userId,
  });

  const loading = conversationLoading;

  // Use enrichment hook for background enrichment
  const enrichment = useEnrichment(params.conversation_id, conversation);

  // Use artifact sync hook for managing artifacts
  const artifactSync = useArtifactSync(params.conversation_id);
  
  // Extract stable methods and values to avoid including entire artifactSync object in dependencies
  const { 
    setActiveTab: setArtifactTab, 
    updateArtifact: updateArtifactState,
    artifacts,
    activeTab: artifactActiveTab
  } = artifactSync;

  // useEffect: DOM manipulation (auto-scroll)
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, [messages]);

  const conversationContextMetadata = conversation?.context_metadata as any;
  const cityNameFromContext = conversationContextMetadata?.city || '';
  const inseeCodeFromContext = conversationContextMetadata?.insee_code || '';
  const persistedEnrichment = conversationContextMetadata?.enrichment;
  const resolvedZoneId =
    enrichment.data.zoneId || persistedEnrichment?.zone_id || null;
  const conversationDocumentMetadata = (conversation?.document_metadata as any) || null;
  const resolvedDocumentId =
    enrichment.data.documentData?.documentId ||
    conversation?.primary_document_id ||
    conversationDocumentMetadata?.document_id ||
    null;

  // Fetch zone name/geometry using React Query when available
  const { data: zoneData } = useQuery({
    queryKey: ['zone-name', resolvedZoneId],
    queryFn: async () => {
      if (!resolvedZoneId) return null;
      const { data } = await supabase
        .from('zones')
        .select('description, name, geometry')
        .eq('id', resolvedZoneId)
        .maybeSingle();
      return data;
    },
    enabled: !!resolvedZoneId && !zoneName,
    onSuccess: (data) => {
      if (data) {
        const extractedZoneName = data.description || data.name || '';
        if (extractedZoneName) {
          setZoneName(extractedZoneName);
        }
      }
    },
  });

  const { data: persistedDocument } = useQuery({
    queryKey: ['document-artifact', resolvedDocumentId],
    queryFn: async () => {
      if (!resolvedDocumentId) return null;
      const { data } = await supabase
        .from('documents')
        .select('id, html_content, source_plu_url, typology_id')
        .eq('id', resolvedDocumentId)
        .maybeSingle();
      return data;
    },
    enabled: !!resolvedDocumentId && !enrichment.data.documentData?.htmlContent,
  });

  // useEffect: state synchronization (map artifact sync)
  useEffect(() => {
    const lon = conversationContextMetadata?.geocoded?.lon;
    const lat = conversationContextMetadata?.geocoded?.lat;
    const mapGeometry = enrichment.data.mapGeometry || (zoneData as any)?.geometry || null;

    // Initialize map artifact when coordinates are available
    // Works for both active enrichment and completed conversations
    if (lon !== undefined && lat !== undefined) {
      const currentMap = artifacts.map;
      
      // Initialize map with just coordinates if we don't have geometry yet
    const mapData: MapArtifactData = {
      center: { lat, lon },
      geometry: mapGeometry || undefined, // Geometry is optional now
      cityName: cityNameFromContext,
      zoneName: zoneName || undefined,
    };

      // If map doesn't exist yet, initialize it with coordinates
      if (!currentMap) {
        updateArtifactState('map', {
          status: 'ready',
          data: mapData,
          renderingStatus: 'pending',
        });
      } else {
        const currentMapData = currentMap.data as MapArtifactData | undefined;
        if (mapGeometry && currentMapData && !currentMapData.geometry) {
          // Update with geometry when it arrives
          updateArtifactState('map', {
            status: 'ready',
            data: {
              ...currentMapData,
              geometry: mapGeometry,
            },
            renderingStatus: 'pending',
          });
        } else if (currentMapData && !currentMapData.geometry && mapGeometry) {
          // Update geometry if it wasn't set before
          updateArtifactState('map', {
            status: 'ready',
            data: {
              ...currentMapData,
              geometry: mapGeometry,
            },
            renderingStatus: 'pending',
          });
        }
      }
    }
  }, [
    enrichment.data.mapGeometry,
    zoneData,
    enrichment.status,
    conversation,
    conversationContextMetadata,
    cityNameFromContext,
    zoneName,
    artifacts.map,
    updateArtifactState,
  ]);

  const resolvedDocumentData = useMemo(() => {
    if (enrichment.data.documentData?.documentId) {
      return enrichment.data.documentData;
    }

    if (!resolvedDocumentId) {
      return null;
    }

    return {
      documentId: resolvedDocumentId,
      htmlContent: persistedDocument?.html_content || null,
      hasAnalysis: conversation?.has_analysis ?? false,
      sourceUrl:
        enrichment.data.documentData?.sourceUrl ||
        conversationDocumentMetadata?.source_plu_url ||
        persistedDocument?.source_plu_url ||
        null,
    };
  }, [
    enrichment.data.documentData,
    resolvedDocumentId,
    persistedDocument,
    conversation?.has_analysis,
    conversationDocumentMetadata,
  ]);

  // useEffect: state synchronization (document artifact sync)
  useEffect(() => {
    if (resolvedDocumentData?.documentId) {
      const docData = resolvedDocumentData;
      const documentData: DocumentArtifactData = {
        documentId: docData.documentId,
        title: 'Document PLU',
        type: 'PLU',
        htmlContent: docData.htmlContent || undefined,
        hasAnalysis: docData.hasAnalysis,
          cityName: cityNameFromContext,
          inseeCode: inseeCodeFromContext,
        sourceUrl: docData.sourceUrl || undefined,
      };

      const currentDoc = artifacts.document;
      
      // Initialize document artifact
      if (!currentDoc) {
        updateArtifactState('document', {
          status: docData.htmlContent || (conversation?.has_analysis ?? false) ? 'ready' : 'loading',
          data: documentData,
          renderingStatus: 'pending',
        });
        
        // Step 2: Switch to document tab immediately when document ID is found (show skeleton)
        if (isPanelOpen && artifactActiveTab === 'map' && 
            conversation?.enrichment_status !== 'completed') {
          console.log('[CHAT_PAGE] Step 2: Switching to document tab (showing skeleton)');
          setArtifactTab('document');
        }
      } else {
        const currentDocData = currentDoc.data as DocumentArtifactData | undefined;
        if (docData.htmlContent && currentDocData && !currentDocData.htmlContent) {
          // Update with HTML content when it arrives
          updateArtifactState('document', {
            status: 'ready',
            data: {
              ...currentDocData,
              htmlContent: docData.htmlContent,
            },
            renderingStatus: 'pending',
          });
        } else if (docData.htmlContent && currentDocData && currentDocData.htmlContent !== docData.htmlContent) {
          // Update HTML content if it changed
          updateArtifactState('document', {
            status: 'ready',
            data: {
              ...currentDocData,
              htmlContent: docData.htmlContent,
            },
            renderingStatus: 'pending',
          });
        }
      }
    }
  }, [
    resolvedDocumentData,
    conversation,
    artifacts.document,
    isPanelOpen,
    artifactActiveTab,
    updateArtifactState,
    setArtifactTab,
    cityNameFromContext,
    inseeCodeFromContext,
  ]);

  // useEffect: reset refs when conversation changes
  useEffect(() => {
    hasAutoOpenedPanelRef.current = false;
    analysisMessageSavedRef.current = false;
    setAnalysisMessageTextComplete({});
    setShowFinalAnalysisMessage(false);
    setLoadingMessageFadingOut(false);
  }, [params.conversation_id]);

  // useEffect: UI state transition (enrichment completion)
  useEffect(() => {
    // Only trigger if we have document content and it's rendered
    const hasDocumentContent = enrichment.data.documentData?.htmlContent;
    const isDocumentRendered = artifactSync.isArtifactRendered('document');
    const enrichmentComplete = enrichment.status === 'complete';
    const conversationEnrichmentComplete = conversation?.enrichment_status === 'completed';
    
    console.log('[CHAT_PAGE] Transition check:', {
      hasDocumentContent: !!hasDocumentContent,
      isDocumentRendered,
      enrichmentComplete,
      conversationEnrichmentComplete,
      enrichmentStatus: enrichment.status,
      conversationStatus: conversation?.enrichment_status,
      showFinalAnalysisMessage,
      loadingMessageFadingOut
    });
    
    if (hasDocumentContent && isDocumentRendered && (enrichmentComplete || conversationEnrichmentComplete) && !showFinalAnalysisMessage && !loadingMessageFadingOut) {
      console.log('[CHAT_PAGE] Enrichment complete, triggering transition to final analysis message');
      
      // First fade out the loading message
      setLoadingMessageFadingOut(true);
      
      // After fade out completes (300ms), show final analysis message
      setTimeout(() => {
        setShowFinalAnalysisMessage(true);
      }, 400); // Slightly longer than fade duration
    }
  }, [
    enrichment.status,
    enrichment.data.documentData,
    conversation?.enrichment_status,
    artifactSync,
    showFinalAnalysisMessage,
    loadingMessageFadingOut
  ]);

  // Save analysis message mutation
  const saveAnalysisMessageMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !conversation || !enrichment.data.documentData?.documentId) {
        throw new Error('Missing required data');
      }

      // Check if message already exists in database
      const { data: existingMessages } = await supabase
        .from('v2_messages')
        .select('id')
        .eq('conversation_id', params.conversation_id)
        .eq('role', 'assistant')
        .ilike('message', '%Voici l\'analyse%')
        .limit(1);

      if (existingMessages && existingMessages.length > 0) {
        return null; // Already exists
      }

      // Create artifact references
      const artifactReferences: Array<{
        type: 'map' | 'document';
        artifactId: string;
        reason: string;
        timestamp: string;
        metadata?: any;
      }> = [];

      if (enrichment.data.mapGeometry && enrichment.data.zoneId) {
        artifactReferences.push({
          type: 'map',
          artifactId: getArtifactId('map', {
            zoneId: enrichment.data.zoneId,
            conversationId: params.conversation_id,
          }),
          reason: 'enrichment-complete',
          timestamp: new Date().toISOString(),
          metadata: {
            geometry: enrichment.data.mapGeometry,
            center: {
              lat: conversationContextMetadata?.geocoded?.lat,
              lon: conversationContextMetadata?.geocoded?.lon,
            },
            zoneId: enrichment.data.zoneId,
          },
        });
      }

      if (enrichment.data.documentData?.documentId) {
        const docData = enrichment.data.documentData;
        if (docData.documentId) {
          const typedDocData = {
            documentId: docData.documentId,
            htmlContent: docData.htmlContent || undefined,
            hasAnalysis: docData.hasAnalysis || false,
          };
          artifactReferences.push({
            type: 'document',
            artifactId: getArtifactId('document', {
              documentData: typedDocData as any,
            }),
            reason: 'enrichment-complete',
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (artifactReferences.length === 0) {
        return null;
      }

      const analysisMessageText = zoneName
        ? `Voici l'analyse concernant la zone ${zoneName}:`
        : 'Voici l\'analyse concernant cette zone:';

      const { data: insertedMessage, error } = await supabase
        .from('v2_messages')
        .insert({
          conversation_id: params.conversation_id,
          user_id: userId,
          role: 'assistant',
          message: analysisMessageText,
          message_type: 'text',
          conversation_turn: messages.length + 1,
          metadata: {
            artifacts: artifactReferences,
          },
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation metadata
      await supabase
        .from('v2_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          message_count: messages.length + 1,
        })
        .eq('id', params.conversation_id);

      return insertedMessage;
    },
    onSuccess: (insertedMessage) => {
      if (insertedMessage) {
        // Invalidate messages query to refresh
        queryClient.invalidateQueries({ queryKey: ['messages', params.conversation_id] });
        analysisMessageSavedRef.current = true;
      }
    },
  });

  // useEffect: trigger analysis message save when conditions are met
  useEffect(() => {
    const isDocumentRendered = artifactSync.isArtifactRendered('document');
      
    const shouldSave = (
      enrichment.status === 'complete' &&
      userId &&
      conversation &&
      !analysisMessageSavedRef.current &&
      enrichment.data.documentData?.documentId &&
      isDocumentRendered
    );

    // Check if message already exists in current messages
    const hasAnalysisMessage = messages.some(
      (msg) => msg.role === 'assistant' && msg.message.includes('Voici l\'analyse')
    );

    if (hasAnalysisMessage) {
      analysisMessageSavedRef.current = true;
      return;
    }

    if (shouldSave && !saveAnalysisMessageMutation.isPending) {
      analysisMessageSavedRef.current = true;
      saveAnalysisMessageMutation.mutate();
    }
  }, [
    enrichment.status,
    enrichment.data.documentData,
    enrichment.data.mapGeometry,
    enrichment.data.zoneId,
    userId,
    conversation,
    messages,
    zoneName,
    params.conversation_id,
    artifactSync,
    saveAnalysisMessageMutation,
  ]);

  // useEffect: UI behavior (auto-open panel)
  useEffect(() => {
    const contextMetadata = conversation?.context_metadata as any;
    const hasCoordinates = contextMetadata?.geocoded?.lon !== undefined && 
                          contextMetadata?.geocoded?.lat !== undefined;
    const hasAddressMessage = messages.some(msg => msg.message_type === 'address_search');
    const isEnriching = enrichment.status === 'enriching' || 
                       conversation?.enrichment_status === 'pending' ||
                       conversation?.enrichment_status === 'in_progress';
    const isCompleted = conversation?.enrichment_status === 'completed';

    // Don't auto-open for completed conversations
    if (isCompleted) {
      return;
    }

    if (hasCoordinates && hasAddressMessage && isEnriching && !isPanelOpen && !hasAutoOpenedPanelRef.current) {
      console.log('[CHAT_PAGE] Auto-opening panel - coordinates received');
      hasAutoOpenedPanelRef.current = true;
      setIsPanelOpen(true);
      setArtifactTab('map');
    }
  }, [conversation, messages, enrichment.status, conversationContextMetadata, isPanelOpen, setArtifactTab]);

  // Handle map rendering completion
  const handleMapRenderComplete = () => {
    console.log('[CHAT_PAGE] Map rendering complete, updating artifact status');
    artifactSync.updateArtifact('map', {
      renderingStatus: 'complete',
    });
  };

  // Handle document rendering completion
  const handleDocumentRenderComplete = () => {
    console.log('[CHAT_PAGE] Document rendering complete, updating artifact status');
    artifactSync.updateArtifact('document', {
      renderingStatus: 'complete',
    });
  };

  // Extract zone name from research history if available
  useEffect(() => {
    if (researchContext?.zone_id && !zoneName) {
      // Zone name will be fetched by the zone-name query above when enrichment completes
      // This is a fallback for completed conversations
      const fetchZoneNameFromResearch = async () => {
        const { data: zoneData } = await supabase
          .from('zones')
          .select('description, name')
          .eq('id', researchContext.zone_id)
          .maybeSingle();
        
        if (zoneData) {
          const extractedZoneName = zoneData.description || zoneData.name || '';
          if (extractedZoneName) {
            setZoneName(extractedZoneName);
          }
        }
      };
      fetchZoneNameFromResearch();
    }
  }, [researchContext?.zone_id, zoneName]);

  // Load artifacts for completed conversations
  useEffect(() => {
    if (conversation?.enrichment_status === 'completed' && researchContext) {
      const contextMetadata = conversationContextMetadata;
      
      // Load document artifact if document_id exists in research
      if (researchContext.documents_found && researchContext.documents_found.length > 0) {
        const documentId = researchContext.documents_found[0];
        const documentData: DocumentArtifactData = {
          documentId,
          title: 'Document PLU',
          type: 'PLU',
          htmlContent: undefined,
          hasAnalysis: false,
          cityName: contextMetadata?.city || '',
          inseeCode: contextMetadata?.insee_code || '',
        };

        updateArtifactState('document', {
          status: 'loading',
          data: documentData,
          renderingStatus: 'pending',
        });
      }
    }
  }, [conversation?.enrichment_status, researchContext, conversationContextMetadata, updateArtifactState]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!userId || !conversation) throw new Error('Missing user or conversation');

      console.log('[CHAT_MESSAGE] Constructing webhook payload');
      const webhookPayload: any = {
        new_conversation: isFirstMessage,
        message: content,
        user_id: userId,
        conversation_id: params.conversation_id,
        context_metadata: conversationContextMetadata,
      };

      if (researchContext?.geo_lon && researchContext?.geo_lat) {
        webhookPayload.gps_coordinates = [researchContext.geo_lon, researchContext.geo_lat];
      }

      if (researchContext?.documents_found && researchContext.documents_found.length > 0) {
        webhookPayload.document_ids = researchContext.documents_found;
      }

      if (researchContext?.geocoded_address) {
        webhookPayload.address = researchContext.geocoded_address;
      }

      console.log('[CHAT_MESSAGE] Calling chat API');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Insert messages into database
      const { data: insertedMessages, error: insertError } = await supabase
        .from('v2_messages')
        .insert([
          {
            conversation_id: params.conversation_id,
            user_id: userId,
            role: 'user',
            message: content,
            conversation_turn: messages.length + 1,
          },
          {
            conversation_id: params.conversation_id,
            user_id: userId,
            role: 'assistant',
            message: data.message,
            conversation_turn: messages.length + 2,
            referenced_documents: researchContext?.documents_found || null,
          },
        ])
        .select();

      if (insertError) throw insertError;

      // Update conversation
      await supabase
        .from('v2_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          message_count: messages.length + 2,
        })
        .eq('id', params.conversation_id);

      // Log analytics events
      if (insertedMessages && insertedMessages.length >= 2) {
        const [userMsg, assistantMsg] = insertedMessages;
        const documentId = getFirstDocumentId(researchContext?.documents_found);

        await logChatEvent({
          conversation_id: params.conversation_id,
          message_id: userMsg.id,
          user_id: userId,
          document_id: documentId,
          user_query_length: content.length,
        });

        await logChatEvent({
          conversation_id: params.conversation_id,
          message_id: assistantMsg.id,
          user_id: userId,
          document_id: documentId,
          ai_response_length: data.message.length,
        });
      }

      return { insertedMessages, data };
    },
    onSuccess: () => {
      // Invalidate messages query to refresh
      queryClient.invalidateQueries({ queryKey: ['messages', params.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversation', params.conversation_id] });
    },
  });

  const handleSendMessage = async (content: string, files?: File[]) => {
    console.log('[CHAT_MESSAGE] handleSendMessage called with content length:', content.length);
    
    if (!userId || !conversation || sendMessageMutation.isPending) {
      console.log('[CHAT_MESSAGE] Send blocked:', { hasUserId: !!userId, hasConversation: !!conversation, isPending: sendMessageMutation.isPending });
      return;
    }

    console.log('[CHAT_MESSAGE] Starting message send process');
    setSendingMessage(true);

    try {
      await sendMessageMutation.mutateAsync(content);
      console.log('[CHAT_MESSAGE] Message send process completed successfully');
    } catch (error) {
      console.error('[CHAT_MESSAGE] Error sending message:', error);
      toast({
        title: 'Erreur',
        description: 'Désolé, une erreur est survenue. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Chargement de la conversation...</div>
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  const conversationStarted = !!conversation;

  const enrichmentBranch = (enrichment.data.branchType as ConversationBranch | undefined) || null;
  const persistedBranch =
    conversation &&
    conversation.branch_type &&
    conversation.branch_type !== 'pending'
      ? (conversation.branch_type as ConversationBranch)
      : null;
  const researchBranch =
    researchContext &&
    researchContext.branch_type &&
    researchContext.branch_type !== 'pending'
      ? (researchContext.branch_type as ConversationBranch)
      : null;

  const hasStableFlags =
    !!(
      (conversation && (conversation.has_analysis || conversation.is_rnu)) ||
      (researchContext && (researchContext.has_analysis || researchContext.is_rnu))
    );

  const fallbackBranch: ConversationBranch | null = hasStableFlags
    ? determineConversationBranch({
        isRnu: conversation?.is_rnu ?? researchContext?.is_rnu ?? false,
        hasAnalysis: conversation?.has_analysis ?? researchContext?.has_analysis ?? false,
      })
    : null;

  const resolvedBranch: ConversationBranch | null =
    enrichmentBranch || persistedBranch || researchBranch || fallbackBranch;

  const chatInputDisabled = resolvedBranch === 'non_rnu_source';
  const chatDisabledTooltip = chatInputDisabled
    ? 'Impossible de discuter avec ce document.'
    : undefined;

  const handleRename = () => {
    setShowRenameDialog(true);
  };

  const handleSaveRename = async (newTitle: string) => {
    if (!conversation || !userId) return;

    const { error } = await supabase
      .from('v2_conversations')
      .update({ title: newTitle })
      .eq('id', conversation.id)
      .eq('user_id', userId);

    if (error) {
      console.error('[CHAT_PAGE] Error renaming conversation:', error);
      throw error;
    }

    // Update local state
    setConversation({ ...conversation, title: newTitle });
  };

  const handleDelete = async () => {
    if (!conversation || !userId) return;

    const { error } = await supabase
      .from('v2_conversations')
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
      })
      .eq('id', conversation.id)
      .eq('user_id', userId);

    if (error) {
      console.error('[CHAT_PAGE] Error deleting conversation:', error);
      return;
    }

    // Redirect to chats page
    router.push('/chats');
  };

  const conversationName =
    conversation.title ||
    conversationContextMetadata?.initial_address ||
    'Conversation';

  return (
    <>
      {/* Breadcrumb header */}
      {conversation && (
        <ConversationBreadcrumb
          project={project}
          conversation={conversation}
        />
      )}

      {/* Two-column layout: chat messages (left), right panel (slides in) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chat messages column */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 p-2 sm:p-4" ref={scrollRef}>
            <div className="space-y-1 sm:space-y-2 max-w-4xl mx-auto pb-24">
              {messages
                .sort((a, b) => {
                  // Sort by conversation_turn first, then by created_at
                  if (a.conversation_turn !== null && b.conversation_turn !== null) {
                    return a.conversation_turn - b.conversation_turn;
                  }
                  if (a.conversation_turn !== null) return -1;
                  if (b.conversation_turn !== null) return 1;
                  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                })
                .map((message) => {
                  // Check if message has artifact metadata
                  const metadata = message.metadata as any;
                  const artifactReferences = metadata?.artifacts || [];
                  
                  // Detect if this is an analysis message
                  const isAnalysisMessage = message.role === 'assistant' && 
                    message.message.includes('Voici l\'analyse');
                  
                  // Check if text generation is complete for this message
                  const textComplete = isAnalysisMessage 
                    ? analysisMessageTextComplete[message.id] || false
                    : true; // Non-analysis messages show cards immediately
                  
                  return (
                    <div key={message.id} className="space-y-3">
                      <ChatMessageBubble 
                        role={message.role as 'user' | 'assistant'}
                        content={message.message}
                        userId={message.role === 'user' ? userId : null}
                        isAnalysisMessage={isAnalysisMessage}
                        onTextGenerationComplete={() => {
                          if (isAnalysisMessage && !analysisMessageTextComplete[message.id]) {
                            setAnalysisMessageTextComplete(prev => ({
                              ...prev,
                              [message.id]: true,
                            }));
                          }
                        }}
                      />
                      
                      {/* Render inline artifact cards if message has artifacts AND text generation is complete */}
                      {message.role === 'assistant' && artifactReferences.length > 0 && textComplete && (
                        <div className="max-w-[85%] sm:max-w-[75%] ml-11 sm:ml-12 space-y-3">
                          {artifactReferences.map((artifactRef: any, index: number) => {
                            // Get artifact data from artifact store or enrichment
                            let artifactData: MapArtifactData | DocumentArtifactData | undefined;
                            let artifactStatus: 'loading' | 'ready' | 'error' = 'loading';
                            
                            if (artifactRef.type === 'map') {
                              const mapArtifact = artifacts.map;
                              artifactStatus = mapArtifact?.status || 'loading';
                              artifactData = mapArtifact?.data as MapArtifactData;
                            } else if (artifactRef.type === 'document') {
                              const docArtifact = artifacts.document;
                              artifactStatus = docArtifact?.status || 'loading';
                              artifactData = docArtifact?.data as DocumentArtifactData;
                            }
                            
                            return (
                              <InlineArtifactCard
                                key={`${message.id}-${artifactRef.type}-${index}`}
                                type={artifactRef.type}
                                artifactId={artifactRef.artifactId}
                                status={artifactStatus}
                                data={artifactData}
                                onViewInPanel={(type) => {
                                  setIsPanelOpen(true);
                                  const tab = artifactSync.openArtifactInPanel(type);
                                  artifactSync.setActiveTab(tab);
                                }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              
              {/* Show loading message when enrichment is in progress */}
              {conversation && 
               ((conversation.enrichment_status === 'pending' || conversation.enrichment_status === 'in_progress') &&
                enrichment.status === 'enriching') &&
               messages.length > 0 &&
               messages.some(msg => msg.message_type === 'address_search') &&
               !showFinalAnalysisMessage && (
                <LoadingAssistantMessage 
                  enrichment={enrichment}
                  isMapRendered={artifactSync.isArtifactRendered('map')}
                  isDocumentRendered={artifactSync.isArtifactRendered('document')}
                  isFadingOut={loadingMessageFadingOut}
                />
              )}

              {/* Show final analysis message when enrichment is complete */}
              {conversation && 
               showFinalAnalysisMessage &&
               enrichment.data.documentData?.documentId &&
               conversation.enrichment_status !== 'completed' && (
                <AnalysisFoundMessage
                  enrichment={enrichment}
                  zoneName={zoneName}
                  onViewInPanel={(type) => {
                    setIsPanelOpen(true);
                    const tab = artifactSync.openArtifactInPanel(type);
                    artifactSync.setActiveTab(tab);
                  }}
                  onTextGenerationComplete={() => {
                    console.log('[CHAT_PAGE] Analysis message text generation complete');
                  }}
                />
              )}

              {/* AI loading icon below first message */}
              {sendingMessage && messages.length > 0 && (
                <div className="flex items-center gap-2 text-gray-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">L&apos;assistant réfléchit...</span>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* PromptInputBox - fixed at bottom, full width */}
          <div className="flex-none p-4 bg-white dark:bg-neutral-900">
            <div className="max-w-4xl mx-auto">
              <PromptInputBox
                onSend={handleSendMessage}
                isLoading={sendingMessage}
                placeholder="Posez votre question..."
                conversationStarted={conversationStarted}
          disabled={chatInputDisabled}
          disabledTooltip={chatDisabledTooltip}
              />
            </div>
          </div>
        </div>

        {/* Right panel */}
        <ChatRightPanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          artifacts={artifactSync.artifacts}
          activeTab={artifactSync.activeTab}
          onTabChange={artifactSync.setActiveTab}
          onMapRenderComplete={handleMapRenderComplete}
          onDocumentRenderComplete={handleDocumentRenderComplete}
        />
      </div>

      {/* Rename Dialog */}
      {conversation && (
        <RenameConversationDialog
          open={showRenameDialog}
          onOpenChange={setShowRenameDialog}
          currentTitle={conversation.title}
          onSave={handleSaveRename}
        />
      )}

      {/* Delete Dialog */}
      {conversation && (
        <DeleteConversationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDelete}
          ConversationName={conversationName}
        />
      )}
    </>
  );
}

