"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Mail, Calendar } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUser(user);
    setLoading(false);
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
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">Profil</CardTitle>
                <CardDescription>Informations de votre compte</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Nom d'utilisateur</p>
                  <p className="text-base text-neutral-900 dark:text-neutral-100">
                    {user?.email?.split('@')[0] || 'Utilisateur'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Email</p>
                  <p className="text-base text-neutral-900 dark:text-neutral-100">{user?.email || 'N/A'}</p>
                </div>
              </div>
              {user?.created_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                  <div>
                    <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Membre depuis</p>
                    <p className="text-base text-neutral-900 dark:text-neutral-100">
                      {new Date(user.created_at).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

