'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, V2Conversation, V2Message, V2ResearchHistory } from '@/lib/supabase';
import { logChatEvent, getFirstDocumentId } from '@/lib/analytics';
import { fetchMunicipality, fetchDocument, fetchZoneUrba } from '@/lib/carto-api';
import { getOrCreateCity, getOrCreateZoning, getOrCreateZone } from '@/lib/geo-enrichment';
import { ChatLeftSidebar } from '@/components/ChatLeftSidebar';
import { ChatRightPanel } from '@/components/ChatRightPanel';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ChatInputField } from '@/components/ChatInputField';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { InlineArtifactCard } from '@/components/InlineArtifactCard';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type ArtifactPhase = 'idle' | 'loading' | 'ready';

// Helper to map ArtifactPhase to component status type
function getArtifactStatus(phase: ArtifactPhase): 'loading' | 'ready' | 'error' {
  if (phase === 'ready') return 'ready';
  return 'loading'; // 'idle' and 'loading' both show loading
}

export default function ChatConversationPage({ params }: { params: { conversation_id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [conversation, setConversation] = useState<V2Conversation | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [introStatus, setIntroStatus] = useState<{ map: ArtifactPhase; document: ArtifactPhase }>({
    map: 'idle',
    document: 'idle',
  });
  const [showIntro, setShowIntro] = useState(false);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const [researchContext, setResearchContext] = useState<V2ResearchHistory | null>(null);
  const [enrichmentStep, setEnrichmentStep] = useState<'idle' | 'municipality' | 'city_check' | 'documents' | 'zones_check' | 'map_loading' | 'map_ready' | 'document_check' | 'complete'>('idle');
  const [enrichmentStatus, setEnrichmentStatus] = useState<string>('');
  const [activeArtifactTab, setActiveArtifactTab] = useState<'map' | 'document'>('map');
  
  // Desktop detection for conditional panel opening
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    // Check on mount and handle resize
    const checkDesktop = () => {
      setIsDesktop(typeof window !== 'undefined' && window.innerWidth >= 768);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  
  // Auto-switch to document tab when document becomes ready (only once)
  useEffect(() => {
    // Only auto-switch if:
    // 1. Document just became ready (transition from loading/idle to ready)
    // 2. Currently on map tab
    // 3. We haven't already auto-switched before
    if (
      introStatus.document === 'ready' && 
      activeArtifactTab === 'map' && 
      !hasAutoSwitchedToDocumentRef.current
    ) {
      console.log('[TAB_SWITCH] Document is ready, auto-switching to document tab');
      setActiveArtifactTab('document');
      hasAutoSwitchedToDocumentRef.current = true;
    }
  }, [introStatus.document, activeArtifactTab]);
  
  // Map and document state
  const [mapData, setMapData] = useState<{ lat: number; lon: number; zoneGeometry?: any; isLoading?: boolean } | null>(null);
  const [zoneData, setZoneData] = useState<{ zoneId: string | null; zoningId: string | null; cityId: string | null; zoneLibelle: string | null }>({
    zoneId: null,
    zoningId: null,
    cityId: null,
    zoneLibelle: null,
  });
  const [documentData, setDocumentData] = useState<{ htmlContent: string | null; documentId: string | null }>({ htmlContent: null, documentId: null });
  
  // Guard to prevent re-execution of enrichment (handles React Strict Mode double-invoke)
  const enrichmentInProgressRef = useRef(false);
  const introSequenceStartedRef = useRef(false);
  // Track if we've already auto-switched to document tab (prevents re-switching when user manually goes back to map)
  const hasAutoSwitchedToDocumentRef = useRef(false);

  useEffect(() => {
    console.log('[CHAT_PAGE] Page initialized, conversation_id:', params.conversation_id);
    checkAuthAndLoadConversation();
  }, [params.conversation_id]);

  useEffect(() => {
    if (!conversation) return;
    if (introSequenceStartedRef.current) return;
    if (messages.length > 0) return;

    startIntroSequence(conversation);
  }, [conversation, messages]);

  useEffect(() => {
    if (!showIntro) return;
    if (!researchContext) return;

    const lat = researchContext.geo_lat;
    const lon = researchContext.geo_lon;

    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return;
    }

    setMapData((prev) => {
      if (prev && prev.lat === lat && prev.lon === lon) {
        return prev;
      }

      // If mapData is already loaded and ready (isLoading: false), don't overwrite it
      // This prevents the effect from overwriting restored state from restoreConversationStateInstant
      if (prev && prev.isLoading === false) {
        return prev;
      }

      return {
        lat,
        lon,
        zoneGeometry: prev?.zoneGeometry,
        isLoading: introStatus.map !== 'ready',
      };
    });
  }, [researchContext, showIntro, introStatus.map]);

  const checkAuthAndLoadConversation = async () => {
    console.log('[CHAT_PAGE] Checking authentication and loading conversation');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[CHAT_PAGE] No user found, redirecting to login');
      router.push('/login');
      return;
    }
    console.log('[CHAT_PAGE] User authenticated, user_id:', user.id);
    setUserId(user.id);
    await loadConversation(user.id);
  };

  const loadConversation = async (currentUserId: string) => {
    console.log('[CHAT_PAGE] loadConversation called, conversation_id:', params.conversation_id, 'user_id:', currentUserId);
    try {
      // Load conversation
      console.log('[CHAT_PAGE] Loading conversation from database');
      const { data: conv, error: convError } = await supabase
        .from('v2_conversations')
        .select('*')
        .eq('id', params.conversation_id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (convError) {
        console.error('[CHAT_PAGE] Error loading conversation:', convError);
        throw convError;
      }

      if (!conv) {
        console.log('[CHAT_PAGE] Conversation not found, redirecting to home');
        router.push('/');
        return;
      }

      console.log('[CHAT_PAGE] Conversation loaded successfully, conversation_id:', conv.id);
      setConversation(conv);

      // Load messages for this conversation
      console.log('[CHAT_PAGE] Loading messages for conversation');
      const { data: messagesData, error: messagesError } = await supabase
        .from('v2_messages')
        .select('*')
        .eq('conversation_id', params.conversation_id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('[CHAT_PAGE] Error loading messages:', messagesError);
        throw messagesError;
      }

      if (messagesData && messagesData.length > 0) {
        console.log('[CHAT_PAGE] Messages loaded successfully, count:', messagesData.length);
        setMessages(messagesData);
        setIsFirstMessage(false);
      } else {
        console.log('[CHAT_PAGE] No messages found for conversation');
        setMessages([]);
      }

      // Check enrichment status and start background enrichment if needed
      console.log('[CHAT_PAGE] Checking enrichment status:', conv.enrichment_status);
      
      // Load research history for context (if exists)
      console.log('[CHAT_PAGE] Loading research history for context');
      const { data: research } = await supabase
        .from('v2_research_history')
        .select('*')
        .eq('conversation_id', params.conversation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (research) {
        console.log('[CHAT_PAGE] Research context loaded, research_id:', research.id);
        setResearchContext(research);
      }

      // Determine if we need to start enrichment
      const needsEnrichment = conv.enrichment_status === 'pending' || !conv.project_id;
      const isEnriched = conv.enrichment_status === 'completed' && conv.project_id;
      
      if (isEnriched && research) {
        // Complete conversation - check if fully enriched
        const hasCompleteData = !!(
          research.city_id && 
          research.zone_id && 
          messagesData && 
          messagesData.length > 0
        );
        
        if (hasCompleteData) {
          console.log('[CHAT_PAGE] Complete conversation detected, skipping enrichment and restoring instantly');
          restoreConversationStateInstant(research, conv);
        } else {
          // Enrichment marked complete but data missing - start enrichment
          console.log('[CHAT_PAGE] Enrichment marked complete but data missing, starting enrichment');
          if (!enrichmentInProgressRef.current) {
            enrichConversationData(research || null, conv);
          }
        }
      } else if (needsEnrichment) {
        // Lightweight conversation - start background enrichment immediately
        console.log('[CHAT_PAGE] Lightweight conversation detected, starting background enrichment');
        setArtifactsLoading(true);
        introSequenceStartedRef.current = false;
        setIntroStatus({ map: 'idle', document: 'idle' });
        setShowIntro(false);
        setActiveArtifactTab('map');
        setMapData(null);
        
        if (!enrichmentInProgressRef.current) {
          enrichConversationData(research || null, conv);
        }
      } else {
        // In-progress or failed - show UI immediately
        console.log('[CHAT_PAGE] Enrichment status:', conv.enrichment_status);
        setArtifactsLoading(false);
      }

      console.log('[CHAT_PAGE] loadConversation completed successfully');
      setLoading(false);
    } catch (error) {
      console.error('[CHAT_PAGE] Error loading conversation:', error);
      router.push('/');
    }
  };

  const restoreConversationStateInstant = (research: V2ResearchHistory, conv: V2Conversation) => {
    console.log('[RESTORE] Starting instant state restoration for complete conversation - Option C: skip all fetching');
    
    // Prevent any intro sequence from running
    introSequenceStartedRef.current = true;
    
    // Option C: Skip ALL database fetching - just set basic state and close loading immediately
    // The right panel will load its data lazily when the user opens it
    
    const lon = research.geo_lon;
    const lat = research.geo_lat;
    const zoneId = research.zone_id;
    const cityId = research.city_id;
    
    // Set minimal zone data (just IDs, no geometry/libelle fetching)
    setZoneData({ 
      zoneId, 
      zoningId: null, // Will be fetched when needed
      cityId, 
      zoneLibelle: null // Will be fetched when needed
    });
    
    // Set minimal map data (just coordinates, geometry will load when right panel opens)
    if (lon !== null && lat !== null) {
      setMapData({
        lat,
        lon,
        zoneGeometry: undefined, // Will be fetched when right panel opens
        isLoading: false, // Not loading - will load lazily
      });
    }
    
    // Don't set document data - will load when right panel opens
    // Don't set intro status - not needed for existing conversations
    // Don't show inline cards - they already have messages
    setShowIntro(false); // EXPLICITLY hide intro cards for existing conversations
    
    // Close loading state IMMEDIATELY - no async operations
    setArtifactsLoading(false);
    
    console.log('[RESTORE] Instant restoration complete - no fetching, messages will appear immediately');
  };

  const startIntroSequence = (conv: V2Conversation) => {
    if (introSequenceStartedRef.current) {
      return;
    }

    introSequenceStartedRef.current = true;

    const contextMetadata = conv.context_metadata as any;
    const lon = researchContext?.geo_lon ?? contextMetadata?.geocoded?.lon ?? null;
    const lat = researchContext?.geo_lat ?? contextMetadata?.geocoded?.lat ?? null;

    setIntroStatus({ map: 'loading', document: 'idle' });
    setActiveArtifactTab('map');
    // Only auto-open panel on desktop
    if (isDesktop) {
      setRightPanelOpen(true);
    }
    setArtifactsLoading(true);
    setShowIntro(false);

    if (lon !== null && lat !== null) {
      setMapData({
        lat,
        lon,
        zoneGeometry: undefined,
        isLoading: true,
      });
    }

    // Note: Status updates are now handled by actual artifact completion in enrichConversationData
    // introStatus.map will be set to 'ready' when map finishes loading
    // introStatus.document will be set to 'ready' when document is retrieved
  };

  const enrichConversationData = async (research: V2ResearchHistory | null, conv: V2Conversation) => {
    // Prevent re-execution if already in progress
    if (enrichmentInProgressRef.current) {
      console.log('[ENRICHMENT] enrichConversationData already in progress, skipping');
      return;
    }
    
    console.log('[ENRICHMENT] enrichConversationData called');
    console.log('[ENRICHMENT] Conversation ID:', conv.id, 'Has research:', !!research);
    
    // Set guard to prevent re-execution
    enrichmentInProgressRef.current = true;
    
    // Show loading state during enrichment
    setArtifactsLoading(true);
    
    // Update enrichment_status to 'in_progress'
    await supabase
      .from('v2_conversations')
      .update({ enrichment_status: 'in_progress' })
      .eq('id', conv.id);
    
    try {
    
    const contextMetadata = conv.context_metadata as any;
    const inseeCode = contextMetadata?.insee_code || '';
    const lon = contextMetadata?.geocoded?.lon;
    const lat = contextMetadata?.geocoded?.lat;
    const addressInput = contextMetadata?.initial_address || '';
    
    console.log('[ENRICHMENT] Context metadata extracted:', { inseeCode, lon, lat, addressInput });
    
    if (!inseeCode || !lon || !lat) {
      console.error('[ENRICHMENT] Missing required data:', { inseeCode, lon, lat });
      await supabase
        .from('v2_conversations')
        .update({ enrichment_status: 'failed' })
        .eq('id', conv.id);
      setArtifactsLoading(false);
      return;
    }

    // Step 0: Ensure we have a valid user ID (use conversation's user_id as source of truth)
    const enrichmentUserId = conv.user_id;
    if (!enrichmentUserId) {
      console.error('[ENRICHMENT] No user_id in conversation');
      await supabase
        .from('v2_conversations')
        .update({ enrichment_status: 'failed' })
        .eq('id', conv.id);
      setArtifactsLoading(false);
      return;
    }

    // Step 1: Create project if it doesn't exist
    let projectId = conv.project_id;
    if (!projectId) {
      console.log('[ENRICHMENT] Creating project for conversation');
      const { data: project, error: projectError } = await supabase
        .from('v2_projects')
        .insert({
          user_id: enrichmentUserId,
          status: 'draft',
          main_address: addressInput,
          geo_lon: lon,
          geo_lat: lat,
        })
        .select('id')
        .single();
      
      if (projectError || !project) {
        console.error('[ENRICHMENT] Error creating project:', projectError);
        await supabase
          .from('v2_conversations')
          .update({ enrichment_status: 'failed' })
          .eq('id', conv.id);
        setArtifactsLoading(false);
        throw new Error(`Failed to create project: ${projectError?.message}`);
      }
      
      projectId = project.id;
      
      // Link conversation to project
      await supabase
        .from('v2_conversations')
        .update({ project_id: projectId })
        .eq('id', conv.id);
      
      console.log('[ENRICHMENT] Project created and linked, project_id:', projectId);
    }

    // Step 2: Create research_history if it doesn't exist
    let researchId: string | null = null;
    if (!research) {
      console.log('[ENRICHMENT] Creating research_history');
      const { data: newResearch, error: researchError } = await supabase
        .from('v2_research_history')
        .insert({
          user_id: enrichmentUserId,
          conversation_id: conv.id,
          project_id: projectId,
          address_input: addressInput,
          geo_lon: lon,
          geo_lat: lat,
          success: true,
        })
        .select('id')
        .single();
      
      if (researchError || !newResearch) {
        console.error('[ENRICHMENT] Error creating research_history:', researchError);
        // Continue - we can still enrich without research_history
      } else {
        researchId = newResearch.id;
        console.log('[ENRICHMENT] Research history created, id:', researchId);
      }
    } else {
      researchId = research.id;
    }

    // Initialize variables from research or fetch new data
    let cityId: string | null = research?.city_id || null;
    let zoneId: string | null = research?.zone_id || null;
    let zoningId: string | null = null;
    let isRnuStatus = false; // Will be set during enrichment or assumed false
    
    // Cache for API responses to avoid redundant calls
    let cachedZonesFromAPI: any[] | null = null;
    let cachedZoneGeometry: any | null = null;
    
    console.log('[ENRICHMENT] Starting with existing data:', { 
      hasCityId: !!cityId, 
      hasZoneId: !!zoneId,
      researchId 
    });
    
    // If we don't have basic enrichment data yet, fetch it
    // OR if we have cityId but are missing zoneId or zoningId, we still need to fetch zones
    if (!cityId || !zoneId || !zoningId) {
      if (!cityId) {
        console.log('[ENRICHMENT] No city_id found, running basic enrichment');
      } else {
        console.log('[ENRICHMENT] Have city_id but no zoneId/zoningId, fetching zones');
      }
      
      let municipality: any = null;
      let isRnu = false;
      let communeName = contextMetadata?.city?.toLowerCase() || '';
      let municipalityInseeCode = inseeCode;
      let hasAnalysis = false;

    // Step 1: Fetch ZoneUrba FIRST (with GPS coordinates)
    // This gives us libelle, typezone, and MultiPolygon geometry
    if (lon !== undefined && lat !== undefined) {
      try {
        console.log('[ENRICHMENT] Step 1: Fetching zones from ZoneUrba API (FIRST)');
        setEnrichmentStep('zones_check');
        setEnrichmentStatus('Récupération des zones...');
        
        cachedZonesFromAPI = await fetchZoneUrba({ lon, lat });
        console.log('[ENRICHMENT] Step 1: Zones fetched from API, count:', cachedZonesFromAPI?.length || 0);
        
        if (cachedZonesFromAPI && cachedZonesFromAPI.length > 0) {
          const firstZone = cachedZonesFromAPI[0];
          const zoneCode = firstZone.properties.libelle;
          const zoneName = firstZone.properties.libelong || firstZone.properties.libelle;
          const typezone = firstZone.properties.typezone;
          cachedZoneGeometry = firstZone.geometry;
          
          console.log('[ENRICHMENT] Step 1: Zone data from API:', { 
            libelle: zoneCode, 
            typezone, 
            hasGeometry: !!cachedZoneGeometry 
          });
        }
      } catch (error) {
        console.error('[ENRICHMENT] Step 1: Error fetching zones from API:', error);
        setEnrichmentStatus('Erreur lors de la récupération des zones');
        // Continue without zones - will try database fallback
      }
    }

    // Step 2: City Database Check (using context metadata, municipality API not called yet)
    try {
      console.log('[ENRICHMENT] Step 2: City database check/creation');
      setEnrichmentStep('city_check');
      setEnrichmentStatus('Vérification de la base de données...');
      
      if (communeName && municipalityInseeCode) {
        cityId = await getOrCreateCity(municipalityInseeCode, communeName);
        console.log('[ENRICHMENT] Step 2: City ID obtained:', cityId);
        
        // Update research_history with city_id
        if (researchId) {
          console.log('[ENRICHMENT] Step 2: Updating research_history with city_id');
          const { error: cityUpdateError } = await supabase
            .from('v2_research_history')
            .update({
              city_id: cityId,
              geocoded_address: communeName,
            })
            .eq('id', researchId);
          
          if (cityUpdateError) {
            console.error('[ENRICHMENT] Step 2: Failed to update research history with city:', cityUpdateError);
          }
          
          // Reload research context
          const { data: updatedResearch } = await supabase
            .from('v2_research_history')
            .select('*')
            .eq('id', researchId)
            .single();
          
          if (updatedResearch) {
            console.log('[ENRICHMENT] Step 2: Research context updated');
            setResearchContext(updatedResearch);
          }
        }
      } else {
        console.log('[ENRICHMENT] Step 2: Skipped - missing communeName or municipalityInseeCode');
      }
    } catch (error) {
      console.error('[ENRICHMENT] Step 2: Error in city check:', error);
      setEnrichmentStatus('Erreur lors de la vérification de la base de données');
      // Continue without city_id
    }
    
    // Step 3: Zones/Zoning Database Check (using data from Step 1)
    // Use libelle and typezone from fetchZoneUrba to get/create zoning and zone
    try {
      console.log('[ENRICHMENT] Step 3: Zones/zoning database check using API data');
      setEnrichmentStep('zones_check');
      setEnrichmentStatus('Vérification des zones...');
      
      // Use zone data from Step 1 if available
      let zoneLibelleFromAPI: string | null = null;
      
      if (cachedZonesFromAPI && cachedZonesFromAPI.length > 0 && cityId) {
        const firstZone = cachedZonesFromAPI[0];
        const zoneCode = firstZone.properties.libelle;
        const zoneName = firstZone.properties.libelong || firstZone.properties.libelle;
        const typezone = firstZone.properties.typezone;
        zoneLibelleFromAPI = zoneCode;
        
        console.log('[ENRICHMENT] Step 3: Using zone data from Step 1:', { zoneCode, typezone });
        
        // Get or create zoning using typezone (maps to zonings.code)
        if (!zoningId) {
          zoningId = await getOrCreateZoning(cityId, typezone, false);
          console.log('[ENRICHMENT] Step 3: Zoning ID:', zoningId);
        }
        
        // Get or create zone (zoneCode is stored as zones.name in database)
        // Pass geometry to ensure it's saved to database
        if (!zoneId && zoningId) {
          try {
            zoneId = await getOrCreateZone(zoningId, zoneCode, zoneName, cachedZoneGeometry);
            console.log('[ENRICHMENT] Step 3: Zone ID created:', zoneId, 'zone name (libelle):', zoneCode);
          } catch (zoneError) {
            console.error('[ENRICHMENT] Step 3: Error creating zone:', zoneError);
            // Continue to query existing zone below
          }
        }
        
        if (zoneLibelleFromAPI && zoningId && !zoneId) {
          // If zoneId wasn't created (already exists), query by libelle to get the correct zoneId
          console.log('[ENRICHMENT] Step 3: Zone may already exist, querying by libelle:', zoneLibelleFromAPI);
          const { data: existingZone } = await supabase
            .from('zones')
            .select('id, name')
            .eq('zoning_id', zoningId)
            .ilike('name', zoneLibelleFromAPI)
            .maybeSingle();
          
          if (existingZone) {
            zoneId = existingZone.id;
            console.log('[ENRICHMENT] Step 3: Found existing zone by libelle:', zoneId, 'libelle:', existingZone.name);
            
            // Update geometry if not already set in database
            if (cachedZoneGeometry) {
              const { error: geomUpdateError } = await supabase
                .from('zones')
                .update({ geometry: cachedZoneGeometry })
                .eq('id', zoneId)
                .is('geometry', null);
              
              if (geomUpdateError) {
                console.error('[ENRICHMENT] Step 3: Error updating zone geometry:', geomUpdateError);
              } else {
                console.log('[ENRICHMENT] Step 3: Zone geometry updated in database');
              }
            }
          }
        }
      }
      
      // Fallback: If no API data or coordinates not available, check database
      if (!zoneId && cityId) {
        console.log('[ENRICHMENT] Step 3: Fallback - fetching from database');
        // Check if zones exist in database for this city
        const { data: zonings } = await supabase
          .from('zonings')
          .select('id, name')
          .eq('city_id', cityId)
          .limit(1);
        
        console.log('[ENRICHMENT] Step 3: Zonings found in database:', zonings?.length || 0);
        
        if (zonings && zonings.length > 0) {
          // Found existing zoning, check for zones
          if (!zoningId) {
            zoningId = zonings[0].id;
            console.log('[ENRICHMENT] Step 3: Zoning ID from database:', zoningId);
          }
          
          // Query zones - filter by libelle if we have it from API
          let zoneQuery = supabase
            .from('zones')
            .select('id, name')
            .eq('zoning_id', zoningId);
          
          if (zoneLibelleFromAPI) {
            // CRITICAL: Filter by libelle to get the correct zone (case-insensitive)
            zoneQuery = zoneQuery.ilike('name', zoneLibelleFromAPI);
            console.log('[ENRICHMENT] Step 3: Filtering zones by libelle:', zoneLibelleFromAPI);
          } else {
            // Fallback: If no libelle, just take first zone (old behavior)
            zoneQuery = zoneQuery.limit(1);
            console.log('[ENRICHMENT] Step 3: No libelle available, taking first zone (may be incorrect)');
          }
          
          const { data: zones } = await zoneQuery;
          
          console.log('[ENRICHMENT] Step 3: Zones found in database:', zones?.length || 0);
          
          if (zones && zones.length > 0) {
            zoneId = zones[0].id;
            const zoneLibelleFromDb = zones[0].name; // This is the libelle stored in zones.name
            console.log('[ENRICHMENT] Step 3: Zone ID from database:', zoneId, 'zone name (libelle):', zoneLibelleFromDb);
            // Verify we got the correct zone
            if (zoneLibelleFromAPI && zoneLibelleFromDb !== zoneLibelleFromAPI) {
              console.warn('[ENRICHMENT] Step 3: WARNING - Zone libelle mismatch! Expected:', zoneLibelleFromAPI, 'Got:', zoneLibelleFromDb);
            }
          }
        }
      }
      
      // Update research_history with zone_id
      if (cityId && zoneId && researchId) {
        console.log('[ENRICHMENT] Step 3: Updating research_history with zone_id:', zoneId);
        const { error: zoneUpdateError } = await supabase
          .from('v2_research_history')
          .update({
            zone_id: zoneId,
          })
          .eq('id', researchId);
        
        if (zoneUpdateError) {
          console.error('[ENRICHMENT] Step 3: Failed to update research history with zone:', zoneUpdateError);
        }
      }
      
      // Reload research context
      if (researchId) {
        const { data: finalResearch } = await supabase
          .from('v2_research_history')
          .select('*')
          .eq('id', researchId)
          .single();
        
        if (finalResearch) {
          console.log('[ENRICHMENT] Step 3: Final research context loaded');
          setResearchContext(finalResearch);
        }
      }
    } catch (error) {
      console.error('[ENRICHMENT] Step 3: Error in zones check:', error);
      setEnrichmentStatus('Erreur lors de la vérification des zones');
      // Continue without zones
    }
    // Step 4: Check documents table for existing analysis (BEFORE calling municipality/document APIs)
    // Only proceed to fetch municipality/document if no analysis exists
    if (zoneId || zoningId) {
      try {
        console.log('[ENRICHMENT] Step 4: Checking documents table for existing analysis');
        setEnrichmentStep('document_check');
        setEnrichmentStatus('Vérification de l\'analyse...');
        
        // Query documents table by zone_id (and optionally zoning_id) for existing analysis
        let documentQuery = supabase
          .from('documents')
          .select('*');
        
        if (zoneId) {
          documentQuery = documentQuery.eq('zone_id', zoneId);
        }
        if (zoningId) {
          documentQuery = documentQuery.eq('zoning_id', zoningId);
        }
        
        const { data: document, error: queryError } = await documentQuery.maybeSingle();
        
        if (queryError) {
          console.error('[ENRICHMENT] Step 4: Document query error:', queryError);
        }
        
        if (document) {
          // Check if analysis exists (has content_json or html_content)
          const hasContentJson = !!document.content_json;
          const hasHtmlContent = !!document.html_content;
          
          if (hasContentJson || hasHtmlContent) {
            // Analysis exists - display it and skip municipality/document API calls
            console.log('[ENRICHMENT] Step 4: Analysis found in database, skipping API calls');
            hasAnalysis = true;
            
            if (hasHtmlContent) {
              setDocumentData({
                htmlContent: document.html_content,
                documentId: document.id
              });
              console.log('[ENRICHMENT] Step 4: Document HTML content set from database');
              setEnrichmentStatus('Analyse trouvée ✓');
              setIntroStatus(prev => ({ ...prev, document: 'ready' }));
            }
            
            // If we have analysis, we can complete early (map will be loaded separately)
            // Don't set complete here - let it continue to map loading phase
          } else {
            // Document record exists but no analysis - will need to call APIs
            console.log('[ENRICHMENT] Step 4: Document record exists but no analysis, will check municipality/RNU');
          }
        } else {
          // No document record - will need to call APIs
          console.log('[ENRICHMENT] Step 4: No document record found, will check municipality/RNU');
        }
      } catch (error) {
        console.error('[ENRICHMENT] Step 4: Error checking documents table:', error);
        // Continue - will still check municipality/RNU
      }
    }
    
    // Step 5 (CONDITIONAL): Only call municipality and document APIs if no analysis exists
    // AND we have zone_id/zoning_id (meaning we've covered the zone)
    if (!hasAnalysis && (zoneId || zoningId)) {
      try {
        console.log('[ENRICHMENT] Step 5: No analysis found, checking municipality for RNU');
        setEnrichmentStep('municipality');
        setEnrichmentStatus('Vérification RNU...');
        
        // Call municipality API to check for RNU
        municipality = await fetchMunicipality({ insee_code: inseeCode });
        
        if (municipality) {
          isRnu = municipality.properties.is_rnu === true;
          isRnuStatus = isRnu;
          
          // Update communeName if we got better data from municipality
          if (municipality.properties.name) {
            communeName = municipality.properties.name.toLowerCase();
          }
          
          console.log('[ENRICHMENT] Step 5: Municipality fetched, isRnu:', isRnu);
        }
        
        // Only fetch documents if not RNU
        if (!isRnu) {
          console.log('[ENRICHMENT] Step 5: Not RNU, fetching source documents');
          setEnrichmentStatus('Récupération des documents sources...');
          
          const documents = await fetchDocument({ insee_code: inseeCode });
          console.log('[ENRICHMENT] Step 5: Documents fetched, count:', documents.length);
          
          // Store source PLU URL if available (for placeholder document creation)
          if (documents && documents.length > 0) {
            const sourcePluUrl = documents[0].properties.document_url || null;
            console.log('[ENRICHMENT] Step 5: Source PLU URL from API:', sourcePluUrl);
            
            // Create placeholder document record if we don't have one
            const typologyId = '7c0f2830-f3fc-4c69-911c-470286f91982';
            const { data: newDocument, error: createError } = await supabase
              .from('documents')
              .insert({
                zoning_id: zoningId,
                zone_id: zoneId,
                typology_id: typologyId,
                source_plu_url: sourcePluUrl,
              })
              .select()
              .single();
            
            if (createError && createError.code !== '23505') { // Ignore duplicate key errors
              console.error('[ENRICHMENT] Step 5: Error creating document record:', createError);
            } else if (newDocument) {
              console.log('[ENRICHMENT] Step 5: Placeholder document created with source PLU URL');
            }
          }
        } else {
          console.log('[ENRICHMENT] Step 5: RNU detected, skipping document fetch');
        }
      } catch (error) {
        console.error('[ENRICHMENT] Step 5: Error fetching municipality/documents:', error);
        setEnrichmentStatus('Erreur lors de la vérification');
      }
    } else if (hasAnalysis) {
      console.log('[ENRICHMENT] Step 5: Skipped - analysis already exists in database');
    } else {
      console.log('[ENRICHMENT] Step 5: Skipped - no zone_id/zoning_id (zone not covered)');
    }
    
    } // End of if (!cityId || (!zoneId && !zoningId)) block - basic enrichment complete
    
    // Step 4 (OUTSIDE enrichment block): Always try to get zoneId/zoningId if we have cityId
    // This ensures we have both IDs even if we skipped the enrichment block
    // This is CRITICAL for existing conversations where cityId exists but zoneId/zoningId are missing
    if (cityId && (!zoneId || !zoningId) && !isRnuStatus) {
      console.log('[ENRICHMENT] Step 4 (post-enrichment): Fetching missing zone/zoning IDs');
      try {
        // OPTIMIZATION: Use cached API response if available to avoid redundant calls
        let zoneLibelleFromAPI: string | null = null;
        let zonesFromAPI: any[] | null = null;
        
        if (cachedZonesFromAPI && cachedZonesFromAPI.length > 0) {
          // Use cached data - no API call needed
          zonesFromAPI = cachedZonesFromAPI;
          console.log('[ENRICHMENT] Step 4 (post): Using cached zones data, count:', zonesFromAPI.length);
        } else if (lon !== undefined && lat !== undefined) {
          // Only fetch if not cached
          console.log('[ENRICHMENT] Step 4 (post): No cache available, fetching from API');
          try {
            zonesFromAPI = await fetchZoneUrba({ lon, lat });
            // Cache for future use
            cachedZonesFromAPI = zonesFromAPI;
            if (zonesFromAPI && zonesFromAPI.length > 0) {
              cachedZoneGeometry = zonesFromAPI[0].geometry;
            }
            console.log('[ENRICHMENT] Step 4 (post): Zones fetched and cached, count:', zonesFromAPI?.length || 0);
          } catch (apiError) {
            console.error('[ENRICHMENT] Step 4 (post): Error fetching from API:', apiError);
            // Continue to database fallback
          }
        }
        
        if (zonesFromAPI && zonesFromAPI.length > 0) {
          const firstZone = zonesFromAPI[0];
          const zoneCode = firstZone.properties.libelle;
          const zoneName = firstZone.properties.libelong || firstZone.properties.libelle;
          const typezone = firstZone.properties.typezone;
          zoneLibelleFromAPI = zoneCode;
          console.log('[ENRICHMENT] Step 4 (post): Zone libelle:', zoneCode, 'typezone:', typezone);
          
          if (!zoningId) {
            zoningId = await getOrCreateZoning(cityId, typezone, false);
            console.log('[ENRICHMENT] Step 4 (post): Zoning ID:', zoningId);
          }
          
          if (!zoneId && zoningId) {
            // Use cached geometry if available
            try {
              zoneId = await getOrCreateZone(zoningId, zoneCode, zoneName, cachedZoneGeometry || firstZone.geometry);
              console.log('[ENRICHMENT] Step 4 (post): Zone ID created:', zoneId, 'libelle:', zoneCode);
            } catch (zoneError) {
              console.error('[ENRICHMENT] Step 4 (post): Error creating zone:', zoneError);
              // Continue to query existing zone below
            }
          }
          
          if (zoneLibelleFromAPI && zoningId && !zoneId) {
            // Zone may already exist, query by libelle to get the correct zoneId
            console.log('[ENRICHMENT] Step 4 (post): Zone may already exist, querying by libelle:', zoneLibelleFromAPI);
            const { data: existingZone } = await supabase
              .from('zones')
              .select('id, name')
              .eq('zoning_id', zoningId)
              .ilike('name', zoneLibelleFromAPI)
              .maybeSingle();
            
            if (existingZone) {
              zoneId = existingZone.id;
              console.log('[ENRICHMENT] Step 4 (post): Found existing zone by libelle:', zoneId, 'libelle:', existingZone.name);
              
              // Update geometry if cached and not already set
              if (cachedZoneGeometry) {
                const { error: geomUpdateError } = await supabase
                  .from('zones')
                  .update({ geometry: cachedZoneGeometry })
                  .eq('id', zoneId)
                  .is('geometry', null);
                
                if (!geomUpdateError) {
                  console.log('[ENRICHMENT] Step 4 (post): Zone geometry updated from cache');
                }
              }
            }
          }
        }
        
        // Fallback: If no API data or coordinates not available, check database
        // If we have libelle from API, filter by it to get the correct zone
        if (!zoningId) {
          const { data: zonings } = await supabase
            .from('zonings')
            .select('id')
            .eq('city_id', cityId)
            .limit(1);
          
          if (zonings && zonings.length > 0) {
            zoningId = zonings[0].id;
            console.log('[ENRICHMENT] Step 4 (post): Zoning ID from database:', zoningId);
          }
        }
        
        // If we have zoningId but not zoneId, try to get zoneId (filter by libelle if available)
        if (zoningId && !zoneId) {
          let zoneQuery = supabase
            .from('zones')
            .select('id, name')
            .eq('zoning_id', zoningId);
          
          if (zoneLibelleFromAPI) {
            // CRITICAL: Filter by libelle to get the correct zone (case-insensitive)
            zoneQuery = zoneQuery.ilike('name', zoneLibelleFromAPI);
            console.log('[ENRICHMENT] Step 4 (post): Filtering zones by libelle:', zoneLibelleFromAPI);
          } else {
            // Fallback: If no libelle, just take first zone (old behavior)
            zoneQuery = zoneQuery.limit(1);
            console.log('[ENRICHMENT] Step 4 (post): No libelle available, taking first zone (may be incorrect)');
          }
          
          const { data: zones } = await zoneQuery;
          
          if (zones && zones.length > 0) {
            zoneId = zones[0].id;
            const zoneLibelleFromDb = zones[0].name;
            console.log('[ENRICHMENT] Step 4 (post): Zone ID from database:', zoneId, 'zone name (libelle):', zoneLibelleFromDb);
            // Verify we got the correct zone
            if (zoneLibelleFromAPI && zoneLibelleFromDb !== zoneLibelleFromAPI) {
              console.warn('[ENRICHMENT] Step 4 (post): WARNING - Zone libelle mismatch! Expected:', zoneLibelleFromAPI, 'Got:', zoneLibelleFromDb);
            }
          }
        }
      } catch (error) {
        console.error('[ENRICHMENT] Step 4 (post): Error fetching zones:', error);
      }
    }
    
    // If we have zoneId but not zoningId, fetch zoningId from the zone
    if (zoneId && !zoningId) {
      console.log('[ENRICHMENT] Have zoneId but not zoningId, fetching zoning_id from zone');
      try {
        const { data: zone } = await supabase
          .from('zones')
          .select('zoning_id')
          .eq('id', zoneId)
          .maybeSingle();
        
        if (zone && zone.zoning_id) {
          zoningId = zone.zoning_id;
          console.log('[ENRICHMENT] Zoning ID from zone:', zoningId);
        }
      } catch (error) {
        console.error('[ENRICHMENT] Error fetching zoning_id from zone:', error);
      }
    }
    
    // If we have cityId and zoningId but not zoneId, fetch zoneId from database
    if (cityId && zoningId && !zoneId) {
      console.log('[ENRICHMENT] Fetching zone_id for existing enrichment');
      try {
        // OPTIMIZATION: Use cached API response if available
        let zoneLibelleFromAPI: string | null = null;
        let zonesFromAPI: any[] | null = null;
        
        if (cachedZonesFromAPI && cachedZonesFromAPI.length > 0) {
          // Use cached data - no API call needed
          zonesFromAPI = cachedZonesFromAPI;
          console.log('[ENRICHMENT] Using cached zones data, count:', zonesFromAPI.length);
        } else if (lon !== undefined && lat !== undefined) {
          // Only fetch if not cached
          console.log('[ENRICHMENT] No cache available, fetching from API');
          try {
            zonesFromAPI = await fetchZoneUrba({ lon, lat });
            // Cache for future use
            cachedZonesFromAPI = zonesFromAPI;
            if (zonesFromAPI && zonesFromAPI.length > 0) {
              cachedZoneGeometry = zonesFromAPI[0].geometry;
            }
            console.log('[ENRICHMENT] Zones fetched and cached, count:', zonesFromAPI?.length || 0);
          } catch (apiError) {
            console.error('[ENRICHMENT] Error fetching from API:', apiError);
            // Continue to database fallback
          }
        }
        
        if (zonesFromAPI && zonesFromAPI.length > 0) {
          const firstZone = zonesFromAPI[0];
          const zoneCode = firstZone.properties.libelle;
          const zoneName = firstZone.properties.libelong || firstZone.properties.libelle;
          zoneLibelleFromAPI = zoneCode;
          console.log('[ENRICHMENT] Zone libelle from API/cache:', zoneCode);
          
          // Try to get or create zone using the correct libelle and cached geometry
          try {
            zoneId = await getOrCreateZone(zoningId, zoneCode, zoneName, cachedZoneGeometry || firstZone.geometry);
            console.log('[ENRICHMENT] Zone ID created/retrieved:', zoneId, 'libelle:', zoneCode);
          } catch (zoneError) {
            console.error('[ENRICHMENT] Error creating zone:', zoneError);
            // Continue to query existing zone below
          }
          
          // If zone already exists but getOrCreateZone didn't return it, query by libelle
          if (!zoneId && zoneLibelleFromAPI) {
            console.log('[ENRICHMENT] Zone may already exist, querying by libelle:', zoneLibelleFromAPI);
            const { data: existingZone } = await supabase
              .from('zones')
              .select('id, name')
              .eq('zoning_id', zoningId)
              .ilike('name', zoneLibelleFromAPI)
              .maybeSingle();
            
            if (existingZone) {
              zoneId = existingZone.id;
              console.log('[ENRICHMENT] Found existing zone by libelle:', zoneId, 'libelle:', existingZone.name);
              
              // Update geometry if cached and not already set
              if (cachedZoneGeometry) {
                const { error: geomUpdateError } = await supabase
                  .from('zones')
                  .update({ geometry: cachedZoneGeometry })
                  .eq('id', zoneId)
                  .is('geometry', null);
                
                if (!geomUpdateError) {
                  console.log('[ENRICHMENT] Zone geometry updated from cache');
                }
              }
            }
          }
        }
        
        // Fallback: Query database - filter by libelle if we have it from API
        if (!zoneId) {
          let zoneQuery = supabase
            .from('zones')
            .select('id, name')
            .eq('zoning_id', zoningId);
          
          if (zoneLibelleFromAPI) {
            // CRITICAL: Filter by libelle to get the correct zone (case-insensitive)
            zoneQuery = zoneQuery.ilike('name', zoneLibelleFromAPI);
            console.log('[ENRICHMENT] Filtering zones by libelle:', zoneLibelleFromAPI);
          } else {
            // Fallback: If no libelle, just take first zone (old behavior)
            zoneQuery = zoneQuery.limit(1);
            console.log('[ENRICHMENT] No libelle available, taking first zone (may be incorrect)');
          }
          
          const { data: zones } = await zoneQuery;
          
          if (zones && zones.length > 0) {
            zoneId = zones[0].id;
            const zoneLibelleFromDb = zones[0].name;
            console.log('[ENRICHMENT] Zone ID from database:', zoneId, 'zone name (libelle):', zoneLibelleFromDb);
            // Verify we got the correct zone
            if (zoneLibelleFromAPI && zoneLibelleFromDb !== zoneLibelleFromAPI) {
              console.warn('[ENRICHMENT] WARNING - Zone libelle mismatch! Expected:', zoneLibelleFromAPI, 'Got:', zoneLibelleFromDb);
            }
          }
        }
      } catch (error) {
        console.error('[ENRICHMENT] Error fetching zone_id:', error);
      }
    }
    
    // Store zone data for document lookup
    // We need to get zoneLibelle from the zone we have
    let zoneLibelle: string | null = null;
    if (zoneId) {
      try {
        const { data: zone } = await supabase
          .from('zones')
          .select('name')
          .eq('id', zoneId)
          .maybeSingle();
        if (zone) {
          zoneLibelle = zone.name; // zones.name stores the libelle value (e.g., "UA1")
        }
      } catch (error) {
        console.error('[ENRICHMENT] Error fetching zone name:', error);
      }
    }
    
    // Store zone data in state (for UI/display purposes)
    setZoneData({ zoneId, zoningId, cityId, zoneLibelle });
    console.log('[ENRICHMENT] Zone data stored:', { zoneId, zoningId, cityId, zoneLibelle });
    
    // CRITICAL: Store these in local scope for document query since React state is asynchronous
    // We'll use these local variables in the document query below
    
    // Step 5: Map Loading Phase
    console.log('[MAP_ARTIFACT_START] Starting map artifact creation');
    setEnrichmentStep('map_loading');
    setEnrichmentStatus('Chargement de la carte...');
    
    // Slide in right panel immediately (desktop only)
    console.log('[MAP_ARTIFACT_START] Opening right panel');
    if (isDesktop) {
      setRightPanelOpen(true);
    }
    
    // Fetch geometry if we need it - use cached geometry first to avoid redundant API calls
    let zoneGeometry: any = null;
    
    if (zoneId) {
      // First try cached geometry from API response
      if (cachedZoneGeometry) {
        zoneGeometry = cachedZoneGeometry;
        console.log('[MAP_ARTIFACT_START] Using cached zone geometry from API');
      } else {
        // Try database
        console.log('[MAP_ARTIFACT_START] Fetching zone geometry from database');
        const { data: zoneRecord } = await supabase
          .from('zones')
          .select('geometry')
          .eq('id', zoneId)
          .maybeSingle();
        
        if (zoneRecord && zoneRecord.geometry) {
          zoneGeometry = zoneRecord.geometry;
          console.log('[MAP_ARTIFACT_START] Zone geometry loaded from database');
        } else if (lon !== undefined && lat !== undefined) {
          // Only fetch from API if we don't have cached data and it's not in DB
          // OPTIMIZATION: Use cached zones if available
          if (cachedZonesFromAPI && cachedZonesFromAPI.length > 0) {
            zoneGeometry = cachedZonesFromAPI[0].geometry;
            cachedZoneGeometry = zoneGeometry; // Cache it
            console.log('[MAP_ARTIFACT_START] Zone geometry loaded from cached API response');
          } else {
            // Last resort: fetch from API (should rarely happen now)
            console.log('[MAP_ARTIFACT_START] Fetching zone geometry from API (fallback)');
            try {
              const zonesFromAPI = await fetchZoneUrba({ lon, lat });
              if (zonesFromAPI && zonesFromAPI.length > 0) {
                const firstZone = zonesFromAPI[0];
                zoneGeometry = firstZone.geometry;
                // Cache for future use
                cachedZonesFromAPI = zonesFromAPI;
                cachedZoneGeometry = zoneGeometry;
                console.log('[MAP_ARTIFACT_START] Zone geometry loaded from API and cached');
                
                // CRITICAL: If we don't have zoneId/zoningId yet, extract them from API response
                if (!zoneId || !zoningId) {
                  const zoneCode = firstZone.properties.libelle; // e.g., "UA1"
                  const zoneName = firstZone.properties.libelong || firstZone.properties.libelle;
                  const typezone = firstZone.properties.typezone; // e.g., "U"
                  
                  console.log('[MAP_ARTIFACT_START] Extracting zone/zoning IDs from API:', { zoneCode, typezone });
                  
                  // Get or create zoning using typezone (maps to zonings.code)
                  if (!zoningId && cityId) {
                    zoningId = await getOrCreateZoning(cityId, typezone, false);
                    console.log('[MAP_ARTIFACT_START] Zoning ID obtained:', zoningId);
                  }
                  
                  // Get or create zone using libelle (maps to zones.name)
                  if (!zoneId && zoningId) {
                    try {
                      zoneId = await getOrCreateZone(zoningId, zoneCode, zoneName, zoneGeometry);
                      console.log('[MAP_ARTIFACT_START] Zone ID obtained:', zoneId);
                      
                      // Update zoneData with the new IDs
                      setZoneData({ zoneId, zoningId, cityId, zoneLibelle: zoneCode });
                    } catch (zoneError) {
                      console.error('[MAP_ARTIFACT_START] Error creating zone:', zoneError);
                      // Zone not created, but geometry is set above
                    }
                  }
                }
              }
            } catch (error) {
              console.error('[MAP_ARTIFACT_START] Error fetching zone geometry:', error);
            }
          }
        }
      }
    }
    
    // Set map data with loading state
    if (lon !== undefined && lat !== undefined) {
      setMapData({
        lat,
        lon,
        zoneGeometry,
        isLoading: true,
      });
      console.log('[MAP_ARTIFACT_LOADING] Map data set with loading state');
    }
    
    // OPTIMIZATION: Reduced delay - only wait briefly for UI to update (200ms instead of 2000ms)
    // The 2-second delay was unnecessary and slowed down document retrieval
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('[MAP_ARTIFACT_LOADING] Loading delay completed');
    
    // Mark map as ready
    setEnrichmentStep('map_ready');
    setEnrichmentStatus('Carte chargée ✓');
    setMapData(prev => prev ? { ...prev, isLoading: false } : null);
    console.log('[MAP_ARTIFACT_READY] Map rendered with zone highlighted');
    setIntroStatus(prev => ({ ...prev, map: 'ready' }));
    
    // Update project with enriched data
    if (projectId && (cityId || zoneId)) {
      console.log('[ENRICHMENT] Updating project with enriched data');
      await supabase
        .from('v2_projects')
        .update({
          main_city_id: cityId,
          main_zone_id: zoneId,
        })
        .eq('id', projectId);
    }
    
    // Update research_history with enriched data if it exists
    if (researchId && (cityId || zoneId)) {
      console.log('[ENRICHMENT] Updating research_history with enriched data');
      await supabase
        .from('v2_research_history')
        .update({
          city_id: cityId,
          zone_id: zoneId,
        })
        .eq('id', researchId);
      
      // Reload research context
      const { data: updatedResearch } = await supabase
        .from('v2_research_history')
        .select('*')
        .eq('id', researchId)
        .single();
      
      if (updatedResearch) {
        setResearchContext(updatedResearch);
      }
    }
    
    // Mark enrichment as completed
    console.log('[ENRICHMENT] Marking enrichment as completed');
    await supabase
      .from('v2_conversations')
      .update({ enrichment_status: 'completed' })
      .eq('id', conv.id);
    
    // Complete the flow
    // Note: Document check and display was already done in Step 4, and municipality/document APIs were called in Step 5 if needed
    setEnrichmentStep('complete');
    setEnrichmentStatus('');
    setArtifactsLoading(false);
    console.log('[FLOW_COMPLETE] Enrichment process completed');
    } catch (error) {
      // Catch-all for any errors in the enrichment process
      console.error('[ENRICHMENT] Error in enrichConversationData:', error);
      
      // Mark enrichment as failed
      await supabase
        .from('v2_conversations')
        .update({ enrichment_status: 'failed' })
        .eq('id', conv.id);
      
      setEnrichmentStep('complete');
      setEnrichmentStatus('Erreur lors de l\'enrichissement');
      setArtifactsLoading(false);
    } finally {
      // Always reset the guard to allow future executions
      enrichmentInProgressRef.current = false;
      console.log('[ENRICHMENT] Enrichment process completed, guard reset');
    }
  };

  const handleSendMessage = async (content: string) => {
    console.log('[CHAT_MESSAGE] handleSendMessage called with content length:', content.length);
    
    if (!userId || !conversation || sendingMessage) {
      console.log('[CHAT_MESSAGE] Send blocked:', { hasUserId: !!userId, hasConversation: !!conversation, sendingMessage });
      return;
    }

    console.log('[CHAT_MESSAGE] Starting message send process');
    setSendingMessage(true);

    // Insert user message
    console.log('[CHAT_MESSAGE] Creating user message object');
    const userMessage: V2Message = {
      id: Date.now().toString(),
      conversation_id: params.conversation_id,
      user_id: userId,
      role: 'user',
      message: content,
      message_type: 'text',
      conversation_turn: messages.length + 1,
      referenced_documents: null,
      referenced_zones: null,
      referenced_cities: null,
      search_context: null,
      intent_detected: null,
      confidence_score: null,
      ai_model_used: null,
      reply_to_message_id: null,
      metadata: null,
      created_at: new Date().toISOString(),
    };

    console.log('[CHAT_MESSAGE] Adding user message to UI');
    setMessages((prev) => [...prev, userMessage]);

    try {
      console.log('[CHAT_MESSAGE] Constructing webhook payload');
      const webhookPayload: any = {
        new_conversation: isFirstMessage,
        message: content,
        user_id: userId,
        conversation_id: params.conversation_id,
        context_metadata: conversation.context_metadata,
      };

      if (researchContext?.geo_lon && researchContext?.geo_lat) {
        webhookPayload.gps_coordinates = [researchContext.geo_lon, researchContext.geo_lat];
        console.log('[CHAT_MESSAGE] Added GPS coordinates to payload');
      }

      if (researchContext?.documents_found && researchContext.documents_found.length > 0) {
        webhookPayload.document_ids = researchContext.documents_found;
        console.log('[CHAT_MESSAGE] Added document IDs to payload, count:', researchContext.documents_found.length);
      }

      if (researchContext?.geocoded_address) {
        webhookPayload.address = researchContext.geocoded_address;
        console.log('[CHAT_MESSAGE] Added address to payload');
      }

      console.log('[CHAT_MESSAGE] Calling chat API');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      console.log('[CHAT_MESSAGE] Chat API response status:', response.status);

      if (!response.ok) {
        console.error('[CHAT_MESSAGE] Chat API returned error status:', response.status);
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      console.log('[CHAT_MESSAGE] Chat API response received, message length:', data.message?.length || 0);

      const assistantMessage: V2Message = {
        id: (Date.now() + 1).toString(),
        conversation_id: params.conversation_id,
        user_id: userId,
        role: 'assistant',
        message: data.message,
        message_type: 'text',
        conversation_turn: messages.length + 2,
        referenced_documents: researchContext?.documents_found || null,
        referenced_zones: null,
        referenced_cities: null,
        search_context: null,
        intent_detected: null,
        confidence_score: null,
        ai_model_used: null,
        reply_to_message_id: null,
        metadata: null,
        created_at: new Date().toISOString(),
      };

      console.log('[CHAT_MESSAGE] Adding assistant message to UI');
      setMessages((prev) => [...prev, assistantMessage]);

      // Insert messages into database
      console.log('[CHAT_MESSAGE] Inserting messages into database');
      const { data: insertedMessages, error: insertError } = await supabase
        .from('v2_messages')
        .insert([
          {
            conversation_id: params.conversation_id,
            user_id: userId,
            role: 'user',
            message: content,
            conversation_turn: messages.length + 1,
          },
          {
            conversation_id: params.conversation_id,
            user_id: userId,
            role: 'assistant',
            message: data.message,
            conversation_turn: messages.length + 2,
            referenced_documents: researchContext?.documents_found || null,
          },
        ])
        .select();

      if (insertError) {
        console.error('[CHAT_MESSAGE] Error inserting messages:', insertError);
        throw insertError;
      }

      console.log('[CHAT_MESSAGE] Messages inserted successfully, count:', insertedMessages?.length || 0);

      // Update conversation
      console.log('[CHAT_MESSAGE] Updating conversation metadata');
      await supabase
        .from('v2_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          message_count: messages.length + 2,
        })
        .eq('id', params.conversation_id);

      // Log analytics events for both messages
      if (insertedMessages && insertedMessages.length >= 2) {
        console.log('[CHAT_MESSAGE] Logging analytics events');
        const [userMessage, assistantMessage] = insertedMessages;
        const documentId = getFirstDocumentId(researchContext?.documents_found);

        // Log user message event
        await logChatEvent({
          conversation_id: params.conversation_id,
          message_id: userMessage.id,
          user_id: userId,
          document_id: documentId,
          user_query_length: content.length,
          // query_intent could be enhanced with intent detection later
        });

        // Log assistant message event
        await logChatEvent({
          conversation_id: params.conversation_id,
          message_id: assistantMessage.id,
          user_id: userId,
          document_id: documentId,
          ai_response_length: data.message.length,
          // Note: model_name, tokens, costs, response_time would come from API response
          // These could be enhanced if the chat API returns them
        });
      }

      if (isFirstMessage) {
        console.log('[CHAT_MESSAGE] First message completed, setting isFirstMessage to false');
        setIsFirstMessage(false);
      }

      console.log('[CHAT_MESSAGE] Message send process completed successfully');
    } catch (error) {
      console.error('[CHAT_MESSAGE] Error sending message:', error);
      const errorMessage: V2Message = {
        id: (Date.now() + 1).toString(),
        conversation_id: params.conversation_id,
        user_id: userId || '',
        role: 'assistant',
        message: 'Désolé, une erreur est survenue. Veuillez réessayer.',
        message_type: 'text',
        conversation_turn: messages.length + 2,
        referenced_documents: null,
        referenced_zones: null,
        referenced_cities: null,
        search_context: null,
        intent_detected: null,
        confidence_score: null,
        ai_model_used: null,
        reply_to_message_id: null,
        metadata: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleNewConversation = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Chargement de la conversation...</div>
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <ChatLeftSidebar
        onNewConversation={handleNewConversation}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex-1 text-center">
            {conversation?.context_metadata?.initial_address && (
              <p className="text-sm text-gray-600 truncate">
                {conversation.context_metadata.initial_address}
              </p>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            {artifactsLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <div className="text-center space-y-3">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Préparation de votre analyse PLU
                  </h2>
                  <div className="space-y-2 text-sm text-gray-600">
                    {enrichmentStatus ? (
                      <div className="flex items-center justify-center gap-2">
                        <span>⏳ {enrichmentStatus}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-2">
                          <span>{introStatus.map === 'ready' ? '✓' : '⏳'} Chargement de la carte...</span>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span>
                            {introStatus.document === 'ready' ? '✓' : introStatus.document === 'loading' ? '⏳' : '•'} Préparation du document PLU...
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1">
                  <div className="max-w-4xl mx-auto py-6 space-y-6">
                    {messages.length === 0 && (introStatus.map === 'ready' || introStatus.document === 'ready') && (
                      <div data-testid="inline-artifact-intro" className="space-y-4 px-4">
                        <ChatMessageBubble role="assistant" content="Carte chargée ✅" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <InlineArtifactCard
                            testId="inline-artifact-card-map"
                            title="Carte cadastrale"
                            description="Visualisez la zone et les limites de la parcelle."
                            status={introStatus.map}
                            onOpen={() => {
                              setRightPanelOpen(true);
                              setActiveArtifactTab('map');
                            }}
                            kind="map"
                          />
                          <InlineArtifactCard
                            testId="inline-artifact-card-document"
                            title="Analyse PLU"
                            description={
                              introStatus.document === 'ready'
                                ? 'Consultez la synthèse et le document officiel.'
                                : 'Analyse en cours, nous préparons le document.'
                            }
                            status={introStatus.document}
                            onOpen={() => {
                              setRightPanelOpen(true);
                              setActiveArtifactTab('document');
                            }}
                            kind="document"
                          />
                        </div>
                      </div>
                    )}

                    {messages.length === 0 && introStatus.document === 'ready' ? (
                      <div className="text-center py-12 px-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Vos documents sont prêts !
                        </h3>
                        <p className="text-gray-600">
                          Posez votre première question sur le PLU de{' '}
                          {conversation?.context_metadata?.city || 'cette commune'}
                        </p>
                      </div>
                    ) : (
                      messages
                        .filter(msg => msg.role !== 'system')
                        .map((message) => (
                          <ChatMessageBubble
                            key={message.id}
                            role={message.role as 'user' | 'assistant'}
                            content={message.message}
                          />
                        ))
                    )}
                  </div>
                </ScrollArea>

                <ChatInputField
                  onSend={handleSendMessage}
                  disabled={
                    sendingMessage ||
                    artifactsLoading ||
                    introStatus.document !== 'ready'
                  }
                />
              </>
            )}
          </div>

          <ChatRightPanel 
            isOpen={rightPanelOpen} 
            onClose={() => setRightPanelOpen(false)}
            mapProps={mapData || undefined}
            activeTab={activeArtifactTab}
            onTabChange={(tab) => setActiveArtifactTab(tab)}
            documentHtml={documentData.htmlContent}
            mapStatus={getArtifactStatus(introStatus.map)}
            documentStatus={getArtifactStatus(introStatus.document)}
            onRetryMap={() => {
              console.log('[TODO Phase 5] Retry map loading');
            }}
            onRetryDocument={() => {
              console.log('[TODO Phase 5] Retry document loading');
            }}
          />
        </div>
      </div>
    </div>
  );
}
