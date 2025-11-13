"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, V2Conversation } from "@/lib/supabase";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MessageSquare, Search, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConversationDialog } from "@/components/DeleteConversationDialog";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/use-toast";

export default function ChatsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<V2Conversation | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

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

  const userId = user?.id;

  // Fetch all conversations using React Query
  const { data: allConversations = [], isLoading: loading } = useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('v2_conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery.trim(), 300);

  // Search conversations using React Query
  const { data: searchResults } = useQuery({
    queryKey: ['conversations-search', userId, debouncedSearchQuery],
    queryFn: async () => {
      if (!userId || !debouncedSearchQuery) return [];

      const query = debouncedSearchQuery.toLowerCase();
      
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
        .eq('user_id', userId)
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

      return uniqueMatches;
    },
    enabled: !!userId && !!debouncedSearchQuery && debouncedSearchQuery.length > 0,
  });

  // Compute displayed conversations (search results or all conversations)
  const conversations = useMemo(() => {
    if (debouncedSearchQuery) {
      return searchResults || [];
    }
    return allConversations;
  }, [debouncedSearchQuery, searchResults, allConversations]);

  // Delete conversation mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ conversationId, alsoDeleteProject }: { conversationId: string; alsoDeleteProject: boolean }) => {
      if (!userId) throw new Error('User not authenticated');

      // Delete conversation
      const { error: convError } = await supabase
        .from('v2_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (convError) throw convError;

      // Delete project if requested
      if (alsoDeleteProject && conversationToDelete?.project_id) {
        const { error: projectError } = await supabase
          .from('v2_projects')
          .delete()
          .eq('id', conversationToDelete.project_id)
          .eq('user_id', userId);

        if (projectError) {
          console.error('Error deleting project:', projectError);
          throw new Error('Failed to delete project');
        }
      }
    },
    onSuccess: () => {
      // Invalidate conversations query to refresh list
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      queryClient.invalidateQueries({ queryKey: ['conversations-search', userId] });
      
      // Dispatch event to refresh sidebar conversations without animations
      window.dispatchEvent(new CustomEvent('conversation:deleted'));
      
      // Close dialog
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
      setProjectName(null);
    },
  });

  const clearSearch = () => {
    setSearchQuery("");
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  const checkIfOnlyConversationInProject = async (
    conversationId: string,
    projectId: string | null
  ): Promise<{ isOnly: boolean; projectName: string | null }> => {
    if (!projectId) {
      return { isOnly: false, projectName: null };
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { isOnly: false, projectName: null };
      }

      // Count active conversations with same project_id
      const { count, error: countError } = await supabase
        .from('v2_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (countError) {
        console.error('Error counting conversations:', countError);
        return { isOnly: false, projectName: null };
      }

      // If count is 1, this is the only conversation in the project
      if (count === 1) {
        // Fetch project name
        const { data: project, error: projectError } = await supabase
          .from('v2_projects')
          .select('name')
          .eq('id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (projectError) {
          console.error('Error fetching project:', projectError);
          return { isOnly: true, projectName: null };
        }

        return { isOnly: true, projectName: project?.name || 'Sans nom' };
      }

      return { isOnly: false, projectName: null };
    } catch (error) {
      console.error('Error checking if only conversation:', error);
      return { isOnly: false, projectName: null };
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, conversation: V2Conversation) => {
    e.stopPropagation(); // Prevent navigation to conversation
    
    const { isOnly, projectName: name } = await checkIfOnlyConversationInProject(
      conversation.id,
      conversation.project_id
    );

    setConversationToDelete(conversation);
    setProjectName(isOnly ? name : null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConversation = async (alsoDeleteProject: boolean) => {
    if (!conversationToDelete) return;

    try {
      await deleteMutation.mutateAsync({
        conversationId: conversationToDelete.id,
        alsoDeleteProject,
      });

      toast({
        title: 'Suppression réussie',
        description: alsoDeleteProject && conversationToDelete.project_id
          ? 'La conversation et le projet ont été supprimés.'
          : 'La conversation a été supprimée.',
      });
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      toast({
        title: error.message?.includes('project') ? 'Conversation supprimée' : 'Erreur',
        description: error.message?.includes('project')
          ? 'La conversation a été supprimée, mais une erreur est survenue lors de la suppression du projet.'
          : 'Une erreur est survenue lors de la suppression de la conversation.',
        variant: 'destructive',
      });
    }
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
                  <div
                    key={conversation.id}
                    className={cn(
                      "relative group w-full rounded-lg transition-all duration-150 border",
                      isActive
                        ? "bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                    )}
                  >
                    <button
                      onClick={() => handleConversationClick(conversation.id)}
                      className="w-full text-left px-4 py-3"
                    >
                      <div className="flex flex-col gap-1">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate pr-8">
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
                    <button
                      onClick={(e) => handleDeleteClick(e, conversation)}
                      disabled={deleteMutation.isPending}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all duration-150",
                        "opacity-0 group-hover:opacity-100",
                        "text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-500",
                        "hover:bg-red-50 dark:hover:bg-red-950/20",
                        deleteMutation.isPending && "opacity-50 cursor-not-allowed"
                      )}
                      aria-label="Supprimer la conversation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
      <DeleteConversationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteDialogOpen(false);
            setConversationToDelete(null);
            setProjectName(null);
          }
        }}
        conversationName={
          conversationToDelete?.title || 
          conversationToDelete?.context_metadata?.initial_address || 
          'Conversation'
        }
        projectName={projectName}
        onConfirm={handleDeleteConversation}
        deleting={deleteMutation.isPending}
      />
    </>
  );
}

