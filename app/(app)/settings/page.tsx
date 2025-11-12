"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings as SettingsIcon, Sun, Moon, Monitor, Lock, Bell, Eye, CreditCard, Plug, Info, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsSection, SettingsRow } from "@/components/settings/SettingsSection";
import { SessionsList } from "@/components/settings/SessionsList";
import { LoginHistoryTable } from "@/components/settings/LoginHistoryTable";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { DataExportDialog } from "@/components/settings/DataExportDialog";
import { getUserProfile } from "@/lib/supabase/queries-profile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  useEffect(() => {
    checkAuth();
    setMounted(true);
  }, []);

  const checkAuth = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      router.push("/login");
      return;
    }
    setUser(authUser);
    await loadSettings(authUser.id);
  };

  const loadSettings = async (userId: string) => {
    try {
      const { profile, error } = await getUserProfile(userId);
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le profil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.new !== passwordData.confirm) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.new.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.new,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Succès",
        description: "Mot de passe modifié avec succès",
      });

      setPasswordData({ current: "", new: "", confirm: "" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le mot de passe",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 w-full">
          <Skeleton className="h-32 w-full mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 w-full">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-6 w-6 text-neutral-500 dark:text-neutral-400" />
              <div>
                <CardTitle className="text-2xl">Paramètres</CardTitle>
                <CardDescription>Gérez vos préférences et votre compte</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="account" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="account" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <span className="hidden sm:inline">Compte</span>
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Notifications</span>
                </TabsTrigger>
                {/* Temporairement désactivé - Feature à venir
                <TabsTrigger value="preferences" className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Préférences</span>
                </TabsTrigger>
                <TabsTrigger value="privacy" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">Confidentialité</span>
                </TabsTrigger>
                */}
              </TabsList>

              {/* Account & Security Tab */}
              <TabsContent value="account" className="space-y-6">
                <SettingsSection
                  title="Changer le mot de passe"
                  description="Mettez à jour votre mot de passe pour sécuriser votre compte"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Mot de passe actuel</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={passwordData.current}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, current: e.target.value })
                        }
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nouveau mot de passe</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordData.new}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, new: e.target.value })
                        }
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwordData.confirm}
                        onChange={(e) =>
                          setPasswordData({ ...passwordData, confirm: e.target.value })
                        }
                        placeholder="••••••••"
                      />
                    </div>
                    <Button onClick={handlePasswordChange} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Modification...
                        </>
                      ) : (
                        "Modifier le mot de passe"
                      )}
                    </Button>
                  </div>
                </SettingsSection>

                <SettingsSection
                  title="Authentification à deux facteurs"
                  description="Ajoutez une couche de sécurité supplémentaire à votre compte"
                >
                  <SettingsRow
                    label="2FA"
                    description="L'authentification à deux facteurs sera disponible prochainement"
                  >
                    <Switch disabled />
                  </SettingsRow>
                </SettingsSection>

                <SessionsList />

                <LoginHistoryTable />

                <SettingsSection
                  title="Suppression du compte"
                  description="Supprimez définitivement votre compte et toutes vos données"
                >
                  {user && (
                    <DeleteAccountDialog userId={user.id}>
                      <Button variant="destructive">Supprimer mon compte</Button>
                    </DeleteAccountDialog>
                  )}
                </SettingsSection>
              </TabsContent>

              {/* App Preferences Tab - Temporairement désactivé - Feature à venir
              <TabsContent value="preferences" className="space-y-6">
                <SettingsSection
                  title="Thème"
                  description="Choisissez l'apparence de l'interface"
                >
                  <div className="flex items-center gap-0 bg-secondary rounded-lg p-1 w-fit">
                    <button
                      onClick={() => setTheme("light")}
                      className={cn(
                        "flex items-center justify-center h-10 w-10 rounded-md transition-all",
                        mounted && theme === "light"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Light mode"
                    >
                      <Sun className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "flex items-center justify-center h-10 w-10 rounded-md transition-all",
                        mounted && theme === "dark"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Dark mode"
                    >
                      <Moon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setTheme("system")}
                      className={cn(
                        "flex items-center justify-center h-10 w-10 rounded-md transition-all",
                        mounted && theme === "system"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="System theme"
                    >
                      <Monitor className="h-5 w-5" />
                    </button>
                  </div>
                </SettingsSection>

              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="space-y-6">
                <SettingsSection
                  title="Notifications"
                  description="Gérez vos notifications"
                >
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="text-4xl font-bold text-muted-foreground">Bientôt</div>
                    <p className="text-lg text-muted-foreground text-center max-w-md">
                      Les notifications seront disponibles prochainement.
                    </p>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      Vous pourrez bientôt gérer vos notifications par email et dans l'application.
                    </p>
                  </div>
                </SettingsSection>
              </TabsContent>

              {/* Privacy & Data Tab - Temporairement désactivé - Feature à venir
              <TabsContent value="privacy" className="space-y-6">
                <SettingsSection
                  title="Export de données"
                  description="Téléchargez une copie de toutes vos données au format JSON ou CSV"
                >
                  <div className="space-y-4">
                    {user && (
                      <DataExportDialog userId={user.id}>
                        <Button variant="outline" className="w-full sm:w-auto">
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger mes données
                        </Button>
                      </DataExportDialog>
                    )}
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-sm text-muted-foreground">
                        L'export inclut : votre profil, tous vos projets, conversations, messages et paramètres.
                        Les données sont exportées au format JSON (recommandé) ou CSV.
                      </p>
                    </div>
                  </div>
                </SettingsSection>


                <SettingsSection
                  title="Vos droits RGPD"
                  description="Informations sur vos droits et la protection de vos données personnelles"
                >
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4 space-y-3">
                      <h4 className="font-medium text-sm">Droits dont vous disposez :</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                        <li>
                          <strong>Droit d'accès :</strong> Vous pouvez accéder à toutes vos données via l'export de données ci-dessus
                        </li>
                        <li>
                          <strong>Droit de rectification :</strong> Vous pouvez modifier vos informations depuis la page Profil
                        </li>
                        <li>
                          <strong>Droit à l'effacement :</strong> Vous pouvez demander la suppression de votre compte dans l'onglet Compte & Sécurité
                        </li>
                        <li>
                          <strong>Droit à la portabilité :</strong> Vos données peuvent être exportées au format JSON ou CSV
                        </li>
                        <li>
                          <strong>Droit d'opposition :</strong> Vous pouvez désactiver les cookies et analytics ci-dessus
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        Vos données sont protégées conformément au Règlement Général sur la Protection des Données (RGPD).
                        Pour plus d'informations détaillées, consultez notre{" "}
                        <a href="#" className="text-primary hover:underline font-medium">
                          politique de confidentialité
                        </a>
                        {" "}et nos{" "}
                        <a href="#" className="text-primary hover:underline font-medium">
                          conditions générales d'utilisation
                        </a>
                        .
                      </p>
                      <p className="pt-2">
                        Pour toute question concernant vos données personnelles, contactez-nous à{" "}
                        <a href="mailto:privacy@mwplu.fr" className="text-primary hover:underline font-medium">
                          privacy@mwplu.fr
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                </SettingsSection>

                <SettingsSection
                  title="Sécurité des données"
                  description="Informations sur la sécurité et le stockage de vos données"
                >
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                      <p>
                        <strong className="text-foreground">Chiffrement :</strong> Toutes vos données sont chiffrées en transit (HTTPS) et au repos
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                      <p>
                        <strong className="text-foreground">Stockage sécurisé :</strong> Vos données sont stockées sur des serveurs sécurisés en Europe
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                      <p>
                        <strong className="text-foreground">Accès restreint :</strong> Seuls les membres autorisés de l'équipe peuvent accéder aux données, uniquement pour le support technique
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                      <p>
                        <strong className="text-foreground">Sauvegardes régulières :</strong> Vos données sont sauvegardées quotidiennement pour garantir leur disponibilité
                      </p>
                    </div>
                  </div>
                </SettingsSection>
              </TabsContent>
              */}
            </Tabs>

            {/* Additional sections as separate cards below tabs */}
            <div className="mt-6 space-y-6">
              {/* Billing & Subscription */}
              <SettingsSection
                title="Facturation & Abonnement"
                description="Gérez votre abonnement et vos méthodes de paiement"
              >
                <div className="space-y-4">
                  <SettingsRow label="Plan actuel" description="Votre plan d'abonnement actuel">
                    <Badge variant="outline">Gratuit</Badge>
                  </SettingsRow>
                  <p className="text-sm text-muted-foreground">
                    La gestion de l'abonnement sera disponible prochainement.
                  </p>
                </div>
              </SettingsSection>

              {/* Integrations */}
              <SettingsSection
                title="Intégrations"
                description="Connectez MWPLU à d'autres services"
              >
                <p className="text-sm text-muted-foreground">
                  Les intégrations seront disponibles prochainement.
                </p>
              </SettingsSection>

              {/* About & Legal */}
              <SettingsSection
                title="À propos & Légal"
                description="Informations sur l'application et liens légaux"
              >
                <div className="space-y-4">
                  <SettingsRow label="Version" description="Version actuelle de l'application">
                    <span className="text-sm">1.0.0</span>
                  </SettingsRow>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Liens légaux</p>
                    <div className="flex flex-col gap-2">
                      <a href="#" className="text-sm text-primary hover:underline">
                        Conditions générales d'utilisation
                      </a>
                      <a href="#" className="text-sm text-primary hover:underline">
                        Politique de confidentialité
                      </a>
                      <a href="#" className="text-sm text-primary hover:underline">
                        Conformité RGPD
                      </a>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Support</p>
                    <a href="mailto:support@mwplu.fr" className="text-sm text-primary hover:underline">
                      support@mwplu.fr
                    </a>
                  </div>
                </div>
              </SettingsSection>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
