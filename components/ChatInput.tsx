'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  disabledTooltip?: string;
  placeholder?: string;
}

export function ChatInput({ 
  onSend, 
  disabled, 
  disabledTooltip,
  placeholder = 'Quelle est la hauteur maximale autorisée ? Puis-je construire un garage ?' 
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // useEffect: DOM manipulation (auto-resize textarea)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-[1px] sm:p-4">
      <div className={cn(
        "relative flex items-end gap-[2px] sm:gap-2 rounded-lg border border-border bg-secondary/30 p-[1px] sm:p-3 transition-all max-w-4xl mx-auto",
        disabled && "opacity-60"
      )}>
        <div className="relative flex-1 min-w-0">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "min-h-[36px] sm:min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent pr-7 sm:pr-10 shadow-none focus-visible:ring-0 overflow-hidden",
              "text-xs sm:text-base placeholder:text-muted-foreground",
              "[&::-webkit-resizer]:hidden [resize:none]"
            )}
            rows={1}
            style={{ resize: 'none' }}
          />
          {input.length > 0 && input.length > 500 && (
            <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground/60 pointer-events-none">
              {input.length}
            </div>
          )}
        </div>
        <Button 
          type="submit" 
          size="icon" 
          disabled={disabled || !input.trim()} 
          title={disabled && disabledTooltip ? disabledTooltip : undefined}
          className={cn(
            "h-7 w-7 sm:h-9 sm:w-9 shrink-0 rounded-md bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "transition-opacity mb-0"
          )}
        >
          <Send className="h-[5px] w-[5px] sm:h-[18px] sm:w-[18px]" />
        </Button>
      </div>
    </form>
  );
}
