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
    return [];
  }

  try {
    const response = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch addresses');
    }

    const data: AddressResult = await response.json();
    return data.features || [];
  } catch (error) {
    console.error('Error searching address:', error);
    return [];
  }
}
