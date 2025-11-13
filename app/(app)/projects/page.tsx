'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, FolderOpen } from 'lucide-react';
import { ProjectCard } from '@/components/ProjectCard';
import { NewConversationModal } from '@/components/NewConversationModal';
import { Button } from '@/components/ui/button';
import { supabase, V2Project, V2Conversation } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';

type ProjectWithConversations = V2Project & {
  conversations?: V2Conversation[];
};

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showNewModal, setShowNewModal] = useState(false);

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

  // Fetch projects using React Query
  const { data: projects = [], isLoading: loading } = useQuery({
    queryKey: ['projects', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Query v2 projects with their conversations
      const { data, error } = await supabase
        .from('v2_projects')
        .select(`
          *,
          conversations:v2_conversations(
            id,
            last_message_at,
            message_count,
            created_at
          )
        `)
        .eq('user_id', userId)
        .or('status.eq.draft,status.eq.active')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ProjectWithConversations[];
    },
    enabled: !!userId,
  });

  // useEffect: sync with URL search params
  useEffect(() => {
    if (searchParams.get('modal') === 'new') {
      setShowNewModal(true);
    }
  }, [searchParams]);

  const handleNewConversation = () => {
    setShowNewModal(true);
  };

  const handleCloseModal = (open: boolean) => {
    setShowNewModal(open);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 w-full">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 w-full">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Mes projets</h1>
            <Button onClick={handleNewConversation} className="gap-2">
              <Plus className="h-5 w-5" />
              Nouveau Projet
            </Button>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FolderOpen className="h-24 w-24 text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Aucun projet pour le moment
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Créez votre premier projet pour commencer !
              </p>
              <Button onClick={handleNewConversation} size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Nouveau Projet
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <NewConversationModal open={showNewModal} onOpenChange={handleCloseModal} />
    </>
  );
}

