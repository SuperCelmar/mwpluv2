import { supabase } from '../supabase';

/**
 * Creates a lightweight conversation record for instant navigation
 * Stores only essential data (user_id, address, coordinates) in context_metadata
 * Does NOT create project, does NOT fetch API data, does NOT enrich geo data
 * 
 * @param userId - User ID
 * @param address - Address string from address suggestion
 * @param coordinates - GPS coordinates { lon, lat }
 * @returns Promise with conversationId
 */
export async function createLightweightConversation(
  userId: string,
  address: string,
  coordinates: { lon: number; lat: number },
  inseeCode?: string,
  city?: string
): Promise<{ conversationId: string }> {
  console.log('[LIGHTWEIGHT_CONV] Creating lightweight conversation:', { userId, address, coordinates });

  const defaultTitle = city && address ? `${city}_${address.split(',')[0]}` : address;

  // Create minimal conversation record
  const { data: conversation, error } = await supabase
    .from('v2_conversations')
    .insert({
      user_id: userId,
      project_id: null, // Will be created during enrichment
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
      },
      enrichment_status: 'pending',
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !conversation) {
    console.error('[LIGHTWEIGHT_CONV] Error creating conversation:', error);
    throw new Error(`Failed to create conversation: ${error?.message || 'Unknown error'}`);
  }

  console.log('[LIGHTWEIGHT_CONV] Conversation created successfully, id:', conversation.id);
  return { conversationId: conversation.id };
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
  console.log('[RESEARCH_HISTORY] Creating initial research history entry:', {
    userId,
    conversationId,
    projectId,
    addressInput,
  });

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
      console.log('[RESEARCH_HISTORY] Entry already exists, skipping creation');
      return;
    }

    const { error: insertError } = await supabase.from('v2_research_history').insert({
      user_id: userId,
      conversation_id: conversationId,
      project_id: projectId,
      address_input: addressInput,
      geo_lon: coordinates.lon,
      geo_lat: coordinates.lat,
      success: true,
    });

    if (insertError) {
      console.error('[RESEARCH_HISTORY] Failed to insert entry:', insertError);
    } else {
      console.log('[RESEARCH_HISTORY] Initial entry created successfully');
    }
  } catch (error) {
    console.error('[RESEARCH_HISTORY] Unexpected error creating entry:', error);
  }
}

