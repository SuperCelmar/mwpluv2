'use client';

import { Message } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const content = 'content' in message ? message.content : message.message;

  return (
    <div
      className={cn(
        'group flex gap-4 py-5 px-6 transition-colors duration-150',
        isUser 
          ? 'bg-gray-50/50 border-l-2 border-l-blue-500' 
          : 'bg-white border-l-2 border-l-gray-300 hover:bg-gray-50/30'
      )}
      role="article"
      aria-label={isUser ? 'User message' : 'Assistant message'}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-lg transition-all duration-200',
          'ring-1 ring-inset',
          isUser
            ? 'bg-blue-600 text-white ring-blue-700 shadow-sm'
            : 'bg-blue-50 text-blue-700 ring-blue-200 shadow-sm group-hover:ring-blue-300'
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Bot className="h-5 w-5" aria-hidden="true" />
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0 max-w-4xl">
        {isUser ? (
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-900 leading-relaxed whitespace-pre-wrap break-words">
              {content}
            </p>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none prose-gray">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="text-gray-900 leading-relaxed mb-3 last:mb-0">
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-gray-800">{children}</em>
                ),
                ul: ({ children }) => (
                  <ul className="my-3 ml-6 list-disc space-y-1.5 text-gray-900">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-3 ml-6 list-decimal space-y-1.5 text-gray-900">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed">{children}</li>
                ),
                code: ({ children }) => (
                  <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-200">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 my-3 overflow-x-auto">
                    {children}
                  </pre>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline transition-colors"
                  >
                    {children}
                  </a>
                ),
                h1: ({ children }) => (
                  <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-semibold text-gray-900 mt-3 mb-2 first:mt-0">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold text-gray-900 mt-3 mb-1.5 first:mt-0">
                    {children}
                  </h3>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-400 pl-4 italic text-gray-700 my-3 bg-blue-50/50 py-2 rounded-r">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-4 border-gray-300" />,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
