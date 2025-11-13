"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { getUserProfile, updateUserProfile, getUserStatistics, getUserAnalytics } from "@/lib/supabase/queries-profile";
import {
  formatLastLogin,
  getAccountStatus,
  formatAccountStatus,
  getStatusBadgeColor,
} from "@/lib/utils/profile-helpers";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, Calendar, Save, X, Loader2 } from "lucide-react";
import type { Profile } from "@/lib/supabase";
import { clearCachedDisplayName, setCachedDisplayName, getDisplayNameFromProfile } from "@/lib/utils/profile-display-name";
import { setCachedAvatarUrl, getCachedAvatarUrl } from "@/lib/utils/profile-avatar";
import { getCachedProfile, setCachedProfile, clearCachedProfile } from "@/lib/utils/profile-cache";

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    pseudo: "",
    first_name: "",
    last_name: "",
    full_name: "",
    phone: "",
  });

  // Fetch user authentication using React Query
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return null;
      }
      return user;
    },
    retry: false,
  });

  const userId = user?.id;
  const lastSignInAt = user?.last_sign_in_at || null;

  // Get cached profile for initial data
  const getInitialProfile = () => {
    if (!userId) return undefined;
    const cachedProfile = getCachedProfile(userId);
    if (cachedProfile) {
      // Check if avatar_url is missing but exists in avatar cache
      let profileToUse = { ...cachedProfile };
      if (!profileToUse.avatar_url) {
        const cachedAvatarUrl = getCachedAvatarUrl(userId);
        if (cachedAvatarUrl) {
          profileToUse.avatar_url = cachedAvatarUrl;
          setCachedProfile(userId, profileToUse);
        }
      }
      return profileToUse;
    }
    return undefined;
  };

  // Fetch profile using React Query
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { profile, error } = await getUserProfile(userId);
      if (error) throw error;

      if (!profile) {
        clearCachedProfile();
        return null;
      }

      // If avatar_url is null in database, check localStorage cache
      let profileToUse = { ...profile };
      if (!profileToUse.avatar_url) {
        const cachedAvatarUrl = getCachedAvatarUrl(userId);
        if (cachedAvatarUrl) {
          profileToUse.avatar_url = cachedAvatarUrl;
          // Try to update database with cached avatar URL (background)
          updateUserProfile(userId, { avatar_url: cachedAvatarUrl }).catch((error) => {
            console.warn("Failed to sync cached avatar URL to database:", error);
          });
        }
      }

      // Cache the profile in localStorage
      setCachedProfile(userId, profileToUse);
      return profileToUse;
    },
    enabled: !!userId,
    initialData: getInitialProfile,
    onSuccess: (data) => {
      if (data) {
        setFormData({
          pseudo: data.pseudo || "",
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          full_name: data.full_name || "",
          phone: data.phone || "",
        });
      }
    },
  });

  // Fetch statistics using React Query
  const { data: stats = {
    projectsCount: 0,
    documentsCount: 0,
    starredProjectsCount: 0,
    conversationsCount: 0,
  } } = useQuery({
    queryKey: ['profile-stats', userId],
    queryFn: async () => {
      if (!userId) return null;
      const result = await getUserStatistics(userId);
      if (result.error) throw result.error;
      return {
        projectsCount: result.projectsCount,
        documentsCount: result.documentsCount,
        starredProjectsCount: result.starredProjectsCount,
        conversationsCount: result.conversationsCount,
      };
    },
    enabled: !!userId,
  });

  // Fetch analytics using React Query
  const { data: analytics = {
    messageCount: 0,
    totalCost: 0,
    totalTokens: 0,
    downloadsCount: 0,
    starsCount: 0,
    reviewsCount: 0,
    commandsCount: 0,
  } } = useQuery({
    queryKey: ['profile-analytics', userId],
    queryFn: async () => {
      if (!userId) return null;
      const result = await getUserAnalytics(userId);
      if (result.error) throw result.error;
      return {
        messageCount: result.messageCount,
        totalCost: result.totalCost,
        totalTokens: result.totalTokens,
        downloadsCount: result.downloadsCount,
        starsCount: result.starsCount,
        reviewsCount: result.reviewsCount,
        commandsCount: result.commandsCount,
      };
    },
    enabled: !!userId,
  });

  const loading = profileLoading;

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!userId) throw new Error('User not authenticated');
      const { profile: updatedProfile, error } = await updateUserProfile(userId, updates);
      if (error) throw error;
      return updatedProfile;
    },
    onSuccess: (updatedProfile) => {
      if (updatedProfile && userId) {
        // Update cache with new profile
        setCachedProfile(userId, updatedProfile);
        // Update cache with new display name
        const newDisplayName = getDisplayNameFromProfile(updatedProfile);
        setCachedDisplayName(userId, newDisplayName || '');
        // Invalidate profile query to refresh
        queryClient.setQueryData(['profile', userId], updatedProfile);
        // Update form data
        setFormData({
          pseudo: updatedProfile.pseudo || "",
          first_name: updatedProfile.first_name || "",
          last_name: updatedProfile.last_name || "",
          full_name: updatedProfile.full_name || "",
          phone: updatedProfile.phone || "",
        });
      }
    },
  });

  const handleSave = async () => {
    if (!user || !profile) return;

    try {
      // Compare current formData with original profile to only update changed fields
      const profileUpdates: any = {};
      
      // Normalize values for comparison (empty string becomes null)
      const normalizeValue = (val: string | null | undefined) => val || null;
      const currentPseudo = normalizeValue(formData.pseudo);
      const currentFirstName = normalizeValue(formData.first_name);
      const currentLastName = normalizeValue(formData.last_name);
      const currentPhone = normalizeValue(formData.phone);
      
      const originalPseudo = normalizeValue(profile.pseudo);
      const originalFirstName = normalizeValue(profile.first_name);
      const originalLastName = normalizeValue(profile.last_name);
      const originalPhone = normalizeValue(profile.phone);
      
      // Only include fields that have changed
      if (currentPseudo !== originalPseudo) {
        profileUpdates.pseudo = currentPseudo;
      }
      if (currentFirstName !== originalFirstName) {
        profileUpdates.first_name = currentFirstName;
      }
      if (currentLastName !== originalLastName) {
        profileUpdates.last_name = currentLastName;
      }
      if (currentPhone !== originalPhone) {
        profileUpdates.phone = currentPhone;
      }
      
      // If no changes, show message and return early
      if (Object.keys(profileUpdates).length === 0) {
        setEditing(false);
        toast({
          title: "Aucune modification",
          description: "Aucun changement détecté",
        });
        return;
      }

      await updateProfileMutation.mutateAsync(profileUpdates);

      setEditing(false);
      toast({
        title: "Succès",
        description: "Profil mis à jour avec succès",
      });
    } catch (error: any) {
      console.error("Error saving profile:", error);
      const errorMessage = error?.message || error?.details || "Impossible de sauvegarder les modifications";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        pseudo: profile.pseudo || "",
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        full_name: profile.full_name || "",
        phone: profile.phone || "",
      });
    }
    setEditing(false);
  };

  const handleAvatarUpdate = (newAvatarUrl: string) => {
    if (profile && user && userId) {
      const updatedProfile = { ...profile, avatar_url: newAvatarUrl };
      // Update localStorage cache for avatar
      setCachedAvatarUrl(userId, newAvatarUrl);
      // Update full profile cache
      setCachedProfile(userId, updatedProfile);
      // Update React Query cache
      queryClient.setQueryData(['profile', userId], updatedProfile);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 w-full space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 w-full">
          <Card>
            <CardHeader>
              <CardTitle>Profil introuvable</CardTitle>
              <CardDescription>
                Votre profil n'a pas été trouvé dans la base de données.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Cela peut arriver si votre profil n'a pas été créé automatiquement lors de l'inscription.
                Veuillez rafraîchir la page ou contacter le support si le problème persiste.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const accountStatus = getAccountStatus(profile);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 w-full space-y-6">
        {/* Header Section */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <ProfileAvatar
                  userId={user.id}
                  avatarUrl={profile.avatar_url}
                  email={user.email || ""}
                  onUpdate={handleAvatarUpdate}
                />
                <div>
                  <CardTitle className="text-2xl">Profil</CardTitle>
                  <CardDescription>Informations de votre compte</CardDescription>
                </div>
              </div>
              {!editing && (
                <Button onClick={() => setEditing(true)} variant="outline">
                  Modifier
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Editable Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pseudo">Pseudo</Label>
                {editing ? (
                  <Input
                    id="pseudo"
                    value={formData.pseudo}
                    onChange={(e) => setFormData({ ...formData, pseudo: e.target.value })}
                    placeholder="Votre pseudo"
                  />
                ) : (
                  <p className="text-base text-neutral-900 dark:text-neutral-100">
                    {profile.pseudo || "Non défini"}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nom complet</Label>
                {editing ? (
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Votre nom complet"
                  />
                ) : (
                  <p className="text-base text-neutral-900 dark:text-neutral-100">
                    {profile.full_name || "Non défini"}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                {editing ? (
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+33 6 12 34 56 78"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    <p className="text-base text-neutral-900 dark:text-neutral-100">
                      {profile.phone || "Non défini"}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  <p className="text-base text-neutral-900 dark:text-neutral-100">
                    {user.email || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {editing && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel} disabled={updateProfileMutation.isPending}>
                  <X className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>Informations du compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Statut:</span>
                <Badge className={getStatusBadgeColor(accountStatus)}>
                  {formatAccountStatus(accountStatus)}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Membre depuis:</span>
              <span className="text-sm font-medium">
                {new Date(profile.created_at).toLocaleDateString("fr-FR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            {lastSignInAt && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Dernière visite:</span>
                <span className="text-sm font-medium">{formatLastLogin(lastSignInAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Statistiques</h2>
          <ProfileStats
            projectsCount={stats.projectsCount}
            documentsCount={stats.documentsCount}
            starredProjectsCount={stats.starredProjectsCount}
            loading={loading}
          />
        </div>

        {/* Usage Analytics Section */}
        <Card>
          <CardHeader>
            <CardTitle>Utilisation</CardTitle>
            <CardDescription>Votre activité et statistiques d'utilisation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Messages</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {analytics.messageCount.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Commandes</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {analytics.commandsCount.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Étoiles données</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {analytics.starsCount.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Avis donnés</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {analytics.reviewsCount.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Téléchargements</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {analytics.downloadsCount.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Tokens utilisés</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {analytics.totalTokens.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Coût total</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {analytics.totalCost > 0 ? `€${analytics.totalCost.toFixed(4)}` : '€0.0000'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
