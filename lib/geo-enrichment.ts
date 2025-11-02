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
  if (!cartoData.municipality) {
    console.warn('No municipality data from Carto API, skipping enrichment');
    return;
  }

  const municipality = cartoData.municipality;
  const inseeCode = municipality.properties.insee;
  const communeName = municipality.properties.name;

  // 1. Get or create city
  let cityId = await getOrCreateCity(inseeCode, communeName);

  // 2. Process first zone (if available)
  let zoneId: string | null = null;
  
  if (cartoData.zones.length > 0) {
    const firstZone = cartoData.zones[0];
    const zoneCode = firstZone.properties.libelle;  // Zone code from Carto API
    const zoneName = firstZone.properties.libelong || firstZone.properties.libelle;  // Full name or code as fallback

    // Get or create zoning for this city
    const zoningId = await getOrCreateZoning(cityId, zoneCode);

    // Get or create zone
    zoneId = await getOrCreateZone(zoningId, zoneCode, zoneName);
  }

  // 3. Extract document IDs from Carto data (if documents table has these)
  // For now, we'll store them as JSON in research_history
  const documentIds: string[] = [];

  // 4. Update research_history with enriched data
  await supabase
    .from('v2_research_history')
    .update({
      city_id: cityId,
      zone_id: zoneId,
      geocoded_address: communeName,
    })
    .eq('id', researchId);
}

/**
 * Get city by INSEE code, or create it if it doesn't exist
 */
async function getOrCreateCity(inseeCode: string, communeName: string): Promise<string> {
  // Check if city exists
  const { data: existingCity } = await supabase
    .from('cities')
    .select('id')
    .eq('id', inseeCode) // Assuming INSEE code is the city ID
    .maybeSingle();

  if (existingCity) {
    return existingCity.id;
  }

  // Create new city
  const { data: newCity, error } = await supabase
    .from('cities')
    .insert({
      id: inseeCode,
      name: communeName,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating city:', error);
    throw error;
  }

  return newCity!.id;
}

/**
 * Get or create zoning for a city
 */
async function getOrCreateZoning(cityId: string, zoneCode: string): Promise<string> {
  // For simplicity, assume one zoning per city (can be enhanced later)
  const zoningName = `PLU ${cityId}`;

  // Check if zoning exists
  const { data: existingZoning } = await supabase
    .from('zonings')
    .select('id')
    .eq('city_id', cityId)
    .maybeSingle();

  if (existingZoning) {
    return existingZoning.id;
  }

  // Create new zoning
  const { data: newZoning, error } = await supabase
    .from('zonings')
    .insert({
      city_id: cityId,
      name: zoningName,
      description: `Plan Local d'Urbanisme`,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating zoning:', error);
    throw error;
  }

  return newZoning!.id;
}

/**
 * Get or create zone within a zoning
 */
async function getOrCreateZone(
  zoningId: string,
  zoneCode: string,
  zoneName: string
): Promise<string> {
  // Check if zone exists by code within this zoning
  const { data: existingZone } = await supabase
    .from('zones')
    .select('id')
    .eq('zoning_id', zoningId)
    .eq('name', zoneCode)
    .maybeSingle();

  if (existingZone) {
    return existingZone.id;
  }

  // Create new zone
  const { data: newZone, error } = await supabase
    .from('zones')
    .insert({
      zoning_id: zoningId,
      name: zoneCode,
      description: zoneName,
      zones_constructibles: true, // Default, can be adjusted based on zone type
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating zone:', error);
    throw error;
  }

  return newZone!.id;
}
