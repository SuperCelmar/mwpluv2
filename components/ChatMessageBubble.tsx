'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import { useAvatar } from '@/hooks/useAvatar';

interface ChatMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  userId?: string | null;
  isAnalysisMessage?: boolean;
  onTextGenerationComplete?: () => void;
}

export function ChatMessageBubble({ 
  role, 
  content, 
  userId, 
  isAnalysisMessage = false,
  onTextGenerationComplete 
}: ChatMessageBubbleProps) {
  const isUser = role === 'user';
  const { avatarUrl } = useAvatar(isUser && userId ? userId : null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [textGenerationComplete, setTextGenerationComplete] = useState(!isAnalysisMessage);

  // Determine theme-aware logo path
  const logoSrc = resolvedTheme === 'dark' 
    ? '/square-white-plu.svg' 
    : '/square-black-plu.svg';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate generation time and call completion callback
  useEffect(() => {
    if (!isAnalysisMessage || textGenerationComplete) {
      return;
    }

    // Estimate generation time: ~0.2s per word (from TextGenerateEffect stagger)
    const wordCount = content.split(' ').length;
    const estimatedTime = wordCount * 0.2 * 1000; // Convert to milliseconds
    const minTime = 1000; // Minimum 1 second
    const maxTime = 5000; // Maximum 5 seconds
    const generationTime = Math.min(Math.max(estimatedTime, minTime), maxTime);

    const timeout = setTimeout(() => {
      setTextGenerationComplete(true);
      if (onTextGenerationComplete) {
        onTextGenerationComplete();
      }
    }, generationTime);

    return () => clearTimeout(timeout);
  }, [isAnalysisMessage, content, textGenerationComplete, onTextGenerationComplete]);

  return (
    <div
      className={cn(
        'flex gap-2 px-3 py-2 sm:px-4 sm:py-2.5',
        isUser ? 'justify-end' : 'justify-start'
      )}
      role="article"
      aria-label={isUser ? 'User message' : 'Assistant message'}
    >
      {/* Assistant Avatar with Logo - Left side */}
      {!isUser && (
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
          {mounted && (
            <img
              src={logoSrc}
              alt="MWPLU Logo"
              className="h-full w-full rounded-full object-contain p-1"
            />
          )}
          <AvatarFallback className="bg-blue-50 text-blue-700 transition-all duration-200">
            <div className="h-full w-full flex items-center justify-center">
              {mounted ? (
                <img
                  src={logoSrc}
                  alt="MWPLU Logo"
                  className="h-5 w-5 object-contain"
                />
              ) : (
                <div className="h-4 w-4 bg-blue-600 rounded" />
              )}
            </div>
          </AvatarFallback>
        </Avatar>
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
        {isAnalysisMessage && !isUser ? (
          <div className="text-sm sm:text-[15px] leading-relaxed">
            <TextGenerateEffect
              words={content}
              className="font-normal text-sm sm:text-[15px] no-margin"
              filter={true}
              duration={0.5}
            />
          </div>
        ) : (
          <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </p>
        )}
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
