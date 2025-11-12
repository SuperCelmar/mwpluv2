'use client';

import Image from 'next/image';
import { Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useChatStore } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function LeftSidebar() {
  const { conversations, currentConversationId, setCurrentConversationId } = useChatStore();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDarkMode = mounted && resolvedTheme === 'dark';

  const handleNewConversation = () => {
    setCurrentConversationId(null);
  };

  return (
    <div className="w-[280px] flex flex-col h-screen" style={{ borderRight: '1px solid #E5E5E5', backgroundColor: '#FFFFFF' }}>
      <div className="p-16 space-y-16">
        <div className="flex items-center justify-between">
          <Image
            src={isDarkMode ? "/MWPLU_white.svg" : "/MWPLU.svg"}
            alt="MWPLU"
            width={120}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </div>

        <Button
          onClick={handleNewConversation}
          className="w-full h-40 transition-all duration-150 rounded"
          style={{ backgroundColor: '#000000', color: '#FFFFFF' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#000000'}
        >
          <Plus className="h-16 w-16 mr-8" />
          Nouvelle conversation
        </Button>
      </div>

      <Separator style={{ backgroundColor: '#E5E5E5' }} />

      <ScrollArea className="flex-1 px-8">
        <div className="space-y-4 py-8">
          {conversations.length === 0 ? (
            <div className="text-sm text-center py-32 px-16" style={{ color: '#666666' }}>
              Aucune conversation pour le moment
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setCurrentConversationId(conversation.id)}
                className={cn(
                  'w-full text-left px-12 py-12 rounded-lg transition-all duration-150 group'
                )}
                style={{
                  backgroundColor: currentConversationId === conversation.id ? '#E5E5E5' : '#FFFFFF',
                }}
                onMouseEnter={(e) => {
                  if (currentConversationId !== conversation.id) {
                    e.currentTarget.style.backgroundColor = '#F5F5F5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentConversationId !== conversation.id) {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }
                }}
              >
                <div className="flex flex-col gap-4">
                  <span className="text-sm font-medium truncate" style={{ color: '#000000' }}>
                    {conversation.address}
                  </span>
                  <span className="text-xs" style={{ color: '#666666' }}>
                    {formatDistanceToNow(new Date(conversation.updatedAt), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </span>
                  {conversation.messages.length > 0 && (
                    <span className="text-xs truncate mt-4" style={{ color: '#999999' }}>
                      {conversation.messages[conversation.messages.length - 1].content.substring(
                        0,
                        60
                      )}
                      ...
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>

      <Separator style={{ backgroundColor: '#E5E5E5' }} />

      <div className="p-16 space-y-8">
        <Button
          variant="ghost"
          className="w-full justify-start transition-all duration-150"
          style={{ color: '#333333' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F5F5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Settings className="h-16 w-16 mr-8" />
          Paramètres
        </Button>

        <div
          className="flex items-center gap-12 px-8 py-8 rounded-lg transition-all duration-150 cursor-pointer"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F5F5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Avatar className="h-32 w-32">
            <AvatarFallback className="text-sm" style={{ backgroundColor: '#000000', color: '#FFFFFF' }}>
              U
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: '#000000' }}>Utilisateur</p>
            <p className="text-xs truncate" style={{ color: '#666666' }}>user@example.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
