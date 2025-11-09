'use client';

import { Message } from '@/lib/store';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
  onCitationClick?: (article: string, page: number) => void;
  onSuggestedQuestionClick?: (question: string) => void;
}

export function ChatMessage({
  message,
  onCitationClick,
  onSuggestedQuestionClick,
}: ChatMessageProps) {
  const isUser = message.role === 'user';

  const renderContent = () => {
    if (isUser) {
      return <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: '#000000' }}>{message.content}</p>;
    }

    const parts = message.content.split(/(\[→ [^\]]+\])/g);

    return (
      <div className="prose prose-sm max-w-none">
        {parts.map((part, index) => {
          const citationMatch = part.match(/\[→ ([^\]]+)\]/);
          if (citationMatch) {
            const articleName = citationMatch[1];
            const citation = message.citations?.find((c) => c.article === articleName);
            return (
              <Badge
                key={index}
                variant="outline"
                className="inline-flex items-center gap-4 cursor-pointer transition-colors duration-150 mx-4 rounded"
                style={{
                  border: '1px solid #000000',
                  color: '#000000',
                  backgroundColor: '#FFFFFF'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F5F5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                onClick={() => citation && onCitationClick?.(citation.article, citation.page)}
              >
                → {articleName}
              </Badge>
            );
          }

          return (
            <ReactMarkdown
              key={index}
              className="inline"
              components={{
                p: ({ children }) => <span className="text-sm sm:text-[15px]" style={{ color: '#000000' }}>{children}</span>,
                strong: ({ children }) => <strong className="font-bold text-sm sm:text-[15px]" style={{ color: '#000000' }}>{children}</strong>,
                ul: ({ children }) => <ul className="my-2 sm:my-3 ml-4 sm:ml-6 list-disc space-y-1 sm:space-y-2">{children}</ul>,
                li: ({ children }) => <li className="text-sm sm:text-[15px]" style={{ color: '#000000' }}>{children}</li>,
              }}
            >
              {part}
            </ReactMarkdown>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'py-2 px-3 sm:py-3 sm:px-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300'
      )}
      style={{
        backgroundColor: isUser ? '#FFFFFF' : '#F5F5F5'
      }}
    >
      <div className="max-w-4xl mx-auto">
        <div
          className={cn(
            'flex gap-2 sm:gap-3',
            isUser ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <div
            className={cn(
              'flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium'
            )}
            style={{
              backgroundColor: isUser ? '#000000' : '#FFFFFF',
              color: isUser ? '#FFFFFF' : '#000000',
              border: isUser ? 'none' : '1px solid #E5E5E5'
            }}
          >
            {isUser ? 'U' : 'M'}
          </div>

          <div className={cn('flex-1 space-y-2 sm:space-y-3', isUser ? 'max-w-[85%] sm:max-w-[80%]' : 'max-w-[85%] sm:max-w-[80%]')}>
            <div className="space-y-1 sm:space-y-2">{renderContent()}</div>

            {message.images && message.images.length > 0 && (
              <div className="space-y-2 sm:space-y-3">
                {message.images.map((image, index) => (
                  <div
                    key={index}
                    className="relative rounded-lg overflow-hidden"
                    style={{ border: '1px solid #E5E5E5' }}
                  >
                    <img
                      src={image}
                      alt={`Schéma ${index + 1}`}
                      className="w-full h-auto hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
            )}

            {!isUser && message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
              <div className="flex flex-wrap gap-2 sm:gap-3 pt-2 sm:pt-3">
                {message.suggestedQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => onSuggestedQuestionClick?.(question)}
                    className="text-xs sm:text-sm rounded-full transition-all duration-150 h-7 sm:h-8 px-3 sm:px-4"
                    style={{
                      border: '1px solid #E5E5E5',
                      color: '#000000',
                      backgroundColor: '#FFFFFF'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#000000';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#E5E5E5';
                    }}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 sm:gap-3 text-xs pt-1 sm:pt-2" style={{ color: '#999999' }}>
              <span>
                {format(new Date(message.timestamp), 'HH:mm', { locale: fr })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
