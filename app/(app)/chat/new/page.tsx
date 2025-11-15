'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTheme } from 'next-themes';
import { createLightweightConversationWithProject, createInitialResearchHistoryEntry } from '@/lib/supabase/queries';
import { toast } from '@/hooks/use-toast';

export default function NewConversationTransitionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const hasCreatedRef = useRef(false);

  // Get address data from URL params
  const addressLabel = searchParams.get('address');
  const addressLon = searchParams.get('lon');
  const addressLat = searchParams.get('lat');
  const addressInseeCode = searchParams.get('inseeCode');
  const addressCity = searchParams.get('city');

  // Fetch user authentication
  const { data: user } = useQuery({
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

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine theme-aware logo path
  const logoSrc = resolvedTheme === 'dark' 
    ? '/square-white-plu.svg' 
    : '/square-black-plu.svg';

  // Create conversation and project, then navigate
  useEffect(() => {
    if (!user || !addressLabel || !addressLon || !addressLat || isCreating || hasCreatedRef.current) {
      return;
    }

    const createAndNavigate = async () => {
      setIsCreating(true);
      hasCreatedRef.current = true;
      
      try {
        const lon = parseFloat(addressLon);
        const lat = parseFloat(addressLat);
        
        if (isNaN(lon) || isNaN(lat)) {
          throw new Error('Invalid coordinates');
        }

        console.log('[TRANSITION_PAGE] Creating conversation and project');
        
        // Create lightweight conversation and project
        const { conversationId, projectId } = await createLightweightConversationWithProject(
          user.id,
          addressLabel,
          { lon, lat },
          addressInseeCode || undefined,
          addressCity || undefined
        );

        console.log('[TRANSITION_PAGE] Conversation and project created:', { conversationId, projectId });

        // Create initial research history entry
        await createInitialResearchHistoryEntry({
          userId: user.id,
          conversationId,
          addressInput: addressLabel,
          coordinates: { lon, lat },
          projectId,
        });

        console.log('[TRANSITION_PAGE] Navigating to chat page:', `/chat/${conversationId}`);
        
        // Navigate to the actual chat page
        router.push(`/chat/${conversationId}`);
      } catch (error) {
        console.error('[TRANSITION_PAGE] Error creating conversation:', error);
        hasCreatedRef.current = false; // Reset on error so user can retry
        toast({
          title: 'Erreur',
          description: 'Impossible de créer la conversation. Veuillez réessayer.',
          variant: 'destructive',
        });
        // Redirect back to home on error
        router.push('/');
      } finally {
        setIsCreating(false);
      }
    };

    createAndNavigate();
  }, [user, addressLabel, addressLon, addressLat, addressInseeCode, addressCity, router]);

  // Validate required params
  if (!addressLabel || !addressLon || !addressLat) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Données d'adresse manquantes. Redirection...</div>
      </div>
    );
  }

  return (
    <>
      {/* Empty breadcrumb header (skeleton) */}
      <div className="border-b bg-white dark:bg-neutral-900 px-4 py-3">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>

      {/* Chat messages column */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ScrollArea className="flex-1 p-2 sm:p-4">
          <div className="space-y-1 sm:space-y-2 max-w-4xl mx-auto pb-24">
            {/* User message with address */}
            <ChatMessageBubble 
              role="user"
              content={addressLabel}
              userId={user?.id || null}
            />

            {/* Assistant avatar (no message, just icon) */}
            <div className="flex gap-2 px-3 py-2 sm:px-4 sm:py-2.5 justify-start">
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                {mounted && (
                  <img
                    src={logoSrc}
                    alt="MWPLU Logo"
                    className="h-full w-full rounded-full object-contain p-1"
                  />
                )}
                <AvatarFallback className="bg-blue-50 text-blue-700 transition-all duration-200">
                  <div className="h-full w-full flex items-center justify-center">
                    {mounted ? (
                      <img
                        src={logoSrc}
                        alt="MWPLU Logo"
                        className="h-5 w-5 object-contain"
                      />
                    ) : (
                      <div className="h-4 w-4 bg-blue-600 rounded" />
                    )}
                  </div>
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

