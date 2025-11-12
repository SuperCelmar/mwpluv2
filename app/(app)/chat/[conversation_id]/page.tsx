'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

export default function ChatConversationPage({ params }: { params: { conversation_id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [conversation, setConversation] = useState<V2Conversation | null>(null);
  const [project, setProject] = useState<V2Project | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [researchContext, setResearchContext] = useState<V2ResearchHistory | null>(null);
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

  useEffect(() => {
    console.log('[CHAT_PAGE] Page initialized, conversation_id:', params.conversation_id);
    checkAuthAndLoadConversation();
  }, [params.conversation_id]);

  // Auto-scroll to bottom when messages change
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

  // Update zone name when enrichment completes
  useEffect(() => {
    const fetchZoneName = async () => {
      if (enrichment.status === 'complete' && enrichment.data.zoneId && !zoneName) {
        const { data: zoneData } = await supabase
          .from('zones')
          .select('description, name')
          .eq('id', enrichment.data.zoneId)
          .maybeSingle();
        
        if (zoneData) {
          const extractedZoneName = zoneData.description || zoneData.name || '';
          if (extractedZoneName) {
            setZoneName(extractedZoneName);
          }
        }
      }
    };

    fetchZoneName();
  }, [enrichment.status, enrichment.data.zoneId, zoneName]);

  // Sync map artifact with enrichment data
  useEffect(() => {
    const contextMetadata = conversation?.context_metadata as any;
    const lon = contextMetadata?.geocoded?.lon;
    const lat = contextMetadata?.geocoded?.lat;
    const mapGeometry = enrichment.data.mapGeometry;

    // Initialize map artifact when coordinates are available
    // Works for both active enrichment and completed conversations
    if (lon !== undefined && lat !== undefined) {
      const currentMap = artifacts.map;
      
      // Initialize map with just coordinates if we don't have geometry yet
      const mapData: MapArtifactData = {
        center: { lat, lon },
        geometry: mapGeometry || undefined, // Geometry is optional now
        cityName: contextMetadata?.city || '',
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
  }, [enrichment.data.mapGeometry, enrichment.status, conversation, zoneName, artifacts.map, updateArtifactState]);

  // Sync document artifact with enrichment data
  useEffect(() => {
    if (enrichment.data.documentData?.documentId) {
      const docData = enrichment.data.documentData;
      if (!docData.documentId) return; // Type guard
      
      const documentData: DocumentArtifactData = {
        documentId: docData.documentId,
        title: 'Document PLU',
        type: 'PLU',
        htmlContent: docData.htmlContent || undefined,
        hasAnalysis: docData.hasAnalysis,
        cityName: (conversation?.context_metadata as any)?.city || '',
        inseeCode: (conversation?.context_metadata as any)?.insee_code || '',
      };

      const currentDoc = artifacts.document;
      
      // Initialize document artifact
      if (!currentDoc) {
        updateArtifactState('document', {
          status: docData.htmlContent ? 'ready' : 'loading',
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
  }, [enrichment.data.documentData, conversation, artifacts.document, isPanelOpen, artifactActiveTab, updateArtifactState, setArtifactTab]);

  // Reset auto-open ref when conversation changes
  useEffect(() => {
    hasAutoOpenedPanelRef.current = false;
    analysisMessageSavedRef.current = false;
    setAnalysisMessageTextComplete({});
    setShowFinalAnalysisMessage(false);
    setLoadingMessageFadingOut(false);
  }, [params.conversation_id]);

  // Trigger transition to final analysis message when enrichment completes
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

  // Save analysis message when enrichment completes AND document is rendered
  useEffect(() => {
    const saveAnalysisMessage = async () => {
      // Only save if:
      // 1. Enrichment is complete
      // 2. Document is rendered (to ensure typewriter effect completes first)
      // 3. We have artifacts
      // 4. Message hasn't been saved yet
      const isDocumentRendered = artifactSync.isArtifactRendered('document');
      
      console.log('[CHAT_PAGE] Save analysis message check:', {
        enrichmentStatus: enrichment.status,
        hasUserId: !!userId,
        hasConversation: !!conversation,
        alreadySaved: analysisMessageSavedRef.current,
        hasDocumentId: !!enrichment.data.documentData?.documentId,
        isDocumentRendered
      });
      
      if (
        enrichment.status !== 'complete' ||
        !userId ||
        !conversation ||
        analysisMessageSavedRef.current ||
        !enrichment.data.documentData?.documentId ||
        !isDocumentRendered
      ) {
        return;
      }

      // Check if message already exists in current messages
      const hasAnalysisMessage = messages.some(
        (msg) => msg.role === 'assistant' && msg.message.includes('Voici l\'analyse')
      );

      if (hasAnalysisMessage) {
        console.log('[CHAT_PAGE] Analysis message already exists in local state, skipping save');
        analysisMessageSavedRef.current = true;
        return;
      }

      // Double-check in database to avoid duplicates (with stronger check)
      const { data: existingMessages, error: checkError } = await supabase
        .from('v2_messages')
        .select('id')
        .eq('conversation_id', params.conversation_id)
        .eq('role', 'assistant')
        .ilike('message', '%Voici l\'analyse%')
        .limit(1);

      if (checkError) {
        console.error('[CHAT_PAGE] Error checking for existing messages:', checkError);
        // Continue anyway, but log the error
      }

      if (existingMessages && existingMessages.length > 0) {
        console.log('[CHAT_PAGE] Analysis message already exists in database, skipping save');
        analysisMessageSavedRef.current = true;
        return;
      }

      // Mark as saved BEFORE attempting to save to prevent race conditions
      analysisMessageSavedRef.current = true;

      // Create artifact references with map geometry in metadata
      const artifactReferences: Array<{
        type: 'map' | 'document';
        artifactId: string;
        reason: string;
        timestamp: string;
        metadata?: any;
      }> = [];

      // Add map artifact if available - include geometry in metadata
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
            geometry: enrichment.data.mapGeometry, // Include multi-polygon zone geometry
            center: {
              lat: (conversation.context_metadata as any)?.geocoded?.lat,
              lon: (conversation.context_metadata as any)?.geocoded?.lon,
            },
            zoneId: enrichment.data.zoneId,
          },
        });
      }

      // Add document artifact if available
      if (enrichment.data.documentData?.documentId) {
        const docData = enrichment.data.documentData;
        if (docData.documentId) { // Type guard
          // Create a properly typed documentData object for getArtifactId
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

      // Only save if we have at least one artifact
      if (artifactReferences.length === 0) {
        console.log('[CHAT_PAGE] No artifacts to save, skipping analysis message');
        return;
      }

      // Create the analysis message - use zoneName if available, otherwise use generic text
      const analysisMessageText = zoneName
        ? `Voici l'analyse concernant la zone ${zoneName}:`
        : 'Voici l\'analyse concernant cette zone:';

      try {
        console.log('[CHAT_PAGE] Saving analysis message with artifacts and map geometry');
        const { data: insertedMessage, error: insertError } = await supabase
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

        if (insertError) {
          console.error('[CHAT_PAGE] Error saving analysis message:', insertError);
          // Reset the flag if save failed so it can be retried
          analysisMessageSavedRef.current = false;
          return;
        }

        console.log('[CHAT_PAGE] Analysis message saved successfully');

        // Add message to local state
        if (insertedMessage) {
          setMessages((prev) => [...prev, insertedMessage]);
        }

        // Update conversation metadata
        await supabase
          .from('v2_conversations')
          .update({
            last_message_at: new Date().toISOString(),
            message_count: messages.length + 1,
          })
          .eq('id', params.conversation_id);
      } catch (error) {
        console.error('[CHAT_PAGE] Error in saveAnalysisMessage:', error);
        // Reset the flag if save failed
        analysisMessageSavedRef.current = false;
      }
    };

    saveAnalysisMessage();
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
  ]);

  // Auto-open panel when coordinates are received (Step 1 begins)
  // Only auto-open during active enrichment, not for completed conversations
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
  }, [conversation, messages, enrichment.status, isPanelOpen, setArtifactTab]);

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

  const checkAuthAndLoadConversation = async () => {
    console.log('[CHAT_PAGE] Checking authentication and loading conversation');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[CHAT_PAGE] No user found, redirecting to login');
      router.push('/login');
      return;
    }
    console.log('[CHAT_PAGE] User authenticated, user_id:', user.id);
    setUserId(user.id);
    await loadConversation(user.id);
  };

  const loadConversation = async (currentUserId: string) => {
    console.log('[CHAT_PAGE] loadConversation called, conversation_id:', params.conversation_id, 'user_id:', currentUserId);
    try {
      // Load conversation
      console.log('[CHAT_PAGE] Loading conversation from database');
      const { data: conv, error: convError } = await supabase
        .from('v2_conversations')
        .select('*')
        .eq('id', params.conversation_id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (convError) {
        console.error('[CHAT_PAGE] Error loading conversation:', convError);
        throw convError;
      }

      if (!conv) {
        console.log('[CHAT_PAGE] Conversation not found, redirecting to home');
        router.push('/');
        return;
      }

      console.log('[CHAT_PAGE] Conversation loaded successfully, conversation_id:', conv.id);
      setConversation(conv);

      // Load project if project_id exists
      if (conv.project_id) {
        console.log('[CHAT_PAGE] Loading project, project_id:', conv.project_id);
        const { data: projectData, error: projectError } = await supabase
          .from('v2_projects')
          .select('*')
          .eq('id', conv.project_id)
          .maybeSingle();

        if (projectError) {
          console.error('[CHAT_PAGE] Error loading project:', projectError);
        } else if (projectData) {
          console.log('[CHAT_PAGE] Project loaded successfully, project_id:', projectData.id);
          setProject(projectData);
        }
      } else {
        console.log('[CHAT_PAGE] No project_id, project will remain null');
      }

      // Load messages for this conversation
      console.log('[CHAT_PAGE] Loading messages for conversation');
      const { data: messagesData, error: messagesError } = await supabase
        .from('v2_messages')
        .select('*')
        .eq('conversation_id', params.conversation_id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('[CHAT_PAGE] Error loading messages:', messagesError);
        throw messagesError;
      }

      // Always set messages, even if empty
      if (messagesData && messagesData.length > 0) {
        console.log('[CHAT_PAGE] Messages loaded successfully, count:', messagesData.length);
        setMessages(messagesData);
        setIsFirstMessage(false);
      } else {
        console.log('[CHAT_PAGE] No messages found for conversation');
        setMessages([]);
      }

      // Add initial address as first message if it exists and no messages yet
      const initialAddress = (conv.context_metadata as any)?.initial_address;
      if (initialAddress && (!messagesData || messagesData.length === 0)) {
        console.log('[CHAT_PAGE] Adding initial address as first message:', initialAddress);
        const addressMessage: V2Message = {
          id: `initial-address-${conv.id}`,
          conversation_id: params.conversation_id,
          user_id: currentUserId,
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
          created_at: conv.created_at || new Date().toISOString(),
        };
        setMessages([addressMessage]);
      } else if (initialAddress && messagesData && messagesData.length > 0) {
        // Check if initial address is already in messages
        const hasAddressMessage = messagesData.some(
          (msg) => msg.message === initialAddress && msg.message_type === 'address_search'
        );
        if (!hasAddressMessage) {
          console.log('[CHAT_PAGE] Adding initial address as first message (prepending):', initialAddress);
          const addressMessage: V2Message = {
            id: `initial-address-${conv.id}`,
            conversation_id: params.conversation_id,
            user_id: currentUserId,
            role: 'user',
            message: initialAddress,
            message_type: 'address_search',
            conversation_turn: 0, // Before first message
            referenced_documents: null,
            referenced_zones: null,
            referenced_cities: null,
            search_context: null,
            intent_detected: null,
            confidence_score: null,
            ai_model_used: null,
            reply_to_message_id: null,
            metadata: null,
            created_at: conv.created_at || new Date().toISOString(),
          };
          setMessages([addressMessage, ...messagesData]);
        }
      }

      // Load research history for context (if exists)
      console.log('[CHAT_PAGE] Loading research history for context');
      const { data: research } = await supabase
        .from('v2_research_history')
        .select('*')
        .eq('conversation_id', params.conversation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (research) {
        console.log('[CHAT_PAGE] Research context loaded, research_id:', research.id);
        setResearchContext(research);
        
        // Try to extract zone name from research history
        if (research.zone_id) {
          // Fetch zone name from database
          const { data: zoneData } = await supabase
            .from('zones')
            .select('description, name')
            .eq('id', research.zone_id)
            .maybeSingle();
          
          if (zoneData) {
            const extractedZoneName = zoneData.description || zoneData.name || '';
            if (extractedZoneName) {
              setZoneName(extractedZoneName);
            }
          }
        }
      }

      // Load artifacts for past conversations (if enrichment is completed)
      if (conv.enrichment_status === 'completed' && research) {
        console.log('[CHAT_PAGE] Loading artifacts for completed conversation');
        const contextMetadata = conv.context_metadata as any;
        const lon = contextMetadata?.geocoded?.lon;
        const lat = contextMetadata?.geocoded?.lat;

        // Load map artifact if coordinates exist
        // Note: Map artifact initialization requires geometry, which will be loaded by the sync effect above
        // Skip initialization here for completed conversations - the sync effect handles it when geometry is available

        // Load document artifact if document_id exists in research
        if (research.documents_found && research.documents_found.length > 0) {
          const documentId = research.documents_found[0];
          const documentData: DocumentArtifactData = {
            documentId,
            title: 'Document PLU',
            type: 'PLU',
            htmlContent: undefined, // Will be loaded by enrichment if needed
            hasAnalysis: false,
            cityName: contextMetadata?.city || '',
            inseeCode: contextMetadata?.insee_code || '',
          };

          updateArtifactState('document', {
            status: 'loading', // Will be updated when HTML content loads
            data: documentData,
            renderingStatus: 'pending',
          });
        }
      }

      console.log('[CHAT_PAGE] loadConversation completed successfully');
    } catch (error) {
      console.error('[CHAT_PAGE] Error loading conversation:', error);
      router.push('/');
    } finally {
      // Always clear loading state, even if there was an error or early return
      setLoading(false);
    }
  };

  const handleSendMessage = async (content: string, files?: File[]) => {
    console.log('[CHAT_MESSAGE] handleSendMessage called with content length:', content.length);
    
    if (!userId || !conversation || sendingMessage) {
      console.log('[CHAT_MESSAGE] Send blocked:', { hasUserId: !!userId, hasConversation: !!conversation, sendingMessage });
      return;
    }

    console.log('[CHAT_MESSAGE] Starting message send process');
    setSendingMessage(true);

    // Insert user message
    console.log('[CHAT_MESSAGE] Creating user message object');
    const userMessage: V2Message = {
      id: Date.now().toString(),
      conversation_id: params.conversation_id,
      user_id: userId,
      role: 'user',
      message: content,
      message_type: 'text',
      conversation_turn: messages.length + 1,
      referenced_documents: null,
      referenced_zones: null,
      referenced_cities: null,
      search_context: null,
      intent_detected: null,
      confidence_score: null,
      ai_model_used: null,
      reply_to_message_id: null,
      metadata: null,
      created_at: new Date().toISOString(),
    };

    console.log('[CHAT_MESSAGE] Adding user message to UI');
    setMessages((prev) => [...prev, userMessage]);

    try {
      console.log('[CHAT_MESSAGE] Constructing webhook payload');
      const webhookPayload: any = {
        new_conversation: isFirstMessage,
        message: content,
        user_id: userId,
        conversation_id: params.conversation_id,
        context_metadata: conversation.context_metadata,
      };

      if (researchContext?.geo_lon && researchContext?.geo_lat) {
        webhookPayload.gps_coordinates = [researchContext.geo_lon, researchContext.geo_lat];
        console.log('[CHAT_MESSAGE] Added GPS coordinates to payload');
      }

      if (researchContext?.documents_found && researchContext.documents_found.length > 0) {
        webhookPayload.document_ids = researchContext.documents_found;
        console.log('[CHAT_MESSAGE] Added document IDs to payload, count:', researchContext.documents_found.length);
      }

      if (researchContext?.geocoded_address) {
        webhookPayload.address = researchContext.geocoded_address;
        console.log('[CHAT_MESSAGE] Added address to payload');
      }

      console.log('[CHAT_MESSAGE] Calling chat API');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      console.log('[CHAT_MESSAGE] Chat API response status:', response.status);

      if (!response.ok) {
        console.error('[CHAT_MESSAGE] Chat API returned error status:', response.status);
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      console.log('[CHAT_MESSAGE] Chat API response received, message length:', data.message?.length || 0);

      const assistantMessage: V2Message = {
        id: (Date.now() + 1).toString(),
        conversation_id: params.conversation_id,
        user_id: userId,
        role: 'assistant',
        message: data.message,
        message_type: 'text',
        conversation_turn: messages.length + 2,
        referenced_documents: researchContext?.documents_found || null,
        referenced_zones: null,
        referenced_cities: null,
        search_context: null,
        intent_detected: null,
        confidence_score: null,
        ai_model_used: null,
        reply_to_message_id: null,
        metadata: null,
        created_at: new Date().toISOString(),
      };

      console.log('[CHAT_MESSAGE] Adding assistant message to UI');
      setMessages((prev) => [...prev, assistantMessage]);

      // Insert messages into database
      console.log('[CHAT_MESSAGE] Inserting messages into database');
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

      if (insertError) {
        console.error('[CHAT_MESSAGE] Error inserting messages:', insertError);
        throw insertError;
      }

      console.log('[CHAT_MESSAGE] Messages inserted successfully, count:', insertedMessages?.length || 0);

      // Update conversation
      console.log('[CHAT_MESSAGE] Updating conversation metadata');
      await supabase
        .from('v2_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          message_count: messages.length + 2,
        })
        .eq('id', params.conversation_id);

      // Log analytics events for both messages
      if (insertedMessages && insertedMessages.length >= 2) {
        console.log('[CHAT_MESSAGE] Logging analytics events');
        const [userMsg, assistantMsg] = insertedMessages;
        const documentId = getFirstDocumentId(researchContext?.documents_found);

        // Log user message event
        await logChatEvent({
          conversation_id: params.conversation_id,
          message_id: userMsg.id,
          user_id: userId,
          document_id: documentId,
          user_query_length: content.length,
        });

        // Log assistant message event
        await logChatEvent({
          conversation_id: params.conversation_id,
          message_id: assistantMsg.id,
          user_id: userId,
          document_id: documentId,
          ai_response_length: data.message.length,
        });
      }

      if (isFirstMessage) {
        console.log('[CHAT_MESSAGE] First message completed, setting isFirstMessage to false');
        setIsFirstMessage(false);
      }

      console.log('[CHAT_MESSAGE] Message send process completed successfully');
    } catch (error) {
      console.error('[CHAT_MESSAGE] Error sending message:', error);
      const errorMessage: V2Message = {
        id: (Date.now() + 1).toString(),
        conversation_id: params.conversation_id,
        user_id: userId || '',
        role: 'assistant',
        message: 'Désolé, une erreur est survenue. Veuillez réessayer.',
        message_type: 'text',
        conversation_turn: messages.length + 2,
        referenced_documents: null,
        referenced_zones: null,
        referenced_cities: null,
        search_context: null,
        intent_detected: null,
        confidence_score: null,
        ai_model_used: null,
        reply_to_message_id: null,
        metadata: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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
    (conversation.context_metadata as any)?.initial_address ||
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
                  <span className="text-sm">L'assistant réfléchit...</span>
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

