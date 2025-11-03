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

