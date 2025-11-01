'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Project {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  municipality: string | null;
  gps_coordinates: any;
  insee_code: string | null;
  document_loaded: boolean;
  map_loaded: boolean;
  artifacts_ready: boolean;
  created_at: string;
  updated_at: string;
}

export default function ChatConversationPage({ params }: { params: { conversation_id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Project | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [isFirstMessage, setIsFirstMessage] = useState(true);

  useEffect(() => {
    checkAuthAndLoadConversation();
  }, [params.conversation_id]);

  useEffect(() => {
    if (conversation && !conversation.artifacts_ready) {
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
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', params.conversation_id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (projectError) throw projectError;

      if (!project) {
        router.push('/');
        return;
      }

      setConversation(project);

      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', params.conversation_id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      if (messagesData && messagesData.length > 0) {
        setMessages(messagesData);
        setIsFirstMessage(false);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
      router.push('/');
    }
  };

  const simulateArtifactLoading = async () => {
    setArtifactsLoading(true);

    setTimeout(async () => {
      await supabase
        .from('projects')
        .update({ document_loaded: true })
        .eq('id', params.conversation_id);

      setConversation((prev) => prev ? { ...prev, document_loaded: true } : null);
    }, 1500);

    setTimeout(async () => {
      await supabase
        .from('projects')
        .update({ map_loaded: true, artifacts_ready: true })
        .eq('id', params.conversation_id);

      setConversation((prev) => prev ? { ...prev, map_loaded: true, artifacts_ready: true } : null);
      setArtifactsLoading(false);
      setRightPanelOpen(true);
    }, 3000);
  };

  const handleSendMessage = async (content: string) => {
    if (!userId || !conversation || sendingMessage || !conversation.artifacts_ready) return;

    setSendingMessage(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const webhookPayload: any = {
        new_conversation: isFirstMessage,
        message: content,
        user_id: userId,
        conversation_id: params.conversation_id,
      };

      if (conversation.gps_coordinates) {
        webhookPayload.gps_coordinates = conversation.gps_coordinates;
      }

      if (conversation.insee_code) {
        webhookPayload.insee_code = conversation.insee_code;
      }

      if (conversation.address) {
        webhookPayload.address = conversation.address;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      await supabase.from('messages').insert([
        {
          project_id: params.conversation_id,
          role: 'user',
          content,
        },
        {
          project_id: params.conversation_id,
          role: 'assistant',
          content: data.message,
        },
      ]);

      await supabase
        .from('projects')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', params.conversation_id);

      if (isFirstMessage) {
        setIsFirstMessage(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
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
            {conversation.address && (
              <p className="text-sm text-gray-600 truncate">{conversation.address}</p>
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
                      {conversation.document_loaded ? (
                        <span className="text-green-600">✓ Document PLU chargé</span>
                      ) : (
                        <span>⏳ Chargement du document PLU...</span>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      {conversation.map_loaded ? (
                        <span className="text-green-600">✓ Carte cadastrale chargée</span>
                      ) : (
                        <span>⏳ Chargement de la carte cadastrale...</span>
                      )}
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
                          Posez votre première question sur le PLU de {conversation.municipality || 'cette commune'}
                        </p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <ChatMessageBubble
                          key={message.id}
                          role={message.role}
                          content={message.content}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>

                <ChatInputField
                  onSend={handleSendMessage}
                  disabled={sendingMessage || !conversation.artifacts_ready}
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
