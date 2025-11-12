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
import { AppSidebar } from '@/components/AppSidebar';
import { ConversationBreadcrumb } from '@/components/ConversationBreadcrumb';
import { RenameConversationDialog } from '@/components/RenameConversationDialog';
import { DeleteConversationDialog } from '@/components/DeleteProjectDialog';

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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use enrichment hook for background enrichment
  const enrichment = useEnrichment(params.conversation_id, conversation);

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
      <div className="flex items-center justify-center h-screen">
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
    <div className="flex h-screen overflow-hidden bg-white dark:bg-neutral-900">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb header */}
        {conversation && (
          <ConversationBreadcrumb
            project={project}
            conversation={conversation}
          />
        )}

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
              .map((message) => (
                <ChatMessageBubble 
                  key={message.id}
                  role={message.role as 'user' | 'assistant'}
                  content={message.message}
                />
              ))}
            
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
    </div>
  );
}
