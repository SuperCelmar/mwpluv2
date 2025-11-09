'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ 
  onSend, 
  disabled, 
  placeholder = 'Quelle est la hauteur maximale autorisée ? Puis-je construire un garage ?' 
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <form onSubmit={handleSubmit} className="border-t bg-white p-4">
      <div className={cn(
        "relative flex items-end gap-2 rounded-lg border border-border bg-secondary/30 p-3 transition-all max-w-4xl mx-auto",
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
              "min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent pr-10 shadow-none focus-visible:ring-0 overflow-hidden",
              "placeholder:text-muted-foreground",
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
          className={cn(
            "h-7 w-7 shrink-0 rounded-md bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "transition-opacity mb-0.5"
          )}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </form>
  );
}
