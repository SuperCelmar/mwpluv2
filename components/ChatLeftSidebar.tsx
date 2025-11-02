'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, MessageSquare, Folder, User, ChevronLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase, V2Conversation } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ChatLeftSidebarProps {
  onNewConversation: () => void;
}

export function ChatLeftSidebar({ onNewConversation }: ChatLeftSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [conversations, setConversations] = useState<V2Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const getCurrentConversationId = () => {
    const match = pathname?.match(/\/chat\/([^\/]+)/);
    return match ? match[1] : null;
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
        .order('created_at', { ascending: false })
        .limit(20);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const currentConversationId = getCurrentConversationId();

  return (
    <TooltipProvider>
      <div
        className={cn('flex flex-col h-screen transition-all duration-300 ease-in-out', collapsed ? 'w-16' : 'w-[280px]')}
        style={{ borderRight: '1px solid #E5E5E5', backgroundColor: '#FFFFFF' }}
      >
        <div className="flex-1 overflow-hidden flex flex-col">
          {collapsed ? (
            /* Collapsed: Unified icon container */
            <div className="p-4 flex flex-col items-center gap-2">
              {/* Hamburger Menu */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-10 h-10 transition-all duration-150"
                    style={{ color: '#333333' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F5F5F5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Menu</p>
                </TooltipContent>
              </Tooltip>

              {/* Plus Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNewConversation}
                    className="w-10 h-10 transition-all duration-150"
                    style={{ backgroundColor: '#000000', color: '#FFFFFF' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#000000'}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Nouvelle recherche</p>
                </TooltipContent>
              </Tooltip>

              {/* Chat Icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {/* TODO: Open conversations panel */}}
                    className="w-10 h-10 transition-all duration-150"
                    style={{ color: '#333333' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F5F5F5';
                      e.currentTarget.style.color = '#000000';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#333333';
                    }}
                  >
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Chat</p>
                </TooltipContent>
              </Tooltip>

              {/* Folder Icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {/* TODO: Open projects panel */}}
                    className="w-10 h-10 transition-all duration-150"
                    style={{ color: '#333333' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F5F5F5';
                      e.currentTarget.style.color = '#000000';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#333333';
                    }}
                  >
                    <Folder className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Projets</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            /* Expanded: Header with toggle and navigation */
            <>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-2xl font-bold" style={{ color: '#000000' }}>MWPLU</h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="h-8 w-8"
                    style={{ color: '#333333' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F5F5F5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </div>

                {/* New Conversation Button */}
                <Button
                  onClick={onNewConversation}
                  className="w-full h-10 transition-all duration-150 rounded"
                  style={{ backgroundColor: '#000000', color: '#FFFFFF' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#000000'}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle recherche
                </Button>
              </div>

              <Separator style={{ backgroundColor: '#E5E5E5' }} />

              {/* Navigation Icons / Content */}
              <div className="p-4">
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start transition-all duration-150"
                    style={{ color: '#333333' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F5F5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Chat
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full justify-start transition-all duration-150"
                    style={{ color: '#333333' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F5F5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Folder className="h-4 w-4 mr-2" />
                    Projets
                  </Button>
                </div>
              </div>
            </>
          )}

          {!collapsed && (
            <>
              <Separator style={{ backgroundColor: '#E5E5E5' }} />

              {/* Recent Chats List (only when expanded) */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#666666' }}>
                  Récents
                </h2>
                <div className="space-y-1">
                  {loading ? (
                    <div className="text-sm text-center py-8" style={{ color: '#666666' }}>
                      Chargement...
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-sm text-center py-8" style={{ color: '#666666' }}>
                      Aucune conversation
                    </div>
                  ) : (
                    conversations.map((conversation) => {
                      const isActive = currentConversationId === conversation.id;
                      const convTitle = conversation.title || 
                        conversation.context_metadata?.initial_address || 
                        'Conversation';
                      const lastActivity = conversation.last_message_at || conversation.created_at;

                      return (
                        <button
                          key={conversation.id}
                          onClick={() => handleConversationClick(conversation.id)}
                          className="w-full text-left px-3 py-2 rounded-lg transition-all duration-150 text-sm"
                          style={{
                            backgroundColor: isActive ? '#E5E5E5' : '#FFFFFF',
                            color: '#000000'
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = '#F5F5F5';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = '#FFFFFF';
                            }
                          }}
                        >
                          <div className="flex flex-col gap-1">
                            <p className="font-medium truncate text-xs" style={{ color: '#000000' }}>
                              {convTitle}
                            </p>
                            <p className="text-xs" style={{ color: '#999999' }}>
                              {formatDistanceToNow(new Date(lastActivity), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </ScrollArea>
            </>
          )}

          {/* Spacer for collapsed */}
          {collapsed && <div className="flex-1" />}

          {/* Bottom Icon - Avatar */}
          <div className="py-4">
            {collapsed ? (
              <div className="flex justify-center">
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-12 h-12 rounded-full transition-all duration-150"
                          style={{ color: '#333333' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#F5F5F5';
                            e.currentTarget.style.color = '#000000';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#333333';
                          }}
                        >
                          <User className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Profil</p>
                    </TooltipContent>
                  </Tooltip>

                  <DropdownMenuContent align="end" side="right" className="w-56">
                    <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {/* TODO: Open settings */}}>
                      Paramètres
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start transition-all duration-150"
                      style={{ color: '#333333' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F5F5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Profil
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="right" className="w-56">
                    <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {/* TODO: Open settings */}}>
                      Paramètres
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
