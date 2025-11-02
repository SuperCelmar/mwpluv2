'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, V2Conversation, V2Message, V2ResearchHistory } from '@/lib/supabase';
import { ChatLeftSidebar } from '@/components/ChatLeftSidebar';
import { ChatRightPanel } from '@/components/ChatRightPanel';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ChatInputField } from '@/components/ChatInputField';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Menu, User, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ChatConversationPage({ params }: { params: { conversation_id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [conversation, setConversation] = useState<V2Conversation | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [researchContext, setResearchContext] = useState<V2ResearchHistory | null>(null);

  useEffect(() => {
    checkAuthAndLoadConversation();
  }, [params.conversation_id]);

  useEffect(() => {
    if (conversation && conversation.document_count > 0) {
      simulateArtifactLoading();
    }
  }, [conversation]);

  const checkAuthAndLoadConversation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUserId(user.id);
    await loadConversation(user.id);
  };

  const loadConversation = async (currentUserId: string) => {
    try {
      // Load conversation
      const { data: conv, error: convError } = await supabase
        .from('v2_conversations')
        .select('*')
        .eq('id', params.conversation_id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (convError) throw convError;

      if (!conv) {
        router.push('/');
        return;
      }

      setConversation(conv);

      // Load messages for this conversation
      const { data: messagesData, error: messagesError } = await supabase
        .from('v2_messages')
        .select('*')
        .eq('conversation_id', params.conversation_id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      if (messagesData && messagesData.length > 0) {
        setMessages(messagesData);
        setIsFirstMessage(false);
      }

      // Load research history for context
      const { data: research } = await supabase
        .from('v2_research_history')
        .select('*')
        .eq('conversation_id', params.conversation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (research) {
        setResearchContext(research);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
      router.push('/');
    }
  };

  const simulateArtifactLoading = async () => {
    setArtifactsLoading(true);
    // Artifact loading state is now managed locally since it's not in the schema
    setTimeout(() => {
      setArtifactsLoading(false);
      setRightPanelOpen(true);
    }, 3000);
  };

  const handleSendMessage = async (content: string) => {
    if (!userId || !conversation || sendingMessage) return;

    setSendingMessage(true);

    // Insert user message
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

    setMessages((prev) => [...prev, userMessage]);

    try {
      const webhookPayload: any = {
        new_conversation: isFirstMessage,
        message: content,
        user_id: userId,
        conversation_id: params.conversation_id,
        context_metadata: conversation.context_metadata,
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

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

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

      setMessages((prev) => [...prev, assistantMessage]);

      // Insert messages into database
      await supabase.from('v2_messages').insert([
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
      ]);

      // Update conversation
      await supabase
        .from('v2_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          message_count: messages.length + 2,
        })
        .eq('id', params.conversation_id);

      if (isFirstMessage) {
        setIsFirstMessage(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNewConversation={handleNewConversation}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {sidebarCollapsed && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed(false)}
                  className="md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-bold text-gray-900 md:hidden">MWPLU</h1>
              </>
            )}
          </div>

          <div className="flex-1 text-center">
            {conversation?.context_metadata?.initial_address && (
              <p className="text-sm text-gray-600 truncate">
                {conversation.context_metadata.initial_address}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                    <div className="flex items-center justify-center gap-2">
                      <span>⏳ Chargement du document PLU...</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span>⏳ Chargement de la carte cadastrale...</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1">
                  <div className="max-w-4xl mx-auto py-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Vos documents sont prêts !
                        </h3>
                        <p className="text-gray-600">
                          Posez votre première question sur le PLU de{' '}
                          {conversation?.context_metadata?.city || 'cette commune'}
                        </p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <ChatMessageBubble
                          key={message.id}
                          role={message.role}
                          content={message.message}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>

                <ChatInputField
                  onSend={handleSendMessage}
                  disabled={sendingMessage || artifactsLoading}
                />
              </>
            )}
          </div>

          <ChatRightPanel isOpen={rightPanelOpen} onClose={() => setRightPanelOpen(false)} />
        </div>
      </div>
    </div>
  );
}
