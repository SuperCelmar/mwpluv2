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
    <div
      className={cn(
        'flex gap-3 px-4 py-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
      role="article"
      aria-label={isUser ? 'User message' : 'Assistant message'}
    >
      {/* Bot Avatar - Left side */}
      {!isUser && (
        <div
          className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm transition-all duration-200 hover:ring-blue-300"
          aria-hidden="true"
        >
          <Bot className="h-5 w-5" aria-hidden="true" />
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm transition-all duration-200',
          'ring-1 ring-inset',
          isUser
            ? 'bg-blue-600 text-white ring-blue-700 hover:bg-blue-700 hover:shadow-md'
            : 'bg-white text-gray-900 ring-gray-200 hover:ring-gray-300 hover:shadow-md'
        )}
      >
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </p>
      </div>

      {/* User Avatar - Right side */}
      {isUser && (
        <div
          className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-lg bg-blue-600 text-white ring-1 ring-blue-700 shadow-sm transition-all duration-200 hover:ring-blue-800"
          aria-hidden="true"
        >
          <User className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
