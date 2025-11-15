import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';

const fromMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromMock,
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import {
  createLightweightConversation,
  createInitialResearchHistoryEntry,
} from '@/lib/supabase/queries';

describe('supabase queries metadata persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores branch metadata when creating lightweight conversations', async () => {
    const singleResponse: PostgrestSingleResponse<{ id: string }> = {
      data: { id: 'conversation-123' },
      error: null,
      status: 201,
      statusText: 'Created',
    };

    const singleMock = vi.fn().mockResolvedValue(singleResponse);
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });

    fromMock.mockImplementationOnce(() => ({
      insert: insertMock,
    }));

    await createLightweightConversation(
      'user-1',
      '12 Rue des Fustiers, Paris',
      { lon: 2.3397, lat: 48.8606 },
      '75056',
      'Paris'
    );

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_type: 'pending',
        has_analysis: false,
        is_rnu: false,
        primary_document_id: null,
        document_metadata: null,
      })
    );
  });

  it('captures metadata flags in initial research history entries', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: null,
      status: 200,
      statusText: 'OK',
    });

    const eqMock = vi.fn().mockReturnValue({
      maybeSingle: maybeSingleMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock,
    });

    const insertMock = vi.fn().mockResolvedValue({
      data: null,
      error: null,
      status: 201,
      statusText: 'Created',
    });

    fromMock
      .mockImplementationOnce(() => ({
        select: selectMock,
      }))
      .mockImplementationOnce(() => ({
        insert: insertMock,
      }));

    await createInitialResearchHistoryEntry({
      userId: 'user-1',
      conversationId: 'conversation-123',
      addressInput: '12 Rue des Fustiers, Paris',
      coordinates: { lon: 2.3397, lat: 48.8606 },
      projectId: null,
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_type: 'pending',
        has_analysis: false,
        is_rnu: false,
        primary_document_id: null,
        document_metadata: null,
      })
    );
  });
});

