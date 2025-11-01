'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { InitialAddressInput } from '@/components/InitialAddressInput';
import { AddressSuggestion } from '@/lib/address-api';

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
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: addressLabel,
          address: addressLabel,
          municipality: address.properties.city,
          gps_coordinates: address.geometry?.coordinates || null,
          insee_code: address.properties.citycode || null,
          document_loaded: false,
          map_loaded: false,
          artifacts_ready: false,
        })
        .select()
        .maybeSingle();

      if (projectError || !project) {
        console.error('Error creating project:', projectError);
        setSendingMessage(false);
        return;
      }

      router.push(`/chat/${project.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
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
