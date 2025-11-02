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
  
  const result: CartoAPIResult = {
    zones: [],
    documents: [],
    municipality: null,
  };
  
  // Zone-Urba API - get zones at coordinates
  try {
    const zoneUrbaResponse = await fetch(
      `https://apicarto.ign.fr/api/gpu/zone-urba?` +
      `geom=${encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))}`
    );
    
    if (zoneUrbaResponse.ok) {
      const zoneUrba = await zoneUrbaResponse.json();
      result.zones = zoneUrba.features || [];
    }
  } catch (error) {
    console.error('Zone-Urba API error:', error);
  }

  // Document API - get PLU/POS documents for commune
  try {
    const documentResponse = await fetch(
      `https://apicarto.ign.fr/api/gpu/document?code_insee=${insee_code}`
    );
    
    if (documentResponse.ok) {
      const document = await documentResponse.json();
      result.documents = document.features || [];
    }
  } catch (error) {
    console.error('Document API error:', error);
  }

  // Municipality API - get commune information (use 'insee' parameter, not 'code_insee')
  try {
    const municipalityResponse = await fetch(
      `https://apicarto.ign.fr/api/gpu/municipality?insee=${insee_code}`
    );
    
    if (municipalityResponse.ok) {
      const municipality = await municipalityResponse.json();
      result.municipality = municipality.features?.[0] || null;
    }
  } catch (error) {
    console.error('Municipality API error:', error);
  }
  
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
  
  const response = await fetch(
    `https://apicarto.ign.fr/api/gpu/zone-urba?` +
    `geom=${encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))}`
  );
  
  if (!response.ok) {
    throw new Error(`Zone-Urba API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.features || [];
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
  
  let url = 'https://apicarto.ign.fr/api/gpu/zone-urba?';
  
  if (lon !== undefined && lat !== undefined) {
    url += `geom=${encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))}`;
  } else if (insee_code) {
    url += `code_insee=${insee_code}`;
  } else {
    throw new Error('Must provide either lon/lat or insee_code');
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Zone-Urba API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.features || [];
}

/**
 * Fetch only documents from document API
 */
export async function fetchDocuments(insee_code: string): Promise<CartoDocument[]> {
  const response = await fetch(
    `https://apicarto.ign.fr/api/gpu/document?code_insee=${insee_code}`
  );
  
  if (!response.ok) {
    throw new Error(`Document API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.features || [];
}

/**
 * Fetch documents with flexible parameters
 */
export async function fetchDocument(params: {
  insee_code: string;
}): Promise<CartoDocument[]> {
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
  
  if (typeof paramsOrCode === 'string') {
    insee_code = paramsOrCode;
  } else {
    insee_code = paramsOrCode.insee_code;
    lon = paramsOrCode.lon;
    lat = paramsOrCode.lat;
  }
  
  if (insee_code) {
    const response = await fetch(
      `https://apicarto.ign.fr/api/gpu/municipality?insee=${insee_code}`
    );
    
    if (!response.ok) {
      throw new Error(`Municipality API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.features?.[0] || null;
  } else if (lon !== undefined && lat !== undefined) {
    // Municipality API also supports geom parameter
    const response = await fetch(
      `https://apicarto.ign.fr/api/gpu/municipality?` +
      `geom=${encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))}`
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.features?.[0] || null;
  } else {
    throw new Error('Must provide either lon/lat or insee_code');
  }
}
