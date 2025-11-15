import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

/**
 * Creates a lightweight conversation AND project together
 * Used for the transition page flow where both are needed before navigation
 * 
 * @param userId - User ID
 * @param address - Address string from address suggestion
 * @param coordinates - GPS coordinates { lon, lat }
 * @param inseeCode - INSEE code (optional)
 * @param city - City name (optional)
 * @returns Promise with conversationId and projectId
 */
export async function createLightweightConversationWithProject(
  userId: string,
  address: string,
  coordinates: { lon: number; lat: number },
  inseeCode?: string,
  city?: string
): Promise<{ conversationId: string; projectId: string }> {

  // Step 1: Create project first
  const { data: project, error: projectError } = await supabase
    .from('v2_projects')
    .insert({
      user_id: userId,
      status: 'draft',
      main_address: address,
      geo_lon: coordinates.lon,
      geo_lat: coordinates.lat,
    })
    .select('id')
    .single();

  if (projectError || !project) {
    console.error('[LIGHTWEIGHT_CONV_WITH_PROJECT] Error creating project:', projectError);
    throw new Error(`Failed to create project: ${projectError?.message || 'Unknown error'}`);
  }


  // Step 2: Create conversation linked to project
  const defaultTitle = city && address ? `${city}_${address.split(',')[0]}` : address;

  const { data: conversation, error: conversationError } = await supabase
    .from('v2_conversations')
    .insert({
      user_id: userId,
      project_id: project.id,
      conversation_type: 'address_analysis',
      title: defaultTitle,
      context_metadata: {
        initial_address: address,
        geocoded: {
          lon: coordinates.lon,
          lat: coordinates.lat,
        },
        city: city || null,
        insee_code: inseeCode || null,
        enrichment: {
          branch_type: 'pending',
          has_analysis: false,
          is_rnu: false,
        },
      },
      enrichment_status: 'pending',
      branch_type: 'pending',
      has_analysis: false,
      is_rnu: false,
      primary_document_id: null,
      document_metadata: null,
      is_active: true,
    })
    .select('id')
    .single();

  if (conversationError || !conversation) {
    console.error('[LIGHTWEIGHT_CONV_WITH_PROJECT] Error creating conversation:', conversationError);
    // Try to clean up project if conversation creation fails
    await supabase.from('v2_projects').delete().eq('id', project.id);
    throw new Error(`Failed to create conversation: ${conversationError?.message || 'Unknown error'}`);
  }

  // Step 3: Create initial address message
  const { error: messageError } = await supabase
    .from('v2_messages')
    .insert({
      conversation_id: conversation.id,
      user_id: userId,
      role: 'user',
      message: address,
      message_type: 'address_search',
      conversation_turn: 1,
      created_at: new Date().toISOString(),
    });

  if (messageError) {
    console.error('[LIGHTWEIGHT_CONV_WITH_PROJECT] Error creating initial message:', messageError);
    // Don't fail the whole operation, but log the error
    // The message can be created later if needed
  }

  return { conversationId: conversation.id, projectId: project.id };
}

interface CreateResearchHistoryParams {
  userId: string;
  conversationId: string;
  addressInput: string;
  coordinates: { lon: number; lat: number };
  projectId?: string | null;
}

export async function createInitialResearchHistoryEntry({
  userId,
  conversationId,
  addressInput,
  coordinates,
  projectId = null,
}: CreateResearchHistoryParams): Promise<void> {
  try {
    const { data: existingEntry, error: lookupError } = await supabase
      .from('v2_research_history')
      .select('id')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (lookupError) {
      console.warn('[RESEARCH_HISTORY] Lookup error (ignored):', lookupError);
    }

    if (existingEntry) {
      return;
    }

    const { error: insertError } = await supabase.from('v2_research_history').insert({
      user_id: userId,
      conversation_id: conversationId,
      project_id: projectId,
      address_input: addressInput,
      geo_lon: coordinates.lon,
      geo_lat: coordinates.lat,
      branch_type: 'pending',
      has_analysis: false,
      is_rnu: false,
      primary_document_id: null,
      document_metadata: null,
      success: true,
    });

    if (insertError) {
      console.error('[RESEARCH_HISTORY] Failed to insert entry:', insertError);
    }
  } catch (error) {
    console.error('[RESEARCH_HISTORY] Unexpected error creating entry:', error);
  }
}

interface PrefetchConversationOptions {
  queryClient: QueryClient;
  conversationId: string;
  userId: string;
}

export async function prefetchConversationForRedirect({
  queryClient,
  conversationId,
  userId,
}: PrefetchConversationOptions): Promise<void> {
  if (!queryClient || !conversationId || !userId) {
    return;
  }

  const fetchConversation = async () => {
    const { data, error } = await supabase
      .from('v2_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Conversation not found for redirect prefetch');
    }

    return data;
  };

  const conversation = await queryClient.fetchQuery({
    queryKey: ['conversation', conversationId],
    queryFn: fetchConversation,
  });

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['messages', conversationId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('v2_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) {
          throw error;
        }

        return data || [];
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ['research-history', conversationId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('v2_research_history')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return data || null;
      },
    }),
  ]);

  if (conversation?.project_id) {
    await queryClient.prefetchQuery({
      queryKey: ['project', conversation.project_id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('v2_projects')
          .select('*')
          .eq('id', conversation.project_id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data;
      },
    });
  }
}

