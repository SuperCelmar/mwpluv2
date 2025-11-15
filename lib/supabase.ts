import { createClient } from '@supabase/supabase-js';
import type { ConversationBranch } from '@/types/enrichment';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (...args) => fetch(...(args as Parameters<typeof fetch>)),
  },
});

// User & Profile Types
export type Profile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  pseudo: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  deletion_requested_at: string | null;
  deletion_scheduled_for: string | null;
  deletion_reason: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};


export type LoginHistory = {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  location: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
};

// Geographic & PLU Types
export type City = {
  id: string;
  name: string;
  insee_code: string | null;
  created_at: string;
  updated_at: string;
};

export type Zoning = {
  id: string;
  city_id: string;
  name: string;
  code: string | null;  // Short code from Carto API typezone (U, AU, N, A, etc.)
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Zone = {
  id: string;
  zoning_id: string;
  name: string;
  description: string | null;
  zones_constructibles: boolean;
  created_at: string;
  updated_at: string;
};

export type Typology = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Document = {
  id: string;
  zoning_id: string | null;
  zone_id: string | null;
  typology_id: string | null;
  content_json: any | null;
  html_content: string | null;
  pdf_storage_path: string | null;
  source_plu_url: string | null;
  source_plu_date: string | null;
  created_at: string;
  updated_at: string;
};

// Chat & Conversation Types
export type ChatConversation = {
  id: string;
  user_id: string;
  document_id: string | null;
  is_active: boolean;
  last_message_at: string | null;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  document_id: string | null;
  role: 'user' | 'assistant';
  message: string;
  metadata: any | null;
  conversation_turn: number | null;
  reply_to_message_id: string | null;
  created_at: string;
};

// Research History Type
export type ResearchHistory = {
  id: string;
  user_id: string;
  address_input: string;
  city_id: string | null;
  zone_label: string | null;
  geo_lon: number | null;
  geo_lat: number | null;
  success: boolean;
  reason: string | null;
  created_at: string | null;
};

// ============================================================================
// V2 SCHEMA TYPES (Non-destructive, runs alongside v1)
// ============================================================================

// Projects v2 (NEW)
export type V2Project = {
  id: string;
  user_id: string;
  name: string | null;  // NULL = "Sans nom" in UI
  description: string | null;
  project_type: 'construction' | 'extension' | 'renovation' | 'amenagement' | 'lotissement' | 'other' | null;
  main_address: string | null;
  main_city_id: string | null;
  main_zone_id: string | null;
  geo_lon: number | null;
  geo_lat: number | null;
  color: string;
  icon: string;
  starred: boolean;
  position: number | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
  plu_alert_enabled: boolean;
  plu_last_check_at: string | null;
  plu_check_frequency: 'daily' | 'weekly' | 'monthly';
  created_at: string;
  updated_at: string;
  first_edited_at: string | null;
  metadata: any | null;
};

// Conversations v2
export type V2Conversation = {
  id: string;
  user_id: string;
  project_id: string | null;  // Optional - created during enrichment phase
  conversation_type: 'address_analysis' | 'multi_zone' | 'general';
  title: string | null;
  context_metadata: any | null;  // Stores initial address, geocoding, etc.
  enrichment_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  branch_type: 'pending' | 'rnu' | 'non_rnu_analysis' | 'non_rnu_source';
  has_analysis: boolean;
  is_rnu: boolean;
  primary_document_id: string | null;
  document_metadata: any | null;
  is_active: boolean;
  archived_at: string | null;
  last_message_at: string | null;
  message_count: number;
  document_count: number;
  created_at: string;
  updated_at: string;
};

// Messages v2
export type V2Message = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  message_type: 'text' | 'address_search' | 'document_summary' | 'comparison' | 'clarification' | null;
  referenced_documents: string[] | null;  // UUID array
  referenced_zones: string[] | null;
  referenced_cities: string[] | null;
  search_context: any | null;  // Address search context
  intent_detected: string | null;
  confidence_score: number | null;
  ai_model_used: string | null;
  conversation_turn: number | null;
  reply_to_message_id: string | null;
  metadata: any | null;
  created_at: string;
};

// Conversation-Document junction (many-to-many)
export type V2ConversationDocument = {
  id: string;
  conversation_id: string;
  document_id: string;
  added_at: string;
  added_by: 'user' | 'ai_auto' | 'ai_suggested' | 'address_search' | 'migration';
  relevance_score: number | null;
  usage_count: number;
  last_referenced_at: string | null;
  trigger_context: any | null;
};

// Project-Document junction (many-to-many)
export type V2ProjectDocument = {
  id: string;
  project_id: string;
  document_id: string;
  pinned: boolean;
  added_at: string;
  notes: string | null;
};

// Research History v2
export type V2ResearchHistory = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  project_id: string | null;
  address_input: string;
  search_intent: string | null;
  geocoded_address: string | null;
  city_id: string | null;
  zone_id: string | null;
  geo_lon: number | null;
  geo_lat: number | null;
  documents_found: string[] | null;  // UUID array
  branch_type: 'pending' | 'rnu' | 'non_rnu_analysis' | 'non_rnu_source';
  has_analysis: boolean;
  is_rnu: boolean;
  primary_document_id: string | null;
  document_metadata: any | null;
  success: boolean;
  error_reason: string | null;
  created_at: string;
};

// Carto API Response Types
export interface CartoAPIResult {
  zones: CartoZone[];
  documents: CartoDocument[];
  municipality: CartoMunicipality | null;
}

export interface CartoZone {
  type: string;
  properties: {
    libelle: string;  // Zone code (e.g., "Uj", "UA", "UB")
    libelong?: string;  // Full zone name (can be empty)
    typezone?: string;  // Zone type category (e.g., "U")
    gid?: number;
    [key: string]: any;  // Other Carto API fields
  };
  geometry: {
    type: string;
    coordinates: any[][][];
  };
}

export interface CartoDocument {
  type: string;
  properties: {
    document_type: string;
    libelle?: string;
    code_insee?: string;
    document_url?: string;
    is_rnu?: boolean;
  };
  geometry?: any;
}

export interface CartoMunicipality {
  type: string;
  properties: {
    insee: string;  // INSEE code (e.g., "75056")
    name: string;  // Municipality name (e.g., "PARIS")
    is_rnu?: boolean;
    is_deleted?: boolean;
    is_coastline?: boolean;
  };
  geometry?: any;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

/**
 * Check for duplicate research by coordinates within 50 meters
 * Uses PostGIS ST_DWithin via RPC if available, otherwise falls back to client-side distance calculation
 * Returns conversation_id if duplicate found, null otherwise
 */
export interface DuplicateCheckResult {
  exists: boolean;
  conversationId?: string;
  projectId?: string | null;
  conversationTitle?: string | null;
  projectName?: string | null;
  branchType?: ConversationBranch;
  hasAnalysis?: boolean;
  isRnu?: boolean;
  documentMetadata?: any;
  lastMessageAt?: string | null;
}

export async function checkDuplicateByCoordinates(
  lon: number,
  lat: number,
  userId: string
): Promise<DuplicateCheckResult> {

  try {
    // First try RPC function if it exists (requires PostGIS migration)
    const { data: rpcData, error: rpcError } = await supabase.rpc('check_duplicate_by_coordinates', {
      p_lon: lon,
      p_lat: lat,
      p_user_id: userId,
      p_distance_meters: 50,
    });

    if (!rpcError && rpcData && rpcData.length > 0 && rpcData[0]?.conversation_id) {
      return await getDuplicateResultForConversation(rpcData[0].conversation_id);
    }

    // Fallback: query recent records and calculate distance client-side
    return await checkDuplicateByCoordinatesFallback(lon, lat, userId);
  } catch (error) {
    // Fallback on error
    return await checkDuplicateByCoordinatesFallback(lon, lat, userId);
  }
}

/**
 * Fallback function that queries recent records and calculates distance client-side
 * This works without requiring PostGIS RPC function
 */
async function checkDuplicateByCoordinatesFallback(
  lon: number,
  lat: number,
  userId: string
): Promise<DuplicateCheckResult> {
  try {
    // Get recent research history records for this user with coordinates
    const { data, error } = await supabase
      .from('v2_research_history')
      .select('conversation_id, geo_lon, geo_lat, created_at')
      .eq('user_id', userId)
      .not('conversation_id', 'is', null) // Only records with conversation_id
      .not('geo_lon', 'is', null) // Must have coordinates
      .not('geo_lat', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50); // Check last 50 records (should be enough for most users)

    if (error) {
      console.error('[DUPLICATE_CHECK] Error in fallback query:', error);
      return { exists: false };
    }

    if (!data || data.length === 0) {
      return { exists: false };
    }

    // Calculate distance for each record and find the closest within 50m
    for (const record of data) {
      if (record.geo_lon !== null && record.geo_lat !== null) {
        const distance = calculateDistance(
          lat,
          lon,
          Number(record.geo_lat),
          Number(record.geo_lon)
        );

        if (distance <= 50) {
          return await getDuplicateResultForConversation(record.conversation_id!);
        }
      }
    }

    return { exists: false };
  } catch (error) {
    return { exists: false };
  }
}

async function getDuplicateResultForConversation(
  conversationId: string
): Promise<DuplicateCheckResult> {
  const metadata = await fetchConversationDuplicateMetadata(conversationId);

  if (!metadata) {
    return {
      exists: true,
      conversationId,
    };
  }

  return {
    exists: true,
    conversationId,
    projectId: metadata.projectId,
    conversationTitle: metadata.title,
    projectName: metadata.projectName,
    branchType: metadata.branchType,
    hasAnalysis: metadata.hasAnalysis,
    isRnu: metadata.isRnu,
    documentMetadata: metadata.documentMetadata,
    lastMessageAt: metadata.lastMessageAt,
  };
}

async function fetchConversationDuplicateMetadata(conversationId: string) {
  try {
    const { data: conversation, error } = await supabase
      .from('v2_conversations')
      .select(
        'id, title, project_id, branch_type, has_analysis, is_rnu, document_metadata, last_message_at'
      )
      .eq('id', conversationId)
      .maybeSingle();

    if (error) {
      console.error('[DUPLICATE_CHECK] Failed to load conversation metadata:', error);
      return null;
    }

    if (!conversation) {
      return null;
    }

    let projectName: string | null = null;

    if (conversation.project_id) {
      const { data: project } = await supabase
        .from('v2_projects')
        .select('name')
        .eq('id', conversation.project_id)
        .maybeSingle();

      projectName = project?.name ?? null;
    }

    return {
      title: conversation.title as string | null,
      projectId: conversation.project_id as string | null,
      projectName,
      branchType: conversation.branch_type as ConversationBranch,
      hasAnalysis: conversation.has_analysis as boolean,
      isRnu: conversation.is_rnu as boolean,
      documentMetadata: conversation.document_metadata,
      lastMessageAt: conversation.last_message_at as string | null,
    };
  } catch (metadataError) {
    console.error('[DUPLICATE_CHECK] Unexpected metadata error:', metadataError);
    return null;
  }
}
