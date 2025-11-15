'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  checkDuplicateByCoordinates,
  type DuplicateCheckResult,
} from '@/lib/supabase';
import { PromptInputBox } from '@/components/ui/ai-prompt-box';
import { AddressSuggestion, searchAddress } from '@/lib/address-api';
import {
  prefetchConversationForRedirect,
} from '@/lib/supabase/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/hooks/use-toast';
import {
  buildDuplicateHintMessage,
  formatBranchBadge,
  type DuplicateHintMessage,
} from '@/lib/utils/branchMetadata';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [duplicateHintMessage, setDuplicateHintMessage] = useState<DuplicateHintMessage | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateRedirecting, setDuplicateRedirecting] = useState(false);

  // Fetch user authentication using React Query
  const { data: user, isLoading: loading } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return null;
      }
      return user;
    },
    retry: false,
  });

  const userId = user?.id || null;

  // Debounce address query for search
  const debouncedAddressQuery = useDebounce(addressQuery, 300);

  // Fetch address suggestions using React Query
  const { data: addressSuggestions = [] } = useQuery({
    queryKey: ['address-search', debouncedAddressQuery],
    queryFn: () => searchAddress(debouncedAddressQuery),
    enabled: debouncedAddressQuery.length >= 3 && !selectedAddress,
  });

  const showAddressSuggestions = debouncedAddressQuery.length >= 3 && !selectedAddress && addressSuggestions.length > 0;

  const resetDuplicateState = useCallback(() => {
    setDuplicateResult(null);
    setDuplicateHintMessage(null);
  }, []);

  const updateDuplicateHintFromResult = useCallback(
    (addressLabel: string, result: DuplicateCheckResult) => {
      setDuplicateResult(result);
      if (result.exists && result.conversationId) {
        const hint = buildDuplicateHintMessage({
          addressLabel,
          branchType: result.branchType,
          hasAnalysis: result.hasAnalysis,
          isRnu: result.isRnu,
          zoneName: result.documentMetadata?.zone_name ?? result.documentMetadata?.zone_code,
          documentTitle: result.documentMetadata?.document_title ?? undefined,
          lastUpdatedAt: result.lastMessageAt ?? undefined,
        });
        setDuplicateHintMessage(hint);
      }
    },
    []
  );

  const handleAddressInputChange = (value: string) => {
    setAddressQuery(value);
    setSelectedAddress(null);
    resetDuplicateState();
  };

  const handleAddressSelect = (address: AddressSuggestion) => {
    setSelectedAddress(address);
    setAddressQuery(address.properties.label);
    if (!userId) return;
    const lon = address.geometry?.coordinates?.[0];
    const lat = address.geometry?.coordinates?.[1];
    if (lon === undefined || lat === undefined) {
      resetDuplicateState();
      return;
    }
    setCheckingDuplicate(true);
    checkDuplicateByCoordinates(lon, lat, userId)
      .then((result) => {
        if (result.exists && result.conversationId) {
          updateDuplicateHintFromResult(address.properties.label, result);
        } else {
          resetDuplicateState();
        }
      })
      .catch((error) => {
        console.error('[DUPLICATE_CHECK] Prefetch error:', error);
        resetDuplicateState();
      })
      .finally(() => setCheckingDuplicate(false));
  };

  const branchBadgeLabel = useMemo(() => {
    if (!duplicateResult) {
      return null;
    }
    return formatBranchBadge({
      branchType: duplicateResult.branchType,
      hasAnalysis: duplicateResult.hasAnalysis,
      isRnu: duplicateResult.isRnu,
    });
  }, [duplicateResult]);

  const duplicateMetadataRows = useMemo(() => {
    if (!duplicateResult?.documentMetadata) {
      return [];
    }

    const { documentMetadata } = duplicateResult;
    const rows: Array<{ label: string; value: string }> = [];

    if (documentMetadata.zone_name || documentMetadata.zone_code) {
      rows.push({
        label: 'Zone',
        value: documentMetadata.zone_name || documentMetadata.zone_code,
      });
    }

    if (documentMetadata.document_title) {
      rows.push({
        label: 'Document',
        value: documentMetadata.document_title,
      });
    }

    if (documentMetadata.city_name) {
      rows.push({
        label: 'Commune',
        value: documentMetadata.city_name,
      });
    }

    return rows;
  }, [duplicateResult]);

  const navigateToConversation = useCallback(
    async (conversationId: string) => {
      if (!conversationId) {
        return;
      }

      try {
        if (userId) {
          setDuplicateRedirecting(true);
          await prefetchConversationForRedirect({
            queryClient,
            conversationId,
            userId,
          });
        }
      } catch (prefetchError) {
        console.error('[HOME] Failed to prefetch conversation before redirect:', prefetchError);
      } finally {
        setDuplicateRedirecting(false);
      }

      router.push(`/chat/${conversationId}`);
    },
    [queryClient, router, userId]
  );

  const duplicateConversationId = duplicateResult?.conversationId || null;

  const handleDuplicateNavigation = useCallback(async () => {
    if (!duplicateConversationId) {
      return;
    }
    setSendingMessage(true);
    try {
      await navigateToConversation(duplicateConversationId);
    } finally {
      setSendingMessage(false);
    }
  }, [duplicateConversationId, navigateToConversation]);

  const handleAddressSubmit = async (address: AddressSuggestion) => {
    console.log('[ADDRESS_SUBMIT_HANDLER] Address submit handler called with address:', {
      label: address.properties.label,
      city: address.properties.city,
      citycode: address.properties.citycode,
      coordinates: address.geometry?.coordinates,
    });

    if (!userId) {
      console.error('[ADDRESS_SUBMIT_HANDLER] Error: User ID validation failed - no userId');
      return;
    }

    console.log('[ADDRESS_SUBMIT_HANDLER] User ID validated:', userId);
    setSendingMessage(true);
    const addressLabel = address.properties.label;
    const inseeCode = address.properties.citycode;
    const lon = address.geometry?.coordinates?.[0];
    const lat = address.geometry?.coordinates?.[1];

    try {
      // Step 1: Check for duplicate by coordinates (fast - keeps existing behavior)
      if (lon !== undefined && lat !== undefined) {
        console.log('[DUPLICATE_CHECK] Checking for duplicate by coordinates');
        
        let duplicateCheck = duplicateResult;

        if (!duplicateCheck) {
          duplicateCheck = await checkDuplicateByCoordinates(lon, lat, userId);
          if (duplicateCheck.exists && duplicateCheck.conversationId) {
            updateDuplicateHintFromResult(addressLabel, duplicateCheck);
          }
        }
        
        if (duplicateCheck?.exists && duplicateCheck.conversationId) {
          console.log('[DUPLICATE_CHECK] Duplicate detected, conversation_id:', duplicateCheck.conversationId);
          
          toast({
            title: 'Analyse existante trouvée',
            description: 'Chargement de la conversation sauvegardée…',
            duration: 3000,
          });

          await navigateToConversation(duplicateCheck!.conversationId!);
          return;
        }
        
        console.log('[DUPLICATE_CHECK] No duplicate found, creating new conversation');
      }

      // Step 2: Navigate to transition page (conversation and project will be created there)
      console.log('[NAVIGATION] Navigating to transition page');
      resetDuplicateState();
      
      // Build URL with address data as query params
      const transitionUrl = new URL('/chat/new', window.location.origin);
      transitionUrl.searchParams.set('address', addressLabel);
      transitionUrl.searchParams.set('lon', lon!.toString());
      transitionUrl.searchParams.set('lat', lat!.toString());
      if (inseeCode) {
        transitionUrl.searchParams.set('inseeCode', inseeCode);
      }
      if (address.properties.city) {
        transitionUrl.searchParams.set('city', address.properties.city);
      }
      
      router.push(transitionUrl.pathname + transitionUrl.search);
    } catch (error) {
      console.error('[ERROR] Error in address submit handler:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la conversation. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setSendingMessage(false);
    }
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  const handleNewConversation = () => {
    // Already on home page, no action needed
  };

  const handleSend = async (message: string, files?: File[]) => {
    // If we have a selected address, use it
    if (selectedAddress) {
      await handleAddressSubmit(selectedAddress);
      return;
    }

    // Otherwise, try to find address from message or search for it
    if (message.trim().length >= 3) {
      const results = await searchAddress(message.trim());
      if (results.length > 0) {
        // Auto-select first result if it's a clear address match
        await handleAddressSubmit(results[0]);
        return;
      }
    }

    // If no address found, show error
    toast({
      title: 'Adresse requise',
      description: 'Veuillez sélectionner une adresse valide pour commencer.',
      variant: 'destructive',
    });
  };

  return (
    <div className="flex items-center justify-center pt-36 p-4">
      <div className="w-full max-w-2xl">
        <PromptInputBox
          onSend={handleSend}
          isLoading={sendingMessage}
          placeholder="Entrez l'adresse de votre projet..."
          enableAddressAutocomplete={true}
          onAddressSelect={handleAddressSelect}
          addressSuggestions={addressSuggestions}
          showAddressSuggestions={showAddressSuggestions}
          onAddressInputChange={handleAddressInputChange}
        />
        {duplicateResult?.exists && duplicateHintMessage && (
          <div
            data-testid="duplicate-hint"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold">{duplicateHintMessage.title}</div>
                {branchBadgeLabel && (
                  <Badge
                    data-testid="duplicate-branch-badge"
                    variant="outline"
                    className="border-amber-300 bg-amber-100 text-amber-900"
                  >
                    {branchBadgeLabel}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-amber-800">{duplicateHintMessage.subtitle}</div>
            </div>

            {(duplicateResult.projectName || duplicateMetadataRows.length > 0) && (
              <dl className="mt-3 space-y-1 text-xs text-amber-900">
                {duplicateResult.projectName && (
                  <div className="flex gap-2">
                    <dt className="font-semibold">Projet</dt>
                    <dd>{duplicateResult.projectName}</dd>
                  </div>
                )}
                {duplicateMetadataRows.map((row) => (
                  <div key={`${row.label}-${row.value}`} className="flex gap-2">
                    <dt className="font-semibold">{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                  duplicateRedirecting || sendingMessage
                    ? 'bg-amber-400 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-700'
                )}
                onClick={handleDuplicateNavigation}
                disabled={!duplicateConversationId || duplicateRedirecting || sendingMessage}
              >
                {duplicateRedirecting ? 'Chargement…' : 'Ouvrir la conversation'}
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-amber-800 underline-offset-2 hover:underline"
                onClick={() => {
                  setSelectedAddress(null);
                  setAddressQuery('');
                  resetDuplicateState();
                }}
              >
                Choisir une autre adresse
              </button>
              {checkingDuplicate && (
                <span className="text-xs text-amber-700">Vérification en cours…</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

