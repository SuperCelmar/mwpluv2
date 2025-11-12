'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { AddressInput } from '@/components/AddressInput';
import { NewConversationModal } from '@/components/NewConversationModal';
import { ConversationActions } from '@/components/ConversationActions';
import { DeleteConversationDialog } from '@/components/DeleteConversationDialog';
import { supabase, V2Conversation, V2Message } from '@/lib/supabase';
import { AddressSuggestion } from '@/lib/address-api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

export default function ConversationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [conversation, setConversation] = useState<V2Conversation | null>(null);
  const [conversations, setConversations] = useState<V2Conversation[]>([]);
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    checkUser();
  }, [params.id]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    fetchConversation();
    fetchConversations();
    fetchMessages();
  };

  const fetchConversation = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('v2_conversations')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        router.push('/projects');
        return;
      }

      setConversation(data);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('v2_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setConversations(data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('v2_messages')
        .select('*')
        .eq('conversation_id', params.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleAddressSelect = async (address: AddressSuggestion) => {
    setSending(true);
    try {
      const fullAddress = address.properties.label;

      // Store in v2_research_history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('v2_research_history')
          .insert({
            user_id: user.id,
            conversation_id: params.id,
            address_input: fullAddress,
            geo_lon: address.geometry?.coordinates?.[0] || null,
            geo_lat: address.geometry?.coordinates?.[1] || null,
            success: true,
          });
      }

      const { data: userMessage, error: userError } = await supabase
        .from('v2_messages')
        .insert({
          conversation_id: params.id,
          user_id: user?.id || '',
          role: 'user',
          message: fullAddress,
          message_type: 'address_search',
          conversation_turn: messages.length + 1,
        })
        .select()
        .single();

      if (userError) throw userError;

      if (userMessage) {
        setMessages((prev) => [...prev, userMessage]);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullAddress,
          conversation_id: params.id,
          address: fullAddress,
          user_id: user?.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const { message: aiResponse } = await response.json();

      const { data: assistantMessage, error: assistantError } = await supabase
        .from('v2_messages')
        .insert({
          conversation_id: params.id,
          user_id: user?.id || '',
          role: 'assistant',
          message: aiResponse,
          message_type: 'text',
          conversation_turn: messages.length + 2,
        })
        .select()
        .single();

      if (assistantError) throw assistantError;

      if (assistantMessage) {
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // Update conversation last_message_at and message_count
      await supabase
        .from('v2_conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          is_active: true,
          message_count: messages.length + 2,
        })
        .eq('id', params.id);
    } catch (error) {
      console.error('Error saving address:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userMessage, error: userError } = await supabase
        .from('v2_messages')
        .insert({
          conversation_id: params.id,
          user_id: user.id,
          role: 'user',
          message: content,
          message_type: 'text',
          conversation_turn: messages.length + 1,
        })
        .select()
        .single();

      if (userError) throw userError;

      if (userMessage) {
        setMessages((prev) => [...prev, userMessage]);
      }

      await supabase
        .from('v2_conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          is_active: true,
          message_count: messages.length + 1,
        })
        .eq('id', params.id);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversation_id: params.id,
          user_id: user.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const { message: aiResponse } = await response.json();

      const { data: assistantMessage, error: assistantError } = await supabase
        .from('v2_messages')
        .insert({
          conversation_id: params.id,
          user_id: user.id,
          role: 'assistant',
          message: aiResponse,
          message_type: 'text',
          conversation_turn: messages.length + 2,
        })
        .select()
        .single();

      if (assistantError) throw assistantError;

      if (assistantMessage) {
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // Update conversation message_count after assistant message
      await supabase
        .from('v2_conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          message_count: messages.length + 2,
        })
        .eq('id', params.id);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleRename = () => {
    // Conversations don't have names in the schema, so this is disabled
    setIsRenaming(false);
  };

  const handleSaveRename = async () => {
    // Conversations don't have names in the schema
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('v2_conversations')
        .update({ 
          is_active: false,
          archived_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      if (error) throw error;

      router.push('/dashboard');
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <div className="w-[280px] border-r bg-gray-50 animate-pulse" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <ChatSidebar
        Conversations={conversations}
        currentConversationId={params.id}
        onNewConversation={() => setShowNewModal(true)}
      />
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-900">Conversation PLU</h1>
              <p className="text-sm text-gray-500 mt-1">Analyse de document PLU</p>
            </div>
            <ConversationActions onRename={handleRename} onDelete={() => setShowDeleteDialog(true)} />
          </div>
        </header>

        <ScrollArea className="flex-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
              <MessageSquare className="h-16 w-16 text-gray-300 mb-6" />
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                Quelle est l'adresse de votre projet ?
              </h2>
              <p className="text-gray-500 max-w-md mb-8">
                Commencez par indiquer l'adresse de votre projet pour obtenir une analyse PLU détaillée.
              </p>
              <AddressInput onAddressSelect={handleAddressSelect} disabled={sending} />
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={{ ...message, content: message.message }} />
              ))}
              {sending && (
                <div className="flex gap-3 py-4 px-6 bg-white">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-200">
                    <MessageSquare className="h-5 w-5 text-gray-700 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-500 italic">L'assistant réfléchit...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {messages.length > 0 && (
          <ChatInput
            onSend={handleSendMessage}
            disabled={sending}
            placeholder="Posez votre question..."
          />
        )}
      </div>
      <NewConversationModal open={showNewModal} onOpenChange={setShowNewModal} />
      <DeleteConversationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        ConversationName="cette conversation"
      />
    </div>
  );
}
