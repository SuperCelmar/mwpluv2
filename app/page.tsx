'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, checkDuplicateByCoordinates } from '@/lib/supabase';
import { InitialAddressInput } from '@/components/InitialAddressInput';
import { AppSidebar } from '@/components/AppSidebar';
import { AddressSuggestion } from '@/lib/address-api';
import { createLightweightConversation } from '@/lib/supabase/queries';
import { toast } from '@/hooks/use-toast';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUserId(user.id);
    setLoading(false);
  };

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
        
        const duplicateCheck = await checkDuplicateByCoordinates(lon, lat, userId);
        
        if (duplicateCheck.exists && duplicateCheck.conversationId) {
          console.log('[DUPLICATE_CHECK] Duplicate detected, conversation_id:', duplicateCheck.conversationId);
          
          toast({
            title: 'Analyse existante trouvée',
            description: 'Vous avez déjà analysé cette adresse. Redirection...',
            duration: 3000,
          });
          
          setSendingMessage(false);
          
          setTimeout(() => {
            router.push(`/chat/${duplicateCheck.conversationId}`);
          }, 500);
          
          return;
        }
        
        console.log('[DUPLICATE_CHECK] No duplicate found, creating new conversation');
      }

      // Step 2: Create lightweight conversation (instant - no API calls, no DB enrichment)
      console.log('[LIGHTWEIGHT_CONV] Creating lightweight conversation');
      const { conversationId } = await createLightweightConversation(
        userId,
        addressLabel,
        { lon: lon!, lat: lat! },
        inseeCode,
        address.properties.city
      );

      console.log('[LIGHTWEIGHT_CONV] Conversation created, id:', conversationId);

      // Step 3: Navigate immediately (enrichment happens in background on chat page)
      console.log('[NAVIGATION] Navigating immediately to chat page:', `/chat/${conversationId}`);
      setSendingMessage(false);
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      console.error('[ERROR] Error in address submit handler:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la conversation. Veuillez réessayer.',
        variant: 'destructive',
      });
      setSendingMessage(false);
    }
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  const handleNewConversation = () => {
    // Already on home page, no action needed
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-neutral-900">
      <AppSidebar />
      <div className="flex-1 flex items-center justify-center">
        <InitialAddressInput
          onAddressSubmit={handleAddressSubmit}
          disabled={sendingMessage}
        />
      </div>
    </div>
  );
}
