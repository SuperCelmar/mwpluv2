"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, V2Conversation } from "@/lib/supabase";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MessageSquare, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChatsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<V2Conversation[]>([]);
  const [allConversations, setAllConversations] = useState<V2Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    checkAuthAndLoadConversations();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setConversations(allConversations);
      return;
    }

    const searchConversations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const query = searchQuery.trim().toLowerCase();
        
        // Search conversations by title and address
        const titleMatches = allConversations.filter(conv => {
          const title = (conv.title || "").toLowerCase();
          const address = (conv.context_metadata?.initial_address || "").toLowerCase();
          return title.includes(query) || address.includes(query);
        });

        // Search messages content and get unique conversation IDs
        const { data: messagesData, error: messagesError } = await supabase
          .from('v2_messages')
          .select('conversation_id')
          .eq('user_id', user.id)
          .ilike('message', `%${query}%`);

        if (messagesError) {
          console.error('Error searching messages:', messagesError);
        }

        const messageConversationIds = new Set(
          messagesData?.map(msg => msg.conversation_id) || []
        );

        // Get conversations that have matching messages
        const messageMatches = allConversations.filter(conv => 
          messageConversationIds.has(conv.id)
        );

        // Combine and deduplicate results
        const allMatches = [...titleMatches, ...messageMatches];
        const uniqueMatches = Array.from(
          new Map(allMatches.map(conv => [conv.id, conv])).values()
        );

        // Sort by last_message_at
        uniqueMatches.sort((a, b) => {
          const aTime = a.last_message_at || a.created_at;
          const bTime = b.last_message_at || b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

        setConversations(uniqueMatches);
      } catch (error) {
        console.error('Error searching conversations:', error);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      searchConversations();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, allConversations]);

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
        setAllConversations(data);
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  return (
    <>
      <header className="border-b bg-white dark:bg-neutral-800 px-6 py-4 shrink-0">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Mes conversations
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher par nom, adresse ou contenu des messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </Button>
            )}
          </div>
        </div>
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
                {searchQuery ? "Aucun résultat" : "Aucune conversation"}
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? "Aucune conversation ne correspond à votre recherche."
                  : "Commencez une nouvelle recherche pour créer votre première conversation."}
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
    </>
  );
}

