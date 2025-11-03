'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, V2Conversation, V2Message, V2ResearchHistory } from '@/lib/supabase';
import { logChatEvent, getFirstDocumentId } from '@/lib/analytics';
import { useEnrichment } from './useEnrichment';
import { ChatLeftSidebar } from '@/components/ChatLeftSidebar';
import { ChatRightPanel } from '@/components/ChatRightPanel';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ChatInputField } from '@/components/ChatInputField';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { InlineArtifactCard } from '@/components/InlineArtifactCard';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type ArtifactPhase = 'idle' | 'loading' | 'ready';

// Helper to map ArtifactPhase to component status type
function getArtifactStatus(phase: ArtifactPhase): 'loading' | 'ready' | 'error' {
  if (phase === 'ready') return 'ready';
  return 'loading'; // 'idle' and 'loading' both show loading
}

export default function ChatConversationPage({ params }: { params: { conversation_id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [conversation, setConversation] = useState<V2Conversation | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [introStatus, setIntroStatus] = useState<{ map: ArtifactPhase; document: ArtifactPhase }>({
    map: 'idle',
    document: 'idle',
  });
  const [showIntro, setShowIntro] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [researchContext, setResearchContext] = useState<V2ResearchHistory | null>(null);
  const [enrichmentStep, setEnrichmentStep] = useState<'idle' | 'municipality' | 'city_check' | 'documents' | 'zones_check' | 'map_loading' | 'map_ready' | 'document_check' | 'complete'>('idle');
  const [enrichmentStatus, setEnrichmentStatus] = useState<string>('');
  const [activeArtifactTab, setActiveArtifactTab] = useState<'map' | 'document'>('map');
  
  // Desktop detection for conditional panel opening
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    // Check on mount and handle resize
    const checkDesktop = () => {
      setIsDesktop(typeof window !== 'undefined' && window.innerWidth >= 768);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  
  // Auto-switch to document tab when document becomes ready (only once)
  useEffect(() => {
    // Only auto-switch if:
    // 1. Document just became ready (transition from loading/idle to ready)
    // 2. Currently on map tab
    // 3. We haven't already auto-switched before
    if (
      introStatus.document === 'ready' && 
      activeArtifactTab === 'map' && 
      !hasAutoSwitchedToDocumentRef.current
    ) {
      console.log('[TAB_SWITCH] Document is ready, auto-switching to document tab');
      setActiveArtifactTab('document');
      hasAutoSwitchedToDocumentRef.current = true;
    }
  }, [introStatus.document, activeArtifactTab]);
  
  // Map and document state
  const [mapData, setMapData] = useState<{ lat: number; lon: number; zoneGeometry?: any; isLoading?: boolean } | null>(null);
  const [zoneData, setZoneData] = useState<{ zoneId: string | null; zoningId: string | null; cityId: string | null; zoneLibelle: string | null }>({
    zoneId: null,
    zoningId: null,
    cityId: null,
    zoneLibelle: null,
  });
  const [documentData, setDocumentData] = useState<{ htmlContent: string | null; documentId: string | null }>({ htmlContent: null, documentId: null });
  
  // Guard to prevent re-execution of enrichment (handles React Strict Mode double-invoke)
  const introSequenceStartedRef = useRef(false);
  // Track if we've already auto-switched to document tab (prevents re-switching when user manually goes back to map)
  const hasAutoSwitchedToDocumentRef = useRef(false);

  // Use enrichment hook for background enrichment
  const enrichment = useEnrichment(params.conversation_id, conversation);

  useEffect(() => {
    console.log('[CHAT_PAGE] Page initialized, conversation_id:', params.conversation_id);
    checkAuthAndLoadConversation();
  }, [params.conversation_id]);

  useEffect(() => {
    if (!conversation) return;
    if (introSequenceStartedRef.current) return;
    if (messages.length > 0) return;

    startIntroSequence(conversation);
  }, [conversation, messages]);

  // Update UI state when enrichment completes
  useEffect(() => {
    if (enrichment.status === 'complete' && enrichment.data) {
      const data = enrichment.data;
      
      // Update zone data
      if (data.zoneId || data.cityId || data.zoningId) {
        setZoneData({
          zoneId: data.zoneId || null,
          zoningId: data.zoningId || null,
          cityId: data.cityId || null,
          zoneLibelle: null, // Will be fetched if needed
        });
      }

      // Update map data
      if (conversation?.context_metadata) {
        const contextMetadata = conversation.context_metadata as any;
        const lon = contextMetadata?.geocoded?.lon;
        const lat = contextMetadata?.geocoded?.lat;
        
        if (lon !== undefined && lat !== undefined) {
          setMapData({
            lat,
            lon,
            zoneGeometry: data.mapGeometry || undefined,
            isLoading: false,
          });
          setIntroStatus(prev => ({ ...prev, map: 'ready' }));
        }
      }

      // Update document data
      if (data.documentData) {
        setDocumentData({
          htmlContent: data.documentData.htmlContent,
          documentId: data.documentData.documentId,
        });
        if (data.documentData.hasAnalysis) {
          setIntroStatus(prev => ({ ...prev, document: 'ready' }));
        }
      }

      // Close loading state
      setArtifactsLoading(false);
      
      // Reload research context to get updated data
      if (conversation) {
        supabase
          .from('v2_research_history')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data: research }) => {
            if (research) {
              setResearchContext(research);
            }
          });
      }
    } else if (enrichment.status === 'error') {
      console.error('[CHAT_PAGE] Enrichment failed');
      setArtifactsLoading(false);
    }
  }, [enrichment.status, enrichment.data, conversation]);

  useEffect(() => {
    if (!showIntro) return;
    if (!researchContext) return;

    const lat = researchContext.geo_lat;
    const lon = researchContext.geo_lon;

    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return;
    }

    setMapData((prev) => {
      if (prev && prev.lat === lat && prev.lon === lon) {
        return prev;
      }

      // If mapData is already loaded and ready (isLoading: false), don't overwrite it
      // This prevents the effect from overwriting restored state from restoreConversationStateInstant
      if (prev && prev.isLoading === false) {
        return prev;
      }

      return {
        lat,
        lon,
        zoneGeometry: prev?.zoneGeometry,
        isLoading: introStatus.map !== 'ready',
      };
    });
  }, [researchContext, showIntro, introStatus.map]);

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

      if (messagesData && messagesData.length > 0) {
        console.log('[CHAT_PAGE] Messages loaded successfully, count:', messagesData.length);
        setMessages(messagesData);
        setIsFirstMessage(false);
      } else {
        console.log('[CHAT_PAGE] No messages found for conversation');
        setMessages([]);
      }

      // Check enrichment status and start background enrichment if needed
      console.log('[CHAT_PAGE] Checking enrichment status:', conv.enrichment_status);
      
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
      }

      // Determine if we need to start enrichment
      const needsEnrichment = conv.enrichment_status === 'pending' || !conv.project_id;
      const isEnriched = conv.enrichment_status === 'completed' && conv.project_id;
      
      if (isEnriched && research) {
        // Complete conversation - check if fully enriched
        const hasCompleteData = !!(
          research.city_id && 
          research.zone_id && 
          messagesData && 
          messagesData.length > 0
        );
        
        if (hasCompleteData) {
          console.log('[CHAT_PAGE] Complete conversation detected, skipping enrichment and restoring instantly');
          restoreConversationStateInstant(research, conv);
        } else {
          // Enrichment marked complete but data missing - enrichment hook will handle retry
          console.log('[CHAT_PAGE] Enrichment marked complete but data missing, enrichment hook will handle');
          setArtifactsLoading(true);
        }
      } else if (needsEnrichment) {
        // Lightweight conversation - enrichment hook will start background enrichment
        console.log('[CHAT_PAGE] Lightweight conversation detected, enrichment hook will start background enrichment');
        setArtifactsLoading(true);
        introSequenceStartedRef.current = false;
        setIntroStatus({ map: 'idle', document: 'idle' });
        setShowIntro(false);
        setActiveArtifactTab('map');
        setMapData(null);
      } else {
        // In-progress or failed - show UI immediately
        console.log('[CHAT_PAGE] Enrichment status:', conv.enrichment_status);
        setArtifactsLoading(false);
      }

      console.log('[CHAT_PAGE] loadConversation completed successfully');
      setLoading(false);
    } catch (error) {
      console.error('[CHAT_PAGE] Error loading conversation:', error);
      router.push('/');
    }
  };

  const restoreConversationStateInstant = (research: V2ResearchHistory, conv: V2Conversation) => {
    console.log('[RESTORE] Starting instant state restoration for complete conversation - Option C: skip all fetching');
    
    // Prevent any intro sequence from running
    introSequenceStartedRef.current = true;
    
    // Option C: Skip ALL database fetching - just set basic state and close loading immediately
    // The right panel will load its data lazily when the user opens it
    
    const lon = research.geo_lon;
    const lat = research.geo_lat;
    const zoneId = research.zone_id;
    const cityId = research.city_id;
    
    // Set minimal zone data (just IDs, no geometry/libelle fetching)
    setZoneData({ 
      zoneId, 
      zoningId: null, // Will be fetched when needed
      cityId, 
      zoneLibelle: null // Will be fetched when needed
    });
    
    // Set minimal map data (just coordinates, geometry will load when right panel opens)
    if (lon !== null && lat !== null) {
      setMapData({
        lat,
        lon,
        zoneGeometry: undefined, // Will be fetched when right panel opens
        isLoading: false, // Not loading - will load lazily
      });
    }
    
    // Don't set document data - will load when right panel opens
    // Don't set intro status - not needed for existing conversations
    // Don't show inline cards - they already have messages
    setShowIntro(false); // EXPLICITLY hide intro cards for existing conversations
    
    // Close loading state IMMEDIATELY - no async operations
    setArtifactsLoading(false);
    
    console.log('[RESTORE] Instant restoration complete - no fetching, messages will appear immediately');
  };

  const startIntroSequence = (conv: V2Conversation) => {
    if (introSequenceStartedRef.current) {
      return;
    }

    introSequenceStartedRef.current = true;

    const contextMetadata = conv.context_metadata as any;
    const lon = researchContext?.geo_lon ?? contextMetadata?.geocoded?.lon ?? null;
    const lat = researchContext?.geo_lat ?? contextMetadata?.geocoded?.lat ?? null;

    setIntroStatus({ map: 'loading', document: 'idle' });
    setActiveArtifactTab('map');
    // Only auto-open panel on desktop
    if (isDesktop) {
      setRightPanelOpen(true);
    }
    setArtifactsLoading(true);
    setShowIntro(false);

    if (lon !== null && lat !== null) {
      setMapData({
        lat,
        lon,
        zoneGeometry: undefined,
        isLoading: true,
      });
    }

    // Note: Status updates are now handled by actual artifact completion in enrichConversationData
    // introStatus.map will be set to 'ready' when map finishes loading
    // introStatus.document will be set to 'ready' when document is retrieved
  };

  // OLD enrichConversationData function removed - now using useEnrichment hook
  // The enrichment logic has been moved to lib/workers/conversationEnrichment.ts

  const handleSendMessage = async (content: string) => {
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
        const [userMessage, assistantMessage] = insertedMessages;
        const documentId = getFirstDocumentId(researchContext?.documents_found);

        // Log user message event
        await logChatEvent({
          conversation_id: params.conversation_id,
          message_id: userMessage.id,
          user_id: userId,
          document_id: documentId,
          user_query_length: content.length,
          // query_intent could be enhanced with intent detection later
        });

        // Log assistant message event
        await logChatEvent({
          conversation_id: params.conversation_id,
          message_id: assistantMessage.id,
          user_id: userId,
          document_id: documentId,
          ai_response_length: data.message.length,
          // Note: model_name, tokens, costs, response_time would come from API response
          // These could be enhanced if the chat API returns them
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

  const handleNewConversation = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Chargement de la conversation...</div>
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <ChatLeftSidebar
        onNewConversation={handleNewConversation}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex-1 text-center">
            {conversation?.context_metadata?.initial_address && (
              <p className="text-sm text-gray-600 truncate">
                {conversation.context_metadata.initial_address}
              </p>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            {artifactsLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <div className="text-center space-y-3">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Préparation de votre analyse PLU
                  </h2>
                  <div className="space-y-2 text-sm text-gray-600">
                    {enrichmentStatus ? (
                      <div className="flex items-center justify-center gap-2">
                        <span>⏳ {enrichmentStatus}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-2">
                          <span>{introStatus.map === 'ready' ? '✓' : '⏳'} Chargement de la carte...</span>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span>
                            {introStatus.document === 'ready' ? '✓' : introStatus.document === 'loading' ? '⏳' : '•'} Préparation du document PLU...
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-4xl mx-auto">
                  {messages.map((message) => (
                    <ChatMessageBubble 
                      key={message.id} 
                      role={message.role as 'user' | 'assistant'}
                      content={message.message}
                    />
                  ))}
                  {sendingMessage && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Envoi en cours...</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {!artifactsLoading && (
              <div className="border-t bg-white p-4 shrink-0">
                <ChatInputField
                  onSend={handleSendMessage}
                  disabled={sendingMessage}
                />
              </div>
            )}
          </div>

          <ChatRightPanel
            isOpen={rightPanelOpen}
            onClose={() => setRightPanelOpen(false)}
            mapProps={mapData || undefined}
            documentHtml={documentData.htmlContent}
            activeTab={activeArtifactTab}
            onTabChange={setActiveArtifactTab}
            mapStatus={getArtifactStatus(introStatus.map)}
            documentStatus={getArtifactStatus(introStatus.document)}
            onRetryMap={() => {
              console.log('[TODO] Retry map loading');
            }}
            onRetryDocument={() => {
              console.log('[TODO] Retry document loading');
            }}
          />
        </div>
      </div>
    </div>
  );
}
