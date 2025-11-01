'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AddressAutocomplete } from './AddressAutocomplete';
import { ChatMessage } from './ChatMessage';
import { useChatStore } from '@/lib/store';
import {
  generateConversationId,
  generateInitialAnalysis,
  generateMockResponse,
} from '@/lib/mock-data';
import { cn } from '@/lib/utils';

export function ChatArea() {
  const {
    getCurrentConversation,
    addConversation,
    addMessage,
    setRightPanelOpen,
    isLoading,
    setLoading,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [isInitialState, setIsInitialState] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentConversation = getCurrentConversation();

  useEffect(() => {
    setIsInitialState(!currentConversation);
  }, [currentConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, [currentConversation?.messages]);

  const handleAddressSelect = async (address: any) => {
    setLoading(true);

    setTimeout(() => {
      const conversationId = generateConversationId();
      const userMessage = {
        id: `msg-${Date.now()}`,
        role: 'user' as const,
        content: address.label,
        timestamp: new Date(),
      };

      const assistantMessage = generateInitialAnalysis(address.label);

      const newConversation = {
        id: conversationId,
        address: address.label,
        zoneLabel: 'Uc - Zone urbaine centre',
        city: address.city,
        pluDate: '2023-06-15',
        highlights: [
          'Zone constructible pour l\'habitat',
          'Hauteur maximale: 12 mètres',
          'Coefficient d\'emprise au sol: 60%',
        ],
        messages: [userMessage, assistantMessage],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addConversation(newConversation);
      setRightPanelOpen(true);
      setLoading(false);
      setIsInitialState(false);
    }, 1500);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !currentConversation || isLoading) return;

    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      content: input.trim(),
      timestamp: new Date(),
    };

    addMessage(currentConversation.id, userMessage);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      const assistantMessage = generateMockResponse(input);
      addMessage(currentConversation.id, assistantMessage);
      setLoading(false);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestedQuestionClick = (question: string) => {
    setInput(question);
    textareaRef.current?.focus();
  };

  if (isInitialState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-32" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="max-w-2xl w-full space-y-32 text-center">
          <div className="space-y-16">
            <h1 className="text-5xl font-bold" style={{ color: '#000000' }}>MWPLU</h1>
            <h2 className="text-2xl font-semibold" style={{ color: '#000000' }}>
              Analysez votre PLU en quelques secondes
            </h2>
            <p className="text-lg" style={{ color: '#666666' }}>
              Entrez l'adresse de votre projet pour commencer
            </p>
          </div>

          <div className="max-w-xl mx-auto">
            <AddressAutocomplete
              onSelect={handleAddressSelect}
              placeholder="12 rue de la République, Rennes..."
            />
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-12" style={{ color: '#666666' }}>
              <Loader2 className="h-20 w-20 animate-spin" />
              <span>Chargement de votre PLU...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
      {currentConversation && (
        <div className="px-24 py-12" style={{ borderBottom: '1px solid #E5E5E5', backgroundColor: '#FFFFFF' }}>
          <div className="flex items-center gap-8 text-sm">
            <span className="font-medium" style={{ color: '#000000' }}>📍</span>
            <span style={{ color: '#666666' }}>{currentConversation.zoneLabel}</span>
            <span style={{ color: '#999999' }}>•</span>
            <span style={{ color: '#666666' }}>🏠 PLU de {currentConversation.city}</span>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div style={{ borderTop: '1px solid #E5E5E5' }}>
          {currentConversation?.messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onCitationClick={(article, page) => {
                setRightPanelOpen(true);
                console.log('Scroll to:', article, page);
              }}
              onSuggestedQuestionClick={handleSuggestedQuestionClick}
            />
          ))}

          {isLoading && (
            <div className="py-24 px-24" style={{ backgroundColor: '#F5F5F5' }}>
              <div className="max-w-4xl mx-auto flex gap-16">
                <div className="flex-shrink-0 h-32 w-32 rounded-lg flex items-center justify-center text-sm font-medium"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5', color: '#000000' }}
                >
                  M
                </div>
                <div className="flex items-center gap-8" style={{ color: '#666666' }}>
                  <Loader2 className="h-16 w-16 animate-spin" />
                  <span className="text-sm italic">L'assistant réfléchit...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-16" style={{ borderTop: '1px solid #E5E5E5', backgroundColor: '#FFFFFF' }}>
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              className="min-h-[60px] max-h-[200px] pr-48 resize-none rounded-lg transition-all duration-150"
              style={{ border: '1px solid #E5E5E5', color: '#000000' }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#000000'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#E5E5E5'}
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="absolute right-8 bottom-8 rounded-full h-40 w-40 transition-all duration-150 disabled:opacity-50"
              style={{ backgroundColor: '#000000', color: '#FFFFFF' }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#1a1a1a';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = '#000000';
                }
              }}
            >
              <Send className="h-16 w-16" />
            </Button>
          </div>
          {input.length > 0 && (
            <div className="text-xs mt-8 text-right" style={{ color: '#999999' }}>
              {input.length} caractères
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
