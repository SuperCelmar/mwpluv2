export interface AddressSuggestion {
  properties: {
    label: string;
    name: string;
    city: string;
    postcode: string;
    context: string;
    x: number;
    y: number;
    citycode?: string;
  };
  geometry?: {
    type: string;
    coordinates: [number, number];
  };
}

export interface AddressResult {
  features: AddressSuggestion[];
}

export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  if (!query || query.length < 3) {
    console.log('[API_CALL] Address search skipped - query too short:', query.length, 'characters');
    return [];
  }

  const apiUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`;
  console.log('[API_CALL] Starting address search API request');
  console.log('[API_CALL] Address search API URL:', apiUrl);
  console.log('[API_CALL] Address search query:', query);

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('[API_CALL] Address search API returned error status:', response.status);
      throw new Error('Failed to fetch addresses');
    }

    console.log('[API_CALL] Address search API response received, status:', response.status);
    const data: AddressResult = await response.json();
    const results = data.features || [];
    console.log('[API_CALL] Address search API response parsed, results count:', results.length);
    
    if (results.length > 0) {
      console.log('[API_CALL] Address search results:', results.map(r => ({
        label: r.properties.label,
        city: r.properties.city,
        citycode: r.properties.citycode,
      })));
    }
    
    return results;
  } catch (error) {
    console.error('[API_CALL] Error searching address:', error);
    return [];
  }
}
