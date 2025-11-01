import { create } from 'zustand';

export interface Citation {
  text: string;
  article: string;
  page: number;
  bbox?: [number, number, number, number];
}

export interface ChatImage {
  url: string;
  caption: string;
  page: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  images?: ChatImage[];
  timestamp: Date;
  suggestedQuestions?: string[];
}

export interface Conversation {
  id: string;
  address: string;
  zoneLabel: string;
  city: string;
  pluDate: string;
  highlights: string[];
  messages: ChatMessage[];
  pdfUrl?: string;
  lastUpdated: Date;
}

export interface Highlight {
  page: number;
  bbox: [number, number, number, number];
  color: string;
}

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  rightPanelOpen: boolean;
  rightPanelTab: 'document' | 'analysis' | 'map';
  highlights: Highlight[];
  pdfPage: number;
  pdfZoom: number;

  addConversation: (conversation: Conversation) => void;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  toggleRightPanel: () => void;
  setRightPanelTab: (tab: 'document' | 'analysis' | 'map') => void;
  addHighlight: (highlight: Highlight) => void;
  clearHighlights: () => void;
  setPdfPage: (page: number) => void;
  setPdfZoom: (zoom: number) => void;
  getActiveConversation: () => Conversation | undefined;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  rightPanelOpen: false,
  rightPanelTab: 'document',
  highlights: [],
  pdfPage: 1,
  pdfZoom: 100,

  addConversation: (conversation) => set((state) => ({
    conversations: [conversation, ...state.conversations],
    activeConversationId: conversation.id,
  })),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) => set((state) => ({
    conversations: state.conversations.map((conv) =>
      conv.id === conversationId
        ? { ...conv, messages: [...conv.messages, message], lastUpdated: new Date() }
        : conv
    ),
  })),

  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

  addHighlight: (highlight) => set((state) => ({
    highlights: [...state.highlights, highlight],
  })),

  clearHighlights: () => set({ highlights: [] }),

  setPdfPage: (page) => set({ pdfPage: page }),

  setPdfZoom: (zoom) => set({ pdfZoom: zoom }),

  getActiveConversation: () => {
    const state = get();
    return state.conversations.find((c) => c.id === state.activeConversationId);
  },
}));
