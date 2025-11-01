'use client';

import { Message } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3 py-4 px-6', isUser ? 'bg-gray-50' : 'bg-white')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md',
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
        )}
      >
        {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
