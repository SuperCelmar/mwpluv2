import { http, HttpResponse } from 'msw';

// Mock user data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
};

// Mock v1 data storage (legacy, kept for backward compatibility)
let mockConversations: any[] = [];
let mockMessages: any[] = [];
let mockResearchHistory: any[] = [];
let conversationIdCounter = 1;
let messageIdCounter = 1;

// Mock v2 data storage
let mockV2Projects: any[] = [];
let mockV2Conversations: any[] = [];
let mockV2Messages: any[] = [];
let mockV2ConversationDocuments: any[] = [];
let mockV2ResearchHistory: any[] = [];
let mockDocuments: any[] = [];
let projectIdCounter = 1;
let v2ConversationIdCounter = 1;
let v2MessageIdCounter = 1;
let researchIdCounter = 1;

const mockProfiles = [
  {
    id: 'test-user-id',
    avatar_url: null,
    full_name: 'Test User',
    pseudo: 'TestUser',
  },
];

// Reset mock data
export const resetMockData = () => {
  // v1 data
  mockConversations = [];
  mockMessages = [];
  mockResearchHistory = [];
  conversationIdCounter = 1;
  messageIdCounter = 1;

  // v2 data
  mockV2Projects = [];
  mockV2Conversations = [];
  mockV2Messages = [];
  mockV2ConversationDocuments = [];
  mockV2ResearchHistory = [];
  mockDocuments = [];
  projectIdCounter = 1;
  v2ConversationIdCounter = 1;
  v2MessageIdCounter = 1;
  researchIdCounter = 1;
};


// Helper function to parse PostgREST filter format (e.g., "id=eq.value")
const parsePostgRESTFilter = (paramValue: string | null): string | null => {
  if (!paramValue) return null;
  // Handle PostgREST format: "eq.value" -> "value"
  if (paramValue.startsWith('eq.')) {
    return paramValue.substring(3);
  }
  // Handle direct value
  return paramValue;
};

export const handlers = [
  // Note: Supabase Auth is mocked at module level in setup.ts
  // since getUser() doesn't make HTTP requests

  // Note: MSW should automatically intercept fetch in Node.js
  // If requests aren't being intercepted, check:
  // 1. MSW server is started before any fetch calls
  // 2. URL patterns match actual requests
  // 3. No fetch polyfill conflicts

  // Supabase REST: Create conversation
  http.post('*/rest/v1/chat_conversations', async ({ request }) => {
    const body = await request.json() as any;
    const newConversation = {
      ...body,
      id: `conversation-${conversationIdCounter++}`,
      is_active: body.is_active !== undefined ? body.is_active : true,
      last_message_at: null,
      created_at: new Date().toISOString(),
    };
    mockConversations.push(newConversation);
    return HttpResponse.json([newConversation]);
  }),

  // Supabase REST: Get conversations
  http.get('*/rest/v1/chat_conversations', ({ request }) => {
    const url = new URL(request.url);
    // Handle both PostgREST format (?id=eq.value) and simple format (?id=value)
    const idParam = url.searchParams.get('id');
    const userIdParam = url.searchParams.get('user_id');
    const id = parsePostgRESTFilter(idParam);
    const userId = parsePostgRESTFilter(userIdParam);

    let filtered = mockConversations;

    if (id) {
      filtered = mockConversations.filter((c) => c.id === id);
    } else if (userId) {
      filtered = mockConversations.filter((c) => c.user_id === userId);
    }

    return HttpResponse.json(filtered);
  }),



  // Supabase REST: Update conversation
  http.patch('*/rest/v1/chat_conversations', async ({ request }) => {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const id = parsePostgRESTFilter(idParam);
    const body = await request.json() as any;

    if (id) {
      const index = mockConversations.findIndex((c) => c.id === id);
      if (index !== -1) {
        mockConversations[index] = {
          ...mockConversations[index],
          ...body,
        };
      }
    }

    return HttpResponse.json([]);
  }),


  // Supabase REST: Delete conversation
  http.delete('*/rest/v1/chat_conversations', async ({ request }) => {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const id = parsePostgRESTFilter(idParam);

    if (id) {
      const index = mockConversations.findIndex((c) => c.id === id);
      if (index !== -1) {
        mockConversations.splice(index, 1);
        // Also delete associated messages
        mockMessages = mockMessages.filter((m) => m.conversation_id !== id);
      }
    }

    return HttpResponse.json([]);
  }),

  // Supabase REST: Create messages
  http.post('*/rest/v1/chat_messages', async ({ request }) => {
    const body = await request.json();
    const messages = Array.isArray(body) ? body : [body];

    const newMessages = messages.map((msg: any) => ({
      ...msg,
      id: `message-${messageIdCounter++}`,
      message: msg.message,
      conversation_id: msg.conversation_id,
      created_at: new Date().toISOString(),
    }));

    mockMessages.push(...newMessages);
    return HttpResponse.json(newMessages);
  }),

  // Supabase REST: Get messages
  http.get('*/rest/v1/chat_messages', ({ request }) => {
    const url = new URL(request.url);
    const conversationIdParam = url.searchParams.get('conversation_id');
    const conversationId = parsePostgRESTFilter(conversationIdParam);

    let filtered = mockMessages;
    if (conversationId) {
      filtered = mockMessages.filter((m) => m.conversation_id === conversationId);
    }

    // Sort by created_at ascending
    filtered.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return HttpResponse.json(filtered);
  }),


  // Supabase REST: Create research_history entry
  http.post('*/rest/v1/research_history', async ({ request }) => {
    const body = await request.json() as any;
    const newEntry = {
      ...body,
      id: `research-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      created_at: new Date().toISOString(),
    };
    mockResearchHistory.push(newEntry);
    return HttpResponse.json([newEntry]);
  }),

  // Supabase REST: Get research_history entries
  http.get('*/rest/v1/research_history', ({ request }) => {
    const url = new URL(request.url);
    const userIdParam = url.searchParams.get('user_id');
    const userId = parsePostgRESTFilter(userIdParam);

    let filtered = mockResearchHistory;
    if (userId) {
      filtered = mockResearchHistory.filter((r) => r.user_id === userId);
    }

    // Sort by created_at descending (most recent first)
    filtered.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    return HttpResponse.json(filtered);
  }),

  // French Address API
  http.get('https://api-adresse.data.gouv.fr/search/', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    // Mock address suggestions
    const mockAddresses = [
      {
        properties: {
          label: '15 Rue des Fustiers, 75001 Paris',
          name: '15 Rue des Fustiers',
          city: 'Paris',
          postcode: '75001',
          context: '75, Paris, Île-de-France',
          x: 2.3397,
          y: 48.8606,
          citycode: '75056',
        },
        geometry: {
          type: 'Point',
          coordinates: [2.3397, 48.8606],
        },
      },
      {
        properties: {
          label: '20 Rue de Rivoli, 75004 Paris',
          name: '20 Rue de Rivoli',
          city: 'Paris',
          postcode: '75004',
          context: '75, Paris, Île-de-France',
          x: 2.3587,
          y: 48.8583,
          citycode: '75056',
        },
        geometry: {
          type: 'Point',
          coordinates: [2.3587, 48.8583],
        },
      },
    ];

    return HttpResponse.json({
      features: query ? mockAddresses : [],
    });
  }),

  // N8N Webhook
  http.post('https://n8n.automationdfy.com/webhook/api/chat', async ({ request }) => {
    const body = await request.json() as any;

    // Mock AI response
    const response = `Merci pour votre question concernant "${body.address || 'votre adresse'}".
    
En analysant le PLU de cette zone, je peux vous fournir des informations détaillées sur les règlements d'urbanisme applicables à votre projet.

Votre demande porte-t-elle sur une construction neuve, une extension, ou une rénovation ?`;

    return HttpResponse.json({
      message: response,
    });
  }),

  // ============================================================================
  // V2 SCHEMA HANDLERS
  // ============================================================================

  // v2_projects handlers
  http.post('*/rest/v1/v2_projects', async ({ request }) => {
    const body = await request.json() as any;
    const newProject = {
      ...body,
      id: `project-${projectIdCounter++}`,
      status: body.status || 'draft',
      color: body.color || '#6B7280',
      icon: body.icon || '📁',
      starred: body.starred || false,
      plu_alert_enabled: body.plu_alert_enabled || false,
      plu_check_frequency: body.plu_check_frequency || 'monthly',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockV2Projects.push(newProject);
    return HttpResponse.json(newProject);
  }),

  http.get('*/rest/v1/v2_projects', ({ request }) => {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const userIdParam = url.searchParams.get('user_id');
    const id = parsePostgRESTFilter(idParam);
    const userId = parsePostgRESTFilter(userIdParam);

    let filtered = mockV2Projects;
    if (id) {
      filtered = mockV2Projects.filter((p) => p.id === id);
    } else if (userId) {
      filtered = mockV2Projects.filter((p) => p.user_id === userId);
    }

    return HttpResponse.json(filtered);
  }),

  // v2_conversations handlers
  http.post('*/rest/v1/v2_conversations', async ({ request }) => {
    const body = await request.json() as any;
    const newConversation = {
      ...body,
      branch_type: body.branch_type || 'pending',
      has_analysis: body.has_analysis ?? false,
      is_rnu: body.is_rnu ?? false,
      primary_document_id: body.primary_document_id || null,
      document_metadata: body.document_metadata || null,
      id: `conversation-${v2ConversationIdCounter++}`,
      is_active: body.is_active !== undefined ? body.is_active : true,
      message_count: body.message_count || 0,
      document_count: body.document_count || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockV2Conversations.push(newConversation);
    return HttpResponse.json(newConversation);
  }),
  http.post('*/rest/v1/rpc/check_duplicate_by_coordinates', async () => {
    return HttpResponse.json([]);
  }),

  http.get('*/rest/v1/v2_conversations', ({ request }) => {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const userIdParam = url.searchParams.get('user_id');
    const projectIdParam = url.searchParams.get('project_id');
    const id = parsePostgRESTFilter(idParam);
    const userId = parsePostgRESTFilter(userIdParam);
    const projectId = parsePostgRESTFilter(projectIdParam);

    let filtered = mockV2Conversations;
    if (id) {
      filtered = mockV2Conversations.filter((c) => c.id === id);
    } else if (userId) {
      filtered = mockV2Conversations.filter((c) => c.user_id === userId);
    } else if (projectId) {
      filtered = mockV2Conversations.filter((c) => c.project_id === projectId);
    }

    return HttpResponse.json(filtered);
  }),

  http.patch('*/rest/v1/v2_conversations', async ({ request }) => {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const id = parsePostgRESTFilter(idParam);
    const body = await request.json() as any;

    if (id) {
      const index = mockV2Conversations.findIndex((c) => c.id === id);
      if (index !== -1) {
        mockV2Conversations[index] = {
          ...mockV2Conversations[index],
          ...body,
        };
      }
    }

    return HttpResponse.json([]);
  }),

  // v2_messages handlers
  http.post('*/rest/v1/v2_messages', async ({ request }) => {
    const body = await request.json();
    const messages = Array.isArray(body) ? body : [body];

    const newMessages = messages.map((msg: any) => ({
      ...msg,
      id: `message-${v2MessageIdCounter++}`,
      message: msg.message,
      conversation_id: msg.conversation_id,
      role: msg.role,
      created_at: new Date().toISOString(),
    }));

    mockV2Messages.push(...newMessages);
    return HttpResponse.json(newMessages);
  }),

  http.get('*/rest/v1/v2_messages', ({ request }) => {
    const url = new URL(request.url);
    const conversationIdParam = url.searchParams.get('conversation_id');
    const conversationId = parsePostgRESTFilter(conversationIdParam);

    let filtered = mockV2Messages;
    if (conversationId) {
      filtered = mockV2Messages.filter((m) => m.conversation_id === conversationId);
    }

    filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return HttpResponse.json(filtered);
  }),

  http.get('*/rest/v1/documents', ({ request }) => {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const id = parsePostgRESTFilter(idParam);

    if (id) {
      const existing = mockDocuments.find((doc) => doc.id === id);
      if (existing) {
        return HttpResponse.json([existing]);
      }

      return HttpResponse.json([
        {
          id,
          html_content: '<p>Document mock content</p>',
          source_plu_url: 'https://example.com/mock-document.pdf',
          typology_id: null,
        },
      ]);
    }

    return HttpResponse.json(mockDocuments);
  }),

  http.get('*/rest/v1/profiles', ({ request }) => {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const id = parsePostgRESTFilter(idParam);

    if (id) {
      const profile = mockProfiles.find((p) => p.id === id);
      if (profile) {
        return HttpResponse.json([profile]);
      }
    }

    return HttpResponse.json([]);
  }),

  // v2_conversation_documents handlers
  http.post('*/rest/v1/v2_conversation_documents', async ({ request }) => {
    const body = await request.json();
    const documents = Array.isArray(body) ? body : [body];

    const newDocs = documents.map((doc: any) => ({
      ...doc,
      id: `conv-doc-${Date.now()}-${Math.random()}`,
      added_at: doc.added_at || new Date().toISOString(),
      usage_count: doc.usage_count || 0,
    }));

    mockV2ConversationDocuments.push(...newDocs);
    return HttpResponse.json(newDocs);
  }),

  http.get('*/rest/v1/v2_conversation_documents', ({ request }) => {
    const url = new URL(request.url);
    const conversationIdParam = url.searchParams.get('conversation_id');
    const conversationId = parsePostgRESTFilter(conversationIdParam);

    let filtered = mockV2ConversationDocuments;
    if (conversationId) {
      filtered = mockV2ConversationDocuments.filter((d) => d.conversation_id === conversationId);
    }

    return HttpResponse.json(filtered);
  }),

  // v2_research_history handlers
  http.post('*/rest/v1/v2_research_history', async ({ request }) => {
    const body = await request.json() as any;
    const newEntry = {
      ...body,
      branch_type: body.branch_type || 'pending',
      has_analysis: body.has_analysis ?? false,
      is_rnu: body.is_rnu ?? false,
      primary_document_id: body.primary_document_id || null,
      document_metadata: body.document_metadata || null,
      id: `research-${researchIdCounter++}`,
      created_at: new Date().toISOString(),
    };
    mockV2ResearchHistory.push(newEntry);
    return HttpResponse.json([newEntry]);
  }),

  http.get('*/rest/v1/v2_research_history', ({ request }) => {
    const url = new URL(request.url);
    const conversationIdParam = url.searchParams.get('conversation_id');
    const userIdParam = url.searchParams.get('user_id');
    const conversationId = parsePostgRESTFilter(conversationIdParam);
    const userId = parsePostgRESTFilter(userIdParam);

    let filtered = mockV2ResearchHistory;
    if (conversationId) {
      filtered = mockV2ResearchHistory.filter((r) => r.conversation_id === conversationId);
    } else if (userId) {
      filtered = mockV2ResearchHistory.filter((r) => r.user_id === userId);
    }

    filtered.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    return HttpResponse.json(filtered);
  }),

  http.patch('*/rest/v1/v2_research_history', async ({ request }) => {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const id = parsePostgRESTFilter(idParam);
    const body = await request.json() as any;

    if (id) {
      const index = mockV2ResearchHistory.findIndex((r) => r.id === id);
      if (index !== -1) {
        mockV2ResearchHistory[index] = {
          ...mockV2ResearchHistory[index],
          ...body,
        };
      }
    }

    return HttpResponse.json([]);
  }),

  // ============================================================================
  // NOTE: Carto API handlers removed - tests will use real API calls
  // ============================================================================
];

