import { supabase } from './supabase';

export interface ChatEventParams {
  conversation_id: string;
  message_id: string;
  user_id: string;
  document_id?: string | null;
  model_name?: string;
  model_version?: string;
  model_provider?: string;
  tokens_prompt?: number;
  tokens_completion?: number;
  tokens_cached?: number;
  tokens_total?: number;
  cost_prompt?: number;
  cost_completion?: number;
  cost_cached?: number;
  cost_total?: number;
  response_time_ms?: number;
  cache_hit?: boolean;
  user_query_length?: number;
  ai_response_length?: number;
  query_intent?: string;
  sections_referenced?: string[];
  error_occurred?: boolean;
  error_message?: string;
  error_code?: string;
  metadata?: Record<string, any>;
}

/**
 * Logs a chat event to analytics.chat_events table
 * This function handles v2 message analytics and tags them with source: 'v2'
 */
export async function logChatEvent(params: ChatEventParams): Promise<void> {
  try {
    const {
      conversation_id,
      message_id,
      user_id,
      document_id,
      model_name,
      model_version,
      model_provider,
      tokens_prompt,
      tokens_completion,
      tokens_cached,
      tokens_total,
      cost_prompt,
      cost_completion,
      cost_cached,
      cost_total,
      response_time_ms,
      cache_hit,
      user_query_length,
      ai_response_length,
      query_intent,
      sections_referenced,
      error_occurred,
      error_message,
      error_code,
      metadata,
    } = params;

    // Build metadata with v2 source tag
    const eventMetadata = {
      source: 'v2',
      ...metadata,
    };

    // Try analytics.chat_events first, fallback to chat_events if schema not exposed
    const { error } = await supabase
      .schema('analytics')
      .from('chat_events')
      .insert({
        conversation_id,
        message_id,
        user_id,
        document_id: document_id || null,
        model_name: model_name || null,
        model_version: model_version || null,
        model_provider: model_provider || null,
        tokens_prompt: tokens_prompt || null,
        tokens_completion: tokens_completion || null,
        tokens_cached: tokens_cached || null,
        tokens_total: tokens_total || null,
        cost_prompt: cost_prompt || null,
        cost_completion: cost_completion || null,
        cost_cached: cost_cached || null,
        cost_total: cost_total || null,
        response_time_ms: response_time_ms || null,
        cache_hit: cache_hit || false,
        user_query_length: user_query_length || null,
        ai_response_length: ai_response_length || null,
        query_intent: query_intent || null,
        sections_referenced: sections_referenced || null,
        error_occurred: error_occurred || false,
        error_message: error_message || null,
        error_code: error_code || null,
        metadata: eventMetadata,
      });

    if (error) {
      // Log error but don't throw - analytics failures shouldn't break the app
      console.error('Failed to log chat event to analytics:', error);
    }
  } catch (error) {
    // Catch any unexpected errors and log them
    console.error('Unexpected error logging chat event:', error);
  }
}

/**
 * Helper to extract document_id from referenced_documents array
 */
export function getFirstDocumentId(referencedDocuments: string[] | null | undefined): string | null {
  if (!referencedDocuments || referencedDocuments.length === 0) {
    return null;
  }
  return referencedDocuments[0];
}







