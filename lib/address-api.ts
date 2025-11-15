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
    // if query too short, return empty array
    return [];
  }

  const apiUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`;


    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('[API_CALL] Address search API returned error status:', response.status);
      throw new Error('Failed to fetch addresses');
    }

    const data: AddressResult = await response.json();
    const results = data.features || [];
    return results;
}
