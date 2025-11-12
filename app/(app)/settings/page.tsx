"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings as SettingsIcon, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    setMounted(true);
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
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
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-6 w-6 text-neutral-500 dark:text-neutral-400" />
              <div>
                <CardTitle className="text-2xl">Paramètres</CardTitle>
                <CardDescription>Gérez vos préférences d'application</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium mb-4 block">Thème</Label>
                <div className="flex items-center gap-0 bg-secondary rounded-lg p-1 w-fit">
                  <button
                    onClick={() => setTheme('light')}
                    className={cn(
                      "flex items-center justify-center h-10 w-10 rounded-md transition-all",
                      mounted && theme === 'light'
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Light mode"
                  >
                    <Sun className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={cn(
                      "flex items-center justify-center h-10 w-10 rounded-md transition-all",
                      mounted && theme === 'dark'
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Dark mode"
                  >
                    <Moon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={cn(
                      "flex items-center justify-center h-10 w-10 rounded-md transition-all",
                      mounted && theme === 'system'
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="System theme"
                  >
                    <Monitor className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

