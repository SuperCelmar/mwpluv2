"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({
    projectsCount: 0,
    documentsCount: 0,
    starredProjectsCount: 0,
    conversationsCount: 0,
  });
  const [analytics, setAnalytics] = useState({
    messageCount: 0,
    totalCost: 0,
    totalTokens: 0,
    downloadsCount: 0,
    starsCount: 0,
    reviewsCount: 0,
    commandsCount: 0,
  });
  const [lastSignInAt, setLastSignInAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    pseudo: "",
    first_name: "",
    last_name: "",
    full_name: "",
    phone: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      router.push("/login");
      return;
    }
    setUser(authUser);
    // Get last_sign_in_at from auth user
    setLastSignInAt(authUser.last_sign_in_at || null);
    await loadProfileData(authUser.id);
  };

  const loadProfileData = async (userId: string) => {
    setLoading(true);
    try {
      const [profileResult, statsResult, analyticsResult] = await Promise.all([
        getUserProfile(userId),
        getUserStatistics(userId),
        getUserAnalytics(userId),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (profileResult.profile) {
        setProfile(profileResult.profile);
        setFormData({
          pseudo: profileResult.profile.pseudo || "",
          first_name: profileResult.profile.first_name || "",
          last_name: profileResult.profile.last_name || "",
          full_name: profileResult.profile.full_name || "",
          phone: profileResult.profile.phone || "",
        });
      }

      if (statsResult.error) {
        console.error("Error loading statistics:", statsResult.error);
      } else {
        setStats({
          projectsCount: statsResult.projectsCount,
          documentsCount: statsResult.documentsCount,
          starredProjectsCount: statsResult.starredProjectsCount,
          conversationsCount: statsResult.conversationsCount,
        });
      }

      if (analyticsResult.error) {
        console.error("Error loading analytics:", analyticsResult.error);
      } else {
        setAnalytics({
          messageCount: analyticsResult.messageCount,
          totalCost: analyticsResult.totalCost,
          totalTokens: analyticsResult.totalTokens,
          downloadsCount: analyticsResult.downloadsCount,
          starsCount: analyticsResult.starsCount,
          reviewsCount: analyticsResult.reviewsCount,
          commandsCount: analyticsResult.commandsCount,
        });
      }

    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données du profil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setSaving(true);
    try {
      // Update profile
      const profileUpdates: any = {
        pseudo: formData.pseudo || null,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        full_name: formData.full_name || null,
        phone: formData.phone || null,
      };

      const { profile: updatedProfile, error: profileError } = await updateUserProfile(
        user.id,
        profileUpdates
      );

      if (profileError) {
        throw profileError;
      }

      if (updatedProfile) setProfile(updatedProfile);

      setEditing(false);
      toast({
        title: "Succès",
        description: "Profil mis à jour avec succès",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les modifications",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
    if (profile) {
      setProfile({ ...profile, avatar_url: newAvatarUrl });
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

  if (!user || !profile) {
    return null;
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
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  <X className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
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
