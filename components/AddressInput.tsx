'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchAddress, AddressSuggestion } from '@/lib/address-api';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface AddressInputProps {
  onAddressSelect: (address: AddressSuggestion) => void;
  disabled?: boolean;
}

export function AddressInput({ onAddressSelect, disabled }: AddressInputProps) {
  const [query, setQuery] = useState('');
  
  // Debounce the query input
  const debouncedQuery = useDebounce(query, 300);
  
  // Fetch address suggestions using React Query
  const { data: suggestions = [], isLoading: loading } = useQuery({
    queryKey: ['address-search', debouncedQuery],
    queryFn: () => searchAddress(debouncedQuery),
    enabled: debouncedQuery.length >= 3,
  });
  
  const showSuggestions = debouncedQuery.length >= 3 && (suggestions.length > 0 || loading);

  const handleSelect = (suggestion: AddressSuggestion) => {
    setQuery('');
    onAddressSelect(suggestion);
  };

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Entrez l'adresse de votre projet..."
          disabled={disabled}
          className="pl-10 pr-10 h-12 text-base"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelect(suggestion)}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors',
                'border-b last:border-b-0 focus:outline-none focus:bg-gray-100'
              )}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {suggestion.properties.name}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {suggestion.properties.postcode} {suggestion.properties.city}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && suggestions.length === 0 && query.length >= 3 && !loading && (
        <div className="absolute z-50 w-full mt-2 bg-white border rounded-md shadow-lg p-4 text-center text-gray-500">
          Aucune adresse trouvée
        </div>
      )}
    </div>
  );
}
