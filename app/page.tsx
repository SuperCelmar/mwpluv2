'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { InitialAddressInput } from '@/components/InitialAddressInput';
import { AddressSuggestion } from '@/lib/address-api';
import { fetchCartoAPIs } from '@/lib/carto-api';
import { enrichResearchWithGeoData } from '@/lib/geo-enrichment';

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
    if (!userId) return;

    setSendingMessage(true);
    const addressLabel = address.properties.label;

    try {
      // 1. Save to v2_research_history
      const { data: research, error: historyError } = await supabase
        .from('v2_research_history')
        .insert({
          user_id: userId,
          address_input: addressLabel,
          geo_lon: address.geometry?.coordinates?.[0] || null,
          geo_lat: address.geometry?.coordinates?.[1] || null,
          success: true,
        })
        .select()
        .single();

      if (historyError || !research) {
        console.error('Error saving research history:', historyError);
        setSendingMessage(false);
        return;
      }

      // 2. Call Carto APIs immediately
      const cartoData = await fetchCartoAPIs({
        lon: address.geometry?.coordinates?.[0] || 0,
        lat: address.geometry?.coordinates?.[1] || 0,
        insee_code: address.properties.citycode || '',
      });

      // 3. Enrich research_history with zone/document info
      await enrichResearchWithGeoData(
        research.id,
        cartoData
      );

      // For now, we don't have document creation logic yet
      // Documents from Carto API would need to be inserted into documents table first
      const documentIds: string[] = [];

      // 4. Create project (draft, unnamed)
      const { data: project, error: projectError } = await supabase
        .from('v2_projects')
        .insert({
          user_id: userId,
          status: 'draft',
          main_address: addressLabel,
          geo_lon: address.geometry?.coordinates?.[0] || null,
          geo_lat: address.geometry?.coordinates?.[1] || null,
        })
        .select()
        .single();

      if (projectError || !project) {
        console.error('Error creating project:', projectError);
        setSendingMessage(false);
        return;
      }

      // 5. Create conversation
      const defaultTitle = `${address.properties.city}_${address.properties.name}`;
      const { data: conversation, error: conversationError } = await supabase
        .from('v2_conversations')
        .insert({
          user_id: userId,
          project_id: project.id,
          conversation_type: 'address_analysis',
          title: defaultTitle,
          context_metadata: {
            initial_address: addressLabel,
            geocoded: {
              lon: address.geometry?.coordinates?.[0] || null,
              lat: address.geometry?.coordinates?.[1] || null,
            },
            city: address.properties.city,
            insee_code: address.properties.citycode,
          },
          is_active: true,
        })
        .select()
        .single();

      if (conversationError || !conversation) {
        console.error('Error creating conversation:', conversationError);
        setSendingMessage(false);
        return;
      }

      // 6. Update research with conversation and project IDs
      await supabase
        .from('v2_research_history')
        .update({
          conversation_id: conversation.id,
          project_id: project.id,
        })
        .eq('id', research.id);

      // 7. Link documents to conversation (if found by Carto)
      if (documentIds.length > 0) {
        await supabase.from('v2_conversation_documents').insert(
          documentIds.map((docId) => ({
            conversation_id: conversation.id,
            document_id: docId,
            added_by: 'address_search',
          }))
        );
      }

      // 8. Navigate to chat
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
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

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <div className="flex-1 flex items-center justify-center">
        <InitialAddressInput
          onAddressSubmit={handleAddressSubmit}
          disabled={sendingMessage}
        />
      </div>
    </div>
  );
}
