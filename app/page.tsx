'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { InitialAddressInput } from '@/components/InitialAddressInput';
import { ChatLeftSidebar } from '@/components/ChatLeftSidebar';
import { AddressSuggestion } from '@/lib/address-api';
import { fetchMunicipality, fetchZoneUrba } from '@/lib/carto-api';
import { getOrCreateCity, getOrCreateZoning, getOrCreateZone, checkExistingResearch } from '@/lib/geo-enrichment';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUserId(user.id);
    setLoading(false);
  };

  const handleAddressSubmit = async (address: AddressSuggestion) => {
    console.log('[ADDRESS_SUBMIT_HANDLER] Address submit handler called with address:', {
      label: address.properties.label,
      city: address.properties.city,
      citycode: address.properties.citycode,
      coordinates: address.geometry?.coordinates,
    });

    if (!userId) {
      console.error('[ADDRESS_SUBMIT_HANDLER] Error: User ID validation failed - no userId');
      return;
    }

    console.log('[ADDRESS_SUBMIT_HANDLER] User ID validated:', userId);
    setSendingMessage(true);
    const addressLabel = address.properties.label;
    const inseeCode = address.properties.citycode;
    const lon = address.geometry?.coordinates?.[0];
    const lat = address.geometry?.coordinates?.[1];

    try {
      // Step 1: Call Carto Municipality API to get zone and zoning info
      console.log('[API_CALL] Step 1: Fetching municipality data');
      let municipality = null;
      try {
        municipality = await fetchMunicipality({ insee_code: inseeCode });
        if (municipality) {
          console.log('[API_CALL] Municipality fetched successfully:', municipality.properties?.name);
        } else {
          console.warn('[API_CALL] Municipality API returned no data');
        }
      } catch (error) {
        console.error('[API_CALL] Error fetching municipality:', error);
      }

      // Step 2: Call Carto Zone-Urba API to get zones
      console.log('[API_CALL] Step 2: Fetching zones data');
      let zones: any[] = [];
      let isRnu = false;
      if (lon !== undefined && lat !== undefined) {
        try {
          zones = await fetchZoneUrba({ lon, lat });
          console.log('[API_CALL] Zones fetched successfully, count:', zones.length);
        } catch (error) {
          console.error('[API_CALL] Error fetching zones:', error);
        }
      }

      // Determine RNU status
      if (municipality) {
        isRnu = municipality.properties.is_rnu === true;
      }

      // Step 3: Enrich database - get or create city, zoning, zone
      console.log('[DB_ENRICHMENT] Step 3: Enriching database with city, zoning, zone');
      let cityId: string | null = null;
      let zoneId: string | null = null;
      let zoningId: string | null = null;

      if (municipality) {
        const communeName = municipality.properties.name.toLowerCase();
        const municipalityInseeCode = municipality.properties.insee || inseeCode || '';
        
        // Get or create city
        if (municipalityInseeCode) {
          cityId = await getOrCreateCity(municipalityInseeCode, communeName);
          console.log('[DB_ENRICHMENT] City ID obtained:', cityId);
        }

        // Process zones if available
        if (cityId && zones.length > 0) {
          const firstZone = zones[0];
          const zoneCode = firstZone.properties.libelle;
          const zoneName = firstZone.properties.libelong || firstZone.properties.libelle;
          const typezone = firstZone.properties.typezone;

          // Get or create zoning
          zoningId = await getOrCreateZoning(cityId, typezone, isRnu);
          console.log('[DB_ENRICHMENT] Zoning ID obtained:', zoningId);

          // Get or create zone
          const zoneGeometry = firstZone.geometry;
          zoneId = await getOrCreateZone(zoningId, zoneCode, zoneName, zoneGeometry);
          console.log('[DB_ENRICHMENT] Zone ID obtained:', zoneId);
        } else if (cityId && isRnu) {
          // RNU case - create RNU zoning but no specific zone
          zoningId = await getOrCreateZoning(cityId, undefined, true);
          console.log('[DB_ENRICHMENT] RNU zoning created, zoning_id:', zoningId);
        }
      } else {
        // Fallback: use address properties to get or create city
        if (inseeCode) {
          const communeName = address.properties.city.toLowerCase();
          cityId = await getOrCreateCity(inseeCode, communeName);
          console.log('[DB_ENRICHMENT] City ID obtained (fallback):', cityId);
        }
      }

      // Step 4: Check for existing research with same user_id, city_id, and zoning_id
      console.log('[DUPLICATE_CHECK] Step 4: Checking for existing research');
      if (cityId) {
        const existingConversationId = await checkExistingResearch(userId, cityId, zoningId);
        
        if (existingConversationId) {
          console.log('[DUPLICATE_CHECK] Existing conversation found, navigating to:', existingConversationId);
          setSendingMessage(false);
          router.push(`/chat/${existingConversationId}`);
          return;
        }
      }

      console.log('[DUPLICATE_CHECK] No existing research found, creating new records');

      // Step 5: Create new research history
      console.log('[DB_INSERT] Step 5: Creating research history');
      const { data: research, error: historyError } = await supabase
        .from('v2_research_history')
        .insert({
          user_id: userId,
          address_input: addressLabel,
          geo_lon: lon || null,
          geo_lat: lat || null,
          city_id: cityId,
          zoning_id: zoningId,
          geocoded_address: municipality?.properties.name.toLowerCase() || address.properties.city.toLowerCase(),
          success: true,
        })
        .select()
        .single();

      if (historyError || !research) {
        console.error('[DB_INSERT] Error saving research history:', historyError);
        setSendingMessage(false);
        return;
      }

      console.log('[DB_INSERT] Research history created successfully, research_id:', research.id);

      // Step 6: Create project
      console.log('[DB_INSERT] Step 6: Creating project');
      const { data: project, error: projectError } = await supabase
        .from('v2_projects')
        .insert({
          user_id: userId,
          status: 'draft',
          main_address: addressLabel,
          main_city_id: cityId,
          main_zone_id: zoneId,
          geo_lon: lon || null,
          geo_lat: lat || null,
        })
        .select()
        .single();

      if (projectError || !project) {
        console.error('[DB_INSERT] Error creating project:', projectError);
        setSendingMessage(false);
        return;
      }

      console.log('[DB_INSERT] Project created successfully, project_id:', project.id);

      // Step 7: Create conversation
      console.log('[DB_INSERT] Step 7: Creating conversation');
      const defaultTitle = `${address.properties.city}_${address.properties.name}`;
      const { data: conversation, error: conversationError } = await supabase
        .from('v2_conversations')
        .insert({
          user_id: userId,
          project_id: project.id,
          conversation_type: 'address_analysis',
          title: defaultTitle,
          context_metadata: {
            initial_address: addressLabel,
            geocoded: {
              lon: lon || null,
              lat: lat || null,
            },
            city: address.properties.city,
            insee_code: inseeCode,
          },
          is_active: true,
        })
        .select()
        .single();

      if (conversationError || !conversation) {
        console.error('[DB_INSERT] Error creating conversation:', conversationError);
        setSendingMessage(false);
        return;
      }

      console.log('[DB_INSERT] Conversation created successfully, conversation_id:', conversation.id);

      // Step 8: Update research with conversation and project IDs
      console.log('[DB_UPDATE] Step 8: Updating research history with conversation and project IDs');
      const { error: updateError } = await supabase
        .from('v2_research_history')
        .update({
          conversation_id: conversation.id,
          project_id: project.id,
        })
        .eq('id', research.id);

      if (updateError) {
        console.error('[DB_UPDATE] Failed to link conversation/project to research:', updateError);
      } else {
        console.log('[DB_UPDATE] Research history updated successfully');
      }

      // Step 9: Navigate to new conversation
      console.log('[NAVIGATION] Navigating to new chat page:', `/chat/${conversation.id}`);
      setSendingMessage(false);
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      console.error('[ERROR] Error in address submit handler:', error);
      setSendingMessage(false);
    }
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  const handleNewConversation = () => {
    // Already on home page, no action needed
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <ChatLeftSidebar
        onNewConversation={handleNewConversation}
      />
      <div className="flex-1 flex items-center justify-center">
        <InitialAddressInput
          onAddressSubmit={handleAddressSubmit}
          disabled={sendingMessage}
        />
      </div>
    </div>
  );
}
