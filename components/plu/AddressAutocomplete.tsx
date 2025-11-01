'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { searchAddresses } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface AddressOption {
  id: string;
  label: string;
  street: string;
  postalCode: string;
  city: string;
}

interface AddressAutocompleteProps {
  onSelect: (address: AddressOption) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  onSelect,
  placeholder = 'Entrez votre adresse...',
  className,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      const results = searchAddresses(query);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (address: AddressOption) => {
    setQuery(address.label);
    setIsOpen(false);
    onSelect(address);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-48 px-16 text-base rounded-lg transition-all duration-150"
          style={{ border: '1px solid #E5E5E5', color: '#000000' }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#000000'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#E5E5E5'}
        />
        {isLoading && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2">
            <Loader2 className="h-20 w-20 animate-spin" style={{ color: '#999999' }} />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-8 rounded-lg max-h-[300px] overflow-y-auto animate-in fade-in-0 slide-in-from-top-1 duration-150"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E5E5',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
          }}
        >
          {suggestions.map((address, index) => (
            <button
              key={address.id}
              onClick={() => handleSelect(address)}
              className={cn(
                'w-full px-16 py-12 flex items-start gap-12 transition-colors duration-150 text-left'
              )}
              style={{
                backgroundColor: selectedIndex === index ? '#F5F5F5' : '#FFFFFF',
                borderBottom: '1px solid #F5F5F5',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F5F5F5'}
              onMouseLeave={(e) => {
                if (selectedIndex !== index) {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }
              }}
            >
              <MapPin className="h-20 w-20 flex-shrink-0 mt-2" style={{ color: '#999999' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: '#000000' }}>{address.street}</p>
                <p className="text-xs mt-2" style={{ color: '#666666' }}>
                  {address.postalCode} {address.city}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 3 && suggestions.length === 0 && !isLoading && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-8 rounded-lg px-16 py-32 text-center animate-in fade-in-0 slide-in-from-top-1 duration-150"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E5E5',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
          }}
        >
          <p className="text-sm" style={{ color: '#666666' }}>Aucune adresse trouvée</p>
        </div>
      )}
    </div>
  );
}
