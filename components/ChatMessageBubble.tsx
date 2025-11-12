'use client';

import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAvatar } from '@/hooks/useAvatar';

interface ChatMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  userId?: string | null;
}

export function ChatMessageBubble({ role, content, userId }: ChatMessageBubbleProps) {
  const isUser = role === 'user';
  const { avatarUrl } = useAvatar(isUser && userId ? userId : null);

  return (
    <div
      className={cn(
        'flex gap-2 px-3 py-2 sm:px-4 sm:py-2.5',
        isUser ? 'justify-end' : 'justify-start'
      )}
      role="article"
      aria-label={isUser ? 'User message' : 'Assistant message'}
    >
      {/* Bot Avatar - Left side */}
      {!isUser && (
        <div
          className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 select-none items-center justify-center rounded-full bg-blue-50 text-blue-700 transition-all duration-200"
          aria-hidden="true"
        >
          <Bot className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={cn(
          'max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 transition-all duration-200',
          isUser
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-white text-gray-900 shadow-sm border border-gray-200 hover:border-gray-300'
        )}
      >
        <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </p>
      </div>

      {/* User Avatar - Right side */}
      {isUser && (
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
          <AvatarImage src={avatarUrl || undefined} alt="Avatar" />
          <AvatarFallback className="bg-blue-600 text-white transition-all duration-200 text-xs sm:text-sm">
            <User className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
