'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Project } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  projects: Project[];
  currentProjectId: string;
  onNewProject: () => void;
}

export function ChatSidebar({ projects, currentProjectId, onNewProject }: ChatSidebarProps) {
  const router = useRouter();

  return (
    <div className="w-[280px] border-r bg-gray-50 flex flex-col h-full">
      <div className="p-4 border-b bg-white">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 mb-4"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft className="h-4 w-4" />
          Tableau de bord
        </Button>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Mes projets
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {projects.length === 0 ? (
            <div className="text-center py-8 px-4 text-sm text-gray-500">
              <FolderOpen className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              Aucun projet
            </div>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/project/${project.id}`)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                  'hover:bg-gray-200',
                  project.id === currentProjectId
                    ? 'bg-blue-100 text-blue-900 font-medium'
                    : 'text-gray-700'
                )}
              >
                <div className="font-medium truncate">{project.name}</div>
                {project.address && (
                  <div className="text-xs text-gray-500 truncate mt-1">
                    {project.address}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-white">
        <Button onClick={onNewProject} className="w-full gap-2" size="sm">
          <Plus className="h-4 w-4" />
          Nouveau Projet
        </Button>
      </div>
    </div>
  );
}
