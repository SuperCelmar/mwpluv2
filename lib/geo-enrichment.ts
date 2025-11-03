import { supabase } from './supabase';
import { CartoAPIResult } from './supabase';

/**
 * Enrich research_history with zone and document information from Carto API data
 * Dynamically creates cities, zonings, and zones if they don't exist
 */
export async function enrichResearchWithGeoData(
  researchId: string,
  cartoData: CartoAPIResult
): Promise<void> {
  console.log('[ENRICHMENT] enrichResearchWithGeoData called');
  console.log('[ENRICHMENT] Research ID:', researchId);
  console.log('[ENRICHMENT] Carto data summary:', {
    hasMunicipality: cartoData.municipality !== null,
    zonesCount: cartoData.zones.length,
    documentsCount: cartoData.documents.length,
  });

  if (!cartoData.municipality) {
    console.warn('[ENRICHMENT] No municipality data from Carto API, skipping enrichment');
    return;
  }

  const municipality = cartoData.municipality;
  const inseeCode = municipality.properties.insee;
  const communeName = municipality.properties.name.toLowerCase();
  console.log('[ENRICHMENT] Municipality data extracted:', { inseeCode, communeName });

  // 1. Get or create city
  console.log('[ENRICHMENT] Step 1: Getting or creating city');
  let cityId = await getOrCreateCity(inseeCode, communeName);
  console.log('[ENRICHMENT] Step 1 completed, city_id:', cityId);

  // Check if address is in RNU zone
  const isRnu = municipality.properties.is_rnu === true || 
                cartoData.documents.some(doc => doc.properties.is_rnu === true);
  console.log('[ENRICHMENT] RNU detection:', { isRnu, fromMunicipality: municipality.properties.is_rnu === true });

  // 2. Process first zone (if available)
  console.log('[ENRICHMENT] Step 2: Processing zones');
  let zoneId: string | null = null;
  let zoningId: string | null = null;
  
  if (cartoData.zones.length > 0) {
    console.log('[ENRICHMENT] Zones found, processing first zone');
    const firstZone = cartoData.zones[0];
    const zoneCode = firstZone.properties.libelle;  // Zone code from Carto API
    const zoneName = firstZone.properties.libelong || firstZone.properties.libelle;  // Full name or code as fallback
    const typezone = firstZone.properties.typezone;  // Zone type (U, A, N, etc.)
    console.log('[ENRICHMENT] Zone data:', { zoneCode, zoneName, typezone });

    // Get or create zoning for this city using typezone or RNU
    console.log('[ENRICHMENT] Getting or creating zoning');
    zoningId = await getOrCreateZoning(cityId, typezone, isRnu);
    console.log('[ENRICHMENT] Zoning ID:', zoningId);

    // Get or create zone
    console.log('[ENRICHMENT] Getting or creating zone');
    const zoneGeometry = firstZone.geometry;
    zoneId = await getOrCreateZone(zoningId, zoneCode, zoneName, zoneGeometry);
    console.log('[ENRICHMENT] Zone ID:', zoneId);
  } else if (isRnu) {
    console.log('[ENRICHMENT] No zones found, but RNU detected, creating RNU zoning');
    // Even if no zones found, if it's RNU, create RNU zoning
    zoningId = await getOrCreateZoning(cityId, undefined, true);
    console.log('[ENRICHMENT] RNU zoning ID:', zoningId);
    // No zone ID in RNU case since there are no specific zones
  } else {
    console.log('[ENRICHMENT] No zones found and not RNU');
  }

  // 3. Extract document IDs from Carto data (if documents table has these)
  // For now, we'll store them as JSON in research_history
  const documentIds: string[] = [];
  console.log('[ENRICHMENT] Step 3: Document IDs extracted:', documentIds.length);

  // 4. Update research_history with enriched data
  console.log('[ENRICHMENT] Step 4: Updating research_history with enriched data');
  console.log('[ENRICHMENT] Update data:', {
    research_id: researchId,
    city_id: cityId,
    zone_id: zoneId,
    geocoded_address: communeName,
  });

  const { error: updateError } = await supabase
    .from('v2_research_history')
    .update({
      city_id: cityId,
      zone_id: zoneId,
      geocoded_address: communeName,
    })
    .eq('id', researchId);

  if (updateError) {
    console.error('[ENRICHMENT] Failed to update research history:', updateError);
  } else {
    console.log('[ENRICHMENT] enrichResearchWithGeoData completed successfully');
  }
}

/**
 * Get city by INSEE code, or create it if it doesn't exist
 * Smart lookup: tries INSEE code first, falls back to name, updates missing INSEE codes
 */
export async function getOrCreateCity(inseeCode: string, communeName: string): Promise<string> {
  console.log('[ENRICHMENT] getOrCreateCity called:', { inseeCode, communeName });

  // 1. Try to find by INSEE code first (most efficient)
  console.log('[ENRICHMENT] Step 1: Looking up city by INSEE code');
  const { data: cityByInsee } = await supabase
    .from('cities')
    .select('id, insee_code')
    .eq('insee_code', inseeCode)
    .maybeSingle();

  if (cityByInsee) {
    console.log('[ENRICHMENT] City found by INSEE code, city_id:', cityByInsee.id);
    return cityByInsee.id;
  }

  console.log('[ENRICHMENT] City not found by INSEE code, trying name lookup');

  // 2. Fall back to finding by name (catches legacy cities) - case-insensitive lookup
  console.log('[ENRICHMENT] Step 2: Looking up city by name');
  const { data: cityByName } = await supabase
    .from('cities')
    .select('id, insee_code, name')
    .ilike('name', communeName)
    .maybeSingle();

  if (cityByName) {
    console.log('[ENRICHMENT] City found by name, city_id:', cityByName.id);
    // 3. If found by name but missing INSEE code or name not in lowercase, update it
    const updates: { insee_code?: string; name?: string } = {};
    if (!cityByName.insee_code) {
      updates.insee_code = inseeCode;
    }
    // Ensure name is stored in lowercase
    if (cityByName.name && cityByName.name !== cityByName.name.toLowerCase()) {
      updates.name = communeName; // Already lowercased
    }
    if (Object.keys(updates).length > 0) {
      console.log('[ENRICHMENT] Updating city with missing data:', updates);
      const { error: updateError } = await supabase
        .from('cities')
        .update(updates)
        .eq('id', cityByName.id);
      
      if (updateError) {
        console.error('[ENRICHMENT] Error updating city:', updateError);
        // Don't throw - continue with existing city ID even if update fails
      } else {
        console.log('[ENRICHMENT] Updated city', cityByName.id, 'with:', updates);
      }
    }
    return cityByName.id;
  }

  console.log('[ENRICHMENT] City not found by name, creating new city');

  // 4. If not found at all, create new city with both fields (name always in lowercase)
  console.log('[ENRICHMENT] Step 3: Creating new city');
  console.log('[ENRICHMENT] New city data:', {
    insee_code: inseeCode,
    name: communeName.toLowerCase(),
  });

  const { data: newCity, error } = await supabase
    .from('cities')
    .insert({
      insee_code: inseeCode,
      name: communeName.toLowerCase(), // Ensure lowercase
    })
    .select('id')
    .single();

  if (error) {
    // Handle duplicate key error (race condition from parallel operations)
    if (error.code === '23505') {
      console.log('[ENRICHMENT] City already exists (duplicate key), retrying lookup');
      // Retry lookup by INSEE code (most reliable)
      const { data: existingCity } = await supabase
        .from('cities')
        .select('id')
        .eq('insee_code', inseeCode)
        .maybeSingle();
      
      if (existingCity) {
        console.log('[ENRICHMENT] Found existing city after duplicate key error, city_id:', existingCity.id);
        return existingCity.id;
      }
      
      // Fallback: try name lookup
      const { data: existingCityByName } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', communeName.toLowerCase())
        .maybeSingle();
      
      if (existingCityByName) {
        console.log('[ENRICHMENT] Found existing city by name after duplicate key error, city_id:', existingCityByName.id);
        return existingCityByName.id;
      }
    }
    
    console.error('[ENRICHMENT] Error creating city:', error);
    throw error;
  }

  console.log('[ENRICHMENT] New city created successfully, city_id:', newCity!.id);
  return newCity!.id;
}

/**
 * Map Carto API typezone values to French zoning names
 */
export function mapTypezoneToZoningName(typezone: string | undefined): string {
  if (!typezone) {
    return 'zone specific';
  }

  const typezoneUpper = typezone.toUpperCase();
  
  // Map common zone types to French names
  const mapping: Record<string, string> = {
    'U': 'Zones Urbaines',
    'AU': 'Zones À Urbaniser',
    'A': 'Zones Agricoles',
    'N': 'Zones Naturelles et Forestières',
    'E': 'zone naturelle environnementale',
  };

  return mapping[typezoneUpper] || 'Zones Spécifiques';
}

/**
 * Get or create zoning for a city
 * Uses typezone from Carto API to map to zonings.code, or RNU if applicable
 */
export async function getOrCreateZoning(cityId: string, typezone?: string, isRnu: boolean = false): Promise<string> {
  console.log('[ENRICHMENT] getOrCreateZoning called:', { cityId, typezone, isRnu });

  // Determine code and name
  let zoningCode: string | null = null;
  let zoningName: string;
  
  if (isRnu) {
    zoningCode = 'RNU';
    zoningName = 'RNU';
  } else if (typezone) {
    // Use typezone directly as code (U, AU, N, A, etc.)
    zoningCode = typezone.toUpperCase();
    // Map code to full name for display
    zoningName = mapTypezoneToZoningName(typezone);
  } else {
    // Fallback: no code, just use name
    zoningName = mapTypezoneToZoningName(typezone);
  }

  console.log('[ENRICHMENT] Zoning code and name determined:', { code: zoningCode, name: zoningName });

  // Check if zoning exists by code (if we have one) and city_id
  // This is the key change: lookup by code instead of name
  console.log('[ENRICHMENT] Looking up existing zoning');
  let query = supabase
    .from('zonings')
    .select('id')
    .eq('city_id', cityId);
  
  if (zoningCode) {
    // Look up by code first (preferred method) - case-sensitive match required
    query = query.eq('code', zoningCode);
  } else {
    // Fallback to name if no code (case-insensitive)
    query = query.ilike('name', zoningName);
  }
  
  const { data: existingZoning } = await query.maybeSingle();

  if (existingZoning) {
    console.log('[ENRICHMENT] Existing zoning found, zoning_id:', existingZoning.id);
    
    // Update code if it's missing and we have one
    if (zoningCode) {
      const { error: updateError } = await supabase
        .from('zonings')
        .update({ code: zoningCode })
        .eq('id', existingZoning.id)
        .is('code', null);
      
      if (updateError) {
        console.warn('[ENRICHMENT] Failed to update zoning code:', updateError);
      } else {
        console.log('[ENRICHMENT] Updated zoning code to:', zoningCode);
      }
    }
    
    return existingZoning.id;
  }

  // Create new zoning with both code and name
  console.log('[ENRICHMENT] Creating new zoning');
  const description = isRnu 
    ? `Règlement National d'Urbanisme` 
    : `Plan Local d'Urbanisme`;
  console.log('[ENRICHMENT] New zoning data:', {
    city_id: cityId,
    code: zoningCode,
    name: zoningName,
    description,
  });
    
  const { data: newZoning, error } = await supabase
    .from('zonings')
    .insert({
      city_id: cityId,
      code: zoningCode,
      name: zoningName,
      description: description,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ENRICHMENT] Error creating zoning:', error);
    throw error;
  }

  console.log('[ENRICHMENT] New zoning created successfully, zoning_id:', newZoning!.id);
  return newZoning!.id;
}

/**
 * Get or create zone within a zoning
 */
export async function getOrCreateZone(
  zoningId: string,
  zoneCode: string,
  zoneName: string,
  geometry?: any
): Promise<string> {
  console.log('[ENRICHMENT] getOrCreateZone called:', { zoningId, zoneCode, zoneName, hasGeometry: !!geometry });

  // Check if zone exists by code within this zoning (case-insensitive)
  console.log('[ENRICHMENT] Looking up existing zone');
  const { data: existingZone } = await supabase
    .from('zones')
    .select('id, geometry')
    .eq('zoning_id', zoningId)
    .ilike('name', zoneCode)
    .maybeSingle();

  if (existingZone) {
    console.log('[ENRICHMENT] Existing zone found, zone_id:', existingZone.id);
    
    // Update geometry if provided and not already set
    if (geometry && !existingZone.geometry) {
      console.log('[ENRICHMENT] Updating zone geometry');
      const { error: updateError } = await supabase
        .from('zones')
        .update({ geometry })
        .eq('id', existingZone.id);
      
      if (updateError) {
        console.error('[ENRICHMENT] Error updating zone geometry:', updateError);
      } else {
        console.log('[ENRICHMENT] Zone geometry updated successfully');
      }
    }
    
    return existingZone.id;
  }

  // Create new zone
  console.log('[ENRICHMENT] Creating new zone');
  console.log('[ENRICHMENT] New zone data:', {
    zoning_id: zoningId,
    name: zoneCode,
    description: zoneName,
    zones_constructibles: true,
    hasGeometry: !!geometry,
  });

  const { data: newZone, error } = await supabase
    .from('zones')
    .insert({
      zoning_id: zoningId,
      name: zoneCode,
      description: zoneName,
      zones_constructibles: true, // Default, can be adjusted based on zone type
      geometry: geometry || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ENRICHMENT] Error creating zone:', error);
    throw error;
  }

  console.log('[ENRICHMENT] New zone created successfully, zone_id:', newZone!.id);
  return newZone!.id;
}

/**
 * Check for existing research history with matching user_id, city_id, and zone_id
 * Returns conversation_id if a duplicate is found, null otherwise
 */
export async function checkExistingResearch(
  userId: string,
  cityId: string,
  zoneId: string | null
): Promise<string | null> {
  console.log('[ENRICHMENT] checkExistingResearch called:', { userId, cityId, zoneId });

  // Build query - must match user_id, city_id, and zone_id if provided
  let query = supabase
    .from('v2_research_history')
    .select('conversation_id, id, created_at')
    .eq('user_id', userId)
    .eq('city_id', cityId);

  // If zone_id is null, we should still check (maybe edge case)
  // If zone_id is provided, match it
  if (zoneId !== null) {
    query = query.eq('zone_id', zoneId);
  } else {
    // For cases where zone_id is null, check for null zone_id
    query = query.is('zone_id', null);
  }

  const { data: existingResearch, error } = await query
    .not('conversation_id', 'is', null) // Only return records with a conversation_id
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[ENRICHMENT] Error checking existing research:', error);
    return null;
  }

  if (existingResearch && existingResearch.length > 0) {
    const found = existingResearch[0];
    console.log('[ENRICHMENT] Existing research found, conversation_id:', found.conversation_id, 'research_id:', found.id);
    return found.conversation_id;
  }

  console.log('[ENRICHMENT] No existing research found for user, city, and zone');
  return null;
}
