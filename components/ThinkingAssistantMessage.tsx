'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function ThinkingAssistantMessage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Determine theme-aware logo path
  const logoSrc = resolvedTheme === 'dark' 
    ? '/square-white-plu.svg' 
    : '/square-black-plu.svg';

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={cn(
        'flex gap-2 px-3 py-2 sm:px-4 sm:py-2.5',
        'justify-start'
      )}
      role="article"
      aria-label="Assistant thinking message"
    >
      {/* Assistant Avatar with Logo */}
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

      {/* Thinking Message Bubble */}
      <div
        className={cn(
          'max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5',
          'bg-white text-gray-900 shadow-sm border border-gray-200 hover:border-gray-300'
        )}
      >
        <div className="flex items-center gap-2">
          <TextShimmer 
            className="text-sm sm:text-[15px] leading-relaxed"
            duration={1.5}
          >
            L&apos;assistant réfléchit...
          </TextShimmer>
        </div>
      </div>
    </div>
  );
}

