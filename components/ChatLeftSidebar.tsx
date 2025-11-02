'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Settings, User, ChevronLeft, Menu, MessageSquare, MapPin, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { supabase, V2Project, V2Conversation } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ProjectWithConversations extends V2Project {
  conversations?: V2Conversation[];
}

interface ChatLeftSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNewConversation: () => void;
}

export function ChatLeftSidebar({ collapsed, onToggle, onNewConversation }: ChatLeftSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<ProjectWithConversations[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const getCurrentConversationId = () => {
    const match = pathname?.match(/\/chat\/([^\/]+)/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('v2_projects')
        .select(`
          *,
          conversations:v2_conversations(
            id,
            title,
            last_message_at,
            context_metadata,
            created_at,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['draft', 'active'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Filter and sort conversations within each project
        const processed = data.map((project) => ({
          ...project,
          conversations: project.conversations
            ?.filter((conv) => conv.is_active)
            .sort((a, b) => {
              const timeA = a.last_message_at || a.created_at;
              const timeB = b.last_message_at || b.created_at;
              return new Date(timeB).getTime() - new Date(timeA).getTime();
            }),
        }));
        setProjects(processed);
        
        // Auto-expand projects that have the current conversation
        const currentConvId = getCurrentConversationId();
        if (currentConvId) {
          const projectWithCurrentConv = processed.find((p) =>
            p.conversations?.some((c) => c.id === currentConvId)
          );
          if (projectWithCurrentConv) {
            setExpandedProjects(new Set([projectWithCurrentConv.id]));
          }
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleConversationClick = (conversationId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    router.push(`/chat/${conversationId}`);
  };

  const handleProjectClick = (project: ProjectWithConversations) => {
    // If project has conversations, toggle expand. Otherwise, go to first conversation or create new.
    if (project.conversations && project.conversations.length > 0) {
      toggleProject(project.id);
      // If collapsing and current conversation is in this project, navigate to first conversation
      if (expandedProjects.has(project.id)) {
        // Will collapse, but if user clicks project name, navigate to most recent conversation
      }
    }
  };

  const currentConversationId = getCurrentConversationId();
  return (
    <>
      <div
        className={cn(
          'relative border-r bg-gray-50 transition-all duration-300 ease-in-out flex flex-col',
          collapsed ? 'w-0 md:w-16' : 'w-64'
        )}
      >
        <div className={cn('flex-1 overflow-hidden', collapsed && 'hidden md:flex md:flex-col')}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              {!collapsed && (
                <h1 className="text-xl font-bold text-gray-900">MWPLU</h1>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className={cn('h-8 w-8', collapsed && 'mx-auto')}
              >
                {collapsed ? (
                  <Menu className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </Button>
            </div>

            {!collapsed && (
              <Button
                onClick={onNewConversation}
                className="w-full justify-start gap-2"
                variant="default"
              >
                <Plus className="h-4 w-4" />
                Nouvelle conversation
              </Button>
            )}

            {collapsed && (
              <Button
                onClick={onNewConversation}
                size="icon"
                className="w-full h-10"
                variant="default"
              >
                <Plus className="h-5 w-5" />
              </Button>
            )}
          </div>

          <Separator />

          <ScrollArea className="flex-1">
            <div className="p-4">
              {!collapsed && (
                <>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Mes Projets
                  </h2>
                  <div className="space-y-1">
                    {loading ? (
                      <div className="text-sm text-gray-500 text-center py-8">
                        Chargement...
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="text-sm text-gray-500 text-center py-8">
                        Aucun projet pour le moment
                      </div>
                    ) : (
                      projects.map((project) => {
                        const isExpanded = expandedProjects.has(project.id);
                        const projectName = project.name || 'Sans nom';
                        const hasConversations = project.conversations && project.conversations.length > 0;
                        const conversationCount = project.conversations?.length || 0;
                        
                        // Get most recent activity
                        const mostRecentActivity = project.conversations && project.conversations.length > 0
                          ? project.conversations[0].last_message_at || project.conversations[0].created_at
                          : project.updated_at;

                        return (
                          <div key={project.id} className="space-y-0.5">
                            {/* Project Header */}
                            <button
                              onClick={() => handleProjectClick(project)}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-md transition-colors text-sm group',
                                'hover:bg-gray-100 text-gray-700'
                              )}
                            >
                              <div className="flex items-start gap-2">
                                {hasConversations ? (
                                  isExpanded ? (
                                    <ChevronDown className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" />
                                  )
                                ) : (
                                  <div className="w-4 h-4 flex-shrink-0" />
                                )}
                                <span className="text-base flex-shrink-0">{project.icon || '📁'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    'font-medium truncate',
                                    project.status === 'draft' && !project.name && 'italic text-gray-500'
                                  )}>
                                    {projectName}
                                  </p>
                                  {project.main_address && (
                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                      {project.main_address}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {conversationCount > 0 && (
                                      <span className="text-xs text-gray-400">
                                        {conversationCount} {conversationCount === 1 ? 'conversation' : 'conversations'}
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-400">
                                      {formatDistanceToNow(new Date(mostRecentActivity), {
                                        addSuffix: true,
                                        locale: fr,
                                      })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>

                            {/* Conversations List */}
                            {isExpanded && hasConversations && (
                              <div className="ml-8 space-y-0.5 pl-2 border-l border-gray-200">
                                {project.conversations?.map((conversation) => {
                                  const isActive = currentConversationId === conversation.id;
                                  const convTitle = conversation.title || 
                                    conversation.context_metadata?.initial_address || 
                                    'Conversation';
                                  const lastActivity = conversation.last_message_at || conversation.created_at;

                                  return (
                                    <button
                                      key={conversation.id}
                                      onClick={(e) => handleConversationClick(conversation.id, e)}
                                      className={cn(
                                        'w-full text-left px-3 py-2 rounded-md transition-colors text-sm',
                                        isActive
                                          ? 'bg-blue-100 text-blue-900'
                                          : 'hover:bg-gray-100 text-gray-700'
                                      )}
                                    >
                                      <div className="flex items-start gap-2">
                                        <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium truncate text-xs">
                                            {convTitle}
                                          </p>
                                          <p className="text-xs text-gray-400 mt-0.5">
                                            {formatDistanceToNow(new Date(lastActivity), {
                                              addSuffix: true,
                                              locale: fr,
                                            })}
                                          </p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {collapsed && (
                <div className="flex flex-col items-center gap-2">
                  {projects.slice(0, 5).map((project) => {
                    // In collapsed state, show project icon, navigate to first conversation
                    const firstConversation = project.conversations && project.conversations.length > 0
                      ? project.conversations[0]
                      : null;
                    
                    return (
                      <button
                        key={project.id}
                        onClick={() => {
                          if (firstConversation) {
                            handleConversationClick(firstConversation.id);
                          }
                        }}
                        className={cn(
                          'w-10 h-10 rounded-md flex items-center justify-center transition-colors',
                          firstConversation && currentConversationId === firstConversation.id
                            ? 'bg-blue-100 text-blue-900'
                            : 'hover:bg-gray-100 text-gray-600'
                        )}
                        title={project.name || 'Sans nom'}
                      >
                        <span className="text-lg">{project.icon || '📁'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          <div className="p-4 space-y-2">
            {!collapsed ? (
              <>
                <Button variant="ghost" className="w-full justify-start gap-2" size="sm">
                  <Settings className="h-4 w-4" />
                  Paramètres
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" size="sm">
                  <User className="h-4 w-4" />
                  Profil
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="icon" className="w-full h-10">
                  <Settings className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-full h-10">
                  <User className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}
