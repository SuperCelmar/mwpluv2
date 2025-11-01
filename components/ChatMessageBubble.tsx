'use client';

import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';

interface ChatMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatMessageBubble({ role, content }: ChatMessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex gap-3 px-4 py-6', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-gray-200">
          <Bot className="h-5 w-5 text-gray-700" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-[#0066CC] text-white'
            : 'bg-gray-100 text-gray-900'
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</p>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-[#0066CC]">
          <User className="h-5 w-5 text-white" />
        </div>
      )}
    </div>
  );
}
