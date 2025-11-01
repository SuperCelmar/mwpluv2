'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Settings, User, ChevronLeft, Menu, MessageSquare, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Conversation {
  id: string;
  name: string;
  address: string | null;
  municipality: string | null;
  updated_at: string;
}

interface ChatLeftSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNewConversation: () => void;
}

export function ChatLeftSidebar({ collapsed, onToggle, onNewConversation }: ChatLeftSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('projects')
        .select('id, name, address, municipality, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

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

  const getCurrentConversationId = () => {
    const match = pathname?.match(/\/chat\/([^\/]+)/);
    return match ? match[1] : null;
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
                    ) : conversations.length === 0 ? (
                      <div className="text-sm text-gray-500 text-center py-8">
                        Aucun projet pour le moment
                      </div>
                    ) : (
                      conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          onClick={() => handleConversationClick(conversation.id)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-md transition-colors text-sm',
                            currentConversationId === conversation.id
                              ? 'bg-blue-100 text-blue-900'
                              : 'hover:bg-gray-100 text-gray-700'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {conversation.municipality || 'Projet'}
                              </p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {conversation.address || conversation.name}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatDistanceToNow(new Date(conversation.updated_at), {
                                  addSuffix: true,
                                  locale: fr,
                                })}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}

              {collapsed && (
                <div className="flex flex-col items-center gap-2">
                  {conversations.slice(0, 5).map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => handleConversationClick(conversation.id)}
                      className={cn(
                        'w-10 h-10 rounded-md flex items-center justify-center transition-colors',
                        currentConversationId === conversation.id
                          ? 'bg-blue-100 text-blue-900'
                          : 'hover:bg-gray-100 text-gray-600'
                      )}
                      title={conversation.municipality || conversation.name}
                    >
                      <MapPin className="h-5 w-5" />
                    </button>
                  ))}
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
