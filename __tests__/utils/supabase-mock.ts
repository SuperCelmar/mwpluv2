/**
 * Supabase Mock for Integration Tests
 * 
 * For integration tests, we mock Supabase at the client level
 * to test the actual integration flow without over-mocking.
 * 
 * This allows us to:
 * - Fix inputs (test data)
 * - Verify outputs (responses, navigation, state changes)
 * - Test actual component integration
 * - Verify data transformation through the system
 */

import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// In-memory data stores for integration testing
const mockConversations: any[] = [];
const mockMessages: any[] = [];
let conversationIdCounter = 1;
let messageIdCounter = 1;

export function resetSupabaseMock() {
  mockConversations.length = 0;
  mockMessages.length = 0;
  conversationIdCounter = 1;
  messageIdCounter = 1;
}

export function getMockConversations() {
  // Legacy alias for backward compatibility
  return [...mockConversations];
}

export function getMockConversations() {
  return [...mockConversations];
}

export function getMockMessages() {
  return [...mockMessages];
}

/**
 * Creates a mock Supabase client for integration tests
 * Mocks the REST API methods while preserving integration behavior
 */
export function createMockSupabaseClient(): Partial<SupabaseClient> {
  return {
    from: vi.fn((table: string) => {
      // Support both old and new table names for backward compatibility during migration
      if (table === 'chat_conversations' || table === 'Conversations') {
        return {
          insert: vi.fn((data: any) => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => {
                const newConversation = {
                  ...(Array.isArray(data) ? data[0] : data),
                  id: `conversation-${conversationIdCounter++}`,
                  is_active: data.is_active !== undefined ? data.is_active : true,
                  last_message_at: null,
                  created_at: new Date().toISOString(),
                };
                mockConversations.push(newConversation);
                return {
                  data: newConversation,
                  error: null,
                };
              }),
              single: vi.fn(async () => {
                const newConversation = {
                  ...(Array.isArray(data) ? data[0] : data),
                  id: `conversation-${conversationIdCounter++}`,
                  is_active: data.is_active !== undefined ? data.is_active : true,
                  last_message_at: null,
                  created_at: new Date().toISOString(),
                };
                mockConversations.push(newConversation);
                return {
                  data: newConversation,
                  error: null,
                };
              }),
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn((key: string, value: string) => ({
              maybeSingle: vi.fn(async () => {
                const conversation = mockConversations.find((c: any) => c[key] === value) || null;
                return { data: conversation, error: null };
              }),
              single: vi.fn(async () => {
                const conversation = mockConversations.find((c: any) => c[key] === value);
                if (!conversation) {
                  return { data: null, error: { message: 'Not found' } };
                }
                return { data: conversation, error: null };
              }),
              order: vi.fn(() => ({
                asc: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: mockConversations,
                    error: null,
                  })),
                })),
              })),
            })),
            order: vi.fn(() => ({
              asc: vi.fn(async () => ({
                data: mockConversations,
                error: null,
              })),
            })),
          })),
          update: vi.fn((data: any) => ({
            eq: vi.fn(async (key: string, value: string) => {
              // Simple update mock - updates matching conversation
              const conversation = mockConversations.find((c: any) => c[key] === value);
              if (conversation) {
                Object.assign(conversation, data);
              }
              return { data: null, error: null };
            }),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(async (key: string, value: string) => {
              const index = mockConversations.findIndex((c: any) => c[key] === value);
              if (index !== -1) {
                mockConversations.splice(index, 1);
              }
              return { data: null, error: null };
            }),
          })),
        };
      }
      
      if (table === 'chat_messages' || table === 'messages') {
        return {
          insert: vi.fn((data: any) => {
            const messages = Array.isArray(data) ? data : [data];
            const newMessages = messages.map((msg: any) => ({
              ...msg,
              id: `message-${messageIdCounter++}`,
              message: msg.message || msg.content, // Support both field names
              content: msg.message || msg.content, // Legacy compatibility
              conversation_id: msg.conversation_id || msg.Conversation_id, // Support both
              created_at: new Date().toISOString(),
            }));
            mockMessages.push(...newMessages);
            return {
              data: newMessages,
              error: null,
            };
          }),
          select: vi.fn(() => ({
            eq: vi.fn((key: string, value: string) => ({
              order: vi.fn(() => ({
                asc: vi.fn(async () => {
                  const filtered = mockMessages.filter((m: any) => 
                    m[key] === value || m.conversation_id === value || m.Conversation_id === value
                  );
                  return {
                    data: filtered,
                    error: null,
                  };
                }),
              })),
            })),
          })),
        };
      }

      // Support research_history table
      if (table === 'research_history') {
        return {
          insert: vi.fn((data: any) => ({
            data: Array.isArray(data) ? data : [data],
            error: null,
          })),
        };
      }
      
      return {
        insert: vi.fn(() => ({ data: null, error: null })),
        select: vi.fn(() => ({ data: [], error: null })),
        update: vi.fn(() => ({ data: null, error: null })),
      };
    }),
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
    } as any,
  } as any;
}

