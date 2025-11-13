'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AddressInput } from '@/components/AddressInput';
import { supabase, V2Project, V2Conversation } from '@/lib/supabase';
import { AddressSuggestion } from '@/lib/address-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, MapPin, Clock, FolderOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

export default function ProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  // Fetch project using React Query
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', params.id],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('v2_projects')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        router.push('/projects');
        return null;
      }

      return data;
    },
    enabled: !!userId,
    onError: () => {
      router.push('/projects');
    },
  });

  // Fetch conversations using React Query
  const { data: conversations = [] } = useQuery({
    queryKey: ['project-conversations', params.id],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('v2_conversations')
        .select('*')
        .eq('project_id', params.id)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!project,
  });

  const loading = projectLoading;

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (address: AddressSuggestion) => {
      if (!userId) throw new Error('User not authenticated');

      const fullAddress = address.properties.label;
      const defaultTitle = address.properties.city && fullAddress 
        ? `${address.properties.city}_${fullAddress.split(',')[0]}` 
        : fullAddress;

      // Create conversation directly linked to this project
      const { data: conversation, error: conversationError } = await supabase
        .from('v2_conversations')
        .insert({
          user_id: userId,
          project_id: params.id,
          conversation_type: 'address_analysis',
          title: defaultTitle,
          context_metadata: {
            initial_address: fullAddress,
            geocoded: {
              lon: address.geometry?.coordinates?.[0] || null,
              lat: address.geometry?.coordinates?.[1] || null,
            },
            city: address.properties.city || null,
            insee_code: address.properties.citycode || null,
          },
          enrichment_status: 'pending',
          is_active: true,
        })
        .select()
        .single();

      if (conversationError || !conversation) {
        throw conversationError || new Error('Failed to create conversation');
      }

      // Store in research history
      await supabase
        .from('v2_research_history')
        .insert({
          user_id: userId,
          conversation_id: conversation.id,
          address_input: fullAddress,
          geo_lon: address.geometry?.coordinates?.[0] || null,
          geo_lat: address.geometry?.coordinates?.[1] || null,
          success: true,
        });

      return conversation;
    },
    onSuccess: (conversation) => {
      // Invalidate conversations query to refresh list
      queryClient.invalidateQueries({ queryKey: ['project-conversations', params.id] });
      // Navigate to the new conversation
      router.push(`/chat/${conversation.id}`);
    },
  });

  const handleAddressSelect = async (address: AddressSuggestion) => {
    try {
      await createConversationMutation.mutateAsync(address);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la conversation. Veuillez réessayer.',
        variant: 'destructive',
      });
    }
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'completed':
        return 'outline';
      case 'archived':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'active':
        return 'Actif';
      case 'completed':
        return 'Terminé';
      case 'archived':
        return 'Archivé';
      default:
        return status;
    }
  };

  const getProjectTypeLabel = (type: string | null): string | null => {
    if (!type) return null;
    const typeMap: Record<string, string> = {
      construction: 'Construction',
      extension: 'Extension',
      renovation: 'Rénovation',
      amenagement: 'Aménagement',
      lotissement: 'Lotissement',
      other: 'Autre',
    };
    return typeMap[type] || type;
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 w-full">
          <Skeleton className="h-32 w-full mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const projectName = project.name || 'Sans nom';
  const projectTypeLabel = getProjectTypeLabel(project.project_type);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 w-full">
        {/* Project Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-3xl flex-shrink-0">{project.icon || '📁'}</span>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-2xl truncate">{projectName}</CardTitle>
                  {projectTypeLabel && (
                    <CardDescription className="mt-1">
                      <Badge variant="outline" className="text-xs">
                        {projectTypeLabel}
                      </Badge>
                    </CardDescription>
                  )}
                </div>
              </div>
              <Badge variant={getStatusBadgeVariant(project.status)}>
                {getStatusLabel(project.status)}
              </Badge>
            </div>
            {project.main_address && (
              <CardDescription className="flex items-center gap-2 mt-2">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{project.main_address}</span>
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        {/* Conversations List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Conversations ({conversations.length})
          </h2>
          {conversations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Aucune conversation
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Commencez une nouvelle conversation en entrant une adresse ci-dessous.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => {
                const convTitle = conversation.title || 
                  conversation.context_metadata?.initial_address || 
                  'Conversation';
                const lastActivity = conversation.last_message_at || conversation.created_at;

                return (
                  <Card
                    key={conversation.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]"
                    onClick={() => handleConversationClick(conversation.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {convTitle}
                            </h3>
                          </div>
                          {conversation.context_metadata?.initial_address && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-1">
                              {conversation.context_metadata.initial_address}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                            <span>{conversation.message_count} messages</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(lastActivity), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nouvelle conversation</CardTitle>
            <CardDescription>
              Entrez une adresse pour créer une nouvelle conversation dans ce projet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddressInput onAddressSelect={handleAddressSelect} disabled={createConversationMutation.isPending} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

