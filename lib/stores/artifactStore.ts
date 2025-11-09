import { create } from 'zustand';
import type { ZoneArtifactData, MapArtifactData, DocumentArtifactData } from '@/types/artifacts';

/**
 * Artifact state for a single artifact type
 */
export interface ArtifactState {
  status: 'loading' | 'ready' | 'error';
  data: ZoneArtifactData | MapArtifactData | DocumentArtifactData | null;
  error?: Error;
  timestamp: number;
}

/**
 * Artifact collection for a conversation
 */
export interface ConversationArtifacts {
  zone: ArtifactState | null;
  map: ArtifactState | null;
  document: ArtifactState | null;
}

/**
 * Conversation artifact state
 */
interface ConversationArtifactState {
  artifacts: ConversationArtifacts;
  activeTab: 'map' | 'document';
}

/**
 * Zustand store for managing artifact state across conversations
 */
interface ArtifactStore {
  // State: conversations keyed by conversationId
  conversations: Record<string, ConversationArtifactState>;

  // Actions
  /**
   * Initialize a conversation's artifact state
   */
  initializeConversation: (conversationId: string) => void;

  /**
   * Update an artifact for a specific conversation
   */
  updateArtifact: (
    conversationId: string,
    type: 'zone' | 'map' | 'document',
    updates: Partial<ArtifactState>
  ) => void;

  /**
   * Set the active tab for a conversation
   */
  setActiveTab: (conversationId: string, tab: 'map' | 'document') => void;

  /**
   * Reset all artifacts for a conversation
   */
  resetConversation: (conversationId: string) => void;

  /**
   * Get artifact state for a conversation
   */
  getConversationState: (conversationId: string) => ConversationArtifactState | undefined;
}

export const useArtifactStore = create<ArtifactStore>((set, get) => ({
  conversations: {},

  initializeConversation: (conversationId) => {
    set((state) => {
      // Only initialize if not already exists
      if (state.conversations[conversationId]) {
        return state;
      }

      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            artifacts: {
              zone: null,
              map: null,
              document: null,
            },
            activeTab: 'map',
          },
        },
      };
    });
  },

  updateArtifact: (conversationId, type, updates) => {
    set((state) => {
      const conversation = state.conversations[conversationId];
      
      // Initialize conversation if it doesn't exist
      if (!conversation) {
        return {
          conversations: {
            ...state.conversations,
            [conversationId]: {
              artifacts: {
                zone: null,
                map: null,
                document: null,
                [type]: {
                  status: 'loading',
                  data: null,
                  timestamp: Date.now(),
                  ...updates,
                },
              },
              activeTab: 'map',
            },
          },
        };
      }

      // Update existing artifact
      const currentArtifact = conversation.artifacts[type];
      
      // Check if update actually changes anything to prevent unnecessary re-renders
      const newStatus = updates.status ?? currentArtifact?.status ?? 'loading';
      const newData = updates.data ?? currentArtifact?.data ?? null;
      
      // Deep equality check for data (simple JSON.stringify for now)
      const dataChanged = currentArtifact?.data !== newData && 
        JSON.stringify(currentArtifact?.data) !== JSON.stringify(newData);
      
      const statusChanged = currentArtifact?.status !== newStatus;
      
      // If nothing changed, return the same state to prevent re-render
      if (!statusChanged && !dataChanged && currentArtifact) {
        return state;
      }
      
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conversation,
            artifacts: {
              ...conversation.artifacts,
              [type]: {
                // If artifact doesn't exist, create new state
                status: 'loading',
                data: null,
                timestamp: Date.now(),
                // Otherwise merge with existing
                ...(currentArtifact || {}),
                // Apply updates
                ...updates,
                // Ensure timestamp is updated
                timestamp: updates.timestamp ?? currentArtifact?.timestamp ?? Date.now(),
              },
            },
          },
        },
      };
    });
  },

  setActiveTab: (conversationId, tab) => {
    set((state) => {
      const conversation = state.conversations[conversationId];
      
      if (!conversation) {
        // Initialize conversation if it doesn't exist
        return {
          conversations: {
            ...state.conversations,
            [conversationId]: {
              artifacts: {
                zone: null,
                map: null,
                document: null,
              },
              activeTab: tab,
            },
          },
        };
      }

      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conversation,
            activeTab: tab,
          },
        },
      };
    });
  },

  resetConversation: (conversationId) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.conversations;
      return {
        conversations: rest,
      };
    });
  },

  getConversationState: (conversationId) => {
    return get().conversations[conversationId];
  },
}));
