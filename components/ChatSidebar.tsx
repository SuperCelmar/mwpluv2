'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { V2Conversation } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  Conversations: V2Conversation[];
  currentConversationId: string;
  onNewConversation: () => void;
}

export function ChatSidebar({ Conversations, currentConversationId, onNewConversation }: ChatSidebarProps) {
  const router = useRouter();

  return (
    <div className="w-[280px] border-r bg-gray-50 flex flex-col h-full">
      <div className="p-4 border-b bg-white">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 mb-4"
          onClick={() => router.push('/projects')}
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
          {Conversations.length === 0 ? (
            <div className="text-center py-8 px-4 text-sm text-gray-500">
              <FolderOpen className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              Aucun projet
            </div>
          ) : (
            Conversations.map((conversation) => {
              const title = conversation.title || conversation.context_metadata?.initial_address || 'Conversation';
              const address = conversation.context_metadata?.initial_address;
              
              return (
                <button
                  key={conversation.id}
                  onClick={() => router.push(`/chat/${conversation.id}`)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    'hover:bg-gray-200',
                    conversation.id === currentConversationId
                      ? 'bg-blue-100 text-blue-900 font-medium'
                      : 'text-gray-700'
                  )}
                >
                  <div className="font-medium truncate">{title}</div>
                  {address && (
                    <div className="text-xs text-gray-500 truncate mt-1">
                      {address}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-white">
        <Button onClick={onNewConversation} className="w-full gap-2" size="sm">
          <Plus className="h-4 w-4" />
          Nouveau Projet
        </Button>
      </div>
    </div>
  );
}
