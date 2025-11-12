"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase, V2Conversation } from "@/lib/supabase";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

export default function ChatsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<V2Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoadConversations();
  }, []);

  const checkAuthAndLoadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    await loadConversations();
  };

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('v2_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-neutral-900">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-white dark:bg-neutral-800 px-6 py-4 shrink-0">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Mes conversations
          </h1>
        </header>
        <ScrollArea className="flex-1">
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Chargement...
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <MessageSquare className="h-24 w-24 text-gray-300 dark:text-gray-600 mb-4" />
                <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Aucune conversation
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Commencez une nouvelle recherche pour créer votre première conversation.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => {
                  const isActive = currentConversationId === conversation.id;
                  const convTitle = conversation.title || 
                    conversation.context_metadata?.initial_address || 
                    'Conversation';
                  const lastActivity = conversation.last_message_at || conversation.created_at;

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => handleConversationClick(conversation.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg transition-all duration-150 border",
                        isActive
                          ? "bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-800 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {convTitle}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(lastActivity), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </p>
                        {conversation.context_metadata?.initial_address && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                            {conversation.context_metadata.initial_address}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

