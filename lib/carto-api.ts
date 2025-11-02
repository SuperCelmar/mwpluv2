import { CartoAPIResult, CartoZone, CartoDocument, CartoMunicipality } from './supabase';

/**
 * Fetch all Carto APIs for an address
 * Calls zone-urba, document, and municipality APIs from IGN
 */
export async function fetchCartoAPIs(params: {
  lon: number;
  lat: number;
  insee_code: string;
}): Promise<CartoAPIResult> {
  const { lon, lat, insee_code } = params;
  
  console.log('[API_CALL] fetchCartoAPIs called with params:', { lon, lat, insee_code });
  
  const result: CartoAPIResult = {
    zones: [],
    documents: [],
    municipality: null,
  };
  
  // Zone-Urba API - get zones at coordinates
  try {
    const zoneUrbaUrl = `https://apicarto.ign.fr/api/gpu/zone-urba?` +
      `geom=${encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))}`;
    console.log('[API_CALL] Starting Zone-Urba API request');
    console.log('[API_CALL] Zone-Urba API URL:', zoneUrbaUrl);
    
    const zoneUrbaResponse = await fetch(zoneUrbaUrl);
    
    console.log('[API_CALL] Zone-Urba API response status:', zoneUrbaResponse.status);
    
    if (zoneUrbaResponse.ok) {
      const zoneUrba = await zoneUrbaResponse.json();
      console.log('[API_CALL] Zone-Urba API response received');
      console.log('[API_CALL] Zone-Urba API response:', JSON.stringify(zoneUrba, null, 2));
      result.zones = zoneUrba.features || [];
      console.log('[API_CALL] Zone-Urba API zones count:', result.zones.length);
    } else {
      console.error('[API_CALL] Zone-Urba API returned error status:', zoneUrbaResponse.status);
    }
  } catch (error) {
    console.error('[API_CALL] Zone-Urba API error:', error);
  }

  // Document API - get PLU/POS documents for commune
  try {
    const documentUrl = `https://apicarto.ign.fr/api/gpu/document?code_insee=${insee_code}`;
    console.log('[API_CALL] Starting Document API request');
    console.log('[API_CALL] Document API URL:', documentUrl);
    console.log('[API_CALL] Document API INSEE code:', insee_code);
    
    const documentResponse = await fetch(documentUrl);
    
    console.log('[API_CALL] Document API response status:', documentResponse.status);
    
    if (documentResponse.ok) {
      const document = await documentResponse.json();
      console.log('[API_CALL] Document API response received');
      console.log('[API_CALL] Document API response:', JSON.stringify(document, null, 2));
      result.documents = document.features || [];
      console.log('[API_CALL] Document API documents count:', result.documents.length);
    } else {
      console.error('[API_CALL] Document API returned error status:', documentResponse.status);
    }
  } catch (error) {
    console.error('[API_CALL] Document API error:', error);
  }

  // Municipality API - get commune information (use 'insee' parameter, not 'code_insee')
  try {
    const municipalityUrl = `https://apicarto.ign.fr/api/gpu/municipality?insee=${insee_code}`;
    console.log('[API_CALL] Starting Municipality API request');
    console.log('[API_CALL] Municipality API URL:', municipalityUrl);
    console.log('[API_CALL] Municipality API INSEE code:', insee_code);
    
    const municipalityResponse = await fetch(municipalityUrl);
    
    console.log('[API_CALL] Municipality API response status:', municipalityResponse.status);
    
    if (municipalityResponse.ok) {
      const municipality = await municipalityResponse.json();
      console.log('[API_CALL] Municipality API response received');
      console.log('[API_CALL] Municipality API response:', JSON.stringify(municipality, null, 2));
      result.municipality = municipality.features?.[0] || null;
      if (result.municipality) {
        console.log('[API_CALL] Municipality API municipality found:', result.municipality.properties?.name);
      } else {
        console.log('[API_CALL] Municipality API no municipality found in response');
      }
    } else {
      console.error('[API_CALL] Municipality API returned error status:', municipalityResponse.status);
    }
  } catch (error) {
    console.error('[API_CALL] Municipality API error:', error);
  }
  
  console.log('[API_CALL] fetchCartoAPIs completed, result summary:', {
    zonesCount: result.zones.length,
    documentsCount: result.documents.length,
    hasMunicipality: result.municipality !== null,
  });
  
  return result;
}

/**
 * Fetch only zone data from zone-urba API
 */
export async function fetchZones(params: {
  lon: number;
  lat: number;
}): Promise<CartoZone[]> {
  const { lon, lat } = params;
  
  const url = `https://apicarto.ign.fr/api/gpu/zone-urba?` +
    `geom=${encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))}`;
  
  console.log('[API_CALL] fetchZones called with params:', { lon, lat });
  console.log('[API_CALL] fetchZones API URL:', url);
  
  const response = await fetch(url);
  
  console.log('[API_CALL] fetchZones response status:', response.status);
  
  if (!response.ok) {
    console.error('[API_CALL] fetchZones API returned error status:', response.status);
    throw new Error(`Zone-Urba API error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('[API_CALL] fetchZones JSON response:', JSON.stringify(data, null, 2));
  const zones = data.features || [];
  console.log('[API_CALL] fetchZones completed, zones count:', zones.length);
  
  return zones;
}

/**
 * Fetch zones with flexible parameters (lon/lat or insee_code)
 */
export async function fetchZoneUrba(params: {
  lon?: number;
  lat?: number;
  insee_code?: string;
}): Promise<CartoZone[]> {
  const { lon, lat, insee_code } = params;
  
  console.log('[API_CALL] fetchZoneUrba called with params:', { lon, lat, insee_code });
  
  let url = 'https://apicarto.ign.fr/api/gpu/zone-urba?';
  
  if (lon !== undefined && lat !== undefined) {
    url += `geom=${encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))}`;
    console.log('[API_CALL] fetchZoneUrba using coordinates:', { lon, lat });
  } else if (insee_code) {
    url += `code_insee=${insee_code}`;
    console.log('[API_CALL] fetchZoneUrba using INSEE code:', insee_code);
  } else {
    console.error('[API_CALL] fetchZoneUrba error: Must provide either lon/lat or insee_code');
    throw new Error('Must provide either lon/lat or insee_code');
  }
  
  console.log('[API_CALL] fetchZoneUrba API URL:', url);
  
  const response = await fetch(url);
  
  console.log('[API_CALL] fetchZoneUrba response status:', response.status);
  
  if (!response.ok) {
    console.error('[API_CALL] fetchZoneUrba API returned error status:', response.status);
    throw new Error(`Zone-Urba API error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('[API_CALL] fetchZoneUrba JSON response:', JSON.stringify(data, null, 2));
  const zones = data.features || [];
  console.log('[API_CALL] fetchZoneUrba completed, zones count:', zones.length);
  
  return zones;
}

/**
 * Fetch only documents from document API
 */
export async function fetchDocuments(insee_code: string): Promise<CartoDocument[]> {
  const url = `https://apicarto.ign.fr/api/gpu/document?code_insee=${insee_code}`;
  
  console.log('[API_CALL] fetchDocuments called with INSEE code:', insee_code);
  console.log('[API_CALL] fetchDocuments API URL:', url);
  
  const response = await fetch(url);
  
  console.log('[API_CALL] fetchDocuments response status:', response.status);
  
  if (!response.ok) {
    console.error('[API_CALL] fetchDocuments API returned error status:', response.status);
    throw new Error(`Document API error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('[API_CALL] fetchDocuments JSON response:', JSON.stringify(data, null, 2));
  const documents = data.features || [];
  console.log('[API_CALL] fetchDocuments completed, documents count:', documents.length);
  
  return documents;
}

/**
 * Fetch documents with flexible parameters
 */
export async function fetchDocument(params: {
  insee_code: string;
}): Promise<CartoDocument[]> {
  console.log('[API_CALL] fetchDocument called with params:', params);
  return fetchDocuments(params.insee_code);
}

/**
 * Fetch municipality information from municipality API
 * Overloaded to support both string and object parameters
 */
export async function fetchMunicipality(params: {
  lon?: number;
  lat?: number;
  insee_code?: string;
}): Promise<CartoMunicipality | null>;
export async function fetchMunicipality(insee_code: string): Promise<CartoMunicipality | null>;
export async function fetchMunicipality(
  paramsOrCode: string | { lon?: number; lat?: number; insee_code?: string }
): Promise<CartoMunicipality | null> {
  let insee_code: string | undefined;
  let lon: number | undefined;
  let lat: number | undefined;
  
  console.log('[API_CALL] fetchMunicipality called with:', typeof paramsOrCode === 'string' ? paramsOrCode : paramsOrCode);
  
  if (typeof paramsOrCode === 'string') {
    insee_code = paramsOrCode;
    console.log('[API_CALL] fetchMunicipality using INSEE code (string):', insee_code);
  } else {
    insee_code = paramsOrCode.insee_code;
    lon = paramsOrCode.lon;
    lat = paramsOrCode.lat;
    console.log('[API_CALL] fetchMunicipality using params:', { insee_code, lon, lat });
  }
  
  if (insee_code) {
    const url = `https://apicarto.ign.fr/api/gpu/municipality?insee=${insee_code}`;
    console.log('[API_CALL] fetchMunicipality API URL (INSEE):', url);
    
    const response = await fetch(url);
    
    console.log('[API_CALL] fetchMunicipality response status (INSEE):', response.status);
    
    if (!response.ok) {
      console.error('[API_CALL] fetchMunicipality API returned error status:', response.status);
      throw new Error(`Municipality API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[API_CALL] fetchMunicipality JSON response (INSEE):', JSON.stringify(data, null, 2));
    const municipality = data.features?.[0] || null;
    
    if (municipality) {
      console.log('[API_CALL] fetchMunicipality completed, municipality found:', municipality.properties?.name);
    } else {
      console.log('[API_CALL] fetchMunicipality completed, no municipality found');
    }
    
    return municipality;
  } else if (lon !== undefined && lat !== undefined) {
    // Municipality API also supports geom parameter
    const url = `https://apicarto.ign.fr/api/gpu/municipality?` +
      `geom=${encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))}`;
    console.log('[API_CALL] fetchMunicipality API URL (coordinates):', url);
    console.log('[API_CALL] fetchMunicipality using coordinates:', { lon, lat });
    
    const response = await fetch(url);
    
    console.log('[API_CALL] fetchMunicipality response status (coordinates):', response.status);
    
    if (!response.ok) {
      console.log('[API_CALL] fetchMunicipality API returned error status (coordinates), returning null:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('[API_CALL] fetchMunicipality JSON response (coordinates):', JSON.stringify(data, null, 2));
    const municipality = data.features?.[0] || null;
    
    if (municipality) {
      console.log('[API_CALL] fetchMunicipality completed (coordinates), municipality found:', municipality.properties?.name);
    } else {
      console.log('[API_CALL] fetchMunicipality completed (coordinates), no municipality found');
    }
    
    return municipality;
  } else {
    console.error('[API_CALL] fetchMunicipality error: Must provide either lon/lat or insee_code');
    throw new Error('Must provide either lon/lat or insee_code');
  }
}
