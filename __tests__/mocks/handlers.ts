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

// Mock project data storage
let mockProjects: any[] = [];
let mockMessages: any[] = [];
let projectIdCounter = 1;
let messageIdCounter = 1;

// Reset mock data
export const resetMockData = () => {
  mockProjects = [];
  mockMessages = [];
  projectIdCounter = 1;
  messageIdCounter = 1;
};

export const getMockProjects = () => mockProjects;
export const getMockMessages = () => mockMessages;

export const handlers = [
  // Supabase Auth: Get current user
  http.get('*/auth/v1/user', async () => {
    return HttpResponse.json({
      data: {
        user: {
          id: mockUser.id,
          email: mockUser.email,
          app_metadata: mockUser.app_metadata,
          user_metadata: mockUser.user_metadata,
          aud: mockUser.aud,
          created_at: mockUser.created_at,
        },
      },
    });
  }),

  // Supabase REST: Create project
  http.post('*/rest/v1/projects', async ({ request }) => {
    const body = await request.json() as any;
    const newProject = {
      ...body,
      id: `project-${projectIdCounter++}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockProjects.push(newProject);
    return HttpResponse.json([newProject]);
  }),

  // Supabase REST: Get projects
  http.get('*/rest/v1/projects', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const userId = url.searchParams.get('user_id');

    let filteredProjects = mockProjects;

    if (id) {
      filteredProjects = mockProjects.filter((p) => p.id === id);
    } else if (userId) {
      filteredProjects = mockProjects.filter((p) => p.user_id === userId);
    }

    return HttpResponse.json(filteredProjects);
  }),

  // Supabase REST: Update project
  http.patch('*/rest/v1/projects', async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const body = await request.json() as any;

    const projectIndex = mockProjects.findIndex((p) => p.id === id);
    if (projectIndex !== -1) {
      mockProjects[projectIndex] = {
        ...mockProjects[projectIndex],
        ...body,
        updated_at: new Date().toISOString(),
      };
    }

    return HttpResponse.json([]);
  }),

  // Supabase REST: Create messages
  http.post('*/rest/v1/messages', async ({ request }) => {
    const body = await request.json();
    const messages = Array.isArray(body) ? body : [body];

    const newMessages = messages.map((msg: any) => ({
      ...msg,
      id: `message-${messageIdCounter++}`,
      created_at: new Date().toISOString(),
    }));

    mockMessages.push(...newMessages);
    return HttpResponse.json(newMessages);
  }),

  // Supabase REST: Get messages
  http.get('*/rest/v1/messages', ({ request }) => {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('project_id');

    let filteredMessages = mockMessages;
    if (projectId) {
      filteredMessages = mockMessages.filter((m) => m.project_id === projectId);
    }

    // Sort by created_at ascending
    filteredMessages.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return HttpResponse.json(filteredMessages);
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
];

