'use client';

import { useState, useEffect } from 'react';
import { MapPin, Loader2, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchAddress, AddressSuggestion } from '@/lib/address-api';
import { cn } from '@/lib/utils';

interface InitialAddressInputProps {
  onAddressSubmit: (address: AddressSuggestion) => void;
  disabled?: boolean;
}

export function InitialAddressInput({ onAddressSubmit, disabled }: InitialAddressInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);

  useEffect(() => {
    if (selectedAddress) {
      return;
    }

    const timer = setTimeout(async () => {
      if (query.length >= 3) {
        setLoading(true);
        const results = await searchAddress(query);
        setSuggestions(results);
        setShowSuggestions(true);
        setLoading(false);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedAddress]);

  const handleSelect = (suggestion: AddressSuggestion) => {
    setQuery(suggestion.properties.label);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedAddress(suggestion);
  };

  const handleSubmit = () => {
    if (selectedAddress && !disabled) {
      onAddressSubmit(selectedAddress);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedAddress) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-2">
            <MapPin className="h-10 w-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Bienvenue sur MWPLU
          </h1>
          <p className="text-lg text-gray-600">
            Entrez l'adresse de votre projet pour commencer l'analyse du PLU
          </p>
        </div>

        <div className="relative">
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedAddress(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ex: 15 rue des Fustiers, Paris 75001"
              disabled={disabled}
              className="pl-12 pr-12 h-14 text-base shadow-sm"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin z-10" />
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white border rounded-lg shadow-xl max-h-80 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(suggestion)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                    'border-b last:border-b-0 focus:outline-none focus:bg-gray-50'
                  )}
                >
                  <div className="flex items-start gap-3">
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
            <div className="absolute z-50 w-full mt-2 bg-white border rounded-lg shadow-xl p-4 text-center text-gray-500">
              Aucune adresse trouvée
            </div>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={disabled || !selectedAddress}
          size="lg"
          className="w-full h-12 text-base"
        >
          <Send className="h-5 w-5 mr-2" />
          Commencer l'analyse
        </Button>
      </div>
    </div>
  );
}
