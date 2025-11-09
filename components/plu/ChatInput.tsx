'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = 'Entrez votre adresse...' }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t bg-white p-[1px] sm:p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex gap-[2px] sm:gap-3 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="resize-none min-h-[36px] sm:min-h-[44px] max-h-[200px] text-xs sm:text-base pr-10 sm:pr-16"
            />
            <div className="absolute bottom-1 sm:bottom-3 right-1 sm:right-3 text-[10px] sm:text-xs text-gray-400">
              {message.length > 0 && `${message.length}`}
            </div>
          </div>
          <Button
            type="submit"
            disabled={!message.trim() || disabled}
            className="h-7 w-7 sm:h-10 sm:w-10 rounded-full bg-black hover:bg-gray-800 p-0 flex-shrink-0"
          >
            <Send className="h-[5px] w-[5px] sm:h-5 sm:w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
