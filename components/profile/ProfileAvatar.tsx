'use client';

import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProfileAvatarProps {
  userId: string;
  avatarUrl: string | null;
  email: string;
  onUpdate: (newAvatarUrl: string) => void;
  className?: string;
}

export function ProfileAvatar({
  userId,
  avatarUrl,
  email,
  onUpdate,
  className,
}: ProfileAvatarProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getInitials = (email: string): string => {
    return email.charAt(0).toUpperCase();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner une image valide',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erreur',
        description: 'L\'image ne doit pas dépasser 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        // If bucket doesn't exist, create a public URL from the file data
        // For now, we'll use a data URL approach or skip storage
        console.error('Upload error:', uploadError);
        toast({
          title: 'Erreur',
          description: 'Impossible de télécharger l\'image. Veuillez réessayer.',
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      onUpdate(publicUrl);
      toast({
        title: 'Succès',
        description: 'Avatar mis à jour avec succès',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue lors de la mise à jour de l\'avatar',
        variant: 'destructive',
      });
      setPreviewUrl(avatarUrl);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <Avatar className="h-24 w-24 border-2 border-neutral-200 dark:border-neutral-700">
        <AvatarImage src={previewUrl || undefined} alt="Avatar" />
        <AvatarFallback className="text-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
          {getInitials(email)}
        </AvatarFallback>
      </Avatar>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

